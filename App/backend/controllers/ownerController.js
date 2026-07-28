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