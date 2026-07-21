const pool = require('../config/db');

const findCustomerByEmail = async (email) => {
  const result = await pool.query(
    'SELECT * FROM Customer WHERE email = $1',
    [email]
  );
  return result.rows[0];
};

const createCustomer = async ({ fname, lname, phone_number, email, password_hash }) => {
  const result = await pool.query(
    `INSERT INTO Customer (fname, lname, phone_number, email, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING customer_id, fname, lname, phone_number, email`,
    [fname, lname, phone_number, email, password_hash]
  );
  return result.rows[0];
};

module.exports = { findCustomerByEmail, createCustomer };
