const salesModel = require('../models/salesModel');
const inventoryModel = require('../models/inventoryModel');
const voidModel = require('../models/voidModel');

// panel tabs for the reports page
const PANELS = [
  { key: 'sales', label: 'Sales Report', hint: 'Every sale for the selected day.' },
  { key: 'voids', label: 'Void Report', hint: 'Void requests raised that day, and who authorized them.' },
  { key: 'receipts', label: 'Receipt History', hint: 'Find a past receipt by OR number or cashier, then reprint it.' },
  { key: 'usage', label: 'Inventory Usage', hint: "Ingredients consumed by the day's sales, derived from recipes." },
  { key: 'stock', label: 'Low Stock', hint: 'Ingredients at or below their reorder level.' }
];

const PANEL_KEYS = PANELS.map((p) => p.key);
const today = () => new Date().toLocaleDateString('en-CA');
const money = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

// calculate summary numbers for completed orders
function summarize(sales) {
  const completed = sales.filter((s) => s.status === 'COMPLETED');
  return {
    count: completed.length,
    voided: sales.length - completed.length,
    gross: money(completed.reduce((sum, s) => sum + Number(s.subtotal_amount || 0), 0)),
    discounts: money(completed.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0)),
    net: money(completed.reduce((sum, s) => sum + Number(s.total_amount || 0), 0))
  };
}

// show reports page and only fetch data for the open panel
async function getReports(req, res) {
  const requested = String(req.query.panel || 'sales').toLowerCase();
  const panel = PANEL_KEYS.includes(requested) ? requested : 'sales';
  const date = req.query.date || today();
  const query = String(req.query.q || '').trim();

  const data = { sales: [], salesSummary: null, voids: [], receipts: [], usage: [], lowStock: [] };

  if (panel === 'sales') {
    data.sales = await salesModel.getSalesByDate(date);
    data.salesSummary = summarize(data.sales);
  } else if (panel === 'voids') {
    data.voids = await voidModel.listByDate(date);
  } else if (panel === 'receipts') {
    // drop date filter when searching by or number
    data.receipts = await salesModel.searchReceipts({ date: query ? null : date, query });
  } else if (panel === 'usage') {
    data.usage = await inventoryModel.getUsageByDate(date);
  } else if (panel === 'stock') {
    data.lowStock = await inventoryModel.getLowStock();
  }

  res.render('reports', {
    user: req.session.user,
    panels: PANELS,
    panel,
    panelMeta: PANELS.find((entry) => entry.key === panel),
    date,
    query,
    ...data
  });
}

module.exports = { getReports, PANELS };