const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// roles allowed to approve voids
const AUTHORIZER_ROLES = ['OWNER', 'MANAGER'];

// submit a new void request
async function createRequest({
  sale_id = null,
  sale_item_id = null,
  client_order_ref = null,
  menu_item_id = null,
  item_name,
  request_type,
  void_qty = 0,
  unit_price = 0,
  line_amount = 0,
  reason,
  requested_by
}) {
  const [result] = await pool.execute(
    `INSERT INTO void_requests
       (sale_id, sale_item_id, client_order_ref, menu_item_id, item_name, request_type,
        void_qty, unit_price, line_amount, reason, status, requested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [sale_id, sale_item_id, client_order_ref, menu_item_id, item_name, request_type, void_qty, unit_price, line_amount, reason, requested_by]
  );
  return result.insertId;
}

// find a void request by id with requester and manager names
async function getById(requestId) {
  const [[row]] = await pool.execute(
    `SELECT v.*,
            requester.full_name AS requested_by_name,
            authorizer.full_name AS authorized_by_name,
            authorizer.role AS authorized_by_role
     FROM void_requests v
     JOIN users requester ON requester.id = v.requested_by
     LEFT JOIN users authorizer ON authorizer.id = v.authorized_by
     WHERE v.id = ?`,
    [requestId]
  );
  return row || null;
}

// count pending void requests for notification badges
async function countPending() {
  const [[row]] = await pool.execute("SELECT COUNT(*) AS total FROM void_requests WHERE status = 'PENDING'");
  return Number(row?.total || 0);
}

// get active pending void requests for the cashier modal
async function listPending() {
  const [rows] = await pool.execute(
    `SELECT v.*, DATE_FORMAT(v.created_at, '%Y-%m-%d %H:%i:%s') AS created_at_local,
            requester.full_name AS requested_by_name
     FROM void_requests v
     JOIN users requester ON requester.id = v.requested_by
     WHERE v.status = 'PENDING'
     ORDER BY v.id DESC LIMIT 100`
  );
  return rows;
}

// get all void requests for a specific date
async function listByDate(date) {
  const [rows] = await pool.execute(
    `SELECT v.*,
            DATE_FORMAT(v.created_at, '%Y-%m-%d %H:%i:%s') AS created_at_local,
            DATE_FORMAT(v.decided_at, '%Y-%m-%d %H:%i:%s') AS decided_at_local,
            requester.full_name AS requested_by_name,
            authorizer.full_name AS authorized_by_name,
            authorizer.role AS authorized_by_role,
            sales.or_number
     FROM void_requests v
     JOIN users requester ON requester.id = v.requested_by
     LEFT JOIN users authorizer ON authorizer.id = v.authorized_by
     LEFT JOIN sales ON sales.id = v.sale_id
     WHERE DATE(v.created_at) = ?
     ORDER BY v.id DESC`,
    [date]
  );
  return rows;
}

// approve or reject a void request if still pending
async function decide(requestId, { status, authorizedBy, note = null }) {
  const [result] = await pool.execute(
    `UPDATE void_requests
     SET status = ?, authorized_by = ?, decision_note = ?, decided_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'PENDING'`,
    [status, authorizedBy, note, requestId]
  );
  return result.affectedRows > 0;
}

// get all active managers and owners who have a void pin set up
async function listActiveAuthorizers() {
  const [rows] = await pool.execute(
    `SELECT id, full_name, username, role
     FROM users
     WHERE is_active = 1 AND manager_pin_hash IS NOT NULL AND role IN (?, ?)
     ORDER BY full_name ASC`,
    AUTHORIZER_ROLES
  );
  return rows;
}

// check if the entered pin matches the managers saved pin
async function verifyAuthorizerPin(authorizerId, pin) {
  const candidate = String(pin || '').trim();
  const id = Number(authorizerId);
  if (!id || !candidate) return null;

  const [[user]] = await pool.execute(
    `SELECT id, full_name, username, role, manager_pin_hash
     FROM users
     WHERE id = ? AND is_active = 1 AND manager_pin_hash IS NOT NULL AND role IN (?, ?)`,
    [id, ...AUTHORIZER_ROLES]
  );

  if (!user || !(await bcrypt.compare(candidate, user.manager_pin_hash))) return null;
  return { id: user.id, full_name: user.full_name, username: user.username, role: user.role };
}

// count managers and owners who have an active pin
async function countAuthorizersWithPin() {
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE is_active = 1 AND manager_pin_hash IS NOT NULL AND role IN (?, ?)`,
    AUTHORIZER_ROLES
  );
  return Number(row?.total || 0);
}

module.exports = {
  AUTHORIZER_ROLES,
  createRequest,
  getById,
  countPending,
  listPending,
  listByDate,
  decide,
  listActiveAuthorizers,
  verifyAuthorizerPin,
  countAuthorizersWithPin
};