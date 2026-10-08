const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOTP } = require('../mailer');
const OwnerModel = require('../models/ownerModel');
const { validateSignupInput, validateProfileInput, normalizeEmail } = require('../utils/validation');
const { generateOTP, storeOTP, verifyOTP } = require('../utils/otp');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (user) =>
  jwt.sign({ id: user.owner_id, role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '1d' });

const publicOwner = (user) => ({ id: user.owner_id, fname: user.fname, lname: user.lname, email: user.email });

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  const validationError = validateSignupInput({ fname, lname, phone_number, email, password });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await OwnerModel.create({
      fname: fname.trim(),
      lname: lname.trim(),
      phone_number: phone_number || null,
      email,
      passwordHash
    });
    res.status(201).json({ success: true, message: 'Account created successfully.', user });
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
    const user = await OwnerModel.findByEmail(email);
    if (!user || !password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const otpCode = generateOTP();
    await storeOTP(email, 'owner', otpCode);
    await sendOTP(normalizeEmail(email), otpCode);

    res.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
      requireOTP: true,
      email: normalizeEmail(email)
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

    const user = await OwnerModel.findByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.json({ success: true, message: 'Login successful', token: signToken(user), owner: publicOwner(user) });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await OwnerModel.findByEmail(email);
    // FIX: returning 404 "User not found" let anyone probe which emails are registered.
    if (user) {
      const otpCode = generateOTP();
      await storeOTP(email, 'owner', otpCode);
      await sendOTP(normalizeEmail(email), otpCode);
    }
    res.json({ success: true, message: 'If this email is registered, a new OTP has been sent.' });
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
    const { email, given_name, family_name, name, email_verified } = payload;

    // FIX: never trust an unverified Google email (account takeover of an existing account)
    if (!email || email_verified === false) {
      return res.status(401).json({ success: false, message: 'Google email is not verified.' });
    }

    let user = await OwnerModel.findByEmail(email);

    if (!user) {
      const randomPassword = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10);
      // FIX: given_name can be missing -> NOT NULL violation on fname
      const fname = given_name || (name || '').split(' ')[0] || email.split('@')[0];
      user = await OwnerModel.create({
        fname,
        lname: family_name || '-',
        phone_number: null,
        email,
        passwordHash: randomPassword
      });
    }

    res.json({ success: true, token: signToken(user), owner: publicOwner(user) });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google Token' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const owner = await OwnerModel.findById(req.params.id);
    res.json({ success: true, owner });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  const validationError = validateProfileInput(req.body || {});
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const owner = await OwnerModel.update(req.params.id, req.body);
    res.json({ success: true, owner, message: 'Profile updated' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/owner/dev-login
// Dev/QA-only shortcut. FIX: it used to be open whenever NODE_ENV !== 'production', so a
// deployment that simply forgot to set NODE_ENV let ANYONE log in as the first owner.
// Now it is off unless ENABLE_DEV_LOGIN=true is set explicitly (and never in production).
exports.devLogin = async (req, res) => {
  // Enabled only when ENABLE_DEV_LOGIN=true and NODE_ENV !== 'production' (see utils/devLogin.js).
  if (!require('../utils/devLogin').isDevLoginEnabled()) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  try {
    const result = await pool.query('SELECT * FROM owner ORDER BY owner_id ASC LIMIT 1');
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No owner account exists yet to use for quick login. Sign up an owner first.'
      });
    }

    res.json({ success: true, token: signToken(user), owner: publicOwner(user) });
  } catch (error) {
    console.error('Owner dev login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
