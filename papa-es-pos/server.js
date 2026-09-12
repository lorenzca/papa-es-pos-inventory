require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// send the route files to the controllers
const authRoutes = require('./routes/authRoutes');
const appRoutes = require('./routes/appRoutes');

// check database and image 
const { syncSchema } = require('./config/schemaSync'); 
const { relinkMenuImages } = require('./config/imageRelink'); 

const app = express();

// tell express where to find our html templates and which template engine to use
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// serve assets (CSS, JS, images) from the /public folder.
app.use(express.static(path.join(__dirname, 'public')));

// forces the browser to load fresh CSS and JS files whenever code changes
const SHARED_BROWSER_ASSETS = ['js/pricing.js', 'js/smart-search.js', 'js/pos.js', 'js/quick-jump.js', 'css/style.css'];

function computeAssetVersion() {
  let newest = 0;

  for (const relativePath of SHARED_BROWSER_ASSETS) {
    try {
      const stats = fs.statSync(path.join(__dirname, 'public', relativePath));
      if (stats.mtimeMs > newest) newest = stats.mtimeMs;
    } catch (error) {
      // ignore missing files
    }
  }

  return String(Math.floor(newest) || Date.now());
}

const ASSET_VERSION = computeAssetVersion();

// let express read incoming data and json                      
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// user sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'papa_es_fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 12 } // session lasts 12  hours
  })
);

// make the logged in user and asset version available to all EJS templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.assetVersion = ASSET_VERSION;
  next();
});

// register route handles (authRoutes handles /login, /logout first)
app.use(authRoutes);
app.use(appRoutes);

// catch all the error page so that the app doesn't crash if something fails
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: err.message || 'Unexpected server error.', user: req.session.user || null });
});

const PORT = process.env.PORT || 3000;

// run startup database and boots the server
async function startServer() {
  // ensure required columns in MySQL exists
  const changes = await syncSchema();
  if (changes.length) {
    console.log('Database schema updates applied:', changes.join(', '));
  }

  // relink uploaded dish photos if the database was freshyl imported 
  const reattached = await relinkMenuImages();
  if (reattached.length) {
    console.log(`Menu photos reattached (${reattached.length}):`, reattached.join(', '));
  }

  app.listen(PORT, () => {
    console.log(`Papa Es POS running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});