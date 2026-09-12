const menuModel = require('../models/menuModel');
const inventoryModel = require('../models/inventoryModel');
const imageFile = require('../config/imageFile');

// panel tabs for the menu management page
const PANELS = [
  { key: 'list', label: 'Menu List', hint: 'Every item, its category and its recipe cost.' },
  { key: 'add', label: 'Add Menu Item', hint: 'Create a new item. Nothing else on this screen can be edited.' },
  { key: 'edit', label: 'Edit Item', hint: 'Pick an item, change its details, or remove it.' },
  { key: 'recipe', label: 'Edit Recipe', hint: 'Set which ingredients an item consumes per serving.' }
];

const PANEL_KEYS = PANELS.map((p) => p.key);

// get image path from uploaded file or form url
function getImageUrlFromRequest(req) {
  if (req.file?.filename) return imageFile.urlFor(req.file.filename);
  return req.body.image_url || null;
}

// redirect back to the active panel
const backTo = (panel, menuItemId) => `/menu?panel=${panel}${menuItemId ? `&item=${menuItemId}` : ''}`;

// show menu page and fetch data for the selected panel
async function getMenu(req, res) {
  const requested = String(req.query.panel || 'list').toLowerCase();
  const panel = PANEL_KEYS.includes(requested) ? requested : 'list';

  const view = {
    user: req.session.user,
    panels: PANELS,
    panel,
    panelMeta: PANELS.find((p) => p.key === panel),
    menuItems: [],
    menuNames: [],
    ingredients: [],
    selectedMenuId: 0,
    selectedItem: null,
    selectedRecipe: [],
    parentGroups: [],
    subCategories: []
  };

  if (panel === 'list') {
    view.menuItems = await menuModel.getAllMenu();
  } else if (panel === 'add') {
    const options = await menuModel.getCategoryOptions();
    view.parentGroups = options.parentGroups;
    view.subCategories = options.subCategories;
  } else if (panel === 'edit' || panel === 'recipe') {
    view.menuNames = await menuModel.listMenuNames();
    view.selectedMenuId = Number(req.query.item || view.menuNames[0]?.id || 0);

    const [item, options, ingredients, recipe] = await Promise.all([
      view.selectedMenuId ? menuModel.getMenuById(view.selectedMenuId) : null,
      panel === 'edit' ? menuModel.getCategoryOptions() : null,
      panel === 'recipe' ? inventoryModel.getAllIngredients() : null,
      panel === 'recipe' && view.selectedMenuId ? menuModel.getRecipe(view.selectedMenuId) : []
    ]);

    view.selectedItem = item;
    if (panel === 'edit') {
      view.parentGroups = options.parentGroups;
      view.subCategories = options.subCategories;
    } else {
      view.ingredients = ingredients;
      view.selectedRecipe = recipe;
    }
  }

  res.render('menu', view);
}

// create a new menu item and open its recipe setup
async function postMenuItem(req, res) {
  const { item_name, parent_group, sub_category, sell_price } = req.body;
  const image_url = getImageUrlFromRequest(req);

  const menuItemId = await menuModel.createMenuItem({
    item_name,
    parent_group,
    sub_category,
    sell_price,
    image_url
  });

  res.redirect(backTo('recipe', menuItemId));
}

// update item details and replace image if a new one was uploaded
async function postUpdateMenuItem(req, res) {
  const menuItemId = Number(req.params.id);
  const { item_name, parent_group, sub_category, sell_price, is_active, existing_image_url } = req.body;
  const image_url = getImageUrlFromRequest(req) || existing_image_url || null;

  await menuModel.updateMenuItem(menuItemId, {
    item_name,
    parent_group: parent_group?.trim() || 'General',
    sub_category: sub_category?.trim() || 'General',
    sell_price,
    image_url,
    is_active: String(is_active) === '1'
  });

  res.redirect(backTo('edit', menuItemId));
}

// save ingredient portions used per serving
async function postRecipe(req, res) {
  const menuItemId = Number(req.body.menu_item_id);
  const ingredientIds = [].concat(req.body.ingredient_id || []);
  const qtys = [].concat(req.body.qty_required || []);

  const recipeRows = ingredientIds
    .map((id, idx) => ({ ingredient_id: Number(id), qty_required: Number(qtys[idx]) }))
    .filter((r) => r.ingredient_id && r.qty_required > 0);

  await menuModel.replaceRecipe(menuItemId, recipeRows);
  res.redirect(backTo('recipe', menuItemId));
}

// remove an item or deactivate it if already used in sales
async function postDeleteMenuItem(req, res) {
  await menuModel.deleteMenuItem(Number(req.params.id));
  res.redirect(backTo('list'));
}

module.exports = { getMenu, postMenuItem, postUpdateMenuItem, postDeleteMenuItem, postRecipe, PANELS };