const cron = require('node-cron');
const pool = require('../config/db');
const mailer = require('../mailer');

const BKK_TODAY = `(NOW() AT TIME ZONE 'Asia/Bangkok')::date`;

// Daily schedule email. Each customer picks the hour (Bangkok time) they want it, default 08:00.
// The job wakes every 10 minutes; daily_email_last_sent makes sure each customer gets at most one per day
// (and still gets it if the server was restarted a few minutes into their hour).
function startDailyEmailJob() {
  const schedule = '*/10 * * * *';
  console.log('[DailyEmailJob] Scheduler configured every 10 minutes (sends at each customer\'s chosen hour, Asia/Bangkok)');

  cron.schedule(schedule, async () => {
    try {
      const { rows: customers } = await pool.query(`
        SELECT customer_id, email, fname, lname
        FROM customer
        WHERE email_notifications_opt_in = TRUE
          AND daily_email_hour = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Bangkok')::int
          AND daily_email_last_sent IS DISTINCT FROM ${BKK_TODAY}
      `);

      for (const customer of customers) {
        // FIX: one failing email (bad address, SMTP hiccup) used to abort the whole run
        // and nobody after that customer got their email.
        try {
          const { rows: tickets } = await pool.query(`
            SELECT t.ticket_id, t.queue_number, t.status_id,
                   b.business_name,
                   to_char(COALESCE(ts.date, q.date), 'YYYY-MM-DD') AS date,
                   COALESCE(ts.start_time::text, '-') AS start_time,
                   COALESCE(ts.end_time::text, '-') AS end_time,
                   st.status_name
            FROM ticket t
            JOIN queue q ON q.queue_id = t.queue_id
            JOIN business b ON b.business_id = q.business_id
            JOIN ticket_status st ON st.status_id = t.status_id
            LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
            WHERE t.customer_id = $1
              AND t.status_id IN (1, 2)  -- WAITING, SERVING
              AND COALESCE(ts.date, q.date) BETWEEN ${BKK_TODAY} AND ${BKK_TODAY} + 14
            ORDER BY COALESCE(ts.date, q.date) ASC, ts.start_time ASC
          `, [customer.customer_id]);

          if (tickets.length > 0) {
            await mailer.sendDailyScheduleEmail(
              customer.email,
              `${customer.fname} ${customer.lname}`,
              tickets,
              customer.customer_id
            );
            await pool.query(`UPDATE customer SET daily_email_last_sent = ${BKK_TODAY} WHERE customer_id = $1`, [customer.customer_id]);
            console.log(`[DailyEmailJob] Sent daily schedule to ${customer.email} (${tickets.length} tickets)`);
            await new Promise((resolve) => setTimeout(resolve, 300)); // be gentle with the SMTP server
          }
        } catch (err) {
          console.error(`[DailyEmailJob] Failed for customer ${customer.customer_id}:`, err.message);
        }
      }
    } catch (error) {
      console.error('[DailyEmailJob] Error:', error);
    }
  }, { timezone: 'Asia/Bangkok' });
}

module.exports = { startDailyEmailJob };