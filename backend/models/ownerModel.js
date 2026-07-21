const pool = require('../config/db');

const findOwnerByEmail = async (email) => {
  const result = await pool.query(
    'SELECT * FROM Owner WHERE email = $1',
    [email]
  );
  return result.rows[0];
};

const createOwner = async ({ fname, lname, phone_number, email, password_hash }) => {
  const result = await pool.query(
    `INSERT INTO Owner (fname, lname, phone_number, email, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING owner_id, fname, lname, phone_number, email`,
    [fname, lname, phone_number, email, password_hash]
  );
  return result.rows[0];
};

module.exports = { findOwnerByEmail, createOwner };
