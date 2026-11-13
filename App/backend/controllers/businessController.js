const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const multer = require('multer');
const SubscriptionModel = require('../models/subscriptionModel');
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

const CANCEL_OPTIONS = [1440, 360, 120, 60, 30, 0]; // minutes before the slot starts; 0 = until it starts

// Deposit must look like a plain money amount: 120 or 120.50 (max 2 decimals), > 0 and not absurdly large.
function validateDeposit(is_deposit, deposit_amount) {
  if (!is_deposit) return null;
  const raw = String(deposit_amount ?? '').trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) {
    return 'Please enter a valid deposit amount (greater than 0, at most 2 decimals).';
  }
  if (Number(raw) > 100000) return 'Deposit amount is too large (max 100,000).';
  return null;
}

// Walk-in opening hours: both empty = open all day; otherwise both required, same day, open < close.
// Returns { error } or { open, close } (HH:MM:SS strings or null).
function parseWalkinHours(open, close) {
  const o = String(open ?? '').trim(), c = String(close ?? '').trim();
  if (!o && !c) return { open: null, close: null };
  if (!o || !c) return { error: 'Please set both an opening and a closing time.' };
  if (!TIME_RE.test(o) || !TIME_RE.test(c)) return { error: 'Opening hours must be in HH:MM format.' };
  if (toMin(o) >= toMin(c)) return { error: 'Opening time must be before closing time (same day, e.g. 09:00-18:00).' };
  const pad = (t) => { const [h, m] = t.split(':'); return `${h.padStart(2, '0')}:${m}:00`; };
  return { open: pad(o), close: pad(c) };
}

// undefined = not sent (keep current value on update, default on create)
function parseCancelBefore(v) {
  if (v === undefined || v === null || v === '') return { value: undefined };
  const n = Number(v);
  if (!Number.isInteger(n) || !CANCEL_OPTIONS.includes(n)) return { error: 'Invalid cancellation deadline.' };
  return { value: n };
}

function validateBusinessFields({ business_name, is_deposit, deposit_amount }) {
  if (typeof business_name !== 'string' || !business_name.trim()) return 'Please enter a business name.';
  if (business_name.trim().length > 200) return 'Business name is too long (max 200 characters).';
  return validateDeposit(is_deposit, deposit_amount);
}

// Shop names must be unique (case-insensitive) among active shops. excludeId = the shop being edited.
async function isNameTaken(name, excludeId = null) {
  const { rows } = await pool.query(
    `SELECT 1 FROM business
      WHERE is_active AND lower(business_name) = lower($1)
        AND ($2::int IS NULL OR business_id <> $2) LIMIT 1`,
    [String(name).trim(), excludeId]
  );
  return rows.length > 0;
}
const DUPLICATE_NAME_MESSAGE = 'A shop with this name already exists. Please choose another name.';

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

  const hours = parseWalkinHours(req.body.walkin_open_time, req.body.walkin_close_time);
  const cancel = parseCancelBefore(req.body.cancel_before_minutes);
  const validationError =
    validateBusinessFields({ business_name, is_deposit: isDeposit, deposit_amount }) ||
    (queue_type === 'timeslot' ? validateSlots(time_slots) : hours.error) ||
    cancel.error;
  if (validationError) {
    discardUpload(req);
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    if (await isNameTaken(business_name)) {
      discardUpload(req);
      return res.status(409).json({ success: false, message: DUPLICATE_NAME_MESSAGE });
    }
  } catch (error) {
    discardUpload(req);
    console.error('Name check error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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
      queue_type: queue_type === 'timeslot' ? 'timeslot' : 'walkin',
      walkin_open_time: hours.open,
      walkin_close_time: hours.close,
      cancel_before_minutes: cancel.value ?? 60
    });

    let insertedSlots = [];
    if (queue_type === 'timeslot') {
      insertedSlots = await BusinessModel.addTimeSlots(client, business.business_id, time_slots);
    }

    // The shop starts unpaid ('Pending'): hidden from customers until the first monthly fee is paid.
    await SubscriptionModel.createPending(client, business.business_id);

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Shop registered successfully.',
      data: { ...business, time_slots: insertedSlots }
    });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    discardUpload(req);
    if (error.code === '23505') return res.status(409).json({ success: false, message: DUPLICATE_NAME_MESSAGE });
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
  const hours = parseWalkinHours(req.body.walkin_open_time, req.body.walkin_close_time);
  const cancel = parseCancelBefore(req.body.cancel_before_minutes);
  const validationError =
    validateBusinessFields({ business_name, is_deposit: isDeposit, deposit_amount }) ||
    (queue_type === 'timeslot' ? validateSlots(time_slots) : queue_type === 'walkin' ? hours.error : null) ||
    cancel.error;
  if (validationError) {
    discardUpload(req);
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    if (await isNameTaken(business_name, Number(businessId))) {
      discardUpload(req);
      return res.status(409).json({ success: false, message: DUPLICATE_NAME_MESSAGE });
    }
  } catch (error) {
    discardUpload(req);
    console.error('Name check error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }

  // A plain "Save" on a time-slot shop sends the same slots back: don't rewrite the schedule then.
  let scheduleUnchanged = false;
  if (queue_type === 'timeslot') {
    try {
      const cur = await pool.query('SELECT queue_type FROM business WHERE business_id = $1', [businessId]);
      scheduleUnchanged = cur.rows[0]?.queue_type === 'timeslot' && await BusinessModel.isSameSchedule(businessId, time_slots);
    } catch { scheduleUnchanged = false; }
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
      queue_type: queue_type === 'timeslot' || queue_type === 'walkin' ? queue_type : undefined,
      walkin_open_time: hours.open,
      walkin_close_time: hours.close,
      cancel_before_minutes: cancel.value
    });

    // Switching to "timeslot" (re)writes the upcoming schedule; switching to
    // "walkin" clears any upcoming unbooked slots so the shop goes back to walk-in.
    let updatedSlots = [];
    if (queue_type === 'timeslot') {
      if (!scheduleUnchanged) updatedSlots = await BusinessModel.updateSchedule(client, businessId, time_slots);
    } else if (queue_type === 'walkin') {
      updatedSlots = await BusinessModel.updateSchedule(client, businessId, []);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Shop updated successfully.', data: { ...business, time_slots: updatedSlots } });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    discardUpload(req);
    if (error.code === '23505') return res.status(409).json({ success: false, message: DUPLICATE_NAME_MESSAGE });
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

  let client;
  let toNotify = [];
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Soft delete: the shop disappears for everyone, but tickets and payments stay as history.
    const own = await client.query(
      'UPDATE business SET is_active = FALSE WHERE business_id = $1 AND owner_id = $2 AND is_active RETURNING business_id, business_name',
      [businessId, owner_id]);
    if (own.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const shopName = own.rows[0].business_name;

    // Who to tell: customers with an active booking today or later (collected BEFORE we cancel them)
    const who = await client.query(
      `SELECT DISTINCT c.email, c.fname, c.lname
         FROM ticket t JOIN queue q ON q.queue_id = t.queue_id
         JOIN customer c ON c.customer_id = t.customer_id
        WHERE q.business_id = $1 AND t.status_id IN (1, 2) AND q.date >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date`,
      [businessId]);
    toNotify = who.rows.map((r) => ({ ...r, shopName }));

    // Active bookings are cancelled ('shop_closed') and their deposits marked Refunded.
    const t = await client.query(
      `UPDATE ticket t SET status_id = 4, cancelled_at = NOW(), cancelled_by = 'shop_closed'
         FROM queue q WHERE q.queue_id = t.queue_id AND q.business_id = $1 AND t.status_id IN (1, 2) RETURNING t.ticket_id`,
      [businessId]);
    if (t.rows.length) await client.query('UPDATE payment SET status_id = 3 WHERE ticket_id = ANY($1::int[])', [t.rows.map((r) => r.ticket_id)]);
    await client.query('COMMIT');
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error('Delete business error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client?.release();
  }

  res.json({ success: true, message: 'Shop closed. Customers with active bookings were cancelled and notified.' });

  // Only now (transaction committed) tell the customers, in the background so the owner is not kept waiting.
  setImmediate(async () => {
    for (const r of toNotify) {
      try { await mailer.sendShopClosedEmail(r.email, `${r.fname} ${r.lname}`, r.shopName); }
      catch (e) { console.error('Shop-closed email error:', e.message); }
    }
  });
};

exports.uploadBusinessImage = uploadBusinessImage;
