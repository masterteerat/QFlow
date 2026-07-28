const pool = require('../config/db');
const BusinessModel = require('../models/businessModel');

// GET /api/customer/businesses
exports.getBusinesses = async (req, res) => {
  try {
    const businesses = await BusinessModel.findAllWithSlots();
    res.json({ success: true, data: businesses });
  } catch (error) {
    console.error('Get businesses error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/owner/businesses/:ownerId
exports.getMyBusinesses = async (req, res) => {
  try {
    const businesses = await BusinessModel.findByOwner(req.params.ownerId);
    res.json({ success: true, data: businesses });
  } catch (error) {
    console.error('Get my businesses error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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
      if (!slot.date || !slot.start_time || !slot.end_time) return 'Time slot details are incomplete.';
      if (slot.start_time >= slot.end_time) return 'Start time must be before end time for every slot.';
    }
  }
  return null;
}

// POST /api/owner/businesses
exports.createBusiness = async (req, res) => {
  const { owner_id, business_name, is_deposit, deposit_amount, queue_type, time_slots = [] } = req.body;

  if (!owner_id) {
    return res.status(401).json({ success: false, message: 'Please log in again.' });
  }

  const validationError = validateNewBusiness(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const business = await BusinessModel.create(client, {
      business_name: business_name.trim(),
      is_deposit: !!is_deposit,
      deposit_amount: is_deposit ? Number(deposit_amount) : 0,
      owner_id
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
