const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOTP } = require('../mailer');
const CustomerModel = require('../models/customerModel');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeOTP(email, role, otpCode) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query(
    `INSERT INTO login_otp (email, role, otp_code, expires_at) VALUES ($1, $2, $3, $4)`,
    [email, role, otpCode, expiresAt]
  );
}

async function verifyOTP(email, role, otpCode) {
  const result = await pool.query(
    `SELECT * FROM login_otp WHERE email = $1 AND role = $2 AND otp_code = $3 AND expires_at > NOW()`,
    [email, role, otpCode]
  );
  if (result.rows.length === 0) return false;
  await pool.query(`DELETE FROM login_otp WHERE email = $1 AND role = $2`, [email, role]);
  return true;
}

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await CustomerModel.create({ fname, lname, phone_number, email, passwordHash });
    res.status(201).json({ success: true, message: 'Account created successfully.', user });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }
    console.error('Customer signup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await CustomerModel.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const otpCode = generateOTP();
    await storeOTP(email, 'customer', otpCode);
    await sendOTP(email, otpCode);

    res.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
      requireOTP: true,
      email: email
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const isValid = await verifyOTP(email, 'customer', otp);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await CustomerModel.findByEmail(email);
    const token = jwt.sign({ id: user.customer_id, role: 'customer' }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.customer_id, fname: user.fname, email: user.email }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await CustomerModel.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otpCode = generateOTP();
    await storeOTP(email, 'customer', otpCode);
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

    let user = await CustomerModel.findByEmail(email);
    
    if (!user) {
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
      user = await CustomerModel.create({
        fname: given_name,
        lname: family_name || '',
        phone_number: null,
        email: email,
        passwordHash: randomPassword
      });
    }

    const token = jwt.sign({ id: user.customer_id, role: 'customer' }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      success: true,
      token,
      user: { id: user.customer_id, fname: user.fname, email: user.email }
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google Token' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await CustomerModel.findById(req.params.id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await CustomerModel.update(req.params.id, req.body);
    res.json({ success: true, user, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};