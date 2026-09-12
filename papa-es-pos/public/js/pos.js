(function () {
  const CONTEXT = window.POS_CONTEXT || {};
  const pricing = window.PapaPricing;

  const QUICK_CASH = [50, 100, 200, 500, 1000];
  const DIGITAL_METHODS = ['GCASH', 'MAYA'];

  // ---- State --------------------------------------------------------------
  let cart = [];
  let clientOrderRef = 'ORDER-' + Date.now();
  let orderType = 'DINE_IN';
  let paymentMethod = 'CASH';
  let orderDiscountType = 'NONE';
  let paymentConfirmed = false;
  let cashEntry = '';
  let pendingCount = Number(CONTEXT.pendingVoidCount) || 0;
  let cachedAuthorizers = [];

  let currentOpenSaleId = null;
  let currentTableNumber = '';

  let discountTargetIndex = null;
  let lineDiscountType = 'NONE';
  let voidTargetIndex = null;
  let activeRequest = null;

  // ---- Helpers ------------------------------------------------------------
  const el = (id) => document.getElementById(id);
  const peso = (v) => '₱' + Number(v || 0).toFixed(2);
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  function setActive(container, attr, val) {
    if (!container) return;
    container.querySelectorAll('[' + attr + ']').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute(attr) === val);
    });
  }

  function showModal(id) {
    const m = el(id);
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
  }

  function hideModal(id) {
    const m = el(id);
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  }

  function say(message, tone) {
    const target = el('result');
    if (!target) return;
    target.className = 'text-sm ' + (tone === 'ok' ? 'text-green-300' : tone === 'warn' ? 'text-papaGold' : 'text-red-300');
    target.textContent = message || '';
  }

  const needsKeyedValue = (type) => type === 'PERCENT' || type === 'AMOUNT';

  function describeDiscount(type, value) {
    const kind = String(type || 'NONE').toUpperCase();
    if (kind === 'NONE') return '';
    if (kind === 'AMOUNT') return peso(value) + ' off';
    return pricing.describeDiscount(kind, value);
  }

  // ---- Cart Calculations & Render -----------------------------------------
  function orderDiscountValue() {
    return needsKeyedValue(orderDiscountType) ? Number(el('orderDiscountValue').value) || 0 : 0;
  }

  function totals() {
    return pricing.computeOrder({
      items: cart,
      discountType: orderDiscountType,
      discountValue: orderDiscountValue()
    });
  }

  function addToCart(item) {
    const existing = cart.find((l) => l.menu_item_id === item.menu_item_id && l.discount_type === 'NONE' && l.voided_qty === 0);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        unit_price: item.unit_price,
        quantity: 1,
        voided_qty: 0,
        discount_type: 'NONE',
        discount_value: 0
      });
    }
    render();
  }

  function changeQty(index, delta) {
    const line = cart[index];
    if (!line) return;
    const floor = Math.max(1, line.voided_qty);
    const next = line.quantity + delta;
    if (next < floor) {
      if (line.voided_qty === 0) removeLine(index);
      return;
    }
    line.quantity = next;
    render();
  }

  function removeLine(index) {
    const line = cart[index];
    if (!line || line.voided_qty > 0) return;
    cart.splice(index, 1);
    render();
  }

  function renderCart() {
    const list = el('cartList');
    const computed = totals();
    list.innerHTML = '';

    computed.lines.forEach((line, index) => {
      const discountLabel = describeDiscount(line.discount_type, line.discount_value);
      const row = document.createElement('div');
      row.className = 'cart-line' + (line.active_qty === 0 ? ' is-voided' : '');
      row.setAttribute('data-index', String(index));
      row.innerHTML = [
        '<div class="flex justify-between gap-2">',
        '  <div class="flex-1 min-w-0">',
        '    <p class="font-semibold truncate">' + escapeHtml(line.item_name) + '</p>',
        '    <p class="text-xs text-white/50">' + peso(line.unit_price) + ' × ' + line.active_qty + '</p>',
        line.voided_qty > 0 ? '    <p class="text-xs text-red-300">' + line.voided_qty + ' voided</p>' : '',
        discountLabel ? '    <p class="text-xs text-papaGold">' + escapeHtml(discountLabel) + ' (−' + peso(line.discount_amount) + ')</p>' : '',
        '  </div>',
        '  <p class="font-bold whitespace-nowrap">' + peso(line.line_total) + '</p>',
        '</div>',
        '<div class="flex items-center justify-between mt-2">',
        '  <div class="flex items-center gap-2">',
        '    <button type="button" class="step-btn" data-qty-step="-1">−</button>',
        '    <span class="w-8 text-center font-bold">' + line.quantity + '</span>',
        '    <button type="button" class="step-btn" data-qty-step="1">+</button>',
        '    <button type="button" class="mini-btn" data-action="discount">Discount</button>',
        line.voided_qty === 0 ? '    <button type="button" class="mini-btn mini-btn-danger" data-action="remove" title="Cancel line">✕</button>' : '',
        '  </div>',
        '  <button type="button" class="mini-btn border border-red-900/60 text-white hover:bg-red-900/30" data-action="void" title="Void item">Void</button>',
        '</div>'
      ].join('');
      list.appendChild(row);
    });

    el('cartEmpty').classList.toggle('hidden', cart.length > 0);
  }

  function renderTotals(computed) {
    const sums = computed || totals();
    el('subtotalAmount').textContent = peso(sums.subtotal_amount);
    el('lineDiscountAmount').textContent = '−' + peso(sums.line_discount_total);
    el('discountAmount').textContent = '−' + peso(sums.order_discount_amount);
    el('totalAmount').textContent = peso(sums.total_amount);

    el('lineDiscountRow').classList.toggle('hidden', sums.line_discount_total <= 0);
    el('orderDiscountRow').classList.toggle('hidden', sums.order_discount_amount <= 0);

    if (el('vatRemovedAmount')) el('vatRemovedAmount').textContent = '−' + peso(sums.vat_removed_total || 0);
    if (el('vatRemovedRow')) el('vatRemovedRow').classList.toggle('hidden', (sums.vat_removed_total || 0) <= 0);
    if (el('vatableSales')) el('vatableSales').textContent = peso(sums.vatable_sales || 0);
    if (el('vatAmount')) el('vatAmount').textContent = peso(sums.vat_amount || 0);
    if (el('vatExemptSales')) el('vatExemptSales').textContent = peso(sums.vat_exempt_sales || 0);
    if (el('vatExemptRow')) el('vatExemptRow').classList.toggle('hidden', (sums.vat_exempt_sales || 0) <= 0);

    const hasSeniorOrPwd = orderDiscountType === 'SENIOR' || orderDiscountType === 'PWD' || cart.some(l => l.discount_type === 'SENIOR' || l.discount_type === 'PWD');
    el('discountIdRow').classList.toggle('hidden', !hasSeniorOrPwd);

    const label = describeDiscount(sums.order_discount_type, sums.order_discount_value);
    el('orderDiscountLabel').textContent = label ? 'Order discount (' + label + ')' : 'Order discount';
    return sums;
  }

  function renderChange(sums) {
    const tender = pricing.changeFor(sums.total_amount, cashEntry === '' ? 0 : Number(cashEntry));
    const target = el('changeAmount');

    if (paymentMethod !== 'CASH') {
      target.textContent = peso(0);
      target.className = 'font-bold';
      return tender;
    }

    if (cashEntry === '') {
      target.textContent = peso(0);
      target.className = 'font-bold';
    } else if (tender.settled) {
      target.textContent = peso(tender.change);
      target.className = 'font-bold text-papaGold';
    } else {
      target.textContent = 'short ' + peso(tender.short);
      target.className = 'font-bold text-red-300';
    }
    return tender;
  }

  function renderQuickCash(sums) {
    const holder = el('quickCashButtons');
    holder.innerHTML = '';
    const options = [sums.total_amount].concat(QUICK_CASH.filter((n) => n >= sums.total_amount));

    options.slice(0, 4).forEach((amount) => {
      if (amount <= 0) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mini-btn';
      button.textContent = amount === sums.total_amount ? 'Exact' : String(amount);
      button.addEventListener('click', () => {
        cashEntry = Number(amount).toFixed(2);
        el('cashReceived').value = cashEntry;
        render();
      });
      holder.appendChild(button);
    });
  }

  function renderPaymentState(sums) {
    const isCash = paymentMethod === 'CASH';
    const isDigital = DIGITAL_METHODS.indexOf(paymentMethod) >= 0;

    el('cashSection').classList.toggle('hidden', !isCash);
    el('digitalSection').classList.toggle('hidden', !isDigital);
    el('cardSection').classList.toggle('hidden', paymentMethod !== 'CARD');
    el('confirmRow').classList.toggle('hidden', isCash);

    if (isDigital) {
      const path = '/img/qr/' + paymentMethod.toLowerCase() + '.png';
      const image = el('qrImage');
      el('qrMethodLabel').textContent = paymentMethod === 'GCASH' ? 'GCash' : 'Maya';
      el('qrPath').textContent = path;
      image.onerror = () => { image.classList.add('hidden'); el('qrPlaceholder').classList.remove('hidden'); };
      image.onload = () => { image.classList.remove('hidden'); el('qrPlaceholder').classList.add('hidden'); };
      if (image.getAttribute('src') !== path) image.setAttribute('src', path);
    }

    const pill = el('paymentStatusPill');
    pill.textContent = paymentConfirmed ? 'Confirmed' : 'Pending';
    pill.className = 'pill ' + (paymentConfirmed ? 'pill-confirmed' : 'pill-pending');
    el('confirmPaymentBtn').textContent = paymentConfirmed ? 'Undo confirmation' : 'Mark as Paid';

    const tender = renderChange(sums);
    const cashOk = !isCash || (cashEntry !== '' && tender.settled);
    const confirmOk = isCash || paymentConfirmed;

    el('completeOrderBtn').disabled = !(sums.active_line_count > 0 && cashOk && confirmOk);
    if (el('holdOrderBtn')) el('holdOrderBtn').disabled = !(sums.active_line_count > 0);
  }

  function render() {
    renderCart();
    const sums = renderTotals();
    renderQuickCash(sums);
    renderPaymentState(sums);

    if (el('loadedTableBanner')) {
      el('loadedTableBanner').classList.toggle('hidden', !currentOpenSaleId);
      if (currentOpenSaleId) el('loadedTableLabel').textContent = `Settling Tab: ${currentTableNumber}`;
    }
    if (el('tableSelectContainer')) {
      el('tableSelectContainer').classList.toggle('hidden', orderType !== 'DINE_IN');
    }
  }

  // ---- Keypad & Cash ------------------------------------------------------
  function cashKey(key) {
    if (key === '.') {
      if (cashEntry.indexOf('.') >= 0) return;
      cashEntry = (cashEntry || '0') + '.';
    } else if (cashEntry.indexOf('.') >= 0 && cashEntry.split('.')[1].length >= 2) {
      return;
    } else {
      cashEntry = (cashEntry === '0' ? '' : cashEntry) + key;
    }
    el('cashReceived').value = cashEntry;
    render();
  }

  function cashBackspace() {
    cashEntry = cashEntry.slice(0, -1);
    el('cashReceived').value = cashEntry;
    render();
  }

  function togglePaymentConfirmed() {
    paymentConfirmed = !paymentConfirmed;
    render();
  }

  // ---- Line Discount Modal ------------------------------------------------
  function renderLineDiscountModal() {
    const line = cart[discountTargetIndex];
    if (!line) return;
    setActive(el('lineDiscountGroup'), 'data-line-discount', lineDiscountType);
    el('lineDiscountValueRow').classList.toggle('hidden', !needsKeyedValue(lineDiscountType));
    el('lineDiscountUnit').textContent = lineDiscountType === 'AMOUNT' ? '₱' : '%';

    const val = needsKeyedValue(lineDiscountType) ? Number(el('lineDiscountValue').value) || 0 : 0;
    const preview = pricing.computeLine({
      unit_price: line.unit_price,
      quantity: line.quantity,
      voided_qty: line.voided_qty,
      discount_type: lineDiscountType,
      discount_value: val
    });

    el('lineDiscountPreview').textContent = lineDiscountType === 'NONE'
      ? 'Line stays at ' + peso(preview.line_total) + '.'
      : 'Less ' + peso(preview.discount_amount) + ' → ' + peso(preview.line_total) + '.';
  }

  function openLineDiscount(index) {
    const line = cart[index];
    if (!line) return;
    discountTargetIndex = index;
    lineDiscountType = line.discount_type || 'NONE';
    el('lineDiscountValue').value = line.discount_value || 0;
    el('lineDiscountItem').textContent = line.item_name + ' — ' + peso(line.unit_price) + ' × ' + line.quantity;
    renderLineDiscountModal();
    showModal('lineDiscountModal');
  }

  function closeLineDiscount() {
    hideModal('lineDiscountModal');
    discountTargetIndex = null;
  }

  function applyLineDiscount() {
    const line = cart[discountTargetIndex];
    if (line) {
      line.discount_type = lineDiscountType;
      line.discount_value = needsKeyedValue(lineDiscountType) ? Number(el('lineDiscountValue').value) || 0 : 0;
    }
    closeLineDiscount();
    render();
  }

  // ---- Void Requests & PIN Authorization -----------------------------------
  function openVoidModal(index) {
    const line = cart[index];
    if (!line) return;
    const remaining = line.quantity - line.voided_qty;
    if (remaining <= 0) return;

    voidTargetIndex = index;
    el('voidItemLabel').textContent = `${line.item_name} — ${remaining} of ${line.quantity} can still be voided`;
    el('voidNotice').textContent = CONTEXT.canAuthorizeVoids
      ? 'Authorize with your manager PIN on the next screen.'
      : 'A manager or owner must key their PIN to authorize this void.';
    el('voidQty').value = 1;
    el('voidQty').max = remaining;
    el('voidReason').value = '';
    el('voidError').textContent = '';
    setActive(el('voidReasonGroup'), 'data-void-reason', '');
    showModal('voidModal');
  }

  function closeVoidModal() {
    hideModal('voidModal');
    voidTargetIndex = null;
  }

  function stepVoidQty(delta) {
    const line = cart[voidTargetIndex];
    if (!line) return;
    const remaining = line.quantity - line.voided_qty;
    el('voidQty').value = Math.min(remaining, Math.max(1, (Number(el('voidQty').value) || 1) + delta));
  }

  async function submitVoidRequest() {
    const line = cart[voidTargetIndex];
    if (!line) return;
    const reason = el('voidReason').value.trim();
    if (reason.length < 3) {
      el('voidError').textContent = 'Enter a reason (at least 3 characters).';
      return;
    }

    const qty = Math.max(1, Number(el('voidQty').value) || 1);
    const targetIdx = voidTargetIndex;
    const btn = el('voidSubmitBtn');
    btn.disabled = true;

    try {
      const res = await fetch('/void/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: currentOpenSaleId || null,
          clientOrderRef: clientOrderRef,
          menuItemId: line.menu_item_id,
          itemName: line.item_name,
          requestType: (qty >= (line.quantity - line.voided_qty)) ? 'VOID_ITEM' : 'VOID_QTY',
          voidQty: qty,
          unitPrice: line.unit_price,
          lineAmount: pricing.round2(line.unit_price * qty),
          reason: reason
        })
      });
      const data = await res.json();
      if (!res.ok) {
        el('voidError').textContent = data.message || 'Could not submit void request.';
        return;
      }

      setPendingCount(data.pendingCount);
      closeVoidModal();

      if (!data.authorizersAvailable) {
        say('Void request #' + data.requestId + ' logged. Manager PIN required.', 'warn');
        return;
      }

      await openPinModal({
        requestId: data.requestId,
        label: `${line.item_name} × ${qty}`,
        cartIndex: targetIdx,
        qty: qty,
        isDraft: true
      });
    } catch (e) {
      el('voidError').textContent = 'Network error — try again.';
    } finally {
      btn.disabled = false;
    }
  }

  async function populateAuthorizerDropdown() {
    const select = el('pinAuthorizerSelect');
    if (!select) return;

    if (!cachedAuthorizers.length) {
      try {
        const res = await fetch('/void/pending', { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (Array.isArray(data.authorizers)) {
          cachedAuthorizers = data.authorizers;
        }
      } catch (e) { /* ignore */ }
    }

    select.innerHTML = '<option value="">Select Authorizer</option>';
    cachedAuthorizers.forEach((mgr) => {
      const opt = document.createElement('option');
      opt.value = mgr.id;
      opt.textContent = `${mgr.full_name} (${mgr.role})`;
      select.appendChild(opt);
    });
  }

  async function openPinModal(request) {
    activeRequest = request;
    el('pinRequestLabel').textContent = 'Request #' + request.requestId + ' — ' + request.label;
    el('pinInput').value = '';
    el('pinError').textContent = '';
    await populateAuthorizerDropdown();
    if (el('pinAuthorizerSelect')) el('pinAuthorizerSelect').value = '';
    showModal('pinModal');
  }

  function closePinModal() {
    hideModal('pinModal');
    activeRequest = null;
  }

  function pinKey(k) { if (el('pinInput').value.length < 6) el('pinInput').value += k; }
  function pinBackspace() { el('pinInput').value = el('pinInput').value.slice(0, -1); }
  function pinClear() { el('pinInput').value = ''; }

  async function decideVoid(decision) {
    if (!activeRequest) return;
    const authorizerId = el('pinAuthorizerSelect') ? el('pinAuthorizerSelect').value : '';
    if (!authorizerId) {
      el('pinError').textContent = 'Select an authorizing manager.';
      return;
    }

    const pin = el('pinInput').value;
    if (pin.length < 4) {
      el('pinError').textContent = 'Enter the 4-6 digit manager PIN.';
      return;
    }

    const req = activeRequest;
    try {
      const res = await fetch('/void/' + req.requestId + '/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, pin, authorizerId: Number(authorizerId) })
      });
      const data = await res.json();
      if (!res.ok) {
        el('pinError').textContent = data.message || 'Authorization failed.';
        el('pinInput').value = '';
        return;
      }

      setPendingCount(data.pendingCount);
      closePinModal();

      if (decision === 'APPROVED' && req.isDraft && typeof req.cartIndex === 'number') {
        const line = cart[req.cartIndex];
        if (line) {
          line.voided_qty = Math.min(line.quantity, line.voided_qty + req.qty);
          render();
        }
      }

      say(data.message, decision === 'APPROVED' ? 'ok' : 'warn');
      if (!el('approvalsModal').classList.contains('hidden')) loadApprovals();
    } catch (e) {
      el('pinError').textContent = 'Network error — try again.';
    }
  }

  function setPendingCount(count) {
    pendingCount = Number(count) || 0;
    const badge = el('pendingVoidBadge');
    if (badge) {
      badge.textContent = String(pendingCount);
      badge.classList.toggle('hidden', pendingCount === 0);
    }
  }

  async function loadApprovals() {
    const list = el('approvalsList');
    list.innerHTML = '<p class="text-sm text-white/50">Loading…</p>';
    try {
      const res = await fetch('/void/pending', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      setPendingCount(data.pendingCount);
      if (Array.isArray(data.authorizers)) {
        cachedAuthorizers = data.authorizers;
      }

      if (!data.requests.length) {
        list.innerHTML = '<p class="text-sm text-white/50">Nothing is waiting for approval.</p>';
        return;
      }

      list.innerHTML = '';
      data.requests.forEach((req) => {
        const row = document.createElement('div');
        row.className = 'border border-slate-700 rounded p-3 flex items-start justify-between gap-3';
        row.innerHTML = [
          '<div class="min-w-0">',
          '  <p class="font-semibold truncate">' + escapeHtml(req.item_name) + ' × ' + req.void_qty + '</p>',
          '  <p class="text-xs text-white/50">#' + req.id + ' · ' + escapeHtml(req.request_type) + ' · ' + escapeHtml(req.requested_by_name) + '</p>',
          '  <p class="text-xs text-white/70 mt-1">' + escapeHtml(req.reason || '') + '</p>',
          '</div>',
          '<button type="button" class="mini-btn">Authorize</button>'
        ].join('');
        row.querySelector('button').addEventListener('click', () => {
          openPinModal({ requestId: req.id, label: req.item_name + ' × ' + req.void_qty, isDraft: false });
        });
        list.appendChild(row);
      });
    } catch (e) {
      list.innerHTML = '<p class="text-sm text-red-300">Could not load pending requests.</p>';
    }
  }

  function openApprovals() { showModal('approvalsModal'); loadApprovals(); }
  function closeApprovals() { hideModal('approvalsModal'); }

  // ---- Table Tabs (Hold & Recall) -----------------------------------------
  async function refreshActiveTablesBadge() {
    try {
      const res = await fetch('/pos/active-tables');
      const data = await res.json();
      const badge = el('activeTablesBadge');
      if (badge && data.tables) {
        badge.textContent = data.tables.length;
        badge.classList.toggle('hidden', data.tables.length === 0);
      }
    } catch (e) { /* ignore */ }
  }

  async function openActiveTablesModal() {
    const list = el('activeTablesList');
    list.innerHTML = '<p class="text-white/50 text-xs">Loading active tables…</p>';
    showModal('activeTablesModal');
    try {
      const res = await fetch('/pos/active-tables');
      const data = await res.json();
      if (!data.tables || !data.tables.length) {
        list.innerHTML = '<p class="text-white/50 text-sm py-4 text-center">No active dining tables at the moment.</p>';
        return;
      }
      list.innerHTML = '';
      data.tables.forEach((tab) => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-slate-800 border border-slate-700 hover:border-papaGold rounded-lg flex items-center justify-between cursor-pointer transition';
        item.innerHTML = [
          '<div><p class="font-bold text-white text-base">' + escapeHtml(tab.table_number || 'Dine-In') + '</p>',
          '<p class="text-xs text-white/60">' + tab.item_count + ' items</p></div>',
          '<div class="text-right"><p class="text-papaGold font-bold text-base">' + peso(tab.total_amount) + '</p></div>'
        ].join('');
        item.addEventListener('click', () => loadTableIntoCart(tab.id, tab.table_number));
        list.appendChild(item);
      });
    } catch (e) {
      list.innerHTML = '<p class="text-red-400 text-xs">Could not load active tables.</p>';
    }
  }

  async function loadTableIntoCart(saleId, tableNumber) {
    try {
      const res = await fetch(`/sales/${saleId}/items`);
      const data = await res.json();
      if (!res.ok) return say(data.message || 'Failed to fetch tab.', 'error');
      const rows = Array.isArray(data) ? data : (data.items || []);

      cart = rows.map(l => ({
        menu_item_id: Number(l.menu_item_id),
        item_name: l.item_name,
        unit_price: Number(l.unit_price),
        quantity: Number(l.quantity),
        voided_qty: Number(l.voided_qty || 0),
        discount_type: l.discount_type || 'NONE',
        discount_value: Number(l.discount_value || 0)
      })).filter(l => (l.quantity - l.voided_qty) > 0);

      currentOpenSaleId = saleId;
      currentTableNumber = tableNumber;
      orderType = 'DINE_IN';
      if (el('tableNumberSelect')) el('tableNumberSelect').value = tableNumber;
      hideModal('activeTablesModal');
      say(`Loaded ${tableNumber}. Ready to add items or settle.`, 'ok');
      render();
    } catch (e) {
      say('Failed to load table items.', 'error');
    }
  }

  function closeActiveTablesModal() { hideModal('activeTablesModal'); }

  async function holdOrderToKitchen() {
    const sums = totals();
    if (sums.active_line_count === 0) return say('Add at least one unvoided item to fire.', 'warn');
    const rawTable = el('tableNumberSelect') ? el('tableNumberSelect').value.trim() : '';
    if (orderType === 'DINE_IN' && !rawTable) return say('Select or enter a Table Number before holding.', 'error');

    const btn = el('holdOrderBtn');
    btn.disabled = true;
    say('Saving tab to kitchen…', 'warn');

    try {
      const res = await fetch('/pos/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openSaleId: currentOpenSaleId,
          cart: cart.map(l => ({
            menu_item_id: l.menu_item_id,
            quantity: l.quantity,
            voided_qty: l.voided_qty,
            discount_type: l.discount_type,
            discount_value: l.discount_value
          })),
          tableNumber: rawTable || 'Counter',
          orderType: orderType,
          orderNote: el('orderNote').value
        })
      });
      const data = await res.json();
      if (!res.ok) return say(data.message || 'Failed to hold order.', 'error');
      say(data.message, 'ok');

      // Auto-open Kitchen Prep Slip print dialog
      const targetSaleId = data.saleId || data.id || (data.sale && data.sale.id) || currentOpenSaleId;
      const targetUrl = data.receiptUrl 
        ? `${data.receiptUrl}&type=kitchen&autoprint=1` 
        : (targetSaleId ? `/receipt/${targetSaleId}?type=kitchen&autoprint=1` : null);

      if (targetUrl) {
        window.open(targetUrl, '_blank', 'width=420,height=720');
      }

      clearOrder();
      refreshActiveTablesBadge();
    } catch (e) {
      say('Network error firing order to kitchen.', 'error');
    } finally {
      btn.disabled = false;
      render();
    }
  }

  // ---- Settle / Complete Order --------------------------------------------
  function clearOrder() {
    cart = [];
    currentOpenSaleId = null;
    currentTableNumber = '';
    clientOrderRef = 'ORDER-' + Date.now();
    orderDiscountType = 'NONE';
    el('orderDiscountValue').value = 0;
    setActive(el('orderDiscountGroup'), 'data-discount-type', 'NONE');
    el('orderDiscountValueRow').classList.add('hidden');
    el('discountIdRow').classList.add('hidden');
    el('discountIdName').value = '';
    el('discountIdNumber').value = '';
    el('orderNote').value = '';
    el('paymentRef').value = '';
    el('cardRef').value = '';
    if (el('tableNumberSelect')) el('tableNumberSelect').value = '';
    cashEntry = '';
    el('cashReceived').value = '';
    paymentConfirmed = false;
    render();
  }

  function detachActiveTable() {
    currentOpenSaleId = null;
    currentTableNumber = '';
    clearOrder();
    say('Switched to new order tab.', 'warn');
  }

  async function completeOrder() {
    const sums = totals();
    if (sums.active_line_count === 0) return say('Add at least one item that is not voided.', 'warn');
    const rawTable = el('tableNumberSelect') ? el('tableNumberSelect').value.trim() : '';
    if (orderType === 'DINE_IN' && !rawTable) {
      return say('Select or enter a Table Number for Dine In orders.', 'error');
    }
    const button = el('completeOrderBtn');
    button.disabled = true;
    say('Settling order…', 'warn');

    try {
      const res = await fetch('/pos/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openSaleId: currentOpenSaleId,
          tableNumber: el('tableNumberSelect') ? el('tableNumberSelect').value.trim() : null,
          cart: cart.map(l => ({
            menu_item_id: l.menu_item_id,
            quantity: l.quantity,
            voided_qty: l.voided_qty,
            discount_type: l.discount_type,
            discount_value: l.discount_value
          })),
          cashReceived: paymentMethod === 'CASH' ? Number(cashEntry || 0) : sums.total_amount,
          paymentMethod: paymentMethod,
          paymentStatus: paymentMethod === 'CASH' || paymentConfirmed ? 'PAID' : 'PENDING',
          paymentRef: paymentMethod === 'CARD' ? el('cardRef').value : el('paymentRef').value,
          orderType: orderType,
          orderNote: el('orderNote').value,
          discountType: orderDiscountType,
          discountValue: orderDiscountValue(),
          discountIdName: el('discountIdName').value,
          discountIdNumber: el('discountIdNumber').value
        })
      });
      const data = await res.json();
      if (!res.ok) return say(data.message || 'Could not complete this order.', 'error');

      say(data.orNumber + ' settled — total ' + peso(data.totalAmount) + (data.change > 0 ? ', change ' + peso(data.change) : '') + '.', 'ok');
      if (data.receiptUrl) window.open(data.receiptUrl, '_blank', 'width=420,height=720');
      clearOrder();
      refreshActiveTablesBadge();
    } catch (e) {
      say('Network error — order was not saved.', 'error');
    } finally {
      button.disabled = false;
      render();
    }
  }

  // ---- Wiring -------------------------------------------------------------
  document.addEventListener('click', (event) => {
    const card = event.target.closest('#menuGrid .menu-card');
    if (!card) return;
    addToCart({
      menu_item_id: Number(card.getAttribute('data-id')),
      item_name: card.getAttribute('data-name'),
      unit_price: Number(card.getAttribute('data-price'))
    });
  });

  el('cartList').addEventListener('click', (event) => {
    const row = event.target.closest('[data-index]');
    if (!row) return;
    const index = Number(row.getAttribute('data-index'));

    const stepper = event.target.closest('[data-qty-step]');
    if (stepper) return changeQty(index, Number(stepper.getAttribute('data-qty-step')));

    const action = event.target.closest('[data-action]');
    if (!action) return;
    const name = action.getAttribute('data-action');
    if (name === 'discount') openLineDiscount(index);
    if (name === 'void') openVoidModal(index);
    if (name === 'remove') removeLine(index);
  });

  el('orderTypeGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-order-type]');
    if (!btn) return;
    orderType = btn.getAttribute('data-order-type');
    setActive(el('orderTypeGroup'), 'data-order-type', orderType);
    render();
  });

  el('orderDiscountGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-discount-type]');
    if (!btn) return;
    orderDiscountType = btn.getAttribute('data-discount-type');
    setActive(el('orderDiscountGroup'), 'data-discount-type', orderDiscountType);
    const keyed = needsKeyedValue(orderDiscountType);
    el('orderDiscountValueRow').classList.toggle('hidden', !keyed);
    el('orderDiscountUnit').textContent = orderDiscountType === 'AMOUNT' ? '₱' : '%';
    if (!keyed) el('orderDiscountValue').value = 0;
    render();
  });

  el('orderDiscountValue').addEventListener('input', render);

  document.querySelectorAll('[data-order-discount-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.getAttribute('data-order-discount-step'));
      const input = el('orderDiscountValue');
      const size = orderDiscountType === 'AMOUNT' ? 5 : 1;
      input.value = Math.max(0, (Number(input.value) || 0) + step * size);
      render();
    });
  });

  el('paymentGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-payment]');
    if (!btn) return;
    paymentMethod = btn.getAttribute('data-payment');
    setActive(el('paymentGroup'), 'data-payment', paymentMethod);
    paymentConfirmed = false;
    render();
  });

  el('lineDiscountGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-line-discount]');
    if (!btn) return;
    lineDiscountType = btn.getAttribute('data-line-discount');
    if (!needsKeyedValue(lineDiscountType)) el('lineDiscountValue').value = 0;
    renderLineDiscountModal();
  });

  el('lineDiscountValue').addEventListener('input', renderLineDiscountModal);

  document.querySelectorAll('[data-line-discount-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.getAttribute('data-line-discount-step'));
      const input = el('lineDiscountValue');
      const size = lineDiscountType === 'AMOUNT' ? 5 : 1;
      input.value = Math.max(0, (Number(input.value) || 0) + step * size);
      renderLineDiscountModal();
    });
  });

  document.querySelectorAll('[data-void-step]').forEach((btn) => {
    btn.addEventListener('click', () => stepVoidQty(Number(btn.getAttribute('data-void-step'))));
  });

  el('voidReasonGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-void-reason]');
    if (!btn) return;
    const reason = btn.getAttribute('data-void-reason');
    el('voidReason').value = reason;
    setActive(el('voidReasonGroup'), 'data-void-reason', reason);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    ['pinModal', 'approvalsModal', 'voidModal', 'lineDiscountModal', 'activeTablesModal'].some((id) => {
      if (el(id).classList.contains('hidden')) return false;
      hideModal(id);
      return true;
    });
  });

  el('pinInput').addEventListener('keydown', (e) => {
    if (/^[0-9]$/.test(e.key)) pinKey(e.key);
    if (e.key === 'Backspace') pinBackspace();
    if (e.key === 'Enter') decideVoid('APPROVED');
  });

  // Global window bindings for pos.ejs inline handlers
  window.completeOrder = completeOrder;
  window.clearOrder = clearOrder;
  window.detachActiveTable = detachActiveTable;
  window.holdOrderToKitchen = holdOrderToKitchen;
  window.openActiveTablesModal = openActiveTablesModal;
  window.closeActiveTablesModal = closeActiveTablesModal;
  window.cashKey = cashKey;
  window.cashBackspace = cashBackspace;
  window.togglePaymentConfirmed = togglePaymentConfirmed;
  window.closeLineDiscount = closeLineDiscount;
  window.applyLineDiscount = applyLineDiscount;
  window.closeVoidModal = closeVoidModal;
  window.submitVoidRequest = submitVoidRequest;
  window.closePinModal = closePinModal;
  window.pinKey = pinKey;
  window.pinBackspace = pinBackspace;
  window.pinClear = pinClear;
  window.decideVoid = decideVoid;
  window.openApprovals = openApprovals;
  window.closeApprovals = closeApprovals;

  setPendingCount(pendingCount);
  refreshActiveTablesBadge();
  render();
})();