const pool = require('../config/db');

// record an action in the audit trail (uses the transaction connection if passed)
async function logAudit({ connection, userId = null, action, entityType, entityId = null, details = null }) {
  const executor = connection || pool;

  await executor.execute(
    `INSERT INTO audit_trails (user_id, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, details ? JSON.stringify(details) : null]
  );
}

// get recent logs so the audit page can show what happened
async function listAudit({ limit = 200 } = {}) {
  const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 200));

  const [rows] = await pool.query(
    `SELECT a.id,
            a.action,
            a.entity_type,
            a.entity_id,
            a.details,
            DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            COALESCE(u.full_name, 'System') AS full_name,
            COALESCE(u.role, '-') AS role
     FROM audit_trails a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.id DESC
     LIMIT ?`,
    [safeLimit]
  );

  return rows;
}

module.exports = { logAudit, listAudit };