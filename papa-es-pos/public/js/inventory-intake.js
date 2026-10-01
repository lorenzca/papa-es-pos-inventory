const CONVERSIONS = {
  g:  [{ label: 'kg', factor: 1000 }, { label: 'g', factor: 1 }],
  ml: [{ label: 'L', factor: 1000 },  { label: 'ml', factor: 1 }],
  pc: [{ label: 'pc', factor: 1 }]
};

let currentGuideItems = [];
let pendingSaveGuideName = null;
let activeReceivingOrderId = null;

function switchInvTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('is-active');
  });
  const activeBtn = document.getElementById(`tab-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add('is-active');
  }

  document.querySelectorAll('.inv-view').forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('block');
  });
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) {
    activeView.classList.remove('hidden');
    activeView.classList.add('block');
  }
}

function mapItem(it, rawQty, rawCost) {
  const base = it.unit_measure || it.unit || 'g';
  const isBulk = (base === 'g' || base === 'ml') && Number(rawQty) >= 1000;
  const factor = isBulk ? 1000 : 1;
  return {
    ingredient_id: it.ingredient_id,
    ingredient_name: it.ingredient_name,
    base_unit: base,
    selected_unit: isBulk ? (base === 'g' ? 'kg' : 'L') : base,
    input_qty: (Number(rawQty) || 0) / factor,
    input_cost: (Number(rawCost) || 0) * factor,
    stock_qty: Number(it.stock_qty || 0),
    reorder_level: Number(it.reorder_level || 0),
    historical_avg: Number(it.historical_avg || rawCost) * factor
  };
}

async function openNewIntake() {
  switchInvTab('intake');
  activeReceivingOrderId = null;
  setupIntake({ isReceive: false, title: 'Receive Delivery' });
  updateDeleteGuideBtn();

  try {
    const res = await fetch('/api/inventory/order-guides');
    const data = await res.json();
    const select = document.getElementById('guideSelect');
    select.innerHTML = '<option value="">Select a Preset Guide</option>';
    if (data.success && Array.isArray(data.guides)) {
      data.guides.forEach(g => {
        select.innerHTML += `<option value="${g.id}" data-supplier="${g.supplier_name || ''}">${g.guide_name}</option>`;
      });
    }
  } catch (err) {
    showToast('Could not load order guides.');
  }
}

async function openReceiveIntake(orderId) {
  switchInvTab('intake');
  activeReceivingOrderId = orderId;
  setupIntake({ isReceive: true, title: `Receive Delivery (PO #${orderId})` });
  updateDeleteGuideBtn();

  try {
    const res = await fetch(`/api/inventory/orders/${orderId}`);
    const data = await res.json();
    if (data.success && data.order) {
      document.getElementById('supplierNameInput').value = data.order.supplier_name || '';
      document.getElementById('guideSelect').innerHTML = `<option value="">Pre-filled from PO #${orderId}</option>`;
      currentGuideItems = data.order.items.map(it => mapItem(it, it.received_qty, it.unit_cost));
      renderReceivingTable();
    }
  } catch (err) {
    showToast('Failed to load pending order details.');
  }
}

function setupIntake({ isReceive, title }) {
  document.getElementById('intakeTitleText').textContent = title;
  document.getElementById('savePendingOrderBtn').classList.toggle('hidden', isReceive);
  document.getElementById('saveGuideBtn').classList.toggle('hidden', isReceive);
  document.getElementById('expectedDateContainer').classList.toggle('hidden', isReceive);
  document.getElementById('submitDeliveryBtn').textContent = 'Confirm & Post Stock';
  cancelSaveGuide();
}

function updateDeleteGuideBtn() {
  const select = document.getElementById('guideSelect');
  const deleteBtn = document.getElementById('deleteGuideBtn');
  if (!deleteBtn) return;
  deleteBtn.classList.toggle('hidden', !(select && select.value));
}

async function deleteCurrentGuide() {
  const select = document.getElementById('guideSelect');
  const guideId = select ? select.value : '';
  if (!guideId) return;

  const selectedOpt = select.options[select.selectedIndex];
  const guideName = selectedOpt.textContent.trim();

  try {
    const res = await fetch(`/api/inventory/order-guides/${guideId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Preset "${guideName}" deleted.`);
      selectedOpt.remove();
      select.value = '';
      loadGuideItems();
    } else {
      showToast(data.error || 'Failed to delete preset.');
    }
  } catch (err) {
    showToast('Error communicating with server.');
  }
}

async function loadGuideItems() {
  updateDeleteGuideBtn();
  const select = document.getElementById('guideSelect');
  const guideId = select.value;
  const supplierInput = document.getElementById('supplierNameInput');
  const tbody = document.getElementById('receivingTableBody');

  if (!guideId) {
    supplierInput.value = '';
    currentGuideItems = [];
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-white/40">Select an order guide or search an ingredient above.</td></tr>';
    recalcIntakeTotal();
    return;
  }

  supplierInput.value = select.options[select.selectedIndex]?.getAttribute('data-supplier') || '';
  try {
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-white/40">Loading items...</td></tr>';
    const res = await fetch(`/api/inventory/order-guides/${guideId}/items`);
    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      currentGuideItems = data.items.map(it => mapItem(it, it.default_qty, it.default_unit_cost || it.current_unit_cost));
      renderReceivingTable();
    }
  } catch (err) {
    showToast('Error connecting to server.');
  }
}

function autoFillSuggestedOrders() {
  if (!currentGuideItems.length) return showToast('Please select an order guide or add ingredients first.');
  let filledCount = 0;
  
  currentGuideItems.forEach(it => {
    const shortfallBase = Math.max(0, it.reorder_level - it.stock_qty);
    const convList = CONVERSIONS[it.base_unit] || [];
    const factor = convList.find(c => c.label === it.selected_unit)?.factor || 1;
    
    if (shortfallBase > 0) {
      it.input_qty = parseFloat((shortfallBase / factor).toFixed(2));
      filledCount++;
    } else {
      it.input_qty = 0;
    }
  });
  
  renderReceivingTable();
  if (filledCount > 0) {
    showToast(`Calculated restock gap for ${filledCount} item(s).`);
  } else {
    showToast('All items are already above their target par levels.');
  }
}

function showIngredientDropdown() {
  const dropdown = document.getElementById('ingredientResults');
  if (dropdown) dropdown.classList.remove('hidden');
  filterIngredientDropdown();
}

function hideIngredientDropdown() {
  setTimeout(() => document.getElementById('ingredientResults')?.classList.add('hidden'), 200);
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('ingredientResults');
  const input = document.getElementById('ingredientSearchInput');
  if (!dropdown || dropdown.classList.contains('hidden')) return;
  if (!dropdown.contains(e.target) && e.target !== input) {
    dropdown.classList.add('hidden');
  }
});

function filterIngredientDropdown() {
  const input = document.getElementById('ingredientSearchInput');
  if (!input) return;
  const items = Array.from(document.querySelectorAll('#ingredientResults .ingredient-result-item'));
  const shown = PapaSearch.applyToElements(input.value, items, { hiddenClass: 'hidden', reorder: input.value.trim().length > 0 });
  document.getElementById('ingredientNoResults')?.classList.toggle('hidden', shown > 0);
}

function selectIngredientItem(el) {
  const id = Number(el.getAttribute('data-id'));
  if (currentGuideItems.some(it => it.ingredient_id === id)) {
    return showToast('Item already in the delivery list.');
  }

  const baseUnit = el.getAttribute('data-unit') || 'g';
  const rawCost = parseFloat(el.getAttribute('data-cost')) || 0;
  const stockQty = parseFloat(el.getAttribute('data-stock')) || 0;
  const reorderLvl = parseFloat(el.getAttribute('data-reorder')) || 0;
  const histAvg = parseFloat(el.getAttribute('data-hist')) || rawCost;
  
  const defaultUnit = baseUnit === 'g' ? 'kg' : (baseUnit === 'ml' ? 'L' : baseUnit);
  const factor = (defaultUnit === 'kg' || defaultUnit === 'L') ? 1000 : 1;

  currentGuideItems.push({
    ingredient_id: id,
    ingredient_name: el.getAttribute('data-name'),
    base_unit: baseUnit,
    selected_unit: defaultUnit,
    input_qty: 1.00,
    input_cost: rawCost * factor,
    stock_qty: stockQty,
    reorder_level: reorderLvl,
    historical_avg: histAvg * factor
  });

  const searchInput = document.getElementById('ingredientSearchInput');
  if (searchInput) searchInput.value = '';
  hideIngredientDropdown();
  renderReceivingTable();
}

function renderReceivingTable() {
  const tbody = document.getElementById('receivingTableBody');
  if (!tbody) return;

  if (!currentGuideItems.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-white/40">Select an order guide or search an ingredient above.</td></tr>';
    return recalcIntakeTotal();
  }

  tbody.innerHTML = currentGuideItems.map((it, idx) => {
    const subtotal = it.input_qty * it.input_cost;
    const units = (CONVERSIONS[it.base_unit] || [{ label: it.base_unit }]).map(u => 
      `<option value="${u.label}" ${it.selected_unit === u.label ? 'selected' : ''}>${u.label}</option>`
    ).join('');

    const isPriceSpike = it.historical_avg > 0 && it.input_cost > (it.historical_avg * 1.10);
    const alertBadge = isPriceSpike 
      ? `<span class="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30" title="Historical avg: ₱${it.historical_avg.toFixed(2)}">+10%</span>` 
      : '';

    return `
      <tr class="hover:bg-white/5 transition border-b border-slate-700/50">
        <td class="p-2.5 font-medium">${it.ingredient_name}</td>
        <td class="p-2.5 text-center">
          <select onchange="updateItemUnit(${idx}, this.value)" class="bg-slate-800 border border-slate-700 rounded p-1 text-xs text-papaGold font-semibold focus:outline-none">${units}</select>
        </td>
        <td class="p-2.5 text-right">
          <input type="number" step="any" min="0" value="${it.input_qty}" oninput="updateItemField(${idx}, 'input_qty', this.value)" class="w-20 bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white text-right focus:border-papaGold focus:outline-none" />
        </td>
        <td class="p-2.5 text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${alertBadge}
            <span class="text-white/40 text-[10px]">₱</span>
            <input type="number" step="any" min="0" value="${it.input_cost}" oninput="updateItemField(${idx}, 'input_cost', this.value)" class="w-20 bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white text-right focus:border-papaGold focus:outline-none" />
          </div>
        </td>
        <td class="p-2.5 text-right font-bold text-papaGold" id="row-subtotal-${idx}">₱${subtotal.toFixed(2)}</td>
        <td class="p-2.5 text-center">
          <button type="button" onclick="removeItem(${idx})" class="text-white/40 hover:text-red-400 font-bold px-1">✕</button>
        </td>
      </tr>`;
  }).join('');

  recalcIntakeTotal();
}

function updateItemUnit(idx, newUnit) {
  const item = currentGuideItems[idx];
  if (item.selected_unit === newUnit) return;

  const convList = CONVERSIONS[item.base_unit] || [];
  const oldFactor = convList.find(c => c.label === item.selected_unit)?.factor || 1;
  const newFactor = convList.find(c => c.label === newUnit)?.factor || 1;
  const ratio = oldFactor / newFactor;

  item.input_qty = parseFloat((item.input_qty * ratio).toFixed(4)) || 0;
  item.input_cost = parseFloat((item.input_cost / ratio).toFixed(4)) || 0;
  item.historical_avg = parseFloat((item.historical_avg / ratio).toFixed(4)) || 0;
  item.selected_unit = newUnit;
  renderReceivingTable();
}

function updateItemField(idx, field, value) {
  currentGuideItems[idx][field] = parseFloat(value) || 0;
  const subtotal = currentGuideItems[idx].input_qty * currentGuideItems[idx].input_cost;
  const el = document.getElementById(`row-subtotal-${idx}`);
  if (el) el.textContent = `₱${subtotal.toFixed(2)}`;
  if (field === 'input_cost') renderReceivingTable();
  recalcIntakeTotal();
}

function removeItem(idx) {
  currentGuideItems.splice(idx, 1);
  renderReceivingTable();
}

function recalcIntakeTotal() {
  const total = currentGuideItems.reduce((sum, it) => sum + (it.input_qty * it.input_cost), 0);
  const totalEl = document.getElementById('intakeTotal');
  if (totalEl) totalEl.textContent = `₱${total.toFixed(2)}`;
}

function toggleSaveGuideDrawer() {
  if (!currentGuideItems.length) return showToast('Add ingredients to the list before creating a preset guide.');
  const drawer = document.getElementById('saveGuideDrawer');
  if (!drawer) return;
  drawer.classList.toggle('hidden');
  if (!drawer.classList.contains('hidden')) {
    resetDrawerState();
    document.getElementById('inlineGuideNameInput')?.focus();
  }
}

function resetDrawerState() {
  document.getElementById('guideNameInputRow')?.classList.remove('hidden');
  document.getElementById('guideOverwriteConfirmRow')?.classList.add('hidden');
}

function cancelSaveGuide() {
  const drawer = document.getElementById('saveGuideDrawer');
  const input = document.getElementById('inlineGuideNameInput');
  if (drawer) drawer.classList.add('hidden');
  if (input) input.value = '';
  pendingSaveGuideName = null;
  resetDrawerState();
  updateGuideBadge();
}

function confirmSaveGuide() {
  const input = document.getElementById('inlineGuideNameInput');
  const val = input ? input.value.trim() : '';
  if (!val) return showToast('Please enter a name for the preset guide.');

  const select = document.getElementById('guideSelect');
  const existingNames = Array.from(select ? select.options : [])
    .map(opt => opt.textContent.trim().toLowerCase())
    .filter(name => name && !name.startsWith('select') && !name.startsWith('pre-filled'));

  if (existingNames.includes(val.toLowerCase())) {
    document.getElementById('guideNameInputRow')?.classList.add('hidden');
    document.getElementById('guideOverwriteConfirmRow')?.classList.remove('hidden');
    return;
  }
  proceedWithPresetName(val);
}

function cancelOverwrite() {
  resetDrawerState();
  document.getElementById('inlineGuideNameInput')?.focus();
}

function applyOverwrite() {
  proceedWithPresetName(document.getElementById('inlineGuideNameInput')?.value.trim() || '');
}

function proceedWithPresetName(val) {
  pendingSaveGuideName = val;
  document.getElementById('saveGuideDrawer')?.classList.add('hidden');
  resetDrawerState();
  updateGuideBadge();
  showToast(`Preset "${pendingSaveGuideName}" will update on submit.`);
}

function updateGuideBadge() {
  const btn = document.getElementById('saveGuideBtn');
  if (!btn) return;
  btn.textContent = pendingSaveGuideName ? `Preset: ${pendingSaveGuideName}` : 'Save as Preset Guide';
  btn.className = pendingSaveGuideName
    ? 'h-9 px-3 rounded bg-amber-500/20 border border-papaGold text-papaGold text-xs font-semibold whitespace-nowrap transition'
    : 'h-9 px-3 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-semibold whitespace-nowrap transition';
}

function getPreparedItems() {
  return currentGuideItems
    .filter(it => it.input_qty > 0)
    .map(it => {
      const factor = (CONVERSIONS[it.base_unit] || []).find(c => c.label === it.selected_unit)?.factor || 1;
      return {
        ingredientId: it.ingredient_id,
        receivedQty: it.input_qty * factor,
        unitCost: it.input_cost / factor,
        unit: it.base_unit
      };
    });
}

async function postIntakeRequest(btn, loadingText, endpoint, payload, successMsg) {
  const originalText = btn.textContent;
  try {
    btn.disabled = true;
    btn.textContent = loadingText;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(successMsg);
      setTimeout(() => window.location.reload(), 800);
    } else {
      showToast(data.error || 'Request failed.');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  } catch (err) {
    showToast('Error communicating with server.');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function submitPendingOrder() {
  const items = getPreparedItems();
  if (!items.length) return showToast('All quantities are 0.');

  const supplierRaw = document.getElementById('supplierNameInput')?.value || '';

  postIntakeRequest(
    document.getElementById('savePendingOrderBtn'),
    'Saving...',
    '/api/inventory/orders/create',
    {
      orderGuideId: document.getElementById('guideSelect').value || null,
      supplierName: supplierRaw.trim() || 'Unspecified Vendor',
      expectedDate: document.getElementById('expectedDateInput').value || null,
      saveAsNewGuide: Boolean(pendingSaveGuideName),
      newGuideName: pendingSaveGuideName,
      items
    },
    'Order placed into pending queue.'
  );
}

function submitFinalDelivery() {
  const items = getPreparedItems();
  if (!items.length) return showToast('All quantities are 0.');

  const isExisting = Boolean(activeReceivingOrderId);
  const endpoint = isExisting 
    ? `/api/inventory/orders/${activeReceivingOrderId}/receive` 
    : '/api/inventory/receive';

  const supplierRaw = document.getElementById('supplierNameInput')?.value || '';

  const payload = isExisting
    ? { items }
    : {
        orderGuideId: document.getElementById('guideSelect').value || null,
        supplierName: supplierRaw.trim() || 'Direct Supplier',
        saveAsNewGuide: Boolean(pendingSaveGuideName),
        newGuideName: pendingSaveGuideName,
        items
      };

  postIntakeRequest(
    document.getElementById('submitDeliveryBtn'),
    'Posting...',
    endpoint,
    payload,
    'Stock received and inventory updated.'
  );
}