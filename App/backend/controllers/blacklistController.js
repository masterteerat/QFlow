const pool = require('../config/db');
const BlacklistModel = require('../models/blacklistModel');
const mailer = require('../mailer');

// A customer is "known" to an owner only if they have had a ticket at one of that owner's shops.
// FIX: add/remove used to work on ANY customer id in the system, so one owner could ban (or
// un-ban) customers they have never served.
const CUSTOMER_SEEN_BY_OWNER = `
  EXISTS (
    SELECT 1 FROM ticket tk
    JOIN queue qk ON qk.queue_id = tk.queue_id
    JOIN business bz ON bz.business_id = qk.business_id
    WHERE tk.customer_id = $1 AND bz.owner_id = $2
  )`;

// GET /api/owner/businesses/:businessId/blacklist
// Lists blacklisted customers who have had tickets at this owner's businesses
exports.getBlacklist = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.list_id, b.customer_id,
             FLOOR(EXTRACT(EPOCH FROM (NOW() - b.banned_at)) / 60)::int AS elapsed_time,
             t.name AS tier_name, t.time AS tier_duration_minutes,
             COALESCE(c.fname || ' ' || c.lname, 'Unknown Customer') AS customer_name
      FROM blacklist b
      JOIN tier t ON t.tier_id = b.tier_id
      LEFT JOIN customer c ON c.customer_id = b.customer_id
      WHERE EXISTS (
        SELECT 1 FROM ticket tk
        JOIN queue qk ON qk.queue_id = tk.queue_id
        JOIN business bz ON bz.business_id = qk.business_id
        WHERE tk.customer_id = b.customer_id AND bz.owner_id = $1
      )
      ORDER BY b.banned_at DESC, b.list_id DESC
    `, [req.user.id]);

    const blacklist = result.rows.map((entry) => ({
      ...entry,
      is_active: entry.tier_duration_minutes === 0 || entry.elapsed_time < entry.tier_duration_minutes
    }));

    res.json({ success: true, data: blacklist });
  } catch (error) {
    console.error('Get blacklist error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/owner/businesses/:businessId/blacklist
// Add customer to blacklist (body: customer_id, tier_id)
exports.addToBlacklist = async (req, res) => {
  const customer_id = Number(req.body.customer_id);
  const tier_id = Number(req.body.tier_id);

  try {
    if (!Number.isInteger(customer_id) || !Number.isInteger(tier_id)) {
      return res.status(400).json({ success: false, message: 'customer_id and tier_id are required' });
    }

    const tierResult = await pool.query('SELECT 1 FROM tier WHERE tier_id = $1', [tier_id]);
    if (tierResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid tier_id' });
    }

    const seen = await pool.query(`SELECT ${CUSTOMER_SEEN_BY_OWNER} AS ok`, [customer_id, req.user.id]);
    if (!seen.rows[0].ok) {
      return res.status(404).json({ success: false, message: 'Customer not found for this owner.' });
    }

    // One row per customer (unique index). Re-adding just moves them to the requested tier.
    const result = await pool.query(
      `INSERT INTO blacklist (elapsed_time, customer_id, tier_id, banned_at)
       VALUES (0, $1, $2, NOW())
       ON CONFLICT (customer_id) DO UPDATE SET tier_id = EXCLUDED.tier_id, elapsed_time = 0, banned_at = NOW()
       RETURNING list_id, elapsed_time, customer_id, tier_id`,
      [customer_id, tier_id]
    );

    // Email the customer about the ban (never fails the request)
    try {
      const ban = await BlacklistModel.getActiveBan(customer_id);
      const cust = await pool.query('SELECT fname, lname, email FROM customer WHERE customer_id = $1', [customer_id]);
      if (ban && cust.rows[0]?.email) {
        const c = cust.rows[0];
        await mailer.sendBanEmail(c.email, `${c.fname} ${c.lname}`, ban);
      }
    } catch (mailError) {
      console.error('Ban email error:', mailError.message);
    }

    console.log(`[Blacklist] Customer ${customer_id} set to tier ${tier_id} by owner ${req.user.id}`);
    res.json({ success: true, data: result.rows[0], message: 'Customer added to blacklist' });
  } catch (error) {
    console.error('Add to blacklist error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/owner/businesses/:businessId/blacklist/:customerId
exports.removeFromBlacklist = async (req, res) => {
  const customerId = Number(req.params.customerId);
  if (!Number.isInteger(customerId)) {
    return res.status(400).json({ success: false, message: 'Invalid customer id' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM blacklist
        WHERE customer_id = $1 AND ${CUSTOMER_SEEN_BY_OWNER}
        RETURNING list_id, customer_id`,
      [customerId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found in blacklist' });
    }

    console.log(`[Blacklist] Customer ${customerId} removed from blacklist by owner ${req.user.id}`);
    res.json({ success: true, data: result.rows[0], message: 'Customer removed from blacklist' });
  } catch (error) {
    console.error('Remove from blacklist error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
