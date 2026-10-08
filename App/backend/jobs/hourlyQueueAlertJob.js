const cron = require('node-cron');
const pool = require('../config/db');
const mailer = require('../mailer');

const BKK_NOW = `(NOW() AT TIME ZONE 'Asia/Bangkok')`;

// Queue reminder (customer-chosen 1-24 hours before the slot) - runs every 5 minutes.
//
// FIX: the old job could never send anything. It built `new Date('1970-01-01T10:00:00:00:00+07:00')`
// (an extra ":00:00" on a value that already had seconds) which is an Invalid Date, so every
// comparison was false. It also had no memory of what it had sent. Now the time window is
// computed in SQL and each ticket is flagged (ticket.reminder_sent) so it is e-mailed once.
function startHourlyQueueAlertJob() {
  const schedule = '*/5 * * * *';
  console.log('[HourlyQueueAlertJob] Scheduler configured every 5 minutes');

  cron.schedule(schedule, async () => {
    try {
      // Each customer picks how many hours before the slot they want the reminder
      // (customer.reminder_hours_before, 1-24). Send once the slot is that close and hasn't started.
      const { rows: tickets } = await pool.query(`
        SELECT t.ticket_id, t.queue_number, t.status_id,
               b.business_name,
               to_char(ts.date, 'YYYY-MM-DD') AS date,
               ts.start_time::text AS start_time,
               ts.end_time::text AS end_time,
               c.email, c.fname, c.lname, c.reminder_hours_before
        FROM ticket t
        JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
        JOIN queue q ON q.queue_id = t.queue_id
        JOIN business b ON b.business_id = q.business_id
        JOIN customer c ON c.customer_id = t.customer_id
        WHERE t.status_id = 1                      -- WAITING only
          AND t.reminder_sent = FALSE
          AND c.queue_reminder_opt_in = TRUE
          AND (ts.date + ts.start_time) > ${BKK_NOW}
          AND (ts.date + ts.start_time) <= ${BKK_NOW} + (c.reminder_hours_before * INTERVAL '1 hour')
        ORDER BY ts.date ASC, ts.start_time ASC
      `);

      for (const ticket of tickets) {
        try {
          const claim = await pool.query(`UPDATE ticket SET reminder_sent = TRUE WHERE ticket_id = $1 AND reminder_sent = FALSE`, [ticket.ticket_id]);
          if (claim.rowCount === 0) continue; // another run already took it
          await mailer.sendQueueReminderEmail(
            ticket.email,
            `${ticket.fname} ${ticket.lname}`,
            ticket,
            ticket.business_name,
            ticket.start_time,
            ticket.reminder_hours_before
          );
          console.log(`[HourlyQueueAlertJob] Sent reminder to ${ticket.email} for ticket #${ticket.ticket_id}`);
        } catch (err) {
          await pool.query(`UPDATE ticket SET reminder_sent = FALSE WHERE ticket_id = $1`, [ticket.ticket_id]).catch(() => {});
          console.error(`[HourlyQueueAlertJob] Failed for ticket ${ticket.ticket_id}:`, err.message);
        }
        await new Promise((resolve) => setTimeout(resolve, 500)); // avoid rate limiting
      }
    } catch (error) {
      console.error('[HourlyQueueAlertJob] Error:', error);
    }
  }, { timezone: 'Asia/Bangkok' });
}

module.exports = { startHourlyQueueAlertJob };
