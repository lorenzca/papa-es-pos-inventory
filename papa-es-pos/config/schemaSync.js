const pool = require('./db');

// check if a column already exists in a table
async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

// check if a table exists in the database
async function tableExists(tableName) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

// add column if missing
async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return false;
  await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  return true;
}

// create void requests table if missing
async function ensureVoidRequestsTable() {
  if (await tableExists('void_requests')) return false;

  await pool.execute(
    `CREATE TABLE void_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NULL,
      sale_item_id INT NULL,
      client_order_ref VARCHAR(64) NULL,
      menu_item_id INT NULL,
      item_name VARCHAR(120) NOT NULL,
      request_type ENUM('VOID_QTY','VOID_ITEM','VOID_SALE','COMP') NOT NULL,
      void_qty INT NOT NULL DEFAULT 0,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      line_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      reason VARCHAR(255) NOT NULL,
      status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
      requested_by INT NOT NULL,
      authorized_by INT NULL,
      decided_at TIMESTAMP NULL,
      decision_note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_vreq_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      CONSTRAINT fk_vreq_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
      CONSTRAINT fk_vreq_requester FOREIGN KEY (requested_by) REFERENCES users(id),
      CONSTRAINT fk_vreq_authorizer FOREIGN KEY (authorized_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_vreq_status (status),
      INDEX idx_vreq_created (created_at)
    )`
  );
  return true;
}

// sync missing tables and columns on startup
async function syncSchema() {
  const changes = [];

  const columns = [
    ['menu_items', 'image_url', 'VARCHAR(255) NULL AFTER sell_price'],
    ['sales', 'discount_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_amount'],
    ['sales', 'discount_type', "VARCHAR(20) NOT NULL DEFAULT 'NONE' AFTER discount_amount"],
    ['sales', 'discount_value', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_type'],
    ['sales', 'payment_method', "VARCHAR(20) NOT NULL DEFAULT 'CASH' AFTER discount_value"],
    ['sales', 'order_type', "VARCHAR(20) NOT NULL DEFAULT 'DINE_IN' AFTER payment_method"],
    ['sales', 'order_note', 'VARCHAR(255) NULL AFTER order_type'],
    ['sales', 'status', "VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' AFTER change_amount"],
    ['sales', 'cancel_reason', 'VARCHAR(255) NULL AFTER status'],
    ['sales', 'cancelled_by', 'INT NULL AFTER cancel_reason'],
    ['sales', 'cancelled_at', 'TIMESTAMP NULL AFTER cancelled_by'],
    ['users', 'manager_pin_hash', 'VARCHAR(255) NULL AFTER password_hash'],
    ['sales', 'subtotal_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_amount'],
    ['sales', 'line_discount_total', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_amount'],
    ['sales', 'order_discount_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER line_discount_total'],
    ['sales', 'payment_status', "VARCHAR(20) NOT NULL DEFAULT 'PAID' AFTER payment_method"],
    ['sales', 'payment_ref', 'VARCHAR(60) NULL AFTER payment_status'],
    ['sale_items', 'item_name', 'VARCHAR(120) NULL AFTER menu_item_id'],
    ['sale_items', 'voided_qty', 'INT NOT NULL DEFAULT 0 AFTER quantity'],
    ['sale_items', 'gross_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER unit_price'],
    ['sale_items', 'discount_type', "VARCHAR(20) NOT NULL DEFAULT 'NONE' AFTER gross_amount"],
    ['sale_items', 'discount_value', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_type'],
    ['sale_items', 'discount_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_value'],
    ['sales', 'receipt_printed_at', 'TIMESTAMP NULL AFTER created_at'],
    ['sales', 'reprint_count', 'INT NOT NULL DEFAULT 0 AFTER receipt_printed_at'],
    ['sales', 'vat_rate', 'DECIMAL(5,4) NOT NULL DEFAULT 0.1200 AFTER subtotal_amount'],
    ['sales', 'vatable_sales', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER vat_rate'],
    ['sales', 'vat_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER vatable_sales'],
    ['sales', 'vat_exempt_sales', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER vat_amount'],
    ['sales', 'zero_rated_sales', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER vat_exempt_sales'],
    ['sales', 'vat_removed_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER zero_rated_sales'],
    ['sales', 'discount_id_name', 'VARCHAR(120) NULL AFTER discount_value'],
    ['sales', 'discount_id_number', 'VARCHAR(60) NULL AFTER discount_id_name'],
    ['sale_items', 'vat_exempt', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER discount_amount'],
    ['sale_items', 'vat_removed', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER vat_exempt']
  ];

  for (const [table, col, def] of columns) {
    if (await ensureColumn(table, col, def)) changes.push(`${table}.${col}`);
  }

  if (await ensureVoidRequestsTable()) changes.push('void_requests');

  return changes;
}

module.exports = { syncSchema };