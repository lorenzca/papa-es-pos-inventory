const pool = require('../config/db');

// get all ingredients for the stock table
async function getAllIngredients() {
  const [rows] = await pool.execute(
    'SELECT id, ingredient_name, unit_measure, stock_qty, reorder_level, unit_cost FROM ingredients ORDER BY ingredient_name'
  );
  return rows;
}

// find one ingredient by id
async function getIngredientById(id) {
  const [[row]] = await pool.execute(
    'SELECT id, ingredient_name, unit_measure, stock_qty, unit_cost FROM ingredients WHERE id = ?',
    [Number(id)]
  );
  return row || null;
}

// update stock count and save movement in one transaction
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

// calculate ingredients used for sales on a specific date
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

// get items that are running low or out of stock
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

module.exports = {
  getAllIngredients,
  getIngredientById,
  adjustStock,
  getUsageByDate,
  getLowStock
};