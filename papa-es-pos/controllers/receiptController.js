const salesModel = require('../models/salesModel');
const auditModel = require('../models/auditModel');

// store info for receipt header
const STORE = {
  name: process.env.STORE_NAME || 'PAPA ES DINER',
  address: process.env.STORE_ADDRESS || 'Poblacion, Philippines',
  contact: process.env.STORE_CONTACT || '',
  tin: process.env.STORE_TIN || ''
};

// thermal paper width presets (character limits per line)
const WIDTHS = { '58': 32, '80': 48 };

// render receipt view and track prints/reprints
async function getReceipt(req, res) {
  const saleId = Number(req.params.id);
  const sale = await salesModel.getSaleById(saleId);

  if (!sale) {
    return res.status(404).render('error', { user: req.session.user, message: 'That receipt does not exist.' });
  }

  const items = await salesModel.getSaleItems(saleId);
  const width = WIDTHS[String(req.query.width)] ? String(req.query.width) : '80';
  const autoprint = String(req.query.autoprint || '') === '1';

  // check if this receipt was already printed before
  const isReprint = Boolean(sale.receipt_printed_at);

  if (autoprint) {
    await salesModel.markReceiptPrinted(saleId, { reprint: isReprint });

    // log if someone is reprinting an old receipt
    if (isReprint) {
      await auditModel.logAudit({
        userId: req.session.user.id,
        action: 'RECEIPT_REPRINTED',
        entityType: 'SALE',
        entityId: saleId,
        details: { or_number: sale.or_number, previous_reprints: Number(sale.reprint_count) || 0 }
      });
    }
  }

  return res.render('receipt', {
    user: req.session.user,
    store: STORE,
    sale,
    items,
    width,
    columns: WIDTHS[width],
    autoprint,
    isReprint
  });
}

module.exports = { getReceipt, STORE, WIDTHS };