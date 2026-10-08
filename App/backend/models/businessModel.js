const pool = require('../config/db');

const BKK_TODAY = `(NOW() AT TIME ZONE 'Asia/Bangkok')::date`;
const BKK_NOW_TIME = `(NOW() AT TIME ZONE 'Asia/Bangkok')::time`;

const BusinessModel = {
  findAllWithSlots: async ({ search, categoryIds } = {}) => {
    // FIX: slots that already ended today are no longer offered to customers
    // (the booking API now rejects them too).
    let query = `
      SELECT
        b.business_id,
        b.business_name,
        b.description,
        b.image,
        b.is_deposit,
        b.deposit_amount,
        c.name AS category_name,
        c.category_id,
        b.queue_type,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'timeslot_id', ts.timeslot_id,
              'date', ts.date,
              'start_time', ts.start_time,
              'end_time', ts.end_time,
              'max_capacity', ts.max_capacity,
              'remaining', ts.max_capacity - COALESCE(booked.total_pax, 0),
              'is_booked', (ts.max_capacity - COALESCE(booked.total_pax, 0)) <= 0
            )
            ORDER BY ts.date ASC, ts.start_time ASC
          ) FILTER (WHERE ts.timeslot_id IS NOT NULL),
          '[]'
        ) AS time_slots
      FROM business b
      LEFT JOIN time_slot ts ON ts.business_id = b.business_id
        AND b.queue_type = 'timeslot'
        AND ts.date BETWEEN ${BKK_TODAY} AND ${BKK_TODAY} + 13
        AND (ts.date > ${BKK_TODAY} OR ts.end_time > ${BKK_NOW_TIME})
      LEFT JOIN category c ON c.category_id = b.category_id
      LEFT JOIN (
        SELECT timeslot_id, SUM(pax) AS total_pax FROM ticket
        WHERE timeslot_id IS NOT NULL AND status_id <> 4
        GROUP BY timeslot_id
      ) booked ON booked.timeslot_id = ts.timeslot_id
      WHERE b.is_active
    `;

    const params = [];

    if (categoryIds && categoryIds.length > 0) {
      params.push(categoryIds);
      query += ` AND b.category_id = ANY($${params.length}::int[])`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND b.business_name ILIKE $${params.length}`;
    }

    query += `
      GROUP BY b.business_id, c.category_id, c.name, b.description, b.image
      ORDER BY b.business_id ASC;
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  findAllCategories: async () => {
    const result = await pool.query('SELECT * FROM category ORDER BY name ASC');
    return result.rows;
  },

  findById: async (businessId) => {
    const result = await pool.query(
      `SELECT b.*, c.name AS category_name, c.category_id
       FROM business b
       LEFT JOIN category c ON c.category_id = b.category_id
       WHERE b.business_id = $1 AND b.is_active`,
      [businessId]
    );
    const business = result.rows[0];
    if (!business) return null;
    const slotsResult = await pool.query(
      `SELECT timeslot_id, date, start_time, end_time, max_capacity
       FROM time_slot WHERE business_id = $1 AND date >= ${BKK_TODAY} ORDER BY date ASC, start_time ASC`,
      [businessId]
    );
    business.time_slots = slotsResult.rows;
    return business;
  },

  // FIX: now also returns queue_type. The Edit-shop form opened with "walk-in" selected for
  // every shop, so pressing Save on a time-slot shop silently deleted all its unbooked slots.
  findByOwner: async (ownerId) => {
    const query = `
      SELECT
        b.business_id,
        b.business_name,
        b.description,
        b.image,
        b.is_deposit,
        b.deposit_amount,
        c.name AS category_name,
        c.category_id,
        b.queue_type,
        COUNT(t.ticket_id) FILTER (WHERE t.status_id = 1) AS waiting_count,
        COUNT(t.ticket_id) FILTER (WHERE t.status_id = 2) AS serving_count
      FROM business b
      LEFT JOIN category c ON c.category_id = b.category_id
      LEFT JOIN queue q ON q.business_id = b.business_id AND q.date = ${BKK_TODAY}
      LEFT JOIN ticket t ON t.queue_id = q.queue_id
      WHERE b.owner_id = $1 AND b.is_active
      GROUP BY b.business_id, c.category_id, c.name, b.description, b.image
      ORDER BY b.business_id ASC;
    `;
    const result = await pool.query(query, [ownerId]);
    return result.rows;
  },

  create: async (client, { business_name, description, image, is_deposit, deposit_amount, owner_id, category_id, queue_type = 'walkin' }) => {
    const result = await client.query(
      `INSERT INTO business (business_name, description, image, is_deposit, deposit_amount, owner_id, category_id, queue_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [business_name, description || null, image || '/uploads/business/default-business.jpg', is_deposit, deposit_amount, owner_id, category_id || null, queue_type]
    );
    return result.rows[0];
  },

  update: async (client, { businessId, business_name, description, image, is_deposit, deposit_amount, category_id, queue_type }) => {
    const fields = [];
    const values = [];
    let paramIdx = 1;

    fields.push(`business_name = $${paramIdx++}`);
    values.push(business_name);

    if (image !== undefined) {
      fields.push(`image = $${paramIdx++}`);
      values.push(image);
    }

    fields.push(`description = $${paramIdx++}`);
    values.push(description);

    fields.push(`is_deposit = $${paramIdx++}`);
    values.push(is_deposit);

    fields.push(`deposit_amount = $${paramIdx++}`);
    values.push(deposit_amount);

    fields.push(`category_id = $${paramIdx++}`);
    values.push(category_id || null);

    if (queue_type === 'walkin' || queue_type === 'timeslot') {
      fields.push(`queue_type = $${paramIdx++}`);
      values.push(queue_type);
    }

    values.push(businessId);

    const result = await client.query(
      `UPDATE business SET ${fields.join(', ')} WHERE business_id = $${paramIdx} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  // Stamps the given daily blocks across the next 14 days (Bangkok date).
  // FIX: done in SQL with ON CONFLICT DO NOTHING (uq_time_slot). Before, re-saving a schedule
  // inserted a duplicate of every slot that already had a booking (those are kept by
  // updateSchedule), so customers saw the same time twice.
  addTimeSlots: async (client, businessId, slots) => {
    if (!slots || slots.length === 0) return [];
    const result = await client.query(
      `INSERT INTO time_slot (business_id, date, start_time, end_time, max_capacity)
       SELECT $1, ${BKK_TODAY} + d, s.start_time, s.end_time, s.max_capacity
         FROM generate_series(0, 13) AS d
        CROSS JOIN UNNEST($2::time[], $3::time[], $4::int[]) AS s(start_time, end_time, max_capacity)
       ON CONFLICT (business_id, date, start_time, end_time) DO NOTHING
       RETURNING *`,
      [
        businessId,
        slots.map((s) => s.start_time),
        slots.map((s) => s.end_time),
        slots.map((s) => Number(s.max_capacity) || 1)
      ]
    );
    return result.rows;
  },

  getSchedule: async (businessId) => {
    const result = await pool.query(
      `SELECT start_time, end_time, max_capacity FROM (
         SELECT DISTINCT ON (start_time, end_time) start_time, end_time, max_capacity
           FROM time_slot
          WHERE business_id = $1 AND date >= ${BKK_TODAY}
          ORDER BY start_time, end_time, date DESC
       ) s ORDER BY start_time ASC`,
      [businessId]
    );
    return result.rows;
  },

  updateSchedule: async (client, businessId, slots) => {
    await client.query(
      `DELETE FROM time_slot
        WHERE business_id = $1
          AND date >= ${BKK_TODAY}
          AND timeslot_id NOT IN (
            SELECT timeslot_id FROM ticket WHERE timeslot_id IS NOT NULL
          )`,
      [businessId]
    );

    if (slots.length === 0) return [];
    return BusinessModel.addTimeSlots(client, businessId, slots);
  },

  // Keeps the rolling 14-day window full. Without this, slots were only ever generated once
  // (at registration / schedule edit), so after 14 days shops had nothing left to book.
  // Copies each shop's most recent daily pattern forward. Called by jobs/slotRollJob.js.
  rollSlotWindow: async () => {
    const result = await pool.query(
      `WITH last_day AS (
         SELECT ts2.business_id, MAX(ts2.date) AS d FROM time_slot ts2
           JOIN business bb ON bb.business_id = ts2.business_id AND bb.queue_type = 'timeslot' AND bb.is_active
          GROUP BY ts2.business_id
       ),
       pattern AS (
         SELECT DISTINCT ts.business_id, ts.start_time, ts.end_time, ts.max_capacity
           FROM time_slot ts
           JOIN last_day l ON l.business_id = ts.business_id AND l.d = ts.date
          WHERE l.d >= ${BKK_TODAY} - 1
       )
       INSERT INTO time_slot (business_id, date, start_time, end_time, max_capacity)
       SELECT p.business_id, ${BKK_TODAY} + d, p.start_time, p.end_time, p.max_capacity
         FROM pattern p
        CROSS JOIN generate_series(0, 13) AS d
       ON CONFLICT (business_id, date, start_time, end_time) DO NOTHING
       RETURNING timeslot_id`
    );
    return result.rowCount;
  }
};

module.exports = BusinessModel;
