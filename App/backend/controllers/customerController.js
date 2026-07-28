const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CustomerModel = require('../models/customerModel');

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await CustomerModel.create({
      fname, lname, phone_number, email, passwordHash
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: newUser
    });
  } catch (error) {
    console.error('Signup Error:', error);
    // 23505 = Postgres unique constraint violation (email ซ้ำ)
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await CustomerModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.customer_id, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.customer_id,
        fname: user.fname,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Customer Login Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getBusinesses = async (req, res) => {
  try {
    const db = require('../config/db');

    // is_booked: เช็คว่า timeslot นี้มี ticket ที่ยังไม่ถูกยกเลิก (status_id <> 4) ผูกอยู่แล้วหรือยัง
    // ถ้ามี -> ห้ามให้ลูกค้าคนอื่นเลือก slot นี้ซ้ำ (ฝั่ง frontend จะทำเป็นสีเทากดไม่ได้)
    const query = `
      SELECT 
        b.business_id,
        b.business_name,
        b.is_deposit,
        b.deposit_amount,
        CASE 
          WHEN COUNT(ts.timeslot_id) > 0 THEN 'timeslot' 
          ELSE 'walkin' 
        END AS queue_type,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'timeslot_id', ts.timeslot_id,
              'date', ts.date,
              'start_time', ts.start_time,
              'end_time', ts.end_time,
              'is_booked', (bt.timeslot_id IS NOT NULL)
            )
          ) FILTER (WHERE ts.timeslot_id IS NOT NULL),
          '[]'
        ) AS time_slots
      FROM business b
      LEFT JOIN time_slot ts ON b.business_id = ts.business_id
      LEFT JOIN (
        SELECT DISTINCT timeslot_id
        FROM ticket
        WHERE timeslot_id IS NOT NULL AND status_id <> 4
      ) bt ON bt.timeslot_id = ts.timeslot_id
      GROUP BY b.business_id
      ORDER BY b.business_id ASC;
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching businesses: ', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/customer/tickets : บันทึกการจองคิว / รับคิว Walk-in
exports.createTicket = async (req, res) => {
  const { customer_id, business_id, timeslot_id = null, amount_paid = 0 } = req.body;

  try {
    const db = require('../config/db');

    // 0. ถ้าเป็นการจองแบบ timeslot ต้องเช็คก่อนว่า slot นี้ถูกจองไปแล้วหรือยัง
    //    (กันการจองซ้ำแบบยิง API ตรงๆ ข้าม UI ด้วย ไม่ใช่แค่เช็คฝั่ง frontend)
    if (timeslot_id) {
      const checkBookedQuery = `
        SELECT ticket_id 
        FROM ticket 
        WHERE timeslot_id = $1 AND status_id <> 4;
      `;
      const checkRes = await db.query(checkBookedQuery, [timeslot_id]);
      if (checkRes.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น'
        });
      }
    }

    // 1. หา หรือ สร้างแฟ้มคิวประจำวัน (queue_id) ของร้านค้านี้
    const queueQuery = `
      INSERT INTO queue (date, business_id)
      VALUES (CURRENT_DATE, $1)
      ON CONFLICT (date, business_id) 
      DO UPDATE SET business_id = EXCLUDED.business_id
      RETURNING queue_id;
    `;
    const queueRes = await db.query(queueQuery, [business_id]);
    const queueId = queueRes.rows[0].queue_id;

    // 2. นับจำนวนคิวใน queue_id นี้เพื่อสร้างเลขคิว (A001, A002...)
    const countQuery = `
      SELECT COUNT(*) + 1 AS next_q 
      FROM ticket 
      WHERE queue_id = $1;
    `;
    const countRes = await db.query(countQuery, [queueId]);
    const queueNumber = `A${String(countRes.rows[0].next_q).padStart(3, '0')}`;

    // 3. บันทึกลงตาราง ticket โดยผูกกับ queue_id และส่ง timeslot_id (ถ้า Walk-in จะเป็น null)
    const insertTicketQuery = `
      INSERT INTO ticket (queue_number, customer_id, queue_id, timeslot_id, status_id)
      VALUES ($1, $2, $3, $4, 1)
      RETURNING *;
    `;
    const ticketRes = await db.query(insertTicketQuery, [
      queueNumber, 
      customer_id, 
      queueId, 
      timeslot_id || null
    ]);
    const newTicket = ticketRes.rows[0];

    // 4. บันทึกมัดจำลงตาราง payment (ถ้ามี) (status_id = 2 คือ Paid)
    if (amount_paid > 0) {
      const insertPaymentQuery = `
        INSERT INTO payment (ticket_id, amount, status_id)
        VALUES ($1, $2, 2);
      `;
      await db.query(insertPaymentQuery, [newTicket.ticket_id, amount_paid]);
    }

    // 5. ดึงข้อมูลตั๋วคิวแบบเต็มส่งกลับไปแสดงผลที่ Frontend
    const fullTicketQuery = `
      SELECT 
        t.ticket_id, 
        t.queue_number,
        t.created_at,
        b.business_name,
        q.date, 
        COALESCE(ts.start_time::text, '-') AS start_time, 
        COALESCE(ts.end_time::text, '-') AS end_time,
        stat.status_name
      FROM ticket t
      JOIN queue q ON t.queue_id = q.queue_id
      JOIN business b ON q.business_id = b.business_id
      LEFT JOIN time_slot ts ON t.timeslot_id = ts.timeslot_id
      JOIN ticket_status stat ON t.status_id = stat.status_id
      WHERE t.ticket_id = $1;
    `;
    const fullRes = await db.query(fullTicketQuery, [newTicket.ticket_id]);

    res.status(201).json({
      success: true,
      message: 'Booking successful',
      data: fullRes.rows[0]
    });

  } catch (error) {
    console.error('Create Ticket Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/customer/tickets/:customerId : ดึงรายการคิวทั้งหมดของลูกค้าคนนั้น (ล่าสุดขึ้นก่อน)
exports.getMyTickets = async (req, res) => {
  const { customerId } = req.params;

  try {
    const db = require('../config/db');

    const query = `
      SELECT 
        t.ticket_id,
        t.queue_number,
        t.created_at,
        t.status_id,
        b.business_id,
        b.business_name,
        q.date,
        COALESCE(ts.start_time::text, '-') AS start_time,
        COALESCE(ts.end_time::text, '-') AS end_time,
        stat.status_name,
        COALESCE(p.amount, 0) AS amount_paid
      FROM ticket t
      JOIN queue q ON t.queue_id = q.queue_id
      JOIN business b ON q.business_id = b.business_id
      LEFT JOIN time_slot ts ON t.timeslot_id = ts.timeslot_id
      JOIN ticket_status stat ON t.status_id = stat.status_id
      LEFT JOIN payment p ON p.ticket_id = t.ticket_id
      WHERE t.customer_id = $1
      ORDER BY t.created_at DESC;
    `;

    const result = await db.query(query, [customerId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching my tickets: ', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};