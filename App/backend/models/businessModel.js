const pool = require('../config/db');

const BusinessModel = {
  // Public list for customers, with each slot flagged as booked or free.
  findAllWithSlots: async () => {
    const query = `
      SELECT
        b.business_id,
        b.business_name,
        b.is_deposit,
        b.deposit_amount,
        c.name AS category_name,
        c.category_id,
        CASE WHEN COUNT(ts.timeslot_id) > 0 THEN 'timeslot' ELSE 'walkin' END AS queue_type,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'timeslot_id', ts.timeslot_id,
              'date', ts.date,
              'start_time', ts.start_time,
              'end_time', ts.end_time,
              'is_booked', booked.timeslot_id IS NOT NULL
            )
          ) FILTER (WHERE ts.timeslot_id IS NOT NULL),
          '[]'
        ) AS time_slots
      FROM business b
      LEFT JOIN time_slot ts ON ts.business_id = b.business_id
      LEFT JOIN category c ON c.category_id = b.category_id
      LEFT JOIN (
        SELECT DISTINCT timeslot_id FROM ticket
        WHERE timeslot_id IS NOT NULL AND status_id <> 4
      ) booked ON booked.timeslot_id = ts.timeslot_id
      GROUP BY b.business_id, c.category_id, c.name
      ORDER BY b.business_id ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // Get all categories
  findAllCategories: async () => {
    const result = await pool.query('SELECT * FROM category ORDER BY name ASC');
    return result.rows;
  },

  // Shops belonging to one owner, with today's waiting/serving counts.
  findByOwner: async (ownerId) => {
    const query = `
      SELECT
        b.business_id,
        b.business_name,
        b.is_deposit,
        b.deposit_amount,
        c.name AS category_name,
        COUNT(t.ticket_id) FILTER (WHERE t.status_id = 1) AS waiting_count,
        COUNT(t.ticket_id) FILTER (WHERE t.status_id = 2) AS serving_count
      FROM business b
      LEFT JOIN category c ON c.category_id = b.category_id
      LEFT JOIN queue q ON q.business_id = b.business_id AND q.date = CURRENT_DATE
      LEFT JOIN ticket t ON t.queue_id = q.queue_id
      WHERE b.owner_id = $1
      GROUP BY b.business_id, c.category_id
      ORDER BY b.business_id ASC;
    `;
    const result = await pool.query(query, [ownerId]);
    return result.rows;
  },

  create: async (client, { business_name, is_deposit, deposit_amount, owner_id, category_id }) => {
    const result = await client.query(
      `INSERT INTO business (business_name, is_deposit, deposit_amount, owner_id, category_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [business_name, is_deposit, deposit_amount, owner_id, category_id || null]
    );
    return result.rows[0];
  },

  addTimeSlots: async (client, businessId, slots) => {
    const values = [];
    const rows = slots.map((slot, i) => {
      const base = i * 4;
      values.push(businessId, slot.date, slot.start_time, slot.end_time);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    const result = await client.query(
      `INSERT INTO time_slot (business_id, date, start_time, end_time)
       VALUES ${rows.join(', ')}
       RETURNING *`,
      values
    );
    return result.rows;
  }
};

module.exports = BusinessModel;
