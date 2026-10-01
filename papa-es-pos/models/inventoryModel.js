const pool = require('../config/db');

// Internal helper to check and save preset order guides without duplicates
async function ensureOrderGuide(conn, { guideName, supplierName, items }) {
  if (!guideName || !guideName.trim()) return null;
  const trimmed = guideName.trim();

  const [res] = await conn.execute(
    `INSERT INTO order_guides (guide_name, supplier_name) 
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), supplier_name = COALESCE(VALUES(supplier_name), supplier_name)`,
    [trimmed, supplierName || null]
  );

  const guideId = res.insertId;

  await conn.execute('DELETE FROM order_guide_items WHERE order_guide_id = ?', [guideId]);

  for (const it of items) {
    await conn.execute(
      `INSERT INTO order_guide_items (order_guide_id, ingredient_id, default_qty, default_unit_cost)
       VALUES (?, ?, ?, ?)`,
      [guideId, Number(it.ingredientId), Number(it.receivedQty) || 0, Number(it.unitCost) || 0]
    );
  }
  return guideId;
}

// Get all ingredients with low-stock pinned to the top, then alphabetically
async function getAllIngredients() {
  const [rows] = await pool.execute(
    `SELECT i.id, i.ingredient_name, i.unit_measure, i.stock_qty, i.reorder_level, i.unit_cost,
            COALESCE((SELECT AVG(unit_cost) FROM delivery_intake_items dii WHERE dii.ingredient_id = i.id), i.unit_cost) AS historical_avg
     FROM ingredients i 
     ORDER BY (i.stock_qty <= i.reorder_level) DESC, i.ingredient_name ASC`
  );
  return rows;
}

// Find one ingredient by id
async function getIngredientById(id) {
  const [[row]] = await pool.execute(
    'SELECT id, ingredient_name, unit_measure, stock_qty, unit_cost FROM ingredients WHERE id = ?',
    [Number(id)]
  );
  return row || null;
}

// Update stock count and save movement in one transaction
async function adjustStock({ ingredientId, qty, movementType, reason, userId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      'UPDATE ingredients SET stock_qty = stock_qty + ? WHERE id = ?',
      [qty, ingredientId]
    );

    await conn.execute(
      `INSERT INTO inventory_movements 
          (ingredient_id, movement_type, qty, reason, reference_type, reference_id, user_id)
        VALUES (?, ?, ?, ?, 'MANUAL', NULL, ?)`,
      [ingredientId, movementType, qty, reason, userId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Calculate ingredients used for sales on a specific date
async function getUsageByDate(date) {
  const [rows] = await pool.execute(
    `SELECT i.id AS ingredient_id, i.ingredient_name, i.unit_measure, i.stock_qty,
            ROUND(SUM((si.quantity - si.voided_qty) * r.qty_required), 4) AS used_qty,
            ROUND(SUM((si.quantity - si.voided_qty) * r.qty_required * i.unit_cost), 2) AS used_cost
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN recipes r ON r.menu_item_id = si.menu_item_id
     JOIN ingredients i ON i.id = r.ingredient_id
     WHERE DATE(s.created_at) = ? AND s.status = 'COMPLETED' AND (si.quantity - si.voided_qty) > 0
     GROUP BY i.id, i.ingredient_name, i.unit_measure, i.stock_qty
     ORDER BY used_qty DESC`,
    [date]
  );
  return rows;
}

// Get items that are running low or out of stock
async function getLowStock() {
  const [rows] = await pool.execute(
    `SELECT id, ingredient_name, unit_measure, stock_qty, reorder_level, unit_cost,
            CASE 
              WHEN stock_qty <= 0 THEN 'OUT'
              WHEN stock_qty <= reorder_level THEN 'LOW'
              ELSE 'OK'
            END AS status
     FROM ingredients
     WHERE stock_qty <= reorder_level
     ORDER BY (stock_qty - reorder_level) ASC, ingredient_name`
  );
  return rows;
}

// Fetch all saved order guides for dropdown
async function getAllOrderGuides() {
  const [rows] = await pool.execute(
    `SELECT og.id, og.guide_name, og.supplier_name
     FROM order_guides og
     GROUP BY og.guide_name
     ORDER BY og.guide_name ASC`
  );
  return rows;
}

// Fetch items for an order guide including par levels and historical costs
async function getOrderGuideItems(orderGuideId) {
  const [rows] = await pool.execute(
    `SELECT ogi.id, ogi.order_guide_id, ogi.ingredient_id, ogi.default_qty, ogi.default_unit_cost,
            i.ingredient_name, i.unit_measure, i.stock_qty, i.reorder_level, i.unit_cost AS current_unit_cost,
            COALESCE((SELECT AVG(unit_cost) FROM delivery_intake_items dii WHERE dii.ingredient_id = i.id), i.unit_cost) AS historical_avg
     FROM order_guide_items ogi
     JOIN ingredients i ON i.id = ogi.ingredient_id
     WHERE ogi.order_guide_id = ?
     ORDER BY i.ingredient_name ASC`,
    [Number(orderGuideId)]
  );
  return rows;
}

// Fetch pending deliveries awaiting receipt
async function getPendingOrders() {
  const [rows] = await pool.execute(
    `SELECT di.id, di.supplier_name, di.total_cost, di.status, di.expected_date, di.received_at AS created_at,
            COUNT(dii.id) AS item_count
     FROM delivery_intakes di
     LEFT JOIN delivery_intake_items dii ON dii.delivery_id = di.id
     WHERE di.status = 'PENDING'
     GROUP BY di.id
     ORDER BY di.received_at DESC`
  );
  return rows;
}

// Fetch completed delivery intake history with line item rollups
async function getIntakeHistory(limit = 50) {
  const [rows] = await pool.execute(
    `SELECT di.id, 
            di.supplier_name, 
            di.received_by, 
            di.total_cost, 
            di.status, 
            di.received_at,
            COUNT(dii.id) AS item_count,
            GROUP_CONCAT(CONCAT(i.ingredient_name, ' (', dii.received_qty, ' ', i.unit_measure, ')') SEPARATOR ', ') AS item_summary
     FROM delivery_intakes di
     LEFT JOIN delivery_intake_items dii ON dii.delivery_id = di.id
     LEFT JOIN ingredients i ON i.id = dii.ingredient_id
     WHERE di.status = 'RECEIVED'
     GROUP BY di.id
     ORDER BY di.received_at DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
}

// Fetch specific order details and line items
async function getOrderDetails(orderId) {
  const [[order]] = await pool.execute(
    `SELECT id, order_guide_id, supplier_name, total_cost, status, expected_date, received_at AS created_at
     FROM delivery_intakes WHERE id = ?`,
    [Number(orderId)]
  );
  if (!order) return null;

  const [items] = await pool.execute(
    `SELECT dii.id, dii.delivery_id, dii.ingredient_id, dii.received_qty, dii.unit_cost,
            i.ingredient_name, i.unit_measure, i.stock_qty, i.reorder_level, i.unit_cost AS current_cost,
            COALESCE((SELECT AVG(unit_cost) FROM delivery_intake_items past WHERE past.ingredient_id = i.id), i.unit_cost) AS historical_avg
     FROM delivery_intake_items dii
     JOIN ingredients i ON i.id = dii.ingredient_id
     WHERE dii.delivery_id = ?`,
    [Number(orderId)]
  );

  return { ...order, items };
}

// Create pending order without altering current stock
async function createPendingOrder({ orderGuideId, supplierName, expectedDate, receivedBy, saveAsNewGuide, newGuideName, items }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let effectiveGuideId = orderGuideId ? Number(orderGuideId) : null;

    if (saveAsNewGuide && newGuideName) {
      effectiveGuideId = await ensureOrderGuide(conn, { guideName: newGuideName, supplierName, items });
    }

    const totalCost = items.reduce((sum, it) => sum + (Number(it.receivedQty) || 0) * (Number(it.unitCost) || 0), 0);

    const [intakeRes] = await conn.execute(
      `INSERT INTO delivery_intakes (order_guide_id, supplier_name, received_by, total_cost, status, expected_date, received_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?, NOW())`,
      [effectiveGuideId, supplierName || 'Unspecified Vendor', receivedBy, totalCost, expectedDate || null]
    );
    const orderId = intakeRes.insertId;

    for (const it of items) {
      await conn.execute(
        `INSERT INTO delivery_intake_items (delivery_id, ingredient_id, received_qty, unit_cost)
         VALUES (?, ?, ?, ?)`,
        [orderId, Number(it.ingredientId), Number(it.receivedQty) || 0, Number(it.unitCost) || 0]
      );
    }

    await conn.commit();
    return { orderId, totalCost };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Receive existing order and post it to stock
async function receiveExistingOrder({ orderId, userId, items }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.execute(
      'SELECT id, supplier_name, status FROM delivery_intakes WHERE id = ? FOR UPDATE',
      [Number(orderId)]
    );

    if (!existing) throw new Error('Order not found.');
    if (existing.status === 'RECEIVED') throw new Error('Order is already received.');

    await conn.execute('DELETE FROM delivery_intake_items WHERE delivery_id = ?', [Number(orderId)]);

    let totalCost = 0;
    for (const it of items) {
      const ingredientId = Number(it.ingredientId);
      const qty = Number(it.receivedQty) || 0;
      const unitCost = Number(it.unitCost) || 0;

      if (!ingredientId || qty <= 0) continue;
      totalCost += qty * unitCost;

      await conn.execute(
        `INSERT INTO delivery_intake_items (delivery_id, ingredient_id, received_qty, unit_cost) VALUES (?, ?, ?, ?)`,
        [orderId, ingredientId, qty, unitCost]
      );

      await conn.execute(
        `UPDATE ingredients SET stock_qty = stock_qty + ?, unit_cost = CASE WHEN ? > 0 THEN ? ELSE unit_cost END WHERE id = ?`,
        [qty, unitCost, unitCost, ingredientId]
      );

      await conn.execute(
        `INSERT INTO inventory_movements (ingredient_id, movement_type, qty, reason, reference_type, reference_id, user_id)
         VALUES (?, 'RESTOCK', ?, ?, 'DELIVERY_INTAKE', ?, ?)`,
        [ingredientId, qty, `Received PO #${orderId} (${existing.supplier_name || 'Vendor'})`, orderId, userId]
      );
    }

    await conn.execute(
      "UPDATE delivery_intakes SET status = 'RECEIVED', total_cost = ?, received_at = NOW() WHERE id = ?",
      [totalCost, Number(orderId)]
    );

    await conn.commit();
    return { orderId, totalCost, supplierName: existing.supplier_name };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Original direct bulk intake
async function receiveDelivery({ orderGuideId, supplierName, saveAsNewGuide, newGuideName, receivedBy, userId, items }) {
  const pending = await createPendingOrder({
    orderGuideId,
    supplierName,
    expectedDate: null,
    receivedBy,
    saveAsNewGuide,
    newGuideName,
    items
  });

  const received = await receiveExistingOrder({
    orderId: pending.orderId,
    userId,
    items
  });

  return { deliveryId: pending.orderId, totalCost: received.totalCost };
}

// Delete an order guide and its mapped items
async function deleteOrderGuide(guideId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM order_guide_items WHERE order_guide_id = ?', [Number(guideId)]);
    const [result] = await conn.execute('DELETE FROM order_guides WHERE id = ?', [Number(guideId)]);
    await conn.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getAllIngredients,
  getIngredientById,
  adjustStock,
  getUsageByDate,
  getLowStock,
  getAllOrderGuides,
  getOrderGuideItems,
  getPendingOrders,
  getIntakeHistory,
  getOrderDetails,
  createPendingOrder,
  receiveExistingOrder,
  receiveDelivery,
  deleteOrderGuide
};