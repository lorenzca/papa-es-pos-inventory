const path = require('path');

// folder where menu pictures are saved
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'menu');

// url path used to show images in the browser
const UPLOAD_URL_PREFIX = '/uploads/menu';

// clean item name and turn it into a safe filename
function fileNameFor(itemName, extension = '.png') {
  const cleaned = String(itemName || 'menu item')
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const ext = String(extension).toLowerCase();
  return `${cleaned || 'menu item'}${ext.startsWith('.') ? ext : `.${ext}`}`;
}

// build public image url from filename
const urlFor = (fileName) => `${UPLOAD_URL_PREFIX}/${fileName}`;

// supported image mime types
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

// get file extension from original name or mime type
function extensionFor(originalName, mimeType) {
  return path.extname(originalName || '').toLowerCase() || EXT_BY_MIME[String(mimeType || '').toLowerCase()] || '.png';
}

module.exports = { UPLOAD_DIR, UPLOAD_URL_PREFIX, fileNameFor, urlFor, extensionFor, EXT_BY_MIME };