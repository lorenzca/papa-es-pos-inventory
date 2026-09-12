const pool = require('../config/db');

// find user by username for login verification
async function findByUsername(username) {
  const [[row]] = await pool.execute(
    'SELECT id, full_name, username, password_hash, role, is_active FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  return row || null;
}

// find user by id without returning pass hash
async function findById(id) {
  const [[row]] = await pool.execute(
    'SELECT id, full_name, username, role, is_active FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return row || null;
}

// get all staff accs for user management
async function listUsers() {
  const [rows] = await pool.execute(
    `SELECT id, full_name, username, role, is_active, created_at,
            (manager_pin_hash IS NOT NULL) AS has_manager_pin
     FROM users
     ORDER BY created_at DESC`
  );
  return rows;
}

// save or remove managers void PIN
async function setManagerPin(id, manager_pin_hash) {
  await pool.execute('UPDATE users SET manager_pin_hash = ? WHERE id = ?', [manager_pin_hash, id]);
}

// create a new staff acc
async function createUser({ full_name, username, password_hash, role }) {
  const [result] = await pool.execute(
    `INSERT INTO users (full_name, username, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [full_name, username, password_hash, role]
  );
  return result.insertId;
}

// update profile details
async function updateUser(id, { full_name, username, role }) {
  await pool.execute(
    'UPDATE users SET full_name = ?, username = ?, role = ? WHERE id = ?',
    [full_name, username, role, id]
  );
}

// update account password
async function updatePassword(id, password_hash) {
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id]);
}

// enable or deactivate the account
async function setUserStatus(id, isActive) {
  await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
}

// makes sure that there is atleast one owner acc
async function countOwners() {
  const [[row]] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'OWNER'");
  return Number(row?.total || 0);
}

// deletes a user record permanently
async function deleteUser(id) {
  await pool.execute('DELETE FROM users WHERE id = ?', [id]);
}

module.exports = {
  findByUsername,
  findById,
  listUsers,
  createUser,
  updateUser,
  updatePassword,
  setManagerPin,
  setUserStatus,
  countOwners,
  deleteUser
};