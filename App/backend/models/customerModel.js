const pool = require('../config/db');

const CustomerModel = {
  findByEmail: async (email) => {
    const result = await pool.query('SELECT * FROM customer WHERE email = $1', [email]);
    return result.rows[0];
  },

  create: async ({ fname, lname, phone_number, email, passwordHash }) => {
    const result = await pool.query(
      `INSERT INTO customer (fname, lname, phone_number, email, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING customer_id, fname, lname, email`,
      [fname, lname, phone_number, email, passwordHash]
    );
    return result.rows[0];
  }
};

module.exports = CustomerModel;
