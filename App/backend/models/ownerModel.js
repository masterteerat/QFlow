const pool = require('../config/db');
const { normalizeEmail } = require('../utils/validation');

const OwnerModel = {
  findByEmail: async (email) => {
    const result = await pool.query('SELECT * FROM owner WHERE email = $1', [normalizeEmail(email)]);
    return result.rows[0];
  },

  create: async ({ fname, lname, phone_number, email, passwordHash }) => {
    const result = await pool.query(
      `INSERT INTO owner (fname, lname, phone_number, email, password, role_id)
       VALUES ($1, $2, $3, $4, $5, (SELECT role_id FROM role WHERE role_name = 'owner'))
       RETURNING owner_id, fname, lname, email`,
      [fname, lname, phone_number, normalizeEmail(email), passwordHash]
    );
    return result.rows[0];
  },

  findById: async (id) => {
    const result = await pool.query(
      'SELECT owner_id AS id, fname, lname, phone_number, email FROM owner WHERE owner_id = $1',
      [id]
    );
    return result.rows[0];
  },

  update: async (id, { fname, lname, phone_number }) => {
    const result = await pool.query(
      `UPDATE owner SET fname = $1, lname = $2, phone_number = $3 WHERE owner_id = $4
       RETURNING owner_id AS id, fname, lname, phone_number, email`,
      [fname.trim(), lname.trim(), phone_number || null, id]
    );
    return result.rows[0];
  }
};

module.exports = OwnerModel;
