const inventoryModel = require('../models/inventoryModel');
const auditModel = require('../models/auditModel');

// show inventory stock table
async function getInventory(req, res) {
  try {
    const ingredients = await inventoryModel.getAllIngredients();
    res.render('inventory', { user: req.session.user, ingredients });
  } catch (err) {
    res.status(500).render('inventory', { user: req.session.user, ingredients: [], error: 'Could not load inventory.' });
  }
}

// adjust or restock ingredient quantity and log movement
async function postAdjustment(req, res) {
  const ingredientId = Number(req.body.ingredient_id);
  const qty = Number(req.body.qty);
  const reason = String(req.body.reason || '').trim();
  const movementType = req.body.movement_type === 'RESTOCK' ? 'RESTOCK' : 'ADJUSTMENT';

  if (!ingredientId || !qty || !reason) {
    return res.status(400).send('Missing required fields.');
  }

  try {
    const ingredient = await inventoryModel.getIngredientById?.(ingredientId) || null;

    await inventoryModel.adjustStock({
      ingredientId,
      qty,
      movementType,
      reason,
      userId: req.session.user.id
    });

    await auditModel.logAudit({
      userId: req.session.user.id,
      action: movementType === 'RESTOCK' ? 'STOCK_RESTOCKED' : 'STOCK_ADJUSTED',
      entityType: 'INGREDIENT',
      entityId: ingredientId,
      details: {
        ingredient_name: ingredient?.ingredient_name || `Ingredient #${ingredientId}`,
        movement_type: movementType,
        quantity_change: qty,
        reason
      }
    });

    res.redirect('/inventory');
  } catch (err) {
    console.error('[inventory] adjustment error:', err.message);
    res.status(500).send('Failed to adjust stock.');
  }
}

module.exports = { getInventory, postAdjustment };