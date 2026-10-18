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
  },

  // Clean slate after a successful visit. A customer whose ban has already run out keeps a blacklist row
  // on purpose, so the next no-show escalates (Warning -> Temporary -> Permanent). Once they book a shop
  // and are actually checked in, that history is erased: one slip months later is a Warning again.
  // An ACTIVE ban is never lifted this way (checking in an older booking must not undo it), and a
  // permanent ban (tier.time = 0) is never reset. Returns true when a row was removed.
  resetAfterSuccessfulVisit: async (customerId) => {
    const { rowCount } = await pool.query(
      `DELETE FROM blacklist b USING tier t
        WHERE t.tier_id = b.tier_id AND b.customer_id = $1
          AND t.time > 0 AND b.banned_at + (t.time * INTERVAL '1 minute') <= NOW()`,
      [customerId]
    );
    return rowCount > 0;
  }
};

module.exports = BlacklistModel;
