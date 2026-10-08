const pool = require('../config/db');

// Single source of truth for "is this customer banned right now, and for how long?".
// A ban is active when its tier is permanent (tier.time = 0) or banned_at + tier.time minutes is still in the future.
// Uses real timestamps, so remaining time is exact (the old hourly counter was off by up to an hour).
const BlacklistModel = {
  getActiveBan: async (customerId) => {
    const { rows } = await pool.query(
      `SELECT b.customer_id, b.tier_id, t.name AS tier_name, t.time AS duration_minutes,
              b.banned_at,
              (t.time = 0) AS permanent,
              CASE WHEN t.time = 0 THEN NULL
                   ELSE b.banned_at + (t.time * INTERVAL '1 minute') END AS expires_at,
              CASE WHEN t.time = 0 THEN NULL
                   ELSE GREATEST(0, EXTRACT(EPOCH FROM (b.banned_at + (t.time * INTERVAL '1 minute') - NOW())))::int
              END AS seconds_left
         FROM blacklist b
         JOIN tier t ON t.tier_id = b.tier_id
        WHERE b.customer_id = $1
          AND (t.time = 0 OR b.banned_at + (t.time * INTERVAL '1 minute') > NOW())`,
      [customerId]
    );
    return rows[0] || null;
  }
};

module.exports = BlacklistModel;
