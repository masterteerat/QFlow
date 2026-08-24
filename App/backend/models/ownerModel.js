const pool = require('../config/db');

const OwnerModel = {
  findByEmail: async (email) => {
    const result = await pool.query('SELECT * FROM owner WHERE email = $1', [email]);
    return result.rows[0];
  },

  create: async ({ fname, lname, phone_number, email, passwordHash }) => {
    const result = await pool.query(
      `INSERT INTO owner (fname, lname, phone_number, email, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING owner_id, fname, lname, email`,
      [fname, lname, phone_number, email, passwordHash]
    );
    return result.rows[0];
  },
  findById: async (id) => {
    const result = await pool.query('SELECT owner_id AS id, fname, lname, phone_number, email FROM owner WHERE owner_id = $1', [id]);
    return result.rows[0];
  },
  
  update: async (id, { fname, lname, phone_number }) => {
    const result = await pool.query(
      `UPDATE owner SET fname = $1, lname = $2, phone_number = $3 WHERE owner_id = $4 RETURNING owner_id AS id, fname, lname, phone_number, email`,
      [fname, lname, phone_number, id]
    );
    return result.rows[0];
  }
};

module.exports = OwnerModel;
