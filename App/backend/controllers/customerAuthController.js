const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CustomerModel = require('../models/customerModel');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    console.error('Customer login error:', error);
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