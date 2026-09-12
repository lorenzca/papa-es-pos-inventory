const pool = require('../config/db');

// get all menu items with calculated recipe cost
async function getAllMenu() {
  const [rows] = await pool.execute(
    `SELECT m.id, 
            m.item_name, 
            m.category, 
            m.parent_group, 
            m.sub_category, 
            m.sell_price, 
            m.image_url, 
            m.is_active,
            IFNULL(SUM(r.qty_required * i.unit_cost), 0) AS recipe_cost
     FROM menu_items m
     LEFT JOIN recipes r ON r.menu_item_id = m.id
     LEFT JOIN ingredients i ON i.id = r.ingredient_id
     GROUP BY m.id
     ORDER BY m.item_name`
  );
  return rows;
}

// find a single menu item by id
async function getMenuById(id) {
  const [[row]] = await pool.execute(
    `SELECT id, item_name, category, parent_group, sub_category, sell_price, image_url, is_active
     FROM menu_items WHERE id = ?`,
    [id]
  );
  return row || null;
}

// insert a new menu item
async function createMenuItem({ item_name, parent_group, sub_category, sell_price, image_url }) {
  const pGroup = parent_group && parent_group.trim() !== '' ? parent_group.trim() : null;
  const sCat = sub_category && sub_category.trim() !== '' ? sub_category.trim() : null;

  const [result] = await pool.execute(
    `INSERT INTO menu_items (item_name, parent_group, sub_category, category, sell_price, image_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [item_name, pGroup, sCat, sCat, sell_price, image_url || null]
  );
  return result.insertId;
}

// update an existing menu item
async function updateMenuItem(id, { item_name, parent_group, sub_category, sell_price, image_url, is_active }) {
  const pGroup = parent_group && parent_group.trim() !== '' ? parent_group.trim() : null;
  const sCat = sub_category && sub_category.trim() !== '' ? sub_category.trim() : null;

  await pool.execute(
    `UPDATE menu_items
     SET item_name = ?, parent_group = ?, sub_category = ?, category = ?, sell_price = ?, image_url = ?, is_active = ?
     WHERE id = ?`,
    [item_name, pGroup, sCat, sCat, sell_price, image_url || null, is_active ? 1 : 0, id]
  );
}

// update the image path for a menu item
async function setMenuImageUrl(id, imageUrl) {
  await pool.execute('UPDATE menu_items SET image_url = ? WHERE id = ?', [imageUrl, id]);
}

// find menu items with missing or broken photo links
async function listItemsWithoutImage() {
  const [rows] = await pool.execute(
    `SELECT id, item_name FROM menu_items
     WHERE image_url IS NULL OR image_url = '' OR image_url LIKE '/menu/%/image'
     ORDER BY item_name`
  );
  return rows;
}

// delete an item or deactivate it if it was already sold in past orders
async function deleteMenuItem(id) {
  try {
    await pool.execute('DELETE FROM menu_items WHERE id = ?', [id]);
    return { mode: 'DELETED' };
  } catch (err) {
    if (String(err.code || '').includes('ER_ROW_IS_REFERENCED')) {
      await pool.execute('UPDATE menu_items SET is_active = 0 WHERE id = ?', [id]);
      return { mode: 'DEACTIVATED' };
    }
    throw err;
  }
}

// get the ingredient list for a dish
async function getRecipe(menuItemId) {
  const [rows] = await pool.execute(
    `SELECT r.id, r.menu_item_id, r.ingredient_id, r.qty_required, i.ingredient_name, i.unit_measure
     FROM recipes r 
     JOIN ingredients i ON i.id = r.ingredient_id 
     WHERE r.menu_item_id = ? 
     ORDER BY i.ingredient_name`,
    [menuItemId]
  );
  return rows;
}

// overwrite the ingredient recipe for a dish
async function replaceRecipe(menuItemId, recipeRows) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM recipes WHERE menu_item_id = ?', [menuItemId]);

    if (recipeRows && recipeRows.length > 0) {
      const values = recipeRows.map((r) => [menuItemId, r.ingredient_id, r.qty_required]);
      await conn.query('INSERT INTO recipes (menu_item_id, ingredient_id, qty_required) VALUES ?', [values]);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// get active item names for dropdowns
async function listMenuNames() {
  const [rows] = await pool.execute(
    'SELECT id, item_name, is_active FROM menu_items ORDER BY item_name'
  );
  return rows;
}

// get unique categories and groups for form autocompletion
async function getCategoryOptions() {
  const [parents] = await pool.execute(
    `SELECT DISTINCT COALESCE(parent_group, category) AS value FROM menu_items
     WHERE COALESCE(parent_group, category) IS NOT NULL ORDER BY value`
  );
  const [subs] = await pool.execute(
    `SELECT DISTINCT COALESCE(sub_category, category) AS value FROM menu_items
     WHERE COALESCE(sub_category, category) IS NOT NULL ORDER BY value`
  );
  return {
    parentGroups: parents.map((row) => row.value),
    subCategories: subs.map((row) => row.value)
  };
}

module.exports = {
  getAllMenu,
  getMenuById,
  listMenuNames,
  getCategoryOptions,
  createMenuItem,
  updateMenuItem,
  setMenuImageUrl,
  listItemsWithoutImage,
  getRecipe,
  replaceRecipe,
  deleteMenuItem
};