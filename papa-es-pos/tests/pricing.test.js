// ---------------------------------------------------------------------------
// tests/pricing.test.js
// ---------------------------------------------------------------------------
// Plain-node tests (no framework, no extra dependencies) for the shared
// discount engine. Run with:  npm test
//
// These lock down the bug that was fixed: a discount keyed on the POS must
// survive all the way into the stored total, and the order-level discount must
// apply AFTER line discounts rather than on the raw subtotal.
// ---------------------------------------------------------------------------

const assert = require('assert');
const pricing = require('../public/js/pricing');

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${error.message}`);
    process.exitCode = 1;
  }
}

console.log('pricing engine');

test('percent discount on a single line order', () => {
  const result = pricing.computeOrder({
    items: [{ menu_item_id: 1, unit_price: 100, quantity: 2 }],
    discountType: 'PERCENT',
    discountValue: 10
  });
  assert.strictEqual(result.subtotal_amount, 200);
  assert.strictEqual(result.order_discount_amount, 20);
  assert.strictEqual(result.total_amount, 180);
});

test('fixed peso discount on the order total', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 348, quantity: 1 }],
    discountType: 'AMOUNT',
    discountValue: 48
  });
  assert.strictEqual(result.order_discount_amount, 48);
  assert.strictEqual(result.total_amount, 300);
});

test('senior and pwd are 20 percent off the VAT-exempt price', () => {
  ['SENIOR', 'PWD'].forEach((type) => {
    const result = pricing.computeOrder({
      items: [{ unit_price: 500, quantity: 1 }],
      discountType: type,
      discountValue: 0
    });
    // 500 / 1.12 = 446.43 exempt base, less 20% = 89.29 -> 357.14 due.
    assert.strictEqual(result.vat_exempt_sales, 446.43, `${type} exempt base`);
    assert.strictEqual(result.order_discount_amount, 89.29, `${type} should be 20%`);
    assert.strictEqual(result.order_discount_value, 20, `${type} rate is reported as 20`);
    assert.strictEqual(result.total_amount, 357.14);
  });
});

test('employee stays a 10 percent house discount with VAT intact', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 500, quantity: 1 }],
    discountType: 'EMPLOYEE',
    discountValue: 0
  });
  assert.strictEqual(result.order_discount_amount, 50);
  assert.strictEqual(result.total_amount, 450);
  assert.strictEqual(result.vat_exempt_sales, 0);
  assert.strictEqual(result.vatable_sales, 401.79);
  assert.strictEqual(result.vat_amount, 48.21);
});

test('the statutory rate cannot be keyed down or up at the terminal', () => {
  [0, 5, 50, 100].forEach((keyed) => {
    const result = pricing.computeOrder({
      items: [{ unit_price: 500, quantity: 1 }],
      discountType: 'SENIOR',
      discountValue: keyed
    });
    assert.strictEqual(result.order_discount_amount, 89.29, `keyed ${keyed} must not change 20%`);
  });
});

test('line discount then house order discount compound in the right order', () => {
  // Line: 1000 gross, 10% off = 100 -> 900 net.
  // Order: 10% employee off the remaining 900 = 90 -> 810 total.
  const result = pricing.computeOrder({
    items: [{ unit_price: 500, quantity: 2, discount_type: 'PERCENT', discount_value: 10 }],
    discountType: 'EMPLOYEE',
    discountValue: 10
  });
  assert.strictEqual(result.subtotal_amount, 1000);
  assert.strictEqual(result.line_discount_total, 100);
  assert.strictEqual(result.order_discount_amount, 90);
  assert.strictEqual(result.discount_amount, 190);
  assert.strictEqual(result.total_amount, 810);
});

test('a statutory order discount never stacks on an already discounted line', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 220, quantity: 1, discount_type: 'SENIOR' }],
    discountType: 'SENIOR'
  });
  assert.strictEqual(result.order_discount_amount, 0);
  assert.strictEqual(result.line_discount_total, 39.29);
  assert.strictEqual(result.total_amount, 157.14);
});

test('line level fixed discount is capped at the line gross', () => {
  const line = pricing.computeLine({ unit_price: 95, quantity: 1, discount_type: 'AMOUNT', discount_value: 500 });
  assert.strictEqual(line.discount_amount, 95);
  assert.strictEqual(line.line_total, 0);
});

test('order discount can never push the total below zero', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 100, quantity: 1 }],
    discountType: 'AMOUNT',
    discountValue: 99999
  });
  assert.strictEqual(result.total_amount, 0);
  assert.strictEqual(result.order_discount_amount, 100);
});

test('percent above 100 is clamped instead of inverting the sale', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 200, quantity: 1 }],
    discountType: 'PERCENT',
    discountValue: 250
  });
  assert.strictEqual(result.total_amount, 0);
});

test('negative and junk discount values are treated as no discount', () => {
  [-5, NaN, undefined, null, 'abc'].forEach((value) => {
    const result = pricing.computeOrder({
      items: [{ unit_price: 120, quantity: 1 }],
      discountType: 'PERCENT',
      discountValue: value
    });
    assert.strictEqual(result.total_amount, 120, `value ${String(value)} should not discount`);
  });
});

test('voided units are excluded from the gross', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 250, quantity: 3, voided_qty: 1 }]
  });
  assert.strictEqual(result.subtotal_amount, 500);
  assert.strictEqual(result.total_amount, 500);
  assert.strictEqual(result.lines[0].active_qty, 2);
});

test('a fully voided line contributes nothing and is not counted as active', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 428, quantity: 1, voided_qty: 1 }]
  });
  assert.strictEqual(result.subtotal_amount, 0);
  assert.strictEqual(result.active_line_count, 0);
});

test('centavo rounding stays at two decimals', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 33.33, quantity: 3 }],
    discountType: 'PERCENT',
    discountValue: 7.5
  });
  assert.strictEqual(result.subtotal_amount, 99.99);
  assert.strictEqual(result.order_discount_amount, 7.5);
  assert.strictEqual(result.total_amount, 92.49);
});

test('change and short are computed off the discounted total', () => {
  const result = pricing.computeOrder({
    items: [{ unit_price: 1000, quantity: 1 }],
    discountType: 'PERCENT',
    discountValue: 20
  });
  const tendered = pricing.changeFor(result.total_amount, 1000);
  assert.strictEqual(tendered.due, 800);
  assert.strictEqual(tendered.change, 200);
  assert.strictEqual(tendered.settled, true);

  const shortPay = pricing.changeFor(result.total_amount, 500);
  assert.strictEqual(shortPay.short, 300);
  assert.strictEqual(shortPay.settled, false);
});

test('mixed exempt and vatable order reconciles the way the receipt prints it', () => {
  // 220 senior line + 120 regular line.
  const result = pricing.computeOrder({
    items: [
      { unit_price: 220, quantity: 1, discount_type: 'SENIOR' },
      { unit_price: 120, quantity: 1 }
    ]
  });
  assert.strictEqual(result.subtotal_amount, 340);
  assert.strictEqual(result.vat_exempt_sales, 196.43);
  assert.strictEqual(result.vat_removed_total, 23.57);
  assert.strictEqual(result.line_discount_total, 39.29);
  assert.strictEqual(result.vatable_sales, 107.14);
  assert.strictEqual(result.vat_amount, 12.86);
  assert.strictEqual(result.total_amount, 277.14);
  assert.strictEqual(result.savings_total, 62.86);

  // The identity a BIR slip has to satisfy.
  const reconciled = pricing.round2(
    result.vatable_sales + result.vat_amount + result.vat_exempt_sales - result.discount_amount
  );
  assert.strictEqual(reconciled, result.total_amount);

  // And the tag prices less everything the customer saved.
  assert.strictEqual(pricing.round2(result.subtotal_amount - result.savings_total), result.total_amount);
});

test('a vatable order splits into net sales plus 12 percent VAT', () => {
  const result = pricing.computeOrder({ items: [{ unit_price: 112, quantity: 1 }] });
  assert.strictEqual(result.vatable_sales, 100);
  assert.strictEqual(result.vat_amount, 12);
  assert.strictEqual(result.vat_exempt_sales, 0);
  assert.strictEqual(result.total_amount, 112);
});

test('discount labels carry no statute numbers', () => {
  assert.strictEqual(pricing.describeDiscount('SENIOR'), 'Senior 20%');
  assert.strictEqual(pricing.describeDiscount('PWD'), 'PWD 20%');
  assert.strictEqual(pricing.describeDiscount('EMPLOYEE'), 'Employee 10%');
  assert.strictEqual(pricing.describeDiscount('NONE'), '');
  Object.keys(pricing.LABELS).forEach((key) => {
    assert.ok(!/RA\s*\d/i.test(pricing.LABELS[key]), `${key} label must not cite a statute`);
  });
});

console.log(`\n${passed} passing`);
