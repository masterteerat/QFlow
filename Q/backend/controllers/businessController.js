const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const multer = require('multer');
const BusinessModel = require('../models/businessModel');
const mailer = require('../mailer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'business');
// FIX: multer does NOT create the folder when `destination` is a function, so the first image
// upload on a fresh deploy failed with ENOENT (-> 500 "Internal server error").
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    cb(null, `business-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (ALLOWED_EXT.includes(ext) && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'));
    }
  }
});

// FIX: multer errors (wrong type, too big) used to fall through to Express's default HTML error
// page, which the frontend could not parse ("Could not reach the server"). Now they are JSON 400s.
function uploadBusinessImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5MB or smaller.' : err.message;
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const toMin = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };

function validateSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return 'Please add at least one time slot.';
  const ranges = [];
  for (const slot of slots) {
    if (!slot || !slot.start_time || !slot.end_time) return 'Time slot details are incomplete.';
    if (!TIME_RE.test(slot.start_time) || !TIME_RE.test(slot.end_time)) return 'Time must be in HH:MM format.';
    const s = toMin(slot.start_time), e = toMin(slot.end_time);
    if (s >= e) return 'Start time must be before end time for every slot.';
    const cap = Number(slot.max_capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 1000) return 'Max capacity must be a whole number from 1 to 1000.';
    if (ranges.some(([a, b]) => s < b && e > a)) return 'Time slots must not overlap each other.';
    ranges.push([s, e]);
  }
  return null;
}

const parseCategory = (v) => { const n = Number(v); return v && Number.isInteger(n) ? n : null; };

function validateBusinessFields({ business_name, is_deposit, deposit_amount }) {
  if (!business_name || !business_name.trim()) return 'Please enter a business name.';
  if (is_deposit && (!deposit_amount || Number(deposit_amount) <= 0)) {
    return 'Please enter a valid deposit amount (greater than 0).';
  }
  return null;
}

function parseTimeSlots(raw) {
  if (!raw) return [];
  return JSON.parse(raw); // throws on bad JSON; callers turn that into a 400
}

// Removes an uploaded file again when the request is rejected after multer already saved it.
function discardUpload(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

exports.getBusinesses = async (req, res) => {
  try {
    const { search, categories } = req.query;

    let categoryIds = [];
    if (categories) {
      if (Array.isArray(categories)) {
        categoryIds = categories.map(Number).filter(Number.isInteger);
      } else if (typeof categories === 'string') {
        categoryIds = categories.split(',').map(Number).filter(Number.isInteger);
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
  // ใช้ id จาก token เท่านั้น (route ผ่าน requireAuth มาแล้ว) ห้ามเชื่อ query string
  const ownerId = req.user.id;
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
  const { business_name, description, deposit_amount, queue_type, category_id } = req.body;
  const owner_id = req.user.id; // จาก token ไม่ใช่จาก body

  const isDeposit = String(req.body.is_deposit) === 'true';

  let time_slots = [];
  try {
    time_slots = parseTimeSlots(req.body.time_slots);
  } catch {
    discardUpload(req);
    return res.status(400).json({ success: false, message: 'Invalid time slots format.' });
  }

  const validationError =
    validateBusinessFields({ business_name, is_deposit: isDeposit, deposit_amount }) ||
    (queue_type === 'timeslot' ? validateSlots(time_slots) : null);
  if (validationError) {
    discardUpload(req);
    return res.status(400).json({ success: false, message: validationError });
  }

  const image = req.file ? `/uploads/business/${req.file.filename}` : '/uploads/business/default-business.jpg';

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const business = await BusinessModel.create(client, {
      business_name: business_name.trim(),
      description: description || null,
      image,
      is_deposit: isDeposit,
      deposit_amount: isDeposit ? Number(deposit_amount) : 0,
      owner_id,
      category_id: parseCategory(category_id),
      queue_type: queue_type === 'timeslot' ? 'timeslot' : 'walkin'
    });

    let insertedSlots = [];
    if (queue_type === 'timeslot') {
      insertedSlots = await BusinessModel.addTimeSlots(client, business.business_id, time_slots);
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Shop registered successfully.',
      data: { ...business, time_slots: insertedSlots }
    });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    discardUpload(req);
    console.error('Create business error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client?.release();
  }
};

exports.updateBusiness = async (req, res) => {
  const { businessId } = req.params;
  const { business_name, description, deposit_amount, category_id, queue_type } = req.body;
  const isDeposit = String(req.body.is_deposit) === 'true';

  const image = req.file ? `/uploads/business/${req.file.filename}` : undefined;

  let time_slots = [];
  try {
    time_slots = parseTimeSlots(req.body.time_slots);
  } catch {
    discardUpload(req);
    return res.status(400).json({ success: false, message: 'Invalid time slots format.' });
  }

  // FIX: update used to skip the deposit check and accept "time slots" with zero slots
  // (which silently wiped the schedule). Same rules as create now.
  const validationError =
    validateBusinessFields({ business_name, is_deposit: isDeposit, deposit_amount }) ||
    (queue_type === 'timeslot' ? validateSlots(time_slots) : null);
  if (validationError) {
    discardUpload(req);
    return res.status(400).json({ success: false, message: validationError });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const business = await BusinessModel.update(client, {
      businessId,
      business_name: business_name.trim(),
      description: description || null,
      image,
      is_deposit: isDeposit,
      deposit_amount: isDeposit ? Number(deposit_amount) : 0,
      category_id: parseCategory(category_id),
      queue_type: queue_type === 'timeslot' || queue_type === 'walkin' ? queue_type : undefined
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
    await client?.query('ROLLBACK').catch(() => {});
    discardUpload(req);
    console.error('Update business error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client?.release();
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
  const { time_slots } = req.body;

  // FIX: a missing time_slots field used to default to [] and delete the whole schedule.
  const validationError = validateSlots(time_slots);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const updatedSlots = await BusinessModel.updateSchedule(client, businessId, time_slots);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Schedule updated.', data: updatedSlots });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client?.release();
  }
};

exports.deleteBusiness = async (req, res) => {
  const { businessId } = req.params;
  const owner_id = req.user.id;

  try {
    // requireBusinessOwner already checks this; the DELETE itself is also scoped to the owner
    // Tell customers with active bookings before their tickets disappear (best effort)
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT c.email, c.fname, c.lname, b.business_name
           FROM ticket t JOIN queue q ON q.queue_id = t.queue_id JOIN business b ON b.business_id = q.business_id
           JOIN customer c ON c.customer_id = t.customer_id
          WHERE q.business_id = $1 AND t.status_id IN (1, 2) AND q.date >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date`, [businessId]);
      for (const r of rows) await mailer.sendShopClosedEmail(r.email, `${r.fname} ${r.lname}`, r.business_name).catch(() => {});
    } catch (e) { console.error('Shop-closed notify error:', e.message); }

    // Soft delete: the shop disappears for everyone, but tickets and payments stay as history.
    // Active bookings are cancelled ('shop_closed') and their deposits marked Refunded.
    const client = await pool.connect();
    let closed = false;
    try {
      await client.query('BEGIN');
      const own = await client.query('UPDATE business SET is_active = FALSE WHERE business_id = $1 AND owner_id = $2 AND is_active RETURNING business_id', [businessId, owner_id]);
      if (own.rows.length > 0) {
        closed = true;
        const t = await client.query(
          `UPDATE ticket t SET status_id = 4, cancelled_at = NOW(), cancelled_by = 'shop_closed'
             FROM queue q WHERE q.queue_id = t.queue_id AND q.business_id = $1 AND t.status_id IN (1, 2) RETURNING t.ticket_id`, [businessId]);
        if (t.rows.length) await client.query('UPDATE payment SET status_id = 3 WHERE ticket_id = ANY($1::int[])', [t.rows.map((r) => r.ticket_id)]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    if (!closed) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.json({ success: true, message: 'Shop closed. Customers with active bookings were cancelled and notified.' });
  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.uploadBusinessImage = uploadBusinessImage;
