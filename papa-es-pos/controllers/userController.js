const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const voidModel = require('../models/voidModel');
const auditModel = require('../models/auditModel');

// roles that can be chosen for staff
const VALID_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN'];

// helper to render error state on the users page
async function renderUserError(req, res, message) {
  const users = await userModel.listUsers();
  return res.status(400).render('users', { user: req.session.user, users, error: message, success: null });
}

// show staff accounts page
async function getUsers(req, res) {
  const users = await userModel.listUsers();
  res.render('users', { user: req.session.user, users, error: null, success: null });
}

// create a new staff account
async function postCreateUser(req, res) {
  try {
    const { full_name, username, password, role } = req.body;
    if (!VALID_ROLES.includes(role)) throw new Error('Invalid role selected.');
    if (!password || String(password).length < 6) throw new Error('Password must be at least 6 characters.');

    // check for duplicate username
    const existing = await userModel.findByUsername(username);
    if (existing) throw new Error('Username already exists.');

    // save account with hashed password
    const password_hash = await bcrypt.hash(password, 10);
    const newUserId = await userModel.createUser({ full_name, username, password_hash, role });

    await auditModel.logAudit({
      userId: req.session.user.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUserId,
      details: { username, full_name, role }
    });

    res.redirect('/users');
  } catch (err) {
    await renderUserError(req, res, err.message);
  }
}

// update user details and revoke pin if demoted
async function postUpdateUser(req, res) {
  try {
    const id = Number(req.params.id);
    const { full_name, username, role } = req.body;
    if (!VALID_ROLES.includes(role)) throw new Error('Invalid role selected.');

    const target = await userModel.findById(id);
    if (!target) throw new Error('User not found.');

    // ensure username is not taken by another user
    const existing = await userModel.findByUsername(username);
    if (existing && Number(existing.id) !== id) throw new Error('Username already exists.');

    await userModel.updateUser(id, { full_name, username, role });

    // remove void pin if user is demoted from owner/manager
    let pinRevoked = false;
    if (!voidModel.AUTHORIZER_ROLES.includes(role) && voidModel.AUTHORIZER_ROLES.includes(target.role)) {
      await userModel.setManagerPin(id, null);
      pinRevoked = true;
    }

    await auditModel.logAudit({
      userId: req.session.user.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      details: {
        previous: { username: target.username, full_name: target.full_name, role: target.role },
        updated: { username, full_name, role },
        pinRevoked
      }
    });

    res.redirect('/users');
  } catch (err) {
    await renderUserError(req, res, err.message);
  }
}

// enable or disable an account (blocks disabling own account)
async function postToggleUserStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const target = await userModel.findById(id);
    if (!target) throw new Error('User not found.');
    if (id === req.session.user.id) throw new Error('You cannot disable your own account while logged in.');

    const nextStatus = !target.is_active;
    await userModel.setUserStatus(id, nextStatus);

    await auditModel.logAudit({
      userId: req.session.user.id,
      action: nextStatus ? 'USER_ENABLED' : 'USER_DISABLED',
      entityType: 'USER',
      entityId: id,
      details: { target_username: target.username, new_status: nextStatus ? 'ACTIVE' : 'DISABLED' }
    });

    res.redirect('/users');
  } catch (err) {
    await renderUserError(req, res, err.message);
  }
}

// reset password for a staff member
async function postResetPassword(req, res) {
  try {
    const id = Number(req.params.id);
    const { password } = req.body;
    if (!password || String(password).length < 6) throw new Error('Password must be at least 6 characters.');

    const target = await userModel.findById(id);
    if (!target) throw new Error('User not found.');

    const password_hash = await bcrypt.hash(password, 10);
    await userModel.updatePassword(id, password_hash);

    await auditModel.logAudit({
      userId: req.session.user.id,
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: id,
      details: { target_username: target.username, target_role: target.role }
    });

    res.redirect('/users');
  } catch (err) {
    await renderUserError(req, res, err.message);
  }
}

// permanently delete account (protects current session and last owner)
async function postDeleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    const target = await userModel.findById(id);
    if (!target) throw new Error('User not found.');
    if (id === req.session.user.id) throw new Error('You cannot delete your own account while logged in.');

    if (target.role === 'OWNER') {
      const ownerCount = await userModel.countOwners();
      if (ownerCount <= 1) throw new Error('Cannot delete the last OWNER account.');
    }

    await userModel.deleteUser(id);

    await auditModel.logAudit({
      userId: req.session.user.id,
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: id,
      details: { deleted_username: target.username, role: target.role }
    });

    res.redirect('/users');
  } catch (err) {
    await renderUserError(req, res, err.message);
  }
}

// set or clear a 4-6 digit manager void pin
async function postManagerPin(req, res) {
  try {
    const id = Number(req.params.id);
    const pin = String(req.body.pin || '').trim();

    const target = await userModel.findById(id);
    if (!target) throw new Error('User not found.');

    // empty pin means remove it
    if (!pin) {
      await userModel.setManagerPin(id, null);
      await auditModel.logAudit({
        userId: req.session.user.id,
        action: 'MANAGER_PIN_CLEARED',
        entityType: 'USER',
        entityId: id,
        details: { target: target.username }
      });
      return res.redirect('/users');
    }

    if (!voidModel.AUTHORIZER_ROLES.includes(target.role)) {
      throw new Error('Only OWNER and MANAGER accounts can hold a manager PIN.');
    }
    if (!/^\d{4,6}$/.test(pin)) throw new Error('The manager PIN must be 4 to 6 digits.');

    await userModel.setManagerPin(id, await bcrypt.hash(pin, 10));

    await auditModel.logAudit({
      userId: req.session.user.id,
      action: 'MANAGER_PIN_SET',
      entityType: 'USER',
      entityId: id,
      details: { target: target.username, role: target.role }
    });

    res.redirect('/users');
  } catch (err) {
    await renderUserError(req, res, err.message);
  }
}

module.exports = {
  getUsers,
  postCreateUser,
  postUpdateUser,
  postToggleUserStatus,
  postResetPassword,
  postManagerPin,
  postDeleteUser
};