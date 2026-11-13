const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOTP } = require('../mailer');
const mailer = require('../mailer');
const CustomerModel = require('../models/customerModel');
const { validateSignupInput, validateProfileInput, normalizeEmail } = require('../utils/validation');
const { generateOTP, storeOTP, verifyOTP } = require('../utils/otp');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (user) =>
  jwt.sign({ id: user.customer_id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '1d' });

const publicUser = (user) => ({ id: user.customer_id, fname: user.fname, email: user.email });

exports.signup = async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;

  const validationError = validateSignupInput({ fname, lname, phone_number, email, password });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await CustomerModel.create({
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
    console.error('Customer signup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await CustomerModel.findByEmail(email);
    if (!user || !password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const otpCode = generateOTP();
    await storeOTP(email, 'customer', otpCode);
    await sendOTP(normalizeEmail(email), otpCode);

    res.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
      requireOTP: true,
      email: normalizeEmail(email)
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
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.json({ success: true, message: 'Login successful', token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await CustomerModel.findByEmail(email);
    // FIX: returning 404 "User not found" let anyone probe which emails are registered.
    if (user) {
      const otpCode = generateOTP();
      await storeOTP(email, 'customer', otpCode);
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

    let user = await CustomerModel.findByEmail(email);

    if (!user) {
      const randomPassword = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10);
      // FIX: given_name can be missing -> NOT NULL violation on fname
      const fname = given_name || (name || '').split(' ')[0] || email.split('@')[0];
      user = await CustomerModel.create({
        fname,
        lname: family_name || '-',
        phone_number: null,
        email,
        passwordHash: randomPassword
      });
    }

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
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
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get the customer's two e-mail settings:
//   email_notifications_opt_in -> daily schedule e-mail (08:00)
//   queue_reminder_opt_in + reminder_hours_before -> reminder N hours before the queue/slot
exports.getNotificationPreference = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT email_notifications_opt_in, daily_email_hour, queue_reminder_opt_in, reminder_hours_before FROM customer WHERE customer_id = $1`,
      [req.user.id]
    );
    const row = rows[0];
    res.json({
      success: true,
      email_notifications_opt_in: !!row?.email_notifications_opt_in,
      daily_email_hour: row?.daily_email_hour ?? 8,
      queue_reminder_opt_in: !!row?.queue_reminder_opt_in,
      reminder_hours_before: row?.reminder_hours_before ?? 1
    });
  } catch (error) {
    console.error('Get notification preference error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.updateProfile = async (req, res) => {
  const validationError = validateProfileInput(req.body || {});
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const user = await CustomerModel.update(req.params.id, req.body);
    res.json({ success: true, user, message: 'Profile updated' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update the e-mail settings. Any of the three fields may be sent on its own.
exports.updateNotificationPreference = async (req, res) => {
  try {
    const { email_notifications_opt_in, daily_email_hour, queue_reminder_opt_in, reminder_hours_before } = req.body || {};
    const customer_id = req.user.id;

    const hasDaily = email_notifications_opt_in !== undefined;
    const hasQueue = queue_reminder_opt_in !== undefined;
    const hasDailyHour = daily_email_hour !== undefined;
    const hasHours = reminder_hours_before !== undefined;
    if (!hasDaily && !hasQueue && !hasHours && !hasDailyHour) {
      return res.status(400).json({ success: false, message: 'Nothing to update.' });
    }
    const isBool = (v) => v === true || v === false;
    if ((hasDaily && !isBool(email_notifications_opt_in)) || (hasQueue && !isBool(queue_reminder_opt_in))) {
      return res.status(400).json({ success: false, message: 'Invalid value. Must be true or false.' });
    }
    const dailyHour = Number(daily_email_hour);
    if (hasDailyHour && (!Number.isInteger(dailyHour) || dailyHour < 0 || dailyHour > 23)) {
      return res.status(400).json({ success: false, message: 'Daily email time must be an hour from 0 to 23.' });
    }
    const hours = Number(reminder_hours_before);
    if (hasHours && (!Number.isInteger(hours) || hours < 1 || hours > 24)) {
      return res.status(400).json({ success: false, message: 'Reminder time must be a whole number of hours from 1 to 24.' });
    }

    const result = await pool.query(
      `UPDATE customer
          SET email_notifications_opt_in = COALESCE($1, email_notifications_opt_in),
              queue_reminder_opt_in      = COALESCE($2, queue_reminder_opt_in),
              reminder_hours_before      = COALESCE($3, reminder_hours_before),
              daily_email_hour           = COALESCE($5, daily_email_hour)
        WHERE customer_id = $4
        RETURNING email_notifications_opt_in, daily_email_hour, queue_reminder_opt_in, reminder_hours_before`,
      [hasDaily ? email_notifications_opt_in : null, hasQueue ? queue_reminder_opt_in : null, hasHours ? hours : null, customer_id, hasDailyHour ? dailyHour : null]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // New lead time (or just turned on) -> let still-waiting tickets be reminded under the new setting.
    if (hasHours || queue_reminder_opt_in === true) {
      await pool.query(`UPDATE ticket SET reminder_sent = FALSE WHERE customer_id = $1 AND status_id = 1`, [customer_id]);
    }

    if (hasDailyHour) {
      await pool.query(`UPDATE customer SET daily_email_last_sent = NULL WHERE customer_id = $1`, [customer_id]);
    }

    const row = result.rows[0];
    res.json({
      success: true,
      email_notifications_opt_in: row.email_notifications_opt_in,
      daily_email_hour: row.daily_email_hour,
      queue_reminder_opt_in: row.queue_reminder_opt_in,
      reminder_hours_before: row.reminder_hours_before,
      message: 'Notification preference updated'
    });
  } catch (error) {
    console.error('Update notification preference error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/customer/test-email  { type: 'daily' | 'reminder' }
// Sends the e-mail to the logged-in customer RIGHT NOW so they can see what it looks like,
// without waiting for the scheduled job. It ignores the on/off switch and the chosen hour, and it
// does NOT touch daily_email_last_sent / ticket.reminder_sent, so the real scheduled emails are unaffected.
// Uses the customer's real bookings when they have any, otherwise a clearly-labelled sample.
const testEmailLastSent = new Map(); // customer_id -> timestamp (10 s cooldown against spamming)
exports.sendTestEmail = async (req, res) => {
  const type = req.body?.type;
  if (type !== 'daily' && type !== 'reminder') {
    return res.status(400).json({ success: false, message: "type must be 'daily' or 'reminder'." });
  }
  const customerId = req.user.id;
  const last = testEmailLastSent.get(customerId) || 0;
  if (Date.now() - last < 10000) {
    return res.status(429).json({ success: false, message: 'Please wait a few seconds before sending another test.' });
  }
  testEmailLastSent.set(customerId, Date.now());

  const BKK_TODAY = `(NOW() AT TIME ZONE 'Asia/Bangkok')::date`;
  const BKK_NOW = `(NOW() AT TIME ZONE 'Asia/Bangkok')`;
  try {
    const { rows: [customer] } = await pool.query(
      'SELECT email, fname, lname, reminder_hours_before FROM customer WHERE customer_id = $1', [customerId]);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    const name = `${customer.fname} ${customer.lname}`;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    let usedSample = false;

    if (type === 'daily') {
      const { rows } = await pool.query(`
        SELECT t.ticket_id, t.queue_number, b.business_name,
               to_char(COALESCE(ts.date, q.date), 'YYYY-MM-DD') AS date,
               COALESCE(ts.start_time::text, '-') AS start_time,
               COALESCE(ts.end_time::text, '-') AS end_time,
               st.status_name
        FROM ticket t
        JOIN queue q ON q.queue_id = t.queue_id
        JOIN business b ON b.business_id = q.business_id
        JOIN ticket_status st ON st.status_id = t.status_id
        LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
        WHERE t.customer_id = $1
          AND t.status_id IN (1, 2)
          AND COALESCE(ts.date, q.date) BETWEEN ${BKK_TODAY} AND ${BKK_TODAY} + 14
        ORDER BY COALESCE(ts.date, q.date) ASC, ts.start_time ASC
      `, [customerId]);
      let tickets = rows;
      if (tickets.length === 0) {
        usedSample = true;
        tickets = [{ ticket_id: 0, queue_number: 'A001', business_name: 'Sample Shop (test data)', date: today, start_time: '10:00:00', end_time: '10:30:00', status_name: 'Waiting' }];
      }
      await mailer.sendDailyScheduleEmail(customer.email, name, tickets, customerId, { test: true });
    } else {
      const { rows } = await pool.query(`
        SELECT t.ticket_id, t.queue_number, b.business_name,
               to_char(ts.date, 'YYYY-MM-DD') AS date,
               ts.start_time::text AS start_time, ts.end_time::text AS end_time
        FROM ticket t
        JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
        JOIN queue q ON q.queue_id = t.queue_id
        JOIN business b ON b.business_id = q.business_id
        WHERE t.customer_id = $1 AND t.status_id = 1
          AND (ts.date + ts.start_time) > ${BKK_NOW}
        ORDER BY ts.date ASC, ts.start_time ASC
        LIMIT 1
      `, [customerId]);
      let ticket = rows[0];
      if (!ticket) {
        usedSample = true;
        ticket = { ticket_id: 0, queue_number: 'A001', business_name: 'Sample Shop (test data)', date: today, start_time: '10:00:00', end_time: '10:30:00' };
      }
      await mailer.sendQueueReminderEmail(customer.email, name, ticket, ticket.business_name, ticket.start_time,
        Number(customer.reminder_hours_before) || 1, { test: true });
    }

    res.json({
      success: true,
      sample: usedSample,
      message: usedSample
        ? `Test email sent to ${customer.email} (you have no upcoming bookings, so it uses sample data).`
        : `Test email sent to ${customer.email}.`
    });
  } catch (error) {
    testEmailLastSent.delete(customerId);
    console.error('Send test email error:', error);
    res.status(500).json({ success: false, message: 'Could not send the test email. Check the SMTP settings on the server.' });
  }
};

// POST /api/customer/dev-login
// Dev/QA-only shortcut. FIX: it used to be open whenever NODE_ENV !== 'production', so a
// deployment that simply forgot to set NODE_ENV let ANYONE log in as the first customer.
// Now it is off unless ENABLE_DEV_LOGIN=true is set explicitly (and never in production).
exports.devLogin = async (req, res) => {
  // Enabled only when ENABLE_DEV_LOGIN=true and NODE_ENV !== 'production' (see utils/devLogin.js).
  if (!require('../utils/devLogin').isDevLoginEnabled()) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  try {
    const result = await pool.query('SELECT * FROM customer ORDER BY customer_id ASC LIMIT 1');
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No customer account exists yet to use for quick login. Sign up a customer first.'
      });
    }

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Customer dev login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


// GET /api/customer/ban-status - lets the customer UI show a "banned" notice with time left
// GET /api/customer/unsubscribe?token=...  (opened from the e-mail footer; no login needed)
exports.unsubscribe = async (req, res) => {
  try {
    const p = jwt.verify(String(req.query.token || ''), process.env.JWT_SECRET);
    if (p.purpose !== 'unsubscribe') throw new Error('bad token');
    await pool.query('UPDATE customer SET email_notifications_opt_in = FALSE WHERE customer_id = $1', [p.id]);
    res.type('html').send('<p style="font-family:Arial;padding:24px">You have been unsubscribed from QFlow daily emails.</p>');
  } catch {
    res.status(400).type('html').send('<p style="font-family:Arial;padding:24px">This unsubscribe link is invalid or expired.</p>');
  }
};

// POST /api/customer/dev-unban - TEST ONLY: lets a customer lift their own ban.
// Same switch as Quick Login (ENABLE_DEV_LOGIN=true and NODE_ENV != production); remove before going live.
exports.devUnban = async (req, res) => {
  if (!require('../utils/devLogin').isDevLoginEnabled()) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  try {
    // Behaves exactly like the timer running out: the row stays (so the next no-show still escalates) and
    // only banned_at moves into the past. A permanent ban never times out, so for the test it is
    // stepped down to an already-expired Temporary Ban (next no-show -> Permanent again).
    await pool.query(
      `UPDATE blacklist b
          SET tier_id = CASE WHEN t.time = 0 THEN COALESCE((SELECT tier_id FROM tier WHERE name = 'Temporary Ban' LIMIT 1), b.tier_id) ELSE b.tier_id END,
              banned_at = NOW() - INTERVAL '1 second' -
                (COALESCE(CASE WHEN t.time = 0 THEN (SELECT time FROM tier WHERE name = 'Temporary Ban' LIMIT 1) ELSE t.time END, 0) * INTERVAL '1 minute')
         FROM tier t
        WHERE t.tier_id = b.tier_id AND b.customer_id = $1`,
      [req.user.id]);
    res.json({ success: true, message: 'Ban lifted (test mode).' });
  } catch (error) {
    console.error('Dev unban error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getBanStatus = async (req, res) => {
  try {
    const ban = await require('../models/blacklistModel').getActiveBan(req.user.id);
    if (!ban) return res.json({ success: true, banned: false });
    res.json({
      success: true,
      banned: true,
      tier_name: ban.tier_name,
      permanent: ban.permanent,
      duration_minutes: ban.duration_minutes,
      banned_at: ban.banned_at,
      expires_at: ban.expires_at,
      seconds_left: ban.seconds_left
    });
  } catch (error) {
    console.error('Ban status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};