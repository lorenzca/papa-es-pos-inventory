const inventoryModel = require('../models/inventoryModel');
const auditModel = require('../models/auditModel');

// GET /inventory - render stock table, pending orders queue, and intake history
async function getInventory(req, res) {
  try {
    const [ingredients, pendingOrders, intakeHistory] = await Promise.all([
      inventoryModel.getAllIngredients(),
      inventoryModel.getPendingOrders().catch(() => []),
      inventoryModel.getIntakeHistory ? inventoryModel.getIntakeHistory().catch(() => []) : []
    ]);
    res.render('inventory', { user: req.session.user, ingredients, pendingOrders, intakeHistory });
  } catch (err) {
    res.status(500).render('inventory', { 
      user: req.session.user, 
      ingredients: [], 
      pendingOrders: [], 
      intakeHistory: [], 
      error: 'Could not load inventory.' 
    });
  }
}

// POST /inventory/adjust - handles both restocks (+) and write-offs/variance (-)
async function postAdjustment(req, res) {
  const ingredientId = Number(req.body.ingredient_id);
  const rawQty = Math.abs(Number(req.body.input_qty || req.body.qty || 0));
  const category = req.body.loss_category || req.body.movement_type || 'ADJUSTMENT';
  const userReason = String(req.body.reason || '').trim();
  const userRole = req.session?.user?.role;

  if (!ingredientId || !rawQty || !userReason) {
    return res.status(400).send('Missing required fields.');
  }

  // Kitchen staff can log waste and deductions, but only managers/owners can post direct manual stock additions
  if (category === 'RESTOCK' && !['OWNER', 'MANAGER'].includes(userRole)) {
    return res.status(403).send('Unauthorized: Only managers and owners can post direct stock additions.');
  }

  const isAddition = category === 'RESTOCK';
  const qty = isAddition ? rawQty : -rawQty;
  const movementType = isAddition ? 'RESTOCK' : 'ADJUSTMENT';
  const reason = isAddition ? userReason : `[${category}] ${userReason}`;

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
      action: isAddition ? 'STOCK_RESTOCKED' : 'STOCK_DEDUCTED',
      entityType: 'INGREDIENT',
      entityId: ingredientId,
      details: {
        ingredient_name: ingredient?.ingredient_name || `Ingredient #${ingredientId}`,
        category,
        quantity_change: qty,
        reason
      }
    });

    res.redirect('/inventory');
  } catch (err) {
    res.status(500).send('Failed to adjust stock.');
  }
}

// API Endpoints for Order Guides & Orders
async function getOrderGuides(req, res) {
  try {
    const guides = await inventoryModel.getAllOrderGuides();
    res.json({ success: true, guides });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load order guides.' });
  }
}

async function getOrderGuideItems(req, res) {
  const guideId = Number(req.params.id);
  if (!guideId) return res.status(400).json({ success: false, error: 'Invalid guide ID.' });

  try {
    const items = await inventoryModel.getOrderGuideItems(guideId);
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load guide items.' });
  }
}

async function getPendingOrders(req, res) {
  try {
    const orders = await inventoryModel.getPendingOrders();
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch pending orders.' });
  }
}

async function getOrderDetails(req, res) {
  try {
    const order = await inventoryModel.getOrderDetails(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch order details.' });
  }
}

async function postCreateOrder(req, res) {
  const { orderGuideId, supplierName, expectedDate, saveAsNewGuide, newGuideName, items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, error: 'No items in order.' });
  }

  try {
    const receivedBy = req.session?.user?.full_name || req.session?.user?.username || 'Staff';
    const result = await inventoryModel.createPendingOrder({
      orderGuideId,
      supplierName: String(supplierName || '').trim(),
      expectedDate: expectedDate || null,
      receivedBy,
      saveAsNewGuide: Boolean(saveAsNewGuide),
      newGuideName: String(newGuideName || '').trim(),
      items
    });
    res.json({ success: true, message: 'Order placed into pending queue.', orderId: result.orderId });
  } catch (err) {
    const isDup = err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry');
    res.status(isDup ? 400 : 500).json({ 
      success: false, 
      error: isDup ? `Preset guide "${newGuideName}" already exists.` : 'Unable to save order.' 
    });
  }
}

async function postReceiveExistingOrder(req, res) {
  const orderId = Number(req.params.id);
  const { items } = req.body;
  if (!orderId || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, error: 'Invalid order or missing items.' });
  }

  try {
    const userId = req.session?.user?.id || null;
    const result = await inventoryModel.receiveExistingOrder({ orderId, userId, items });

    await auditModel.logAudit({
      userId,
      action: 'DELIVERY_RECEIVED',
      entityType: 'DELIVERY_INTAKE',
      entityId: orderId,
      details: { supplier_name: result.supplierName, total_cost: result.totalCost, item_count: items.length }
    });

    res.json({ success: true, message: 'Order received and inventory updated.', orderId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to receive order.' });
  }
}

async function postReceiveDelivery(req, res) {
  const { orderGuideId, supplierName, saveAsNewGuide, newGuideName, items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, error: 'No items provided.' });
  }

  try {
    const receivedBy = req.session?.user?.full_name || req.session?.user?.username || 'Staff';
    const userId = req.session?.user?.id || null;

    const result = await inventoryModel.receiveDelivery({
      orderGuideId,
      supplierName: String(supplierName || '').trim(),
      saveAsNewGuide: Boolean(saveAsNewGuide),
      newGuideName: String(newGuideName || '').trim(),
      receivedBy,
      userId,
      items
    });

    await auditModel.logAudit({
      userId,
      action: 'DELIVERY_RECEIVED',
      entityType: 'DELIVERY_INTAKE',
      entityId: result.deliveryId,
      details: { supplier_name: supplierName, total_cost: result.totalCost, item_count: items.length }
    });

    res.json({ success: true, message: 'Stock received and inventory updated.', deliveryId: result.deliveryId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to record delivery.' });
  }
}

async function deleteOrderGuide(req, res) {
  const guideId = Number(req.params.id);
  if (!guideId) return res.status(400).json({ success: false, error: 'Invalid guide ID.' });

  try {
    const deleted = await inventoryModel.deleteOrderGuide(guideId);
    if (!deleted) return res.status(404).json({ success: false, error: 'Preset guide not found.' });
    res.json({ success: true, message: 'Preset guide deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete preset guide.' });
  }
}

module.exports = {
  getInventory,
  postAdjustment,
  getOrderGuides,
  getOrderGuideItems,
  getPendingOrders,
  getOrderDetails,
  postCreateOrder,
  postReceiveExistingOrder,
  postReceiveDelivery,
  deleteOrderGuide
};