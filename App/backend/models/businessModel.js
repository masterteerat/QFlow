const pool = require('../config/db');

const BusinessModel = {
  // Public list for customers, with each slot flagged as booked or free.
findAllWithSlots: async ({ search, categoryIds } = {}) => {
    let query = `
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
        AND ts.date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '13 days'
      LEFT JOIN category c ON c.category_id = b.category_id
      LEFT JOIN (
        SELECT timeslot_id, SUM(pax) AS total_pax FROM ticket
        WHERE timeslot_id IS NOT NULL AND status_id <> 4
        GROUP BY timeslot_id
      ) booked ON booked.timeslot_id = ts.timeslot_id
      WHERE 1=1
    `;
    
    const params = [];

    // เพิ่มเงื่อนไขกรอง Category (รับเป็น Array)
    if (categoryIds && categoryIds.length > 0) {
      params.push(categoryIds);
      query += ` AND b.category_id = ANY($${params.length}::int[])`;
    }

    // เพิ่มเงื่อนไขค้นหาชื่อร้าน
    if (search) {
      params.push(`%${search}%`);
      query += ` AND b.business_name ILIKE $${params.length}`;
    }

    query += `
      GROUP BY b.business_id, c.category_id, c.name
      ORDER BY b.business_id ASC;
    `;

    const result = await pool.query(query, params);
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
    // Stamp the daily template across the next 14 days (today through +13 days)
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    const values = [];
    let paramIdx = 1;
    const rows = [];

    for (const date of dates) {
      for (const slot of slots) {
        const base = paramIdx - 1;
        values.push(businessId, date, slot.start_time, slot.end_time, slot.max_capacity || 1);
        rows.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
        paramIdx += 5;
      }
    }

    const result = await client.query(
      `INSERT INTO time_slot (business_id, date, start_time, end_time, max_capacity)
        VALUES ${rows.join(', ')}
        RETURNING *`,
      values
    );
    return result.rows;
  },

  // Current daily template — dedupe by time since every day repeats the same blocks
  // 🟢 ORDER BY start_time เดิมมีอยู่แล้ว ใช้งานถูกต้อง
  getSchedule: async (businessId) => {
    const result = await pool.query(
      `SELECT DISTINCT start_time, end_time, max_capacity
       FROM time_slot
       WHERE business_id = $1 AND date >= CURRENT_DATE
       ORDER BY start_time ASC`,
      [businessId]
    );
    return result.rows;
  },

  // Replaces the daily template for the whole shop, re-stamping the next 14 days.
  // Slots that already have a booking are left alone — never deleted out from
  // under a customer who already reserved them.
  updateSchedule: async (client, businessId, slots) => {
    await client.query(
      `DELETE FROM time_slot
       WHERE business_id = $1
         AND date >= CURRENT_DATE
         AND timeslot_id NOT IN (
           SELECT timeslot_id FROM ticket WHERE timeslot_id IS NOT NULL
         )`,
      [businessId]
    );

    if (slots.length === 0) return [];
    return BusinessModel.addTimeSlots(client, businessId, slots);
  }
};

module.exports = BusinessModel;