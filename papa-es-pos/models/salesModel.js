const pool = require('../config/db');

// gets all active menu for the pos grid
async function getPOSItems() {
  const [rows] = await pool.execute(
    `SELECT id, item_name, category, parent_group, sub_category, sell_price, image_url, is_active
     FROM menu_items 
     WHERE is_active = 1
     ORDER BY item_name`
  );
  return rows;
}

// RECEIPTS / REPORTS 

// gets one sale by ID with the cashier and voider names
async function getSaleById(saleId) {
  const [[row]] = await pool.execute(
    `SELECT s.*,
            DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') AS created_at_local,
            u.full_name AS cashier_name,
            u.username AS cashier_username,
            voider.full_name AS voided_by_name
     FROM sales s
     JOIN users u ON u.id = s.cashier_id
     LEFT JOIN users voider ON voider.id = s.cancelled_by
     WHERE s.id = ?
     LIMIT 1`,
    [saleId]
  );
  return row || null;
}

// gets the list of items inside an order
async function getSaleItems(saleId) {
  const [rows] = await pool.execute(
    `SELECT si.*, COALESCE(si.item_name, mi.item_name, 'Item') AS display_name
     FROM sale_items si
     LEFT JOIN menu_items mi ON mi.id = si.menu_item_id
     WHERE si.sale_id = ?
     ORDER BY si.id`,
    [saleId]
  );
  return rows;
}

// gets all sales for one specific date for the sales report
async function getSalesByDate(date) {
  const [rows] = await pool.execute(
    `SELECT s.id AS sale_id, s.or_number, s.subtotal_amount, s.discount_amount,
            s.total_amount, s.cash_received, s.change_amount, s.payment_method,
            s.payment_status, s.order_type, s.status,
            DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') AS created_at_local,
            u.full_name AS cashier
     FROM sales s
     JOIN users u ON u.id = s.cashier_id
     WHERE DATE(s.created_at) = ?
     ORDER BY s.id DESC`,
    [date]
  );
  return rows;
}

// searches receipts by date or OR number/cashier name
async function searchReceipts({ date = null, query = '' } = {}) {
  const filters = [];
  const params = [];

  if (date) {
    filters.push('DATE(s.created_at) = ?');
    params.push(date);
  }

  const trimmedQuery = String(query || '').trim();
  if (trimmedQuery) {
    filters.push('(s.or_number LIKE ? OR u.full_name LIKE ?)');
    params.push(`%${trimmedQuery}%`, `%${trimmedQuery}%`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT s.id AS sale_id, s.or_number, s.total_amount, s.discount_amount,
            s.payment_method, s.status, s.reprint_count,
            DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') AS created_at_local,
            u.full_name AS cashier
     FROM sales s
     JOIN users u ON u.id = s.cashier_id
     ${where}
     ORDER BY s.id DESC
     LIMIT 200`,
    params
  );
  return rows;
}

// stamps first print time or increases the reprint counter
async function markReceiptPrinted(saleId, { reprint = false } = {}) {
  if (reprint) {
    await pool.execute('UPDATE sales SET reprint_count = reprint_count + 1 WHERE id = ?', [saleId]);
    return;
  }
  await pool.execute('UPDATE sales SET receipt_printed_at = COALESCE(receipt_printed_at, CURRENT_TIMESTAMP) WHERE id = ?', [saleId]);
}

// dashboard calculations

// pre-calculates unit cost for each dish based on recipes
const MENU_ITEM_UNIT_COST_SQL = `
  SELECT r.menu_item_id, SUM(r.qty_required * i.unit_cost) AS unit_cost
  FROM recipes r
  JOIN ingredients i ON i.id = r.ingredient_id
  GROUP BY r.menu_item_id`;

// gets total revenue, cost of goods (COGS), gross profit, and order count for a day
async function getDashboardMetrics(date) {
  const [[[rev]], [[cogs]]] = await Promise.all([
    pool.execute(
      `SELECT COALESCE(SUM(s.total_amount), 0) AS revenue, COUNT(*) AS order_count
       FROM sales s
       WHERE DATE(s.created_at) = ? AND s.status = 'COMPLETED'`,
      [date]
    ),
    pool.execute(
      `SELECT COALESCE(SUM(
                CASE WHEN rc.unit_cost IS NOT NULL
                     THEN (si.quantity - si.voided_qty) * rc.unit_cost
                     ELSE si.cost_amount
                END
              ), 0) AS cogs
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN (${MENU_ITEM_UNIT_COST_SQL}) rc ON rc.menu_item_id = si.menu_item_id
       WHERE DATE(s.created_at) = ? AND s.status = 'COMPLETED' AND (si.quantity - si.voided_qty) > 0`,
      [date]
    )
  ]);

  const revenue = Number(rev?.revenue) || 0;
  const totalCogs = Number(cogs?.cogs) || 0;

  return {
    revenue: Math.round(revenue * 100) / 100,
    cogs: Math.round(totalCogs * 100) / 100,
    grossProfit: Math.round((revenue - totalCogs) * 100) / 100,
    orderCount: Number(rev?.order_count) || 0
  };
}

// helper to shift ISO date string by days
function shiftIsoDate(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

// builds the sales trend chart data for day (hourly), week (7 days), or month (30 days)
async function getRevenueTrend({ date, range = 'week' } = {}) {
  const endDate = date || new Date().toISOString().slice(0, 10);

  // hourly trend for a single day
  if (range === 'day') {
    const [rows] = await pool.execute(
      `SELECT HOUR(s.created_at) AS bucket, COALESCE(SUM(s.total_amount), 0) AS revenue
       FROM sales s
       WHERE DATE(s.created_at) = ? AND s.status = 'COMPLETED'
       GROUP BY HOUR(s.created_at)`,
      [endDate]
    );

    const byHour = new Map(rows.map((r) => [Number(r.bucket), Number(r.revenue) || 0]));
    return Array.from({ length: 24 }, (_, h) => ({
      sales_date: `${String(h).padStart(2, '0')}:00`,
      revenue: byHour.get(h) || 0
    }));
  }

  // daily trend across 7 or 30 days
  const span = range === 'month' ? 30 : 7;
  const startDate = shiftIsoDate(endDate, -(span - 1));

  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(s.created_at, '%Y-%m-%d') AS bucket, COALESCE(SUM(s.total_amount), 0) AS revenue
     FROM sales s
     WHERE s.status = 'COMPLETED' AND DATE(s.created_at) BETWEEN ? AND ?
     GROUP BY bucket`,
    [startDate, endDate]
  );

  const byDate = new Map(rows.map((r) => [r.bucket, Number(r.revenue) || 0]));
  return Array.from({ length: span }, (_, offset) => {
    const day = shiftIsoDate(startDate, offset);
    return { sales_date: day, revenue: byDate.get(day) || 0 };
  });
}

module.exports = {
  getPOSItems,
  getSaleById,
  getSaleItems,
  getSalesByDate,
  searchReceipts,
  markReceiptPrinted,
  getDashboardMetrics,
  getRevenueTrend
};