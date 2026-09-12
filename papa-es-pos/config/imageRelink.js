const fs = require('fs');
const path = require('path');
const menuModel = require('../models/menuModel');
const imageFile = require('./imageFile');
const PapaSearch = require('../public/js/smart-search');

const uploadDir = imageFile.UPLOAD_DIR;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// match quality thresholds
const MIN_SCORE = 0.6;
const TIE_GAP = 0.05;

// skip old randomly generated filenames
const isAutoNamed = (fileName) => /^menu-\d+-\d+$/.test(fileName);

// expand shorthand tags in filenames like (pp) to party pan
const FILENAME_SHORTHAND = [
  { pattern: /\((?:pp|party ?pan)\)/gi, expandsTo: 'party pan', itemMustContain: 'party pan' }
];

// clean filename for matching and check required dish words
function readFileLabel(label) {
  let searchLabel = label;
  let mustContain = null;

  for (const entry of FILENAME_SHORTHAND) {
    if (!entry.pattern.test(searchLabel)) continue;
    entry.pattern.lastIndex = 0;
    searchLabel = searchLabel.replace(entry.pattern, ` ${entry.expandsTo} `);
    mustContain = entry.itemMustContain;
  }

  return {
    searchLabel: searchLabel.replace(/[()[\]_]+/g, ' ').replace(/\s+/g, ' ').trim(),
    mustContain
  };
}

// read all valid picture files in the uploads folder
function listImageFiles() {
  let names = [];
  try {
    names = fs.readdirSync(uploadDir);
  } catch (err) {
    return [];
  }

  return names
    .filter((name) => IMAGE_EXTENSIONS.includes(path.extname(name).toLowerCase()))
    .map((name) => {
      const label = path.basename(name, path.extname(name));
      const read = readFileLabel(label);
      return {
        fileName: name,
        label,
        searchLabel: read.searchLabel,
        mustContain: read.mustContain
      };
    })
    .filter((file) => !isAutoNamed(file.label));
}

// score every item against file names and sort by best match
function scorePairings(items, files) {
  const pairings = [];

  for (const item of items) {
    const itemName = String(item.item_name || '').toLowerCase();

    for (const file of files) {
      if (file.mustContain && !itemName.includes(file.mustContain)) continue;

      const score = PapaSearch.score(file.searchLabel, item.item_name);
      if (score >= MIN_SCORE) pairings.push({ item, file, score });
    }
  }

  return pairings.sort((a, b) => b.score - a.score);
}

// find menu items missing photos and link them to matching files
async function relinkMenuImages() {
  const reattached = [];

  const items = await menuModel.listItemsWithoutImage();
  if (!items.length) return reattached;

  const files = listImageFiles();
  if (!files.length) return reattached;

  const claimedItems = new Set();
  const claimedFiles = new Set();
  const pairings = scorePairings(items, files);

  // skip match if two items have nearly the same score
  const isAmbiguous = (pairing) => pairings.some((other) => (
    other.file.fileName === pairing.file.fileName &&
    other.item.id !== pairing.item.id &&
    !claimedItems.has(other.item.id) &&
    pairing.score - other.score < TIE_GAP
  ));

  for (const pairing of pairings) {
    if (claimedItems.has(pairing.item.id) || claimedFiles.has(pairing.file.fileName)) continue;
    if (isAmbiguous(pairing)) continue;

    try {
      await menuModel.setMenuImageUrl(pairing.item.id, imageFile.urlFor(pairing.file.fileName));
      claimedItems.add(pairing.item.id);
      claimedFiles.add(pairing.file.fileName);
      reattached.push(pairing.item.item_name);
    } catch (err) {
      console.error(`Could not reattach ${pairing.file.fileName}:`, err.message);
    }
  }

  return reattached;
}

module.exports = { relinkMenuImages };