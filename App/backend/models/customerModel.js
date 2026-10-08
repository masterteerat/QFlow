const pool = require('../config/db');
const { normalizeEmail } = require('../utils/validation');

const CustomerModel = {
  // FIX: emails are stored lowercase at signup, so lookups must be lowercase too
  // (logging in with "John@Mail.com" used to fail).
  findByEmail: async (email) => {
    const result = await pool.query('SELECT * FROM customer WHERE email = $1', [normalizeEmail(email)]);
    return result.rows[0];
  },

  create: async ({ fname, lname, phone_number, email, passwordHash }) => {
    const result = await pool.query(
      `INSERT INTO customer (fname, lname, phone_number, email, password, role_id)
       VALUES ($1, $2, $3, $4, $5, (SELECT role_id FROM role WHERE role_name = 'customer'))
       RETURNING customer_id, fname, lname, email`,
      [fname, lname, phone_number, normalizeEmail(email), passwordHash]
    );
    return result.rows[0];
  },

  // FIX: now returns email_notifications_opt_in (the toggle on My Schedule always
  // loaded as OFF after a refresh because this column was missing).
  findById: async (id) => {
    const result = await pool.query(
      `SELECT customer_id AS id, fname, lname, phone_number, email, email_notifications_opt_in
         FROM customer WHERE customer_id = $1`,
      [id]
    );
    return result.rows[0];
  },

  update: async (id, { fname, lname, phone_number }) => {
    const result = await pool.query(
      `UPDATE customer SET fname = $1, lname = $2, phone_number = $3 WHERE customer_id = $4
       RETURNING customer_id AS id, fname, lname, phone_number, email`,
      [fname.trim(), lname.trim(), phone_number || null, id]
    );
    return result.rows[0];
  }
};

module.exports = CustomerModel;
