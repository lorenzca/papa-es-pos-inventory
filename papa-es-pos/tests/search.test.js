// ---------------------------------------------------------------------------
// tests/search.test.js
// ---------------------------------------------------------------------------
// Pins down the smart-search rules the cashier actually relies on:
// abbreviations, dropped letters, wrong word order, and typos — while making
// sure unrelated items do NOT match (a search that returns everything is worse
// than no search at all).
//
// Run with: npm test
// ---------------------------------------------------------------------------

const assert = require('assert');
const search = require('../public/js/smart-search');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok   ' + name);
  } catch (error) {
    console.error('  FAIL ' + name + '\n       ' + error.message);
    process.exitCode = 1;
  }
}

const MENU = [
  'Baked Chicken',
  'Baked Mac',
  'Chicken Adobo',
  'Pork Sisig',
  'Halo-Halo',
  'Papa Es Half Chicken',
  'Iced Tea'
];

const names = (query) => search.filter(MENU, query, (item) => item);

console.log('\nsmart-search');

test('exact name matches itself first', () => {
  assert.strictEqual(names('Baked Chicken')[0], 'Baked Chicken');
});

test('prefix search finds both baked items', () => {
  const hits = names('bak');
  assert.ok(hits.includes('Baked Chicken'));
  assert.ok(hits.includes('Baked Mac'));
});

test('dropped vowels: "bkd" finds Baked Chicken', () => {
  assert.ok(names('bkd').includes('Baked Chicken'));
});

test('the whole word "baked" still works', () => {
  assert.ok(names('baked').includes('Baked Chicken'));
});

test('initials: "bc" finds Baked Chicken', () => {
  assert.ok(names('bc').includes('Baked Chicken'));
});

test('word order does not matter: "chicken baked"', () => {
  assert.ok(names('chicken baked').includes('Baked Chicken'));
});

test('typo tolerance: "chikcen" finds the chicken dishes', () => {
  const hits = names('chikcen');
  assert.ok(hits.includes('Baked Chicken'));
  assert.ok(hits.includes('Chicken Adobo'));
});

test('typo tolerance: "bakd chiken"', () => {
  assert.ok(names('bakd chiken').includes('Baked Chicken'));
});

test('punctuation and case are ignored: "halo halo"', () => {
  assert.ok(names('halo halo').includes('Halo-Halo'));
});

test('accents are ignored: "sisig" finds "Pork Sísig"', () => {
  assert.ok(search.matches('sisig', 'Pork Sísig'));
});

test('unrelated queries match nothing', () => {
  assert.strictEqual(names('pizza').length, 0);
});

test('short words do not fuzzy-match each other', () => {
  // "tea" and "sea" are one edit apart, but 3-letter words get zero tolerance.
  assert.strictEqual(search.matches('sea', 'Iced Tea'), false);
});

test('an empty query keeps the whole list', () => {
  assert.strictEqual(names('').length, MENU.length);
  assert.strictEqual(names('   ').length, MENU.length);
});

test('secondary fields are searchable but rank lower', () => {
  const item = { item_name: 'Baked Mac', category: 'Pasta' };
  const textOf = (row) => [row.item_name, row.category];
  assert.ok(search.matches('pasta', textOf(item)));
  assert.ok(search.score('baked mac', textOf(item)) > search.score('pasta', textOf(item)));
});

test('better matches are ranked first', () => {
  const hits = names('chicken');
  assert.strictEqual(hits[0], 'Chicken Adobo'); // starts with the query
});

test('bounded edit distance still measures correctly', () => {
  assert.strictEqual(search.editDistance('baked', 'bakd', 2), 1);
  assert.strictEqual(search.editDistance('kitten', 'sitting', 3), 3);
  assert.ok(search.editDistance('abc', 'xyz', 1) > 1); // bailed out early
});

test('inventory-style rows match on ingredient names', () => {
  const rows = [
    { name: 'Chicken Thigh', unit: 'kg' },
    { name: 'Cooking Oil', unit: 'L' },
    { name: 'Soy Sauce', unit: 'L' }
  ];
  const hits = search.filter(rows, 'ckng oil', (row) => [row.name, row.unit]);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].name, 'Cooking Oil');
});

console.log('\n' + passed + ' passing\n');
