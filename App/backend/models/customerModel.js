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
  },
  findById: async (id) => {
    const result = await pool.query('SELECT customer_id AS id, fname, lname, phone_number, email FROM customer WHERE customer_id = $1', [id]);
    return result.rows[0];
  },
  update: async (id, { fname, lname, phone_number }) => {
    const result = await pool.query(
      `UPDATE customer SET fname = $1, lname = $2, phone_number = $3 WHERE customer_id = $4 RETURNING customer_id AS id, fname, lname, phone_number, email`,
      [fname, lname, phone_number, id]
    );
    return result.rows[0];
  }
};

module.exports = CustomerModel;
