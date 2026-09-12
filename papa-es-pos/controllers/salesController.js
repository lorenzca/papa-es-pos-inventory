const salesModel = require('../models/salesModel');
const voidModel = require('../models/voidModel');
const auditModel = require('../models/auditModel');
const pricing = require('../public/js/pricing');
const pool = require('../config/db');

const PAYMENT_METHODS = ['CASH', 'GCASH', 'MAYA', 'CARD'];
const ORDER_TYPES = ['DINE_IN', 'TAKEOUT', 'DELIVERY'];
const DIGITAL_METHODS = ['GCASH', 'MAYA'];
const VOID_AUTHORIZER_ROLES = ['OWNER', 'MANAGER'];
const TREND_RANGES = ['day', 'week', 'month'];

// format or number like OR-000001
const formatOrNumber = (id) => `OR-${String(id).padStart(6, '0')}`;
// get today's date string in YYYY-MM-DD
const todayIsoDate = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const readDateParam = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : todayIsoDate());

// get prices and recipe ingredient costs for cart items in batch
async function loadPricedCart(conn, cart) {
  const ids = [...new Set(cart.map((c) => Number(c.menu_item_id)).filter(Boolean))];
  if (!ids.length) return { pricedItems: [], unitCostByMenuItem: new Map() };

  // fetch active menu prices and recipe unit costs in parallel
  const [[menuRows], [costRows]] = await Promise.all([
    conn.query('SELECT id, item_name, sell_price FROM menu_items WHERE id IN (?) AND is_active = 1', [ids]),
    conn.query(
      `SELECT r.menu_item_id, COALESCE(SUM(r.qty_required * i.unit_cost), 0) AS unit_cost
       FROM recipes r
       JOIN ingredients i ON i.id = r.ingredient_id
       WHERE r.menu_item_id IN (?)
       GROUP BY r.menu_item_id`,
      [ids]
    )
  ]);

  const menuMap = new Map(menuRows.map((m) => [m.id, m]));
  const unitCostByMenuItem = new Map(costRows.map((c) => [c.menu_item_id, Number(c.unit_cost) || 0]));

  // map cart items with verified prices
  const pricedItems = cart.map((item) => {
    const dish = menuMap.get(Number(item.menu_item_id));
    if (!dish) throw new Error(`Menu item not found or inactive: ${item.menu_item_id}`);
    return {
      menu_item_id: dish.id,
      item_name: dish.item_name,
      unit_price: Number(dish.sell_price),
      quantity: Math.max(1, Number(item.quantity || 1)),
      voided_qty: Math.max(0, Number(item.voided_qty || 0)),
      discount_type: item.discount_type || 'NONE',
      discount_value: Number(item.discount_value || 0)
    };
  });

  return { pricedItems, unitCostByMenuItem };
}

// show sales dashboard metrics and revenue trends
async function getDashboard(req, res) {
  const date = readDateParam(req.query.date);
  const range = TREND_RANGES.includes(req.query.range) ? req.query.range : 'week';
  let metrics = { revenue: 0, cogs: 0, grossProfit: 0, orderCount: 0 };
  let trend = [];
  let dataError = null;

  try {
    [metrics, trend] = await Promise.all([
      salesModel.getDashboardMetrics(date),
      salesModel.getRevenueTrend({ date, range })
    ]);
  } catch (error) {
    dataError = 'Could not read sales data for this date.';
  }

  res.render('dashboard', { user: req.session.user, date, range, metrics, trend, dataError });
}

// return revenue trend json for charts
async function getDashboardTrend(req, res) {
  const date = readDateParam(req.query.date);
  const range = TREND_RANGES.includes(req.query.range) ? req.query.range : 'week';
  try {
    const trend = await salesModel.getRevenueTrend({ date, range });
    return res.json({ range, date, trend });
  } catch (error) {
    return res.status(500).json({ message: 'Could not load the revenue trend.' });
  }
}

// render pos screen with active items and pending void count
async function getPOS(req, res) {
  const [items, pendingVoidCount] = await Promise.all([
    salesModel.getPOSItems(),
    voidModel.countPending()
  ]);
  res.render('pos', {
    user: req.session.user,
    items,
    canAuthorizeVoids: VOID_AUTHORIZER_ROLES.includes(req.session.user.role),
    pendingVoidCount
  });
}

// list currently open dine-in tables
async function getActiveTables(req, res) {
  try {
    const [tables] = await pool.execute(
      `SELECT s.id, s.or_number, s.table_number, s.total_amount, s.created_at, COUNT(si.id) AS item_count
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.status = 'OPEN'
       GROUP BY s.id
       ORDER BY s.created_at ASC`
    );
    return res.json({ tables });
  } catch (error) {
    return res.status(500).json({ message: 'Could not fetch active tables.' });
  }
}

// save an unpaid table tab to resume or pay later
async function holdOrder(req, res) {
  const { openSaleId, cart, tableNumber, orderType = 'DINE_IN', orderNote } = req.body;
  const cleanTable = String(tableNumber || '').trim();

  if (!cleanTable) return res.status(400).json({ message: 'Table number is required for dine-in tabs.' });
  if (!Array.isArray(cart) || !cart.length) return res.status(400).json({ message: 'Cart is empty.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let targetSaleId = openSaleId ? Number(openSaleId) : null;
    if (!targetSaleId) {
      const [[existing]] = await conn.execute(`SELECT id FROM sales WHERE table_number = ? AND status = 'OPEN' LIMIT 1`, [cleanTable]);
      if (existing) targetSaleId = existing.id;
    }

    const { pricedItems } = await loadPricedCart(conn, cart);
    const totals = pricing.computeOrder({ items: pricedItems, discountType: 'NONE', discountValue: 0 });

    const tabFields = {
      total_amount: totals.total_amount,
      discount_amount: 0,
      discount_type: 'NONE',
      discount_value: 0,
      payment_method: 'CASH',
      order_type: orderType,
      table_number: cleanTable,
      order_note: orderNote || null,
      cash_received: 0,
      change_amount: 0,
      status: 'OPEN'
    };

    if (targetSaleId) {
      await conn.query('UPDATE sales SET ? WHERE id = ? AND status = "OPEN"', [tabFields, targetSaleId]);
      await conn.execute('DELETE FROM sale_items WHERE sale_id = ?', [targetSaleId]);
    } else {
      const [inserted] = await conn.query(
        'INSERT INTO sales SET ?, or_number = ?, cashier_id = ?',
        [tabFields, `TAB-${Date.now()}`, req.session.user.id]
      );
      targetSaleId = inserted.insertId;
      await conn.execute('UPDATE sales SET or_number = ? WHERE id = ?', [`TAB-${String(targetSaleId).padStart(6, '0')}`, targetSaleId]);
    }

    // save ordered lines in batch matching database.sql
    const lineValues = totals.lines.map((l) => [
      targetSaleId,
      l.menu_item_id,
      Math.max(1, Number(l.quantity)),
      l.unit_price,
      l.line_total,
      0
    ]);
    await conn.query('INSERT INTO sale_items (sale_id, menu_item_id, quantity, unit_price, line_total, cost_amount) VALUES ?', [lineValues]);

    await auditModel.logAudit({
      connection: conn,
      userId: req.session.user.id,
      action: openSaleId ? 'TABLE_UPDATED' : 'TABLE_OPENED',
      entityType: 'SALE',
      entityId: targetSaleId,
      details: { table_number: cleanTable, subtotal: totals.subtotal_amount, item_count: cart.length }
    });

    await conn.commit();
    return res.json({ message: `Tab saved for ${cleanTable}.`, saleId: targetSaleId });
  } catch (error) {
    await conn.rollback();
    return res.status(400).json({ message: error.message || 'Failed to process table tab.' });
  } finally {
    conn.release();
  }
}

// complete transaction, calculate vat/change, and write audit trail
async function completeOrder(req, res) {
  const {
    openSaleId, tableNumber, cart, cashReceived,
    paymentMethod = 'CASH', paymentStatus = 'PAID', paymentRef,
    orderType = 'DINE_IN', orderNote, discountType = 'NONE', discountValue = 0
  } = req.body;

  if (!Array.isArray(cart) || !cart.length) return res.status(400).json({ message: 'Cart is empty.' });

  const method = String(paymentMethod).toUpperCase();
  const type = String(orderType).toUpperCase();
  if (!PAYMENT_METHODS.includes(method)) return res.status(400).json({ message: `Unsupported payment method: ${method}` });
  if (!ORDER_TYPES.includes(type)) return res.status(400).json({ message: `Unsupported order type: ${type}` });

  if (method !== 'CASH' && String(paymentStatus).toUpperCase() !== 'PAID') {
    const label = DIGITAL_METHODS.includes(method) ? 'the QR payment' : 'the card payment';
    return res.status(400).json({ message: `Confirm ${label} before completing this order.` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { pricedItems, unitCostByMenuItem } = await loadPricedCart(conn, cart);
    const totals = pricing.computeOrder({ items: pricedItems, discountType, discountValue });

    if (totals.active_line_count === 0) throw new Error('Every line in this order is voided — nothing left to charge.');

    const tender = pricing.changeFor(totals.total_amount, method === 'CASH' ? cashReceived : totals.total_amount);
    if (method === 'CASH' && !tender.settled) throw new Error(`Cash received is short by ₱${tender.short.toFixed(2)}.`);

    const saleFields = {
      cashier_id: req.session.user.id,
      table_number: tableNumber || null,
      total_amount: totals.total_amount,
      discount_amount: totals.discount_amount,
      discount_type: totals.order_discount_type || 'NONE',
      discount_value: totals.order_discount_value || 0,
      payment_method: method,
      order_type: type,
      order_note: orderNote || null,
      cash_received: tender.cash,
      change_amount: tender.change,
      status: 'COMPLETED'
    };

    let saleId = openSaleId ? Number(openSaleId) : null;
    let orNumber = '';

    if (saleId) {
      orNumber = formatOrNumber(saleId);
      await conn.query('UPDATE sales SET ?, or_number = ? WHERE id = ?', [saleFields, orNumber, saleId]);
      await conn.execute('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
    } else {
      const [inserted] = await conn.query('INSERT INTO sales SET ?', [saleFields]);
      saleId = inserted.insertId;
      orNumber = formatOrNumber(saleId);
      await conn.execute('UPDATE sales SET or_number = ? WHERE id = ?', [orNumber, saleId]);
    }

    // save sale items matching database.sql columns
    const itemValues = totals.lines.map((l) => {
      const unitCost = unitCostByMenuItem.get(l.menu_item_id) || 0;
      const chargeableQty = Math.max(0, Number(l.quantity) - Number(l.voided_qty));
      const costAmount = Math.round(unitCost * chargeableQty * 100) / 100;
      return [
        saleId,
        l.menu_item_id,
        chargeableQty,
        l.unit_price,
        l.line_total,
        costAmount
      ];
    });

    await conn.query(
      `INSERT INTO sale_items
         (sale_id, menu_item_id, quantity, unit_price, line_total, cost_amount)
       VALUES ?`,
      [itemValues]
    );

    // DEDUCT STOCK: Uses exact column `stock_qty` from `database.sql`
    for (const line of totals.lines) {
      const chargeableQty = Math.max(0, Number(line.quantity) - Number(line.voided_qty));
      if (chargeableQty <= 0) continue;

      await conn.execute(
        `UPDATE ingredients i
         JOIN recipes r ON r.ingredient_id = i.id
         SET i.stock_qty = GREATEST(0, i.stock_qty - (r.qty_required * ?))
         WHERE r.menu_item_id = ?`,
        [chargeableQty, line.menu_item_id]
      );
    }

    await auditModel.logAudit({
      connection: conn,
      userId: req.session.user.id,
      action: 'SALE_COMPLETED',
      entityType: 'SALE',
      entityId: saleId,
      details: { or_number: orNumber, table_number: tableNumber, total: totals.total_amount, payment_method: method }
    });

    await conn.commit();
    return res.json({
      message: 'Order completed successfully.',
      saleId,
      orNumber,
      totalAmount: totals.total_amount,
      change: tender.change,
      receiptUrl: `/receipt/${saleId}?autoprint=1`
    });
  } catch (error) {
    await conn.rollback();
    return res.status(400).json({ message: error.message || 'Failed to complete order.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  getDashboard,
  getDashboardTrend,
  getPOS,
  completeOrder,
  getActiveTables,
  holdOrder,
  VOID_AUTHORIZER_ROLES
};