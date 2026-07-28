const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OwnerModel = require('../models/ownerModel');

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const owner = await OwnerModel.create({ fname, lname, phone_number, email, passwordHash });
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
    console.error('Owner login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
