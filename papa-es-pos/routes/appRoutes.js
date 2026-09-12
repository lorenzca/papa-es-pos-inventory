const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pool = require('../config/db');
const { ensureAuthenticated, ensureRole } = require('../middleware/authMiddleware');
const imageFile = require('../config/imageFile');

const salesController = require('../controllers/salesController');
const voidController = require('../controllers/voidController');
const receiptController = require('../controllers/receiptController');
const inventoryController = require('../controllers/inventoryController');
const menuController = require('../controllers/menuController');
const reportController = require('../controllers/reportController');
const auditController = require('../controllers/auditController');
const userController = require('../controllers/userController');

const router = express.Router();
const POS_ROLES = ['OWNER', 'MANAGER', 'CASHIER'];

// file upload directory
const uploadDir = imageFile.UPLOAD_DIR;
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = imageFile.extensionFor(file.originalname, file.mimetype);
    cb(null, imageFile.fileNameFor(req.body.item_name, extension));
  }
});

// limit file uploads to image types and a max size of 5MB
const menuImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if ((file.mimetype || '').startsWith('image/')) return cb(null, true);
    cb(new Error('Only image uploads are allowed.'));
  }
});

// default redirect based on user role
router.get('/', ensureAuthenticated, (req, res) => {
  const roleHome = { OWNER: '/dashboard', MANAGER: '/dashboard', CASHIER: '/pos', KITCHEN: '/inventory' };
  res.redirect(roleHome[req.session.user.role] || '/pos');
});

// dashboard and sales endpoints
router.get('/dashboard', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), salesController.getDashboard);
router.get('/dashboard/trend', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), salesController.getDashboardTrend);
router.get('/pos', ensureAuthenticated, ensureRole(POS_ROLES), salesController.getPOS);
router.post('/pos/complete', ensureAuthenticated, ensureRole(POS_ROLES), salesController.completeOrder);

// active dining tables & hold order tabs
router.get('/pos/active-tables', ensureAuthenticated, ensureRole(POS_ROLES), salesController.getActiveTables);
router.post('/pos/hold', ensureAuthenticated, ensureRole(POS_ROLES), salesController.holdOrder);

// lookup receipt and reprinting
router.get('/receipt/:id', ensureAuthenticated, ensureRole(POS_ROLES), receiptController.getReceipt);

// fetch items for post void (reports/receipt)
router.get('/sales/:saleId/items', ensureAuthenticated, ensureRole(POS_ROLES), async (req, res) => {
  try {
    const [items] = await pool.execute(
      `SELECT id, menu_item_id, item_name, quantity, voided_qty, unit_price 
       FROM sale_items 
       WHERE sale_id = ?`,
      [req.params.saleId]
    );
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load sale items.' });
  }
});

// post void sale actions
router.post('/sales/:saleId/void-item', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), voidController.voidSaleItem);
router.post('/sales/:saleId/void-order', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), voidController.voidEntireSale);

// live order item void
router.get('/void/pending', ensureAuthenticated, ensureRole(POS_ROLES), voidController.getPending);
router.post('/void/request', ensureAuthenticated, ensureRole(POS_ROLES), voidController.postRequest);
router.post('/void/:id/decide', ensureAuthenticated, ensureRole(POS_ROLES), voidController.postDecide);

// inventory tracking anf stock adjustments
router.get('/inventory', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER', 'KITCHEN']), inventoryController.getInventory);
router.post('/inventory/adjust', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER', 'KITCHEN']), inventoryController.postAdjustment);

// menu item management and ingredient recipes
router.get('/menu', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), menuController.getMenu);
router.post('/menu', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), menuImageUpload.single('image_file'), menuController.postMenuItem);
router.post('/menu/:id/update', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), menuImageUpload.single('image_file'), menuController.postUpdateMenuItem);
router.post('/menu/:id/delete', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), menuController.postDeleteMenuItem);
router.post('/menu/recipe', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), menuController.postRecipe);

// about
router.get('/about', ensureAuthenticated, (req, res) => {
  res.render('about', { user: req.session.user, pageTitle: 'About Papa Es Diner' });
});

// CRUD of owner
router.get('/users', ensureAuthenticated, ensureRole(['OWNER']), userController.getUsers);
router.post('/users', ensureAuthenticated, ensureRole(['OWNER']), userController.postCreateUser);
router.post('/users/:id/update', ensureAuthenticated, ensureRole(['OWNER']), userController.postUpdateUser);
router.post('/users/:id/toggle', ensureAuthenticated, ensureRole(['OWNER']), userController.postToggleUserStatus);
router.post('/users/:id/password', ensureAuthenticated, ensureRole(['OWNER']), userController.postResetPassword);
router.post('/users/:id/pin', ensureAuthenticated, ensureRole(['OWNER']), userController.postManagerPin);
router.post('/users/:id/delete', ensureAuthenticated, ensureRole(['OWNER']), userController.postDeleteUser);

// sales report and audit trails
router.get('/reports', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), reportController.getReports);
router.get('/audit', ensureAuthenticated, ensureRole(['OWNER', 'MANAGER']), auditController.getAudit);

module.exports = router;