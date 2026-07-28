const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OwnerModel = require('../models/ownerModel');

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newOwner = await OwnerModel.create({
      fname, lname, phone_number, email, passwordHash
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: newOwner
    });
  } catch (error) {
    console.error('Owner Signup Error: ', error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const owner = await OwnerModel.findByEmail(email);
    if (!owner) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: owner.owner_id, role: 'owner' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      owner: {
        id: owner.owner_id,
        fname: owner.fname,
        lname: owner.lname,
        email: owner.email
      }
    });
  } catch (error) {
    console.error('Owner Login Error: ', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/owner/businesses/:ownerId : ร้านทั้งหมดของเจ้าของร้านคนนี้ พร้อมจำนวนคนรอคิววันนี้
exports.getMyBusinesses = async (req, res) => {
  const { ownerId } = req.params;
  try {
    const db = require('../config/db');
    const query = `
      SELECT
        b.business_id,
        b.business_name,
        b.is_deposit,
        b.deposit_amount,
        COUNT(t.ticket_id) FILTER (WHERE t.status_id = 1) AS waiting_count,
        COUNT(t.ticket_id) FILTER (WHERE t.status_id = 2) AS serving_count
      FROM business b
      LEFT JOIN queue q ON q.business_id = b.business_id AND q.date = CURRENT_DATE
      LEFT JOIN ticket t ON t.queue_id = q.queue_id
      WHERE b.owner_id = $1
      GROUP BY b.business_id
      ORDER BY b.business_id ASC;
    `;
    const result = await db.query(query, [ownerId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get My Businesses Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/owner/queue/:businessId : คิวที่ยังไม่จบของร้านนี้ (Waiting + Serving) ของวันนี้
exports.getQueueList = async (req, res) => {
  const { businessId } = req.params;
  try {
    const db = require('../config/db');
    const query = `
      SELECT
        t.ticket_id,
        t.queue_number,
        t.status_id,
        stat.status_name,
        c.fname,
        c.lname,
        COALESCE(ts.start_time::text, '-') AS start_time,
        COALESCE(ts.end_time::text, '-') AS end_time,
        (t.timeslot_id IS NULL) AS is_walkin
      FROM ticket t
      JOIN queue q ON t.queue_id = q.queue_id
      JOIN customer c ON t.customer_id = c.customer_id
      JOIN ticket_status stat ON t.status_id = stat.status_id
      LEFT JOIN time_slot ts ON t.timeslot_id = ts.timeslot_id
      WHERE q.business_id = $1
        AND q.date = CURRENT_DATE
        AND t.status_id IN (1, 2)
      ORDER BY t.created_at ASC;
    `;
    const result = await db.query(query, [businessId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get Queue List Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/owner/tickets/:ticketId/checkin : ยืนยันลูกค้ามาถึงร้านแล้ว (จำลองการสแกน QR) → Waiting -> Serving
exports.checkInTicket = async (req, res) => {
  const { ticketId } = req.params;
  try {
    const db = require('../config/db');
    const result = await db.query(
      `UPDATE ticket SET status_id = 2 WHERE ticket_id = $1 AND status_id = 1 RETURNING *;`,
      [ticketId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'ตั๋วนี้ไม่อยู่ในสถานะรอคิว (Waiting) แล้ว' });
    }
    res.json({ success: true, message: 'ยืนยันลูกค้ามาถึงร้านแล้ว', data: result.rows[0] });
  } catch (error) {
    console.error('Check-in Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/owner/tickets/:ticketId/complete : จบงานให้ลูกค้าคนนี้แล้ว → Serving -> Completed
exports.completeTicket = async (req, res) => {
  const { ticketId } = req.params;
  try {
    const db = require('../config/db');
    const result = await db.query(
      `UPDATE ticket SET status_id = 3 WHERE ticket_id = $1 AND status_id = 2 RETURNING *;`,
      [ticketId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'ตั๋วนี้ไม่อยู่ในสถานะกำลังให้บริการ (Serving)' });
    }
    res.json({ success: true, message: 'บันทึกว่าให้บริการเสร็จสิ้นแล้ว', data: result.rows[0] });
  } catch (error) {
    console.error('Complete Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/owner/tickets/:ticketId/no-show : ลูกค้าไม่มาตามนัด → Waiting -> Cancelled
exports.noShowTicket = async (req, res) => {
  const { ticketId } = req.params;
  try {
    const db = require('../config/db');
    const result = await db.query(
      `UPDATE ticket SET status_id = 4 WHERE ticket_id = $1 AND status_id = 1 RETURNING *;`,
      [ticketId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถบันทึก No-show ได้' });
    }
    res.json({ success: true, message: 'บันทึกลูกค้าไม่มาตามนัดแล้ว', data: result.rows[0] });
  } catch (error) {
    console.error('No-show Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/owner/businesses : ลงทะเบียนร้านค้าใหม่
exports.createBusiness = async (req, res) => {
  const {
    owner_id,
    business_name,
    is_deposit,
    deposit_amount,
    queue_type,      // 'walkin' | 'timeslot'
    time_slots = []   // [{ date, start_time, end_time }]
  } = req.body;

  // --- Validation ฝั่ง backend (กันเผื่อข้าม UI ยิง API ตรง) ---
  if (!owner_id) {
    return res.status(401).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
  }
  if (!business_name || !business_name.trim()) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อร้านค้า' });
  }
  if (is_deposit && (!deposit_amount || Number(deposit_amount) <= 0)) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุยอดมัดจำให้ถูกต้อง (มากกว่า 0)' });
  }
  if (queue_type === 'timeslot' && (!Array.isArray(time_slots) || time_slots.length === 0)) {
    return res.status(400).json({ success: false, message: 'กรุณาเพิ่มรอบเวลาอย่างน้อย 1 รอบ' });
  }
  if (queue_type === 'timeslot') {
    for (const slot of time_slots) {
      if (!slot.date || !slot.start_time || !slot.end_time) {
        return res.status(400).json({ success: false, message: 'ข้อมูลรอบเวลาไม่ครบถ้วน' });
      }
      if (slot.start_time >= slot.end_time) {
        return res.status(400).json({ success: false, message: 'เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุดในทุกรอบ' });
      }
    }
  }

  const pool = require('../config/db');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertBusinessQuery = `
      INSERT INTO business (business_name, is_deposit, deposit_amount, owner_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const businessRes = await client.query(insertBusinessQuery, [
      business_name.trim(),
      !!is_deposit,
      is_deposit ? Number(deposit_amount) : 0,
      owner_id
    ]);
    const newBusiness = businessRes.rows[0];

    let insertedSlots = [];
    if (queue_type === 'timeslot' && time_slots.length > 0) {
      const values = [];
      const placeholders = time_slots.map((slot, i) => {
        const base = i * 4;
        values.push(newBusiness.business_id, slot.date, slot.start_time, slot.end_time);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      }).join(', ');

      const insertSlotsQuery = `
        INSERT INTO time_slot (business_id, date, start_time, end_time)
        VALUES ${placeholders}
        RETURNING *;
      `;
      const slotsRes = await client.query(insertSlotsQuery, values);
      insertedSlots = slotsRes.rows;
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'ลงทะเบียนร้านค้าสำเร็จ',
      data: { ...newBusiness, time_slots: insertedSlots }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create Business Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};