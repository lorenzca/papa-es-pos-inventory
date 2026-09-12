const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');

// show the login page, or straight to the dashboard if they're already logged in
function getLogin(req, res) {
  if (req.session.user) {
    const roleHome = { OWNER: '/dashboard', MANAGER: '/dashboard', CASHIER: '/pos', KITCHEN: '/inventory' };
    return res.redirect(roleHome[req.session.user.role] || '/pos');
  }
  res.render('login', { error: null });
}

// handle login
async function postLogin(req, res) {
  const { username, password } = req.body;
  try {
    const user = await userModel.findByUsername(username);

    // stop if the acc doesn't exist or if the acc is disabled
    if (!user || !user.is_active) {
      return res.render('login', { error: 'Invalid credentials.' });
    }

    // compare the typed password against the stored hash
    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) {
      return res.render('login', { error: 'Invalid credentials.' });
    }

    // save basic user info in session (leave out the password hash)
    req.session.user = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      role: user.role
    };

    // Log the successful login event
    await auditModel.logAudit({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      details: {
        username: user.username,
        role: user.role
      }
    });

    // send each role to their page
    const roleHome = {
      OWNER: '/dashboard',
      MANAGER: '/dashboard',
      CASHIER: '/pos',
      KITCHEN: '/inventory'
    };

    res.redirect(roleHome[user.role] || '/pos');
  } catch (err) {
    res.status(500).render('login', { error: 'Server error: ' + err.message });
  }
}

// logout and send user back to login
async function logout(req, res) {
  try {
    if (req.session && req.session.user) {
      await auditModel.logAudit({
        userId: req.session.user.id,
        action: 'USER_LOGOUT',
        entityType: 'USER',
        entityId: req.session.user.id,
        details: {
          username: req.session.user.username,
          role: req.session.user.role
        }
      });
    }
  } catch (err) {
    console.error('[audit] Logout logging failed:', err.message);
  } finally {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }
}

module.exports = { getLogin, postLogin, logout };