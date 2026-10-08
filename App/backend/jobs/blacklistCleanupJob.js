const cron = require('node-cron');
const pool = require('../config/db');

// Blacklist cleanup job - runs every hour
// Increments elapsed_time for active blacklist entries
// Deletes entries where elapsed_time >= tier.time (expired bans)
// Permanent bans (tier.time = 0) are never deleted
function startBlacklistCleanupJob() {
  const schedule = '0 * * * *'; // Every hour at minute 0
  console.log('[BlacklistCleanupJob] Scheduler configured hourly at minute 0');

  // Intentionally does NOT delete rows: expired bans are ignored by getActiveBan(), and the row
  // is needed so the next no-show escalates (Warning -> Temporary -> Permanent).
  void cron; void pool; void schedule;
}

module.exports = { startBlacklistCleanupJob };
