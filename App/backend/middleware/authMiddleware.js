const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Reads the Authorization: Bearer <token> header (if present), verifies it and sets
// req.user = { id, role }. Non-blocking: a missing/invalid/revoked token leaves req.user = null
// and routes that need a user return 401 themselves.
//
// Logout sets customer/owner.tokens_valid_after = NOW(); every token issued before that is rejected.
// The lookup is cached for 30 s; logout clears the cache entry of this process immediately.
const cache = new Map(); // "role:id" -> { validAfter (ms|0), at }
const TTL = 30 * 1000;
const TABLE = { customer: ['customer', 'customer_id'], owner: ['owner', 'owner_id'] };

async function validAfter(role, id) {
  const key = `${role}:${id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.validAfter;
  const [table, col] = TABLE[role] || [];
  if (!table) return 0;
  const { rows } = await pool.query(`SELECT tokens_valid_after FROM ${table} WHERE ${col} = $1`, [id]);
  const v = rows[0]?.tokens_valid_after ? new Date(rows[0].tokens_valid_after).getTime() : 0;
  cache.set(key, { validAfter: v, at: Date.now() });
  return v;
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  req.user = null;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // { id, role, iat, exp }
    try {
      const after = await validAfter(decoded.role, decoded.id);
      if (after && decoded.iat * 1000 < Math.floor(after / 1000) * 1000) return next(); // revoked
    } catch (e) {
      console.error('Token revocation check failed (allowing signed token):', e.message); // DB hiccup must not log everyone out
    }
    req.user = decoded;
  } catch {
    req.user = null;
  }
  next();
}

authenticate.revokeAll = async (role, id) => {
  const [table, col] = TABLE[role];
  await pool.query(`UPDATE ${table} SET tokens_valid_after = NOW() WHERE ${col} = $1`, [id]);
  cache.delete(`${role}:${id}`);
};

module.exports = authenticate;
