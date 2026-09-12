// works in both browser (window.PapaPricing) and node.js (require)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PapaPricing = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // 12% vat rate
  var VAT_RATE = 0.12;

  // statutory discounts that legally remove vat first then apply 20%
  var STATUTORY_TYPES = ['SENIOR', 'PWD'];
  var PRESET_PERCENTS = { SENIOR: 20, PWD: 20, EMPLOYEE: 10 };
  var LABELS = { SENIOR: 'Senior 20%', PWD: 'PWD 20%', EMPLOYEE: 'Employee 10%' };
  var PERCENT_TYPES = ['PERCENT', 'EMPLOYEE', 'PWD', 'SENIOR'];
  var AMOUNT_TYPES = ['AMOUNT'];

  // round to 2 decimal places safely
  function round2(value) {
    var number = Number(value);
    if (!isFinite(number)) return 0;
    return Math.round((number + Number.EPSILON) * 100) / 100;
  }

  function upper(type) {
    return String(type || 'NONE').toUpperCase();
  }

  function isPercentType(type) {
    return PERCENT_TYPES.indexOf(upper(type)) >= 0;
  }

  function isAmountType(type) {
    return AMOUNT_TYPES.indexOf(upper(type)) >= 0;
  }

  function isStatutoryType(type) {
    return STATUTORY_TYPES.indexOf(upper(type)) >= 0;
  }

  function presetPercent(type) {
    var key = upper(type);
    return Object.prototype.hasOwnProperty.call(PRESET_PERCENTS, key) ? PRESET_PERCENTS[key] : null;
  }

  // strip 12% vat from amount
  function netOfVat(amount) {
    return round2(round2(amount) / (1 + VAT_RATE));
  }

  // get the vat portion of an amount
  function vatPortion(amount) {
    return round2(round2(amount) - netOfVat(amount));
  }

  // discount text for receipt or table
  function describeDiscount(type, value) {
    var kind = upper(type);
    if (kind === 'NONE') return '';
    if (LABELS[kind]) return LABELS[kind];
    if (kind === 'PERCENT') return (Number(value) || 0) + '% off';
    if (kind === 'AMOUNT') return 'Less ' + round2(value).toFixed(2);
    return kind;
  }

  // calculate peso deduction for a given base and discount type
  function discountAmountFor(base, type, value) {
    var amountBase = round2(base);
    if (amountBase <= 0) return 0;

    var normalizedType = upper(type);
    var keyed = Number(value);
    if (!isFinite(keyed) || keyed < 0) keyed = 0;

    if (isPercentType(normalizedType)) {
      var locked = presetPercent(normalizedType);
      var percent = locked === null ? keyed : isStatutoryType(normalizedType) ? locked : keyed > 0 ? keyed : locked;
      if (percent <= 0) return 0;
      if (percent > 100) percent = 100;
      return Math.min(amountBase, round2(amountBase * (percent / 100)));
    }

    if (isAmountType(normalizedType)) {
      return Math.min(amountBase, round2(keyed));
    }

    return 0;
  }

  // calculate totals, vat removal, and discounts for a single item line
  function computeLine(line) {
    var source = line || {};
    var unitPrice = round2(source.unit_price != null ? source.unit_price : source.price);
    var quantity = Math.max(0, Math.floor(Number(source.quantity) || 0));
    var voidedQty = Math.min(quantity, Math.max(0, Math.floor(Number(source.voided_qty) || 0)));
    var activeQty = quantity - voidedQty;

    var gross = round2(unitPrice * activeQty);
    var discountType = upper(source.discount_type);
    var keyedValue = Number(source.discount_value) || 0;

    // strip vat first if item line is senior or pwd
    var statutory = isStatutoryType(discountType) && gross > 0;
    var base = statutory ? netOfVat(gross) : gross;
    var vatRemoved = statutory ? round2(gross - base) : 0;
    var discountAmount = discountAmountFor(base, discountType, keyedValue);
    var reportedValue = statutory ? presetPercent(discountType) : keyedValue;

    return {
      menu_item_id: source.menu_item_id,
      item_name: source.item_name,
      unit_price: unitPrice,
      quantity: quantity,
      voided_qty: voidedQty,
      active_qty: activeQty,
      gross_amount: gross,
      vat_exempt: statutory,
      vat_exempt_base: statutory ? base : 0,
      vat_removed: vatRemoved,
      discount_type: discountType,
      discount_value: round2(reportedValue),
      discount_amount: discountAmount,
      line_total: round2(base - discountAmount)
    };
  }

  // calculate full cart totals, order-level discounts, and final vat breakdown
  function computeOrder(input) {
    var source = input || {};
    var lines = (source.items || []).map(computeLine);

    var subtotal = 0;
    var lineDiscountTotal = 0;
    var vatRemovedTotal = 0;
    var exemptSales = 0;
    var statutoryDue = 0;
    var plainTotal = 0;
    var discountedTaxable = 0;

    lines.forEach(function (line) {
      subtotal = round2(subtotal + line.gross_amount);
      lineDiscountTotal = round2(lineDiscountTotal + line.discount_amount);
      vatRemovedTotal = round2(vatRemovedTotal + line.vat_removed);
      if (line.vat_exempt) {
        exemptSales = round2(exemptSales + line.vat_exempt_base);
        statutoryDue = round2(statutoryDue + line.line_total);
      } else if (line.discount_type === 'NONE') {
        plainTotal = round2(plainTotal + line.line_total);
      } else {
        discountedTaxable = round2(discountedTaxable + line.line_total);
      }
    });

    var orderType = upper(source.discountType || source.discount_type);
    var keyedValue = Number(source.discountValue != null ? source.discountValue : source.discount_value) || 0;
    var orderStatutory = isStatutoryType(orderType);

    // statutory order discount only touches items without line discounts
    var orderBase = orderStatutory ? plainTotal : round2(plainTotal + discountedTaxable);
    var orderExemptBase = orderStatutory ? netOfVat(orderBase) : 0;
    var orderVatRemoved = orderStatutory ? round2(orderBase - orderExemptBase) : 0;
    var orderDiscountBase = orderStatutory ? orderExemptBase : orderBase;
    var orderDiscountAmount = discountAmountFor(orderDiscountBase, orderType, keyedValue);
    var orderDue = round2(Math.max(0, orderDiscountBase - orderDiscountAmount));

    var taxableDue;
    var total;
    if (orderStatutory) {
      exemptSales = round2(exemptSales + orderExemptBase);
      vatRemovedTotal = round2(vatRemovedTotal + orderVatRemoved);
      taxableDue = discountedTaxable;
      total = round2(statutoryDue + orderDue + taxableDue);
    } else {
      taxableDue = orderDue;
      total = round2(statutoryDue + taxableDue);
    }

    var vatableSales = netOfVat(taxableDue);
    var vatAmount = round2(taxableDue - vatableSales);
    var discountTotal = round2(lineDiscountTotal + orderDiscountAmount);

    return {
      lines: lines,
      subtotal_amount: subtotal,
      line_discount_total: lineDiscountTotal,
      order_discount_type: orderType,
      order_discount_value: round2(orderStatutory ? presetPercent(orderType) : keyedValue),
      order_discount_amount: orderDiscountAmount,
      order_vat_exempt: orderStatutory,
      discount_amount: discountTotal,
      vat_rate: VAT_RATE,
      vatable_sales: vatableSales,
      vat_amount: vatAmount,
      vat_exempt_sales: exemptSales,
      zero_rated_sales: 0,
      vat_removed_total: vatRemovedTotal,
      savings_total: round2(discountTotal + vatRemovedTotal),
      total_amount: total,
      active_line_count: lines.filter(function (line) { return line.active_qty > 0; }).length
    };
  }

  // calculate change or amount short from payment
  function changeFor(total, cashReceived) {
    var due = round2(total);
    var cash = round2(cashReceived);
    var difference = round2(cash - due);
    return {
      due: due,
      cash: cash,
      change: difference > 0 ? difference : 0,
      short: difference < 0 ? round2(Math.abs(difference)) : 0,
      settled: difference >= 0
    };
  }

  return {
    VAT_RATE: VAT_RATE,
    STATUTORY_TYPES: STATUTORY_TYPES,
    PRESET_PERCENTS: PRESET_PERCENTS,
    LABELS: LABELS,
    PERCENT_TYPES: PERCENT_TYPES,
    AMOUNT_TYPES: AMOUNT_TYPES,
    round2: round2,
    isPercentType: isPercentType,
    isAmountType: isAmountType,
    isStatutoryType: isStatutoryType,
    presetPercent: presetPercent,
    netOfVat: netOfVat,
    vatPortion: vatPortion,
    describeDiscount: describeDiscount,
    discountAmountFor: discountAmountFor,
    computeLine: computeLine,
    computeOrder: computeOrder,
    changeFor: changeFor
  };
});