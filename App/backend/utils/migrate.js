const pool = require('../config/db');

// Idempotent "catch-up" for databases created from an OLDER init.sql.
// Symptom it fixes: "Internal server error" on ban-status / booking / no-show / blacklist because the
// code uses columns or indexes (blacklist.banned_at, UNIQUE(blacklist.customer_id), ...) that an old
// database does not have yet. Safe to run on every start: every statement is IF NOT EXISTS.
const STEPS = [
  // --- blacklist (ban system) ---
  `ALTER TABLE blacklist ADD COLUMN IF NOT EXISTS elapsed_time INT NOT NULL DEFAULT 0`,
  `ALTER TABLE blacklist ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  // one row per customer is required by ON CONFLICT (customer_id): keep the newest row, drop older duplicates
  `DELETE FROM blacklist b USING blacklist n WHERE b.customer_id = n.customer_id AND b.list_id < n.list_id`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_customer ON blacklist(customer_id)`,
  // --- customer / owner ---
  `ALTER TABLE customer ADD COLUMN IF NOT EXISTS email_notifications_opt_in BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE customer ADD COLUMN IF NOT EXISTS daily_email_hour INT NOT NULL DEFAULT 8`,
  `ALTER TABLE customer ADD COLUMN IF NOT EXISTS daily_email_last_sent DATE`,
  `ALTER TABLE customer ADD COLUMN IF NOT EXISTS queue_reminder_opt_in BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE customer ADD COLUMN IF NOT EXISTS reminder_hours_before INT NOT NULL DEFAULT 1`,
  `ALTER TABLE customer ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ`,
  `ALTER TABLE owner ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ`,
  // --- business / schedule ---
  `ALTER TABLE business ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE business ADD COLUMN IF NOT EXISTS queue_type VARCHAR(10) NOT NULL DEFAULT 'walkin'`,
  `ALTER TABLE business ADD COLUMN IF NOT EXISTS walkin_open_time TIME`,
  `ALTER TABLE business ADD COLUMN IF NOT EXISTS walkin_close_time TIME`,
  `ALTER TABLE business ADD COLUMN IF NOT EXISTS cancel_before_minutes INT NOT NULL DEFAULT 60`,
  `ALTER TABLE time_slot ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE`,
  // --- monthly platform fee (shop subscription) ---
  `INSERT INTO subscription_status (substatus_name) SELECT 'Pending' WHERE NOT EXISTS (SELECT 1 FROM subscription_status WHERE substatus_name = 'Pending')`,
  `ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS reference VARCHAR(60)`,
  `ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS period_start DATE`,
  `ALTER TABLE subscription_payment ADD COLUMN IF NOT EXISTS period_end DATE`,
  // shops that already existed before the fee was introduced get one free month so they stay visible
  `INSERT INTO subscription (start_date, end_date, business_id, plan_id, substatus_id)
   SELECT (NOW() AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 30, b.business_id,
          (SELECT plan_id FROM subscription_plan ORDER BY (plan_name = 'Basic Plan') DESC, price LIMIT 1),
          (SELECT substatus_id FROM subscription_status WHERE substatus_name = 'Active')
     FROM business b
    WHERE NOT EXISTS (SELECT 1 FROM subscription s WHERE s.business_id = b.business_id)
      AND EXISTS (SELECT 1 FROM subscription_plan) AND EXISTS (SELECT 1 FROM subscription_status WHERE substatus_name = 'Active')`,
  // --- ticket / otp ---
  `ALTER TABLE ticket ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE ticket ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,
  `ALTER TABLE ticket ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20)`,
  `ALTER TABLE login_otp ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0`,
];

async function migrate() {
  for (const sql of STEPS) {
    try {
      await pool.query(sql);
    } catch (e) {
      // never block startup; just say which step could not be applied
      console.error(`[Migrate] skipped "${sql.slice(0, 70)}...": ${e.message}`);
    }
  }
  console.log('[Migrate] schema check done');
}

module.exports = { migrate };
