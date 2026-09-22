const pool = require('../config/db');
const multer = require('multer');
const BusinessModel = require('../models/businessModel');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/business/');
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `business-${Date.now()}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (allowed.includes(file.originalname.split('.').pop().toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'));
    }
  }
});

function validateNewBusiness({ business_name, is_deposit, deposit_amount, queue_type, time_slots }) {
  if (!business_name || !business_name.trim()) return 'Please enter a business name.';
  if (is_deposit && (!deposit_amount || Number(deposit_amount) <= 0)) {
    return 'Please enter a valid deposit amount (greater than 0).';
  }
  if (queue_type === 'timeslot') {
    if (!Array.isArray(time_slots) || time_slots.length === 0) {
      return 'Please add at least one time slot.';
    }
    for (const slot of time_slots) {
      if (!slot.start_time || !slot.end_time) return 'Time slot details are incomplete.';
      if (slot.start_time >= slot.end_time) return 'Start time must be before end time for every slot.';
      if (!slot.max_capacity || Number(slot.max_capacity) < 1) return 'Each time slot needs a max capacity of at least 1.';
    }
  }
  return null;
}

exports.getBusinesses = async (req, res) => {
  try {
    const { search, categories } = req.query;

    let categoryIds = [];
    if (categories) {
      if (Array.isArray(categories)) {
        categoryIds = categories.map(Number);
      } else if (typeof categories === 'string') {
        categoryIds = categories.split(',').map(Number).filter(Boolean);
      }
    }

    const businesses = await BusinessModel.findAllWithSlots({ search, categoryIds });
    res.json({ success: true, data: businesses });
  } catch (error) {
    console.error('Get businesses error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await BusinessModel.findAllCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getMyBusinesses = async (req, res) => {
  const ownerId = req.query.ownerId || req.user?.id;
  if (!ownerId) {
    return res.status(401).json({ success: false, message: 'Owner ID is required.' });
  }
  try {
    const businesses = await BusinessModel.findByOwner(ownerId);
    res.json({ success: true, data: businesses });
  } catch (error) {
    console.error('Get my businesses error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getBusinessById = async (req, res) => {
  try {
    const business = await BusinessModel.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found.' });
    }
    res.json({ success: true, data: business });
  } catch (error) {
    console.error('Get business by id error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.createBusiness = async (req, res) => {
  const { owner_id, business_name, description, is_deposit, deposit_amount, queue_type, category_id } = req.body;

  const isDeposit = String(is_deposit) === 'true';

  if (!owner_id) {
    return res.status(401).json({ success: false, message: 'Please log in again.' });
  }

  // time_slots arrives as a JSON string over multipart/form-data - parse it before use.
  let time_slots = [];
  if (req.body.time_slots) {
    try {
      time_slots = JSON.parse(req.body.time_slots);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid time slots format.' });
    }
  }

  const validationError = validateNewBusiness({ business_name, is_deposit: isDeposit, deposit_amount, queue_type, time_slots });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const image = req.file ? `/uploads/business/${req.file.filename}` : '/uploads/business/default-business.jpg';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const business = await BusinessModel.create(client, {
      business_name: business_name.trim(),
      description: description || null,
      image,
      is_deposit: isDeposit,
      deposit_amount: isDeposit ? Number(deposit_amount) : 0,
      owner_id,
      category_id
    });

    let insertedSlots = [];
    if (queue_type === 'timeslot' && time_slots.length > 0) {
      insertedSlots = await BusinessModel.addTimeSlots(client, business.business_id, time_slots);
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Shop registered successfully.',
      data: { ...business, time_slots: insertedSlots }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create business error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.updateBusiness = async (req, res) => {
  const { businessId } = req.params;
  const { business_name, description, is_deposit, deposit_amount, category_id, queue_type } = req.body;
  const isDeposit = String(is_deposit) === 'true';

  const image = req.file ? `/uploads/business/${req.file.filename}` : undefined;

  if (!business_name || !business_name.trim()) {
    return res.status(400).json({ success: false, message: 'Business name is required.' });
  }

  // time_slots arrives as a JSON string over multipart/form-data - parse it before use.
  let time_slots = [];
  if (req.body.time_slots) {
    try {
      time_slots = JSON.parse(req.body.time_slots);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid time slots format.' });
    }
  }

  if (queue_type === 'timeslot') {
    for (const slot of time_slots) {
      if (!slot.start_time || !slot.end_time) {
        return res.status(400).json({ success: false, message: 'Time slot details are incomplete.' });
      }
      if (slot.start_time >= slot.end_time) {
        return res.status(400).json({ success: false, message: 'Start time must be before end time for every slot.' });
      }
      if (!slot.max_capacity || Number(slot.max_capacity) < 1) {
        return res.status(400).json({ success: false, message: 'Each time slot needs a max capacity of at least 1.' });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const business = await BusinessModel.update(client, {
      businessId,
      business_name: business_name.trim(),
      description: description || null,
      image,
      is_deposit: isDeposit,
      deposit_amount: isDeposit ? Number(deposit_amount) : 0,
      category_id: category_id || null
    });

    // Switching to "timeslot" (re)writes the upcoming schedule; switching to
    // "walkin" clears any upcoming unbooked slots so the shop goes back to walk-in.
    let updatedSlots = [];
    if (queue_type === 'timeslot') {
      updatedSlots = await BusinessModel.updateSchedule(client, businessId, time_slots);
    } else if (queue_type === 'walkin') {
      updatedSlots = await BusinessModel.updateSchedule(client, businessId, []);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Shop updated successfully.', data: { ...business, time_slots: updatedSlots } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update business error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const schedule = await BusinessModel.getSchedule(req.params.businessId);
    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.updateSchedule = async (req, res) => {
  const { businessId } = req.params;
  const { time_slots = [] } = req.body;

  for (const slot of time_slots) {
    if (!slot.start_time || !slot.end_time) {
      return res.status(400).json({ success: false, message: 'Time slot details are incomplete.' });
    }
    if (slot.start_time >= slot.end_time) {
      return res.status(400).json({ success: false, message: 'Start time must be before end time for every slot.' });
    }
    if (!slot.max_capacity || Number(slot.max_capacity) < 1) {
      return res.status(400).json({ success: false, message: 'Each time slot needs a max capacity of at least 1.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updatedSlots = await BusinessModel.updateSchedule(client, businessId, time_slots);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Schedule updated.', data: updatedSlots });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.uploadBusinessImage = upload.single('image');