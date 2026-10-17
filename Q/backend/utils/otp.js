const crypto = require('crypto');
const pool = require('../config/db');
const { normalizeEmail } = require('./validation');

const MAX_ATTEMPTS = 5;

// FIX: Math.random() is not cryptographically secure -> use crypto.randomInt
function generateOTP() {
  return String(crypto.randomInt(100000, 1000000));
}

async function storeOTP(email, role, otpCode) {
  const e = normalizeEmail(email);
  await pool.query(`DELETE FROM login_otp WHERE email = $1 AND role = $2`, [e, role]);
  await pool.query(
    `INSERT INTO login_otp (email, role, otp_code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [e, role, otpCode]
  );
}

// FIX: the old version allowed unlimited guesses of a 6-digit code within 5 minutes.
// Now each wrong guess is counted and the code is burned after MAX_ATTEMPTS.
async function verifyOTP(email, role, otpCode) {
  const e = normalizeEmail(email);
  const code = String(otpCode || '').trim();

  const { rows } = await pool.query(
    `SELECT otp_id, otp_code, attempts FROM login_otp
      WHERE email = $1 AND role = $2 AND expires_at > NOW()
      ORDER BY otp_id DESC LIMIT 1`,
    [e, role]
  );
  const row = rows[0];
  if (!row) return false;

  if (row.attempts >= MAX_ATTEMPTS) {
    await pool.query(`DELETE FROM login_otp WHERE otp_id = $1`, [row.otp_id]);
    return false;
  }

  const a = Buffer.from(row.otp_code);
  const b = Buffer.from(code);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    await pool.query(`UPDATE login_otp SET attempts = attempts + 1 WHERE otp_id = $1`, [row.otp_id]);
    return false;
  }

  await pool.query(`DELETE FROM login_otp WHERE email = $1 AND role = $2`, [e, role]);
  return true;
}

module.exports = { generateOTP, storeOTP, verifyOTP };
