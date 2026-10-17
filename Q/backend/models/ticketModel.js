const pool = require('../config/db');

// Status ids, matching ticket_status seed data
const STATUS = { WAITING: 1, SERVING: 2, COMPLETED: 3, CANCELLED: 4 };

// FIX: the whole app works in Bangkok time, but several queries used the DB's CURRENT_DATE
// (UTC on most hosts). Between 00:00 and 07:00 Bangkok time that is *yesterday*, so "today's
// queue", the owner dashboard and the reminder jobs were all looking at the wrong day.
const BKK_TODAY = `(NOW() AT TIME ZONE 'Asia/Bangkok')::date`;
const BKK_NOW_TIME = `(NOW() AT TIME ZONE 'Asia/Bangkok')::time`;

const TicketModel = {
  STATUS,
  BKK_TODAY,
  BKK_NOW_TIME,

  // Locks the slot row (inside a transaction) so two people cannot book the last seat at once.
  lockSlot: async (client, timeslotId) => {
    const result = await client.query(
      `SELECT timeslot_id, business_id, max_capacity, start_time::text AS start_time, end_time::text AS end_time,
              date::text AS date,
              (date - ${BKK_TODAY}) AS days_ahead,
              (date = ${BKK_TODAY} AND end_time <= ${BKK_NOW_TIME}) AS already_ended
         FROM time_slot WHERE timeslot_id = $1 FOR UPDATE`,
      [timeslotId]
    );
    return result.rows[0];
  },

  getBookedPax: async (client, timeslotId) => {
    const result = await client.query(
      `SELECT COALESCE(SUM(pax), 0) AS booked_pax FROM ticket WHERE timeslot_id = $1 AND status_id <> $2`,
      [timeslotId, STATUS.CANCELLED]
    );
    return Number(result.rows[0].booked_pax);
  },

  // Does this customer already hold an active booking that overlaps [start, end) on that slot date?
  // FIX: compares the *slot's* date (ts.date). The old query compared q.date, which was always
  // "today's queue", so overlaps on future dates were never detected.
  hasOverlappingBooking: async (client, customerId, date, startTime, endTime) => {
    const result = await client.query(
      `SELECT 1
         FROM ticket t
         JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
        WHERE t.customer_id = $1
          AND ts.date = $2
          AND t.status_id NOT IN ($5, $6)
          AND ts.start_time < $4
          AND ts.end_time > $3
        LIMIT 1`,
      [customerId, date, startTime, endTime, STATUS.CANCELLED, STATUS.COMPLETED]
    );
    return result.rows.length > 0;
  },

  getBusinessForBooking: async (client, businessId) => {
    const result = await client.query(
      `SELECT b.business_id, b.is_deposit, b.deposit_amount,
              (b.queue_type = 'timeslot') AS has_slots
         FROM business b WHERE b.business_id = $1 AND b.is_active`,
      [businessId]
    );
    return result.rows[0];
  },

  // One queue per business per day. Reuses the row if it already exists.
  // FIX: takes the date (the slot's date for bookings), so a booking for next Tuesday lands in
  // Tuesday's queue instead of today's.
  findOrCreateQueue: async (client, businessId, date = null) => {
    // Advisory lock per (business, day) instead of relying on ON CONFLICT: an older database
    // without the UNIQUE (date, business_id) constraint made ON CONFLICT throw -> "Internal server error".
    const day = (await client.query(`SELECT COALESCE($1::date, ${BKK_TODAY}) AS d`, [date])).rows[0].d;
    await client.query(`SELECT pg_advisory_xact_lock($1::int, ($2::date - DATE '2000-01-01')::int)`, [businessId, day]);
    const found = await client.query(
      `SELECT queue_id FROM queue WHERE business_id = $1 AND date = $2::date ORDER BY queue_id LIMIT 1`,
      [businessId, day]
    );
    if (found.rows[0]) return found.rows[0].queue_id;
    const created = await client.query(
      `INSERT INTO queue (date, business_id) VALUES ($1::date, $2) RETURNING queue_id`,
      [day, businessId]
    );
    return created.rows[0].queue_id;
  },

  // FIX: COUNT(*)+1 handed out the same number to two simultaneous bookings (unique violation -> 500).
  // The queue row is locked first so numbering is serialized per queue.
  nextQueueNumber: async (client, queueId) => {
    await client.query(`SELECT 1 FROM queue WHERE queue_id = $1 FOR UPDATE`, [queueId]);
    const result = await client.query(
      `SELECT COUNT(*) + 1 AS next_number FROM ticket WHERE queue_id = $1`,
      [queueId]
    );
    return `A${String(result.rows[0].next_number).padStart(3, '0')}`;
  },

  create: async (client, { queueNumber, customerId, queueId, timeslotId, pax }) => {
    const result = await client.query(
      `INSERT INTO ticket (queue_number, customer_id, queue_id, timeslot_id, status_id, pax)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
       [queueNumber, customerId, queueId, timeslotId, STATUS.WAITING, pax]
    );
    return result.rows[0];
  },

  addDepositPayment: async (client, ticketId, amount) => {
    await client.query(
      `INSERT INTO payment (ticket_id, amount, status_id) VALUES ($1, $2, 2)`,
      [ticketId, amount]
    );
  },

  // date is returned as 'YYYY-MM-DD' text so the browser never shifts it by a timezone
  findFullTicket: async (ticketId, client = pool) => {
    const query = `
      SELECT
         t.ticket_id, t.queue_number, t.created_at,
         t.pax,
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
      WHERE t.ticket_id = $1
    `;
    const result = await client.query(query, [ticketId]);
    return result.rows[0];
  },

  findByCustomer: async (customerId) => {
    const query = `
      SELECT
         t.ticket_id, t.queue_number, t.created_at, t.status_id, t.pax,
         b.business_id, b.business_name,
         to_char(COALESCE(ts.date, q.date), 'YYYY-MM-DD') AS date,
         COALESCE(ts.start_time::text, '-') AS start_time,
         COALESCE(ts.end_time::text, '-') AS end_time,
         st.status_name,
         COALESCE(p.amount, 0) AS amount_paid,
         ps.status_name AS payment_status,
         -- Walk-in tickets only: how many walk-in tickets in the same queue are still ahead of this one
         CASE WHEN t.timeslot_id IS NULL AND t.status_id = ${STATUS.WAITING} THEN (
           SELECT COUNT(*) FROM ticket t2
            WHERE t2.queue_id = t.queue_id AND t2.timeslot_id IS NULL
              AND t2.status_id IN (${STATUS.WAITING}, ${STATUS.SERVING})
              AND t2.ticket_id < t.ticket_id
         ) END AS people_ahead
      FROM ticket t
      JOIN queue q ON q.queue_id = t.queue_id
      JOIN business b ON b.business_id = q.business_id
      JOIN ticket_status st ON st.status_id = t.status_id
      LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
      LEFT JOIN payment p ON p.ticket_id = t.ticket_id
      LEFT JOIN payment_status ps ON ps.status_id = p.status_id
      WHERE t.customer_id = $1
      ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query, [customerId]);
    return result.rows;
  },

  findOwnedByCustomer: async (ticketId, customerId) => {
    const result = await pool.query(
      `SELECT ticket_id, status_id FROM ticket WHERE ticket_id = $1 AND customer_id = $2`,
      [ticketId, customerId]
    );
    return result.rows[0];
  },

  // Today's active tickets (waiting or serving) for a business, oldest first.
  findActiveForBusiness: async (businessId) => {
    const query = `
      SELECT
        t.ticket_id, t.queue_number, t.status_id, st.status_name, t.pax,
        c.fname, c.lname,
        COALESCE(ts.start_time::text, '-') AS start_time,
        COALESCE(ts.end_time::text, '-') AS end_time,
        t.timeslot_id IS NULL AS is_walkin,
        q.date::text AS date
      FROM ticket t
      JOIN queue q ON q.queue_id = t.queue_id
      JOIN customer c ON c.customer_id = t.customer_id
      JOIN ticket_status st ON st.status_id = t.status_id
      LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
      WHERE q.business_id = $1
        -- FIX: was q.date = today, so bookings for any later day (the app lets customers book
        -- 14 days ahead) were Waiting for the customer but never appeared on the owner's page.
        AND q.date >= ${BKK_TODAY}
        AND t.status_id IN ($2, $3)
      ORDER BY q.date ASC, ts.start_time ASC NULLS FIRST, t.created_at ASC
    `;
    const result = await pool.query(query, [businessId, STATUS.WAITING, STATUS.SERVING]);
    return result.rows;
  },

  getBusinessAnalytics: async (businessId) => {
    const totalsQuery = `
      SELECT
        COUNT(t.ticket_id) AS total_queues,
        COUNT(t.ticket_id) FILTER (WHERE q.date = ${BKK_TODAY}) AS queues_today,
        COUNT(t.ticket_id) FILTER (WHERE q.date >= ${BKK_TODAY} - 30 AND q.date < ${BKK_TODAY}) AS queues_past_month,
        COUNT(t.ticket_id) FILTER (WHERE t.status_id = 4) AS total_cancelled
      FROM business b
      LEFT JOIN queue q ON q.business_id = b.business_id
      LEFT JOIN ticket t ON t.queue_id = q.queue_id
      WHERE b.business_id = $1
    `;

    const chartQuery = `
      SELECT
        to_char(series.date, 'Mon DD') AS date_label,
        COUNT(t.ticket_id) AS count
      FROM generate_series(${BKK_TODAY}::timestamp - INTERVAL '13 days', ${BKK_TODAY}::timestamp, INTERVAL '1 day') AS series(date)
      LEFT JOIN queue q ON q.date = series.date::date AND q.business_id = $1
      LEFT JOIN ticket t ON t.queue_id = q.queue_id
      GROUP BY series.date
      ORDER BY series.date ASC;
    `;

    const [totalsResult, chartResult] = await Promise.all([
      pool.query(totalsQuery, [businessId]),
      pool.query(chartQuery, [businessId])
    ]);

    return {
      totals: totalsResult.rows[0] || { total_queues: 0, queues_today: 0, queues_past_month: 0, total_cancelled: 0 },
      chartData: chartResult.rows
    };
  },

  // Moves a ticket from one status to another, only if it's currently in fromStatus.
  // When ownerId is given, the ticket must also belong to a business owned by that owner.
  // When businessId is given, the ticket must also belong to THAT SPECIFIC business.
  // cancelledBy ('customer' | 'no_show') is stored when the new status is Cancelled, for the owner's history.
  transitionStatus: async (ticketId, fromStatus, toStatus, ownerId = null, businessId = null, cancelledBy = null) => {
    const values = [toStatus, ticketId, fromStatus];
    let set = 'status_id = $1';
    if (toStatus === STATUS.CANCELLED) {
      values.push(cancelledBy);
      set += `, cancelled_at = NOW(), cancelled_by = $${values.length}`;
    }
    let query = `
      UPDATE ticket t
      SET ${set}
      FROM queue q
      JOIN business b ON b.business_id = q.business_id
      WHERE t.ticket_id = $2
        AND t.status_id = $3
        AND t.queue_id = q.queue_id
    `;

    if (ownerId) {
      values.push(ownerId);
      query += ` AND b.owner_id = $${values.length}`;
    }

    if (businessId) {
      values.push(businessId);
      query += ` AND q.business_id = $${values.length}`;
    }

    query += ` RETURNING t.*`;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Cancelled tickets (customer cancelled, or owner marked no-show) for the owner's history tab. Newest first.
  findCancelledForBusiness: async (businessId, limit = 200) => {
    const result = await pool.query(
      `SELECT t.ticket_id, t.queue_number, t.pax,
              c.fname, c.lname, c.email, c.phone_number,
              COALESCE(t.cancelled_by, 'unknown') AS cancelled_by,
              COALESCE(t.cancelled_at, t.created_at) AS cancelled_at,
              to_char(COALESCE(ts.date, q.date), 'YYYY-MM-DD') AS date,
              COALESCE(ts.start_time::text, '-') AS start_time,
              COALESCE(ts.end_time::text, '-') AS end_time,
              t.timeslot_id IS NULL AS is_walkin
         FROM ticket t
         JOIN queue q ON q.queue_id = t.queue_id
         LEFT JOIN customer c ON c.customer_id = t.customer_id
         LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
        WHERE q.business_id = $1 AND t.status_id = $2
        ORDER BY COALESCE(t.cancelled_at, t.created_at) DESC
        LIMIT $3`,
      [businessId, STATUS.CANCELLED, limit]
    );
    return result.rows;
  }
};

module.exports = TicketModel;
