const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const customerModel = require('../models/customerModel');
const ownerModel = require('../models/ownerModel');

const SALT_ROUNDS = 10;

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function validateRegisterInput({ fname, lname, email, password }) {
  const errors = [];
  if (!fname || !fname.trim()) errors.push('fname is required');
  if (!lname || !lname.trim()) errors.push('lname is required');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('valid email is required');
  if (!password || password.length < 6) errors.push('password must be at least 6 characters');
  return errors;
}

// ---------------- CUSTOMER ----------------

const registerCustomer = async (req, res) => {
  try {
    const { fname, lname, phone_number, email, password } = req.body;
    const errors = validateRegisterInput({ fname, lname, email, password });
    if (errors.length) return res.status(400).json({ errors });

    const existing = await customerModel.findCustomerByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const customer = await customerModel.createCustomer({ fname, lname, phone_number, email, password_hash });

    const token = generateToken({ id: customer.customer_id, role: 'customer' });
    res.status(201).json({ token, user: { ...customer, role: 'customer' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const customer = await customerModel.findCustomerByEmail(email);
    if (!customer) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, customer.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    delete customer.password_hash;
    const token = generateToken({ id: customer.customer_id, role: 'customer' });
    res.json({ token, user: { ...customer, role: 'customer' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------- OWNER ----------------

const registerOwner = async (req, res) => {
  try {
    const { fname, lname, phone_number, email, password } = req.body;
    const errors = validateRegisterInput({ fname, lname, email, password });
    if (errors.length) return res.status(400).json({ errors });

    const existing = await ownerModel.findOwnerByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const owner = await ownerModel.createOwner({ fname, lname, phone_number, email, password_hash });

    const token = generateToken({ id: owner.owner_id, role: 'owner' });
    res.status(201).json({ token, user: { ...owner, role: 'owner' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const loginOwner = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const owner = await ownerModel.findOwnerByEmail(email);
    if (!owner) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, owner.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    delete owner.password_hash;
    const token = generateToken({ id: owner.owner_id, role: 'owner' });
    res.json({ token, user: { ...owner, role: 'owner' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { registerCustomer, loginCustomer, registerOwner, loginOwner };
