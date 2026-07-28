const pool = require('../config/db');

// Status ids, matching ticket_status seed data
const STATUS = { WAITING: 1, SERVING: 2, COMPLETED: 3, CANCELLED: 4 };

const TicketModel = {
  STATUS,

  isSlotTaken: async (timeslotId) => {
    const result = await pool.query(
      `SELECT ticket_id FROM ticket WHERE timeslot_id = $1 AND status_id <> $2`,
      [timeslotId, STATUS.CANCELLED]
    );
    return result.rows.length > 0;
  },

  // One queue per business per day. Reuses today's row if it already exists.
  findOrCreateTodayQueue: async (businessId) => {
    const result = await pool.query(
      `INSERT INTO queue (date, business_id)
       VALUES (CURRENT_DATE, $1)
       ON CONFLICT (date, business_id) DO UPDATE SET business_id = EXCLUDED.business_id
       RETURNING queue_id`,
      [businessId]
    );
    return result.rows[0].queue_id;
  },

  nextQueueNumber: async (queueId) => {
    const result = await pool.query(
      `SELECT COUNT(*) + 1 AS next_number FROM ticket WHERE queue_id = $1`,
      [queueId]
    );
    return `A${String(result.rows[0].next_number).padStart(3, '0')}`;
  },

  create: async ({ queueNumber, customerId, queueId, timeslotId }) => {
    const result = await pool.query(
      `INSERT INTO ticket (queue_number, customer_id, queue_id, timeslot_id, status_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [queueNumber, customerId, queueId, timeslotId, STATUS.WAITING]
    );
    return result.rows[0];
  },

  addDepositPayment: async (ticketId, amount) => {
    await pool.query(
      `INSERT INTO payment (ticket_id, amount, status_id) VALUES ($1, $2, 2)`,
      [ticketId, amount]
    );
  },

  findFullTicket: async (ticketId) => {
    const query = `
      SELECT
        t.ticket_id, t.queue_number, t.created_at,
        b.business_name, q.date,
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
    const result = await pool.query(query, [ticketId]);
    return result.rows[0];
  },

  findByCustomer: async (customerId) => {
    const query = `
      SELECT
        t.ticket_id, t.queue_number, t.created_at, t.status_id,
        b.business_id, b.business_name, q.date,
        COALESCE(ts.start_time::text, '-') AS start_time,
        COALESCE(ts.end_time::text, '-') AS end_time,
        st.status_name,
        COALESCE(p.amount, 0) AS amount_paid
      FROM ticket t
      JOIN queue q ON q.queue_id = t.queue_id
      JOIN business b ON b.business_id = q.business_id
      JOIN ticket_status st ON st.status_id = t.status_id
      LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
      LEFT JOIN payment p ON p.ticket_id = t.ticket_id
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
        t.ticket_id, t.queue_number, t.status_id, st.status_name,
        c.fname, c.lname,
        COALESCE(ts.start_time::text, '-') AS start_time,
        COALESCE(ts.end_time::text, '-') AS end_time,
        t.timeslot_id IS NULL AS is_walkin
      FROM ticket t
      JOIN queue q ON q.queue_id = t.queue_id
      JOIN customer c ON c.customer_id = t.customer_id
      JOIN ticket_status st ON st.status_id = t.status_id
      LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
      WHERE q.business_id = $1
        AND q.date = CURRENT_DATE
        AND t.status_id IN ($2, $3)
      ORDER BY t.created_at ASC
    `;
    const result = await pool.query(query, [businessId, STATUS.WAITING, STATUS.SERVING]);
    return result.rows;
  },

  // Moves a ticket from one status to another, only if it's currently in fromStatus.
  transitionStatus: async (ticketId, fromStatus, toStatus) => {
    const result = await pool.query(
      `UPDATE ticket SET status_id = $1 WHERE ticket_id = $2 AND status_id = $3 RETURNING *`,
      [toStatus, ticketId, fromStatus]
    );
    return result.rows[0];
  }
};

module.exports = TicketModel;
