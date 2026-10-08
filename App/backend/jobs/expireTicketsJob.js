const cron = require('node-cron');
const pool = require('../config/db');

const BKK_TODAY = `(NOW() AT TIME ZONE 'Asia/Bangkok')::date`;

// Closes tickets left open from earlier days so they don't stay "Waiting"/"Serving" forever.
//  - Waiting from a past day -> Cancelled, cancelled_by = 'expired' (NOT a no-show: no ban is applied)
//  - Serving from a past day -> Completed
async function expireOnce(label) {
  try {
    const w = await pool.query(
      `UPDATE ticket t SET status_id = 4, cancelled_at = NOW(), cancelled_by = 'expired'
         FROM queue q WHERE q.queue_id = t.queue_id AND t.status_id = 1 AND q.date < ${BKK_TODAY}`);
    const s = await pool.query(
      `UPDATE ticket t SET status_id = 3 FROM queue q
        WHERE q.queue_id = t.queue_id AND t.status_id = 2 AND q.date < ${BKK_TODAY}`);
    console.log(`[ExpireTicketsJob] ${label}: expired ${w.rowCount} waiting, completed ${s.rowCount} serving`);
  } catch (e) {
    console.error('[ExpireTicketsJob] Error:', e);
  }
}

function startExpireTicketsJob() {
  console.log('[ExpireTicketsJob] Scheduler configured daily at 00:10 Asia/Bangkok');
  cron.schedule('10 0 * * *', () => expireOnce('daily run'), { timezone: 'Asia/Bangkok' });
  expireOnce('startup run');
}

module.exports = { startExpireTicketsJob };
