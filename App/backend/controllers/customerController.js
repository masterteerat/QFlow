const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CustomerModel = require('../models/customerModel');

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  try {
    // 1. เข้ารหัส Password ก่อนลง Database (Salt rounds = 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 2. ส่งไปบันทึกผ่าน Model
    const newUser = await CustomerModel.create({
      fname, lname, phone_number, email, passwordHash
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: newUser
    });
  } catch (error) {
    console.error('Customer Signup Error: ', error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. ค้นหา User จาก Email
    const user = await CustomerModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 2. เปรียบเทียบ Password ที่ส่งมา กับ Password Hash ใน DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 3. สร้าง JWT Token สำหรับยืนยันตัวตน
    const token = jwt.sign(
      { id: user.customer_id, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // หมดอายุใน 1 วัน
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
    
    const query = `
      SELECT 
        b.business_id,
        b.business_name,
        b.is_deposit,
        b.deposit_amount,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'timeslot_id', ts.timeslot_id,
              'date', ts.date,
              'start_time', ts.start_time,
              'end_time', ts.end_time
            )
          ) FILTER (WHERE ts.timeslot_id IS NOT NULL),
          '[]'
        ) AS time_slots
      FROM business b
      LEFT JOIN time_slot ts ON b.business_id = ts.business_id
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