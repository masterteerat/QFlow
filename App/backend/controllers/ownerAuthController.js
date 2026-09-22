const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOTP } = require('../mailer');
const OwnerModel = require('../models/ownerModel');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const NAME_REGEX = /^[A-Za-zก-๙'\- ]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{8,9}$/; // 0XXXXXXXX(X) - 9 or 10 digits, starts with 0
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validateSignupInput({ fname, lname, phone_number, email, password }) {
  if (!fname || !fname.trim() || !NAME_REGEX.test(fname.trim())) {
    return 'First name is invalid.';
  }
  if (!lname || !lname.trim() || !NAME_REGEX.test(lname.trim())) {
    return 'Last name is invalid.';
  }
  if (phone_number && !PHONE_REGEX.test(phone_number)) {
    return 'Phone number is invalid. Must be 9-10 digits starting with 0.';
  }
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return 'Email is invalid.';
  }
  if (!password || !PASSWORD_REGEX.test(password)) {
    return 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
  }
  return null;
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeOTP(email, role, otpCode) {
  const normalizedEmail = email.trim().toLowerCase();
  await pool.query(
    `DELETE FROM login_otp WHERE email = $1 AND role = $2`,
    [normalizedEmail, role]
  );
  await pool.query(
    `INSERT INTO login_otp (email, role, otp_code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [normalizedEmail, role, otpCode]
  );
}

async function verifyOTP(email, role, otpCode) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = String(otpCode).trim();

  const result = await pool.query(
    `SELECT * FROM login_otp
     WHERE email = $1 AND role = $2 AND otp_code = $3 AND expires_at > NOW()`,
    [normalizedEmail, role, normalizedOtp]
  );
  if (result.rows.length === 0) return false;

  await pool.query(
    `DELETE FROM login_otp WHERE email = $1 AND role = $2`,
    [normalizedEmail, role]
  );
  return true;
}

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  const validationError = validateSignupInput({ fname, lname, phone_number, email, password });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const owner = await OwnerModel.create({
      fname: fname.trim(),
      lname: lname.trim(),
      phone_number: phone_number || null,
      email: email.trim().toLowerCase(),
      passwordHash
    });
    res.status(201).json({ success: true, message: 'Account created successfully.', user: owner });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }
    console.error('Owner signup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const owner = await OwnerModel.findByEmail(email);
    if (!owner || !(await bcrypt.compare(password, owner.password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const otpCode = generateOTP();
    await storeOTP(email, 'owner', otpCode);
    await sendOTP(email, otpCode);

    res.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
      requireOTP: true,
      email: email
    });
  } catch (error) {
    console.error('Owner login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const isValid = await verifyOTP(email, 'owner', otp);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const owner = await OwnerModel.findByEmail(email);
    const token = jwt.sign({ id: owner.owner_id, role: 'owner' }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      owner: { id: owner.owner_id, fname: owner.fname, lname: owner.lname, email: owner.email }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const owner = await OwnerModel.findByEmail(email);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otpCode = generateOTP();
    await storeOTP(email, 'owner', otpCode);
    await sendOTP(email, otpCode);

    res.json({ success: true, message: 'OTP resent to your email.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.googleLogin = async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, given_name, family_name } = payload;

    let owner = await OwnerModel.findByEmail(email);
    
    if (!owner) {
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
      owner = await OwnerModel.create({
        fname: given_name,
        lname: family_name || '',
        phone_number: null,
        email: email,
        passwordHash: randomPassword
      });
    }

    const token = jwt.sign({ id: owner.owner_id, role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({
      success: true,
      token,
      owner: { id: owner.owner_id, fname: owner.fname, lname: owner.lname, email: owner.email }
    });
  } catch (error) {
    console.error('Owner Google Auth Error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google Token' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const owner = await OwnerModel.findById(req.params.id);
    res.json({ success: true, owner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const owner = await OwnerModel.update(req.params.id, req.body);
    res.json({ success: true, owner, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/owner/dev-login
// Dev/QA-only shortcut: issues a REAL, properly-signed JWT for the first
// owner account in the DB, so anything gated behind auth (like ticket
// check-in) works exactly as it would for a normal logged-in owner.
// Disabled outside development so it can never be reached in production.
exports.devLogin = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  try {
    const result = await pool.query('SELECT * FROM owner ORDER BY owner_id ASC LIMIT 1');
    const owner = result.rows[0];

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'No owner account exists yet to use for quick login. Sign up an owner first.'
      });
    }

    const token = jwt.sign({ id: owner.owner_id, role: 'owner' }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      success: true,
      token,
      owner: { id: owner.owner_id, fname: owner.fname, lname: owner.lname, email: owner.email }
    });
  } catch (error) {
    console.error('Owner dev login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};