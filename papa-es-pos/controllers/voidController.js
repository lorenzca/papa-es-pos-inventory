const voidModel = require('../models/voidModel');
const auditModel = require('../models/auditModel');
const pricing = require('../public/js/pricing');
const pool = require('../config/db');

const REQUEST_TYPES = ['VOID_QTY', 'VOID_ITEM', 'VOID_SALE', 'COMP'];
const DECISIONS = ['APPROVED', 'REJECTED'];
const cleanReason = (v) => String(v || '').trim().slice(0, 255);

// recalculate totals, discounts, and change after voiding lines
async function recalcSale(conn, saleId) {
  const [[sale]] = await conn.execute('SELECT id, discount_type, discount_value, payment_method, cash_received FROM sales WHERE id = ?', [saleId]);
  if (!sale) throw new Error('Sale not found: ' + saleId);

  const [items] = await conn.execute('SELECT id, menu_item_id, item_name, quantity, voided_qty, unit_price, discount_type, discount_value FROM sale_items WHERE sale_id = ? ORDER BY id', [saleId]);

  const totals = pricing.computeOrder({
    items: items.map((r) => ({ ...r, unit_price: Number(r.unit_price), quantity: Number(r.quantity), voided_qty: Number(r.voided_qty), discount_value: Number(r.discount_value) })),
    discountType: sale.discount_type,
    discountValue: Number(sale.discount_value)
  });

  for (let i = 0; i < items.length; i++) {
    const l = totals.lines[i];
    await conn.execute('UPDATE sale_items SET gross_amount = ?, discount_amount = ?, line_total = ? WHERE id = ?', [l.gross_amount, l.discount_amount, l.line_total, items[i].id]);
  }

  const change = sale.payment_method === 'CASH' ? Math.max(0, pricing.round2((Number(sale.cash_received) || 0) - totals.total_amount)) : 0;
  await conn.execute('UPDATE sales SET subtotal_amount = ?, line_discount_total = ?, order_discount_amount = ?, discount_amount = ?, total_amount = ?, change_amount = ? WHERE id = ?',
    [totals.subtotal_amount, totals.line_discount_total, totals.order_discount_amount, totals.discount_amount, totals.total_amount, change, saleId]);

  return totals;
}

// submit a void request from the cashier terminal
async function postRequest(req, res) {
  const { saleId, saleItemId, clientOrderRef, menuItemId, itemName, requestType = 'VOID_QTY', voidQty, unitPrice, lineAmount, reason } = req.body;
  const type = String(requestType).toUpperCase();
  const why = cleanReason(reason);

  if (!REQUEST_TYPES.includes(type)) return res.status(400).json({ message: `Unsupported void type: ${type}` });
  if (why.length < 3) return res.status(400).json({ message: 'Enter a reason for this void.' });

  const label = String(itemName || '').trim().slice(0, 120) || 'Whole order';
  try {
    const requestId = await voidModel.createRequest({
      sale_id: saleId ? Number(saleId) : null, sale_item_id: saleItemId ? Number(saleItemId) : null,
      client_order_ref: clientOrderRef ? String(clientOrderRef).slice(0, 64) : null,
      menu_item_id: menuItemId ? Number(menuItemId) : null, item_name: label, request_type: type,
      void_qty: Math.max(0, Number(voidQty) || 0), unit_price: pricing.round2(unitPrice || 0),
      line_amount: pricing.round2(lineAmount || 0), reason: why, requested_by: req.session.user.id
    });

    await auditModel.logAudit({ userId: req.session.user.id, action: 'VOID_REQUESTED', entityType: 'VOID_REQUEST', entityId: requestId, details: { request_type: type, item_name: label, void_qty: Number(voidQty) || 0, reason: why } });
    return res.json({ message: 'Void request submitted. Manager PIN required.', requestId, authorizersAvailable: await voidModel.countAuthorizersWithPin(), pendingCount: await voidModel.countPending() });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to submit void request.' });
  }
}

// manager approves or rejects a pending void with their pin
async function postDecide(req, res) {
  const requestId = Number(req.params.id);
  const decision = String(req.body.decision || 'APPROVED').toUpperCase();
  const { note, authorizerId, pin } = req.body;

  if (!DECISIONS.includes(decision)) return res.status(400).json({ message: `Unsupported decision: ${decision}` });
  const authorizer = await voidModel.verifyAuthorizerPin(authorizerId ? Number(authorizerId) : null, pin);
  if (!authorizer) return res.status(403).json({ message: 'Invalid manager selection or PIN.' });

  const request = await voidModel.getById(requestId);
  if (!request) return res.status(404).json({ message: 'Void request not found.' });
  if (request.status !== 'PENDING') return res.status(409).json({ message: `Already ${request.status.toLowerCase()}.` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let outcome = { applied: 'REJECTED' };

    if (decision === 'APPROVED') {
      if (!request.sale_id) {
        outcome = { applied: 'DRAFT_ORDER' };
      } else if (request.request_type === 'VOID_SALE') {
        await conn.execute(`UPDATE sales SET status = 'VOIDED', cancel_reason = ?, cancelled_by = ?, cancelled_at = CURRENT_TIMESTAMP WHERE id = ?`, [request.reason, authorizer.id, request.sale_id]);
        outcome = { applied: 'SALE_VOIDED' };
      } else {
        const [[line]] = await conn.execute('SELECT id, quantity, voided_qty FROM sale_items WHERE id = ?', [request.sale_item_id]);
        if (line) {
          const requested = Math.min(line.quantity - line.voided_qty, Number(request.void_qty) || 1);
          await conn.execute('UPDATE sale_items SET voided_qty = voided_qty + ? WHERE id = ?', [requested, line.id]);
          const totals = await recalcSale(conn, request.sale_id);
          if (totals.active_line_count === 0) await conn.execute(`UPDATE sales SET status = 'VOIDED', cancel_reason = ? WHERE id = ?`, [request.reason, request.sale_id]);
          outcome = { applied: 'LINE_VOIDED', voided_qty: requested, new_total: totals.total_amount };
        }
      }
    }

    await conn.execute(`UPDATE void_requests SET status = ?, authorized_by = ?, decision_note = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?`, [decision, authorizer.id, cleanReason(note) || null, requestId]);
    await auditModel.logAudit({ connection: conn, userId: authorizer.id, action: decision === 'APPROVED' ? 'VOID_APPROVED' : 'VOID_REJECTED', entityType: 'VOID_REQUEST', entityId: requestId, details: { item_name: request.item_name, reason: request.reason, authorized_by: authorizer.full_name, ...outcome } });

    await conn.commit();
    return res.json({ message: `Void ${decision.toLowerCase()} by ${authorizer.full_name}.`, requestId, status: decision, pendingCount: await voidModel.countPending() });
  } catch (error) {
    await conn.rollback();
    return res.status(400).json({ message: error.message || 'Failed to record decision.' });
  } finally {
    conn.release();
  }
}

// get pending void requests and active managers for the modal
async function getPending(req, res) {
  const [requests, authorizers] = await Promise.all([voidModel.listPending(), voidModel.listActiveAuthorizers()]);
  return res.json({ requests, pendingCount: requests.length, authorizers, authorizersAvailable: authorizers.length });
}

// immediately void specific line items from an existing sale
async function voidSaleItem(req, res) {
  const saleId = Number(req.params.saleId);
  const { saleItemId, voidQty, itemsToVoid, reason, pin, authorizerId } = req.body;
  const why = cleanReason(reason);

  if (why.length < 3) return res.status(400).json({ message: 'A valid reason (minimum 3 characters) is required.' });
  const authorizer = await voidModel.verifyAuthorizerPin(authorizerId ? Number(authorizerId) : null, pin);
  if (!authorizer) return res.status(403).json({ message: 'Invalid manager selection or PIN.' });

  const targets = Array.isArray(itemsToVoid) && itemsToVoid.length
    ? itemsToVoid.map((t) => ({ saleItemId: Number(t.saleItemId), qty: Math.max(1, Number(t.qty || 1)) }))
    : saleItemId ? [{ saleItemId: Number(saleItemId), qty: Math.max(1, Number(voidQty || 1)) }] : [];

  if (!targets.length) return res.status(400).json({ message: 'Select at least one dish to void.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const t of targets) {
      const [[item]] = await conn.execute('SELECT * FROM sale_items WHERE id = ? AND sale_id = ? FOR UPDATE', [t.saleItemId, saleId]);
      if (!item) continue;
      const actualVoid = Math.min(t.qty, item.quantity - item.voided_qty);
      if (actualVoid <= 0) continue;

      await conn.execute('UPDATE sale_items SET voided_qty = voided_qty + ? WHERE id = ?', [actualVoid, t.saleItemId]);
      await conn.execute(
        `INSERT INTO void_requests (sale_id, sale_item_id, menu_item_id, item_name, request_type, void_qty, unit_price, line_amount, reason, status, requested_by, authorized_by)
         VALUES (?, ?, ?, ?, 'VOID_ITEM', ?, ?, ?, ?, 'APPROVED', ?, ?)`,
        [saleId, t.saleItemId, item.menu_item_id, item.item_name, actualVoid, item.unit_price, pricing.round2(item.unit_price * actualVoid), why, req.session.user.id, authorizer.id]
      );
    }

    const totals = await recalcSale(conn, saleId);
    const isFullyVoided = totals.active_line_count === 0;
    if (isFullyVoided) await conn.execute(`UPDATE sales SET status = 'VOIDED', cancel_reason = ? WHERE id = ?`, [why, saleId]);

    await auditModel.logAudit({ connection: conn, userId: req.session.user.id, action: 'SALE_ITEMS_VOIDED', entityType: 'SALE', entityId: saleId, details: { reason: why, authorized_by: authorizer.full_name, voided_count: targets.length, is_fully_voided: isFullyVoided, new_total: totals.total_amount } });

    await conn.commit();
    return res.json({ message: 'Voided selected item(s) successfully.', newTotal: totals.total_amount, isFullyVoided });
  } catch (error) {
    await conn.rollback();
    return res.status(400).json({ message: error.message || 'Could not void items.' });
  } finally {
    conn.release();
  }
}

// void an entire completed sale with manager authorization
async function voidEntireSale(req, res) {
  const saleId = Number(req.params.saleId);
  const why = cleanReason(req.body.reason);
  if (why.length < 3) return res.status(400).json({ message: 'A valid reason (minimum 3 characters) is required.' });

  const authorizer = await voidModel.verifyAuthorizerPin(req.body.authorizerId ? Number(req.body.authorizerId) : null, req.body.pin);
  if (!authorizer) return res.status(403).json({ message: 'Invalid manager selection or PIN.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[sale]] = await conn.execute('SELECT * FROM sales WHERE id = ? FOR UPDATE', [saleId]);
    if (!sale) throw new Error('Sale not found.');
    if (sale.status === 'VOIDED') throw new Error('Sale is already voided.');

    await conn.execute('UPDATE sale_items SET voided_qty = quantity WHERE sale_id = ?', [saleId]);
    await conn.execute(`UPDATE sales SET status = 'VOIDED', cancel_reason = ? WHERE id = ?`, [why, saleId]);
    await conn.execute(
      `INSERT INTO void_requests (sale_id, menu_item_id, item_name, request_type, void_qty, unit_price, line_amount, reason, status, requested_by, authorized_by)
       VALUES (?, NULL, 'ENTIRE_ORDER', 'VOID_SALE', 1, ?, ?, ?, 'APPROVED', ?, ?)`,
      [saleId, sale.total_amount, sale.total_amount, why, req.session.user.id, authorizer.id]
    );

    await auditModel.logAudit({ connection: conn, userId: req.session.user.id, action: 'SALE_ORDER_VOIDED', entityType: 'SALE', entityId: saleId, details: { or_number: sale.or_number, reason: why, authorized_by: authorizer.full_name } });

    await conn.commit();
    return res.json({ message: `Order ${sale.or_number} has been voided.` });
  } catch (error) {
    await conn.rollback();
    return res.status(400).json({ message: error.message || 'Could not void order.' });
  } finally {
    conn.release();
  }
}

module.exports = { REQUEST_TYPES, postRequest, postDecide, getPending, recalcSale, voidSaleItem, voidEntireSale };