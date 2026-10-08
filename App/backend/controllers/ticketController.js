const crypto = require('crypto');
const pool = require('../config/db');
const TicketModel = require('../models/ticketModel');
const BlacklistModel = require('../models/blacklistModel');
const mailer = require('../mailer');
const { STATUS } = TicketModel;

// production ต้องตั้ง QR_SECRET เอง ห้ามใช้ค่า default ที่อยู่ในโค้ด
const SECRET_KEY = process.env.QR_SECRET;
if (!SECRET_KEY) {
  throw new Error('QR_SECRET must be set');
}

// Thrown inside the booking transaction to roll back and answer with a specific HTTP status.
class BookingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function formatDuration(totalSeconds) {
  const mins = Math.max(0, Math.ceil(totalSeconds / 60));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return [d && `${d}d`, h && `${h}h`, (m || (!d && !h)) && `${m}m`].filter(Boolean).join(' ');
}

async function checkCustomerBlacklist(customerId) {
  const ban = await BlacklistModel.getActiveBan(customerId);
  return ban || null; // null = not banned
}

function sign(ticketId, timestamp) {
  return crypto.createHmac('sha256', SECRET_KEY).update(`${ticketId}:${timestamp}`).digest('hex');
}

function generateSignedPayload(ticketId, timestamp) {
  return JSON.stringify({ ticketId, timestamp, signature: sign(ticketId, timestamp) });
}

// POST /api/customer/tickets - book a slot, or take a walk-in ticket
exports.createTicket = async (req, res) => {
  const { business_id, timeslot_id = null } = req.body;
  const customer_id = req.user.id; // จาก token ไม่ใช่จาก body

  const paxNum = Number(req.body.pax ?? 1);
  if (!Number.isInteger(paxNum) || paxNum < 1 || paxNum > 20) {
    return res.status(400).json({ success: false, message: 'Party size must be between 1 and 20.' });
  }
  if (timeslot_id !== null && !Number.isInteger(Number(timeslot_id))) {
    return res.status(400).json({ success: false, message: 'Invalid time slot.' });
  }
  const businessId = Number(business_id);
  if (!Number.isInteger(businessId)) {
    return res.status(400).json({ success: false, message: 'Invalid shop.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const business = await TicketModel.getBusinessForBooking(client, businessId);
    if (!business) throw new BookingError(404, 'Shop not found.');

    // FIX: the ban check used to live inside `if (timeslot_id)`, so walk-in tickets skipped it.
    const activeBan = await checkCustomerBlacklist(customer_id);
    if (activeBan) {
      throw new BookingError(403, activeBan.permanent
        ? 'You are permanently banned from booking due to repeated no-shows.'
        : `You are banned from booking due to previous no-shows. Time left: ${formatDuration(activeBan.seconds_left)}.`);
    }

    const active = await client.query(
      `SELECT COUNT(*)::int AS n FROM ticket t JOIN queue q ON q.queue_id = t.queue_id
        WHERE t.customer_id = $1 AND t.status_id IN ($2, $3) AND q.date >= ${TicketModel.BKK_TODAY}`,
      [customer_id, STATUS.WAITING, STATUS.SERVING]);
    if (active.rows[0].n >= 10) {
      throw new BookingError(409, 'You already have 10 active bookings. Cancel one before booking another.');
    }

    // FIX: a shop that runs on time slots could be booked as a walk-in by simply omitting timeslot_id.
    if (!timeslot_id && business.has_slots) {
      throw new BookingError(400, 'This shop only takes bookings for a time slot. Please pick one.');
    }

    let slot = null;
    if (timeslot_id) {
      // Locks the slot row so concurrent bookings are serialized (no more overbooking).
      slot = await TicketModel.lockSlot(client, timeslot_id);
      if (!slot) throw new BookingError(404, 'Time slot not found.');

      // slot ต้องเป็นของร้านที่จอง ไม่งั้นเอา slot ร้าน A ไปใส่คิวร้าน B ได้
      if (Number(slot.business_id) !== businessId) {
        throw new BookingError(400, 'This time slot does not belong to the selected shop.');
      }
      if (Number(slot.days_ahead) < 0 || Number(slot.days_ahead) > 13) {
        throw new BookingError(400, 'This time slot is outside the bookable window.');
      }
      if (slot.already_ended) {
        throw new BookingError(400, 'This time slot has already ended. Please choose another time.');
      }

      const booked = await TicketModel.getBookedPax(client, slot.timeslot_id);
      const remaining = slot.max_capacity - booked;
      if (paxNum > remaining) {
        throw new BookingError(409, remaining <= 0
          ? 'This slot is full.'
          : `Only ${remaining} spot${remaining === 1 ? '' : 's'} left in this slot.`);
      }

      if (await TicketModel.hasOverlappingBooking(client, customer_id, slot.date, slot.start_time, slot.end_time)) {
        throw new BookingError(409, 'You already have a booking in this time slot (overlapping). Please choose another time.');
      }
    } else {
      // One active walk-in ticket per shop per day
      const dup = await client.query(
        `SELECT 1 FROM ticket t JOIN queue q ON q.queue_id = t.queue_id
          WHERE t.customer_id = $1 AND q.business_id = $2 AND q.date = ${TicketModel.BKK_TODAY}
            AND t.timeslot_id IS NULL AND t.status_id IN ($3, $4) LIMIT 1`,
        [customer_id, businessId, STATUS.WAITING, STATUS.SERVING]
      );
      if (dup.rows.length > 0) {
        throw new BookingError(409, 'You already have an active walk-in ticket for this shop.');
      }
    }

    // FIX: the ticket now goes into the queue of the SLOT's date (not always today's queue).
    const queueId = await TicketModel.findOrCreateQueue(client, businessId, slot ? slot.date : null);
    const queueNumber = await TicketModel.nextQueueNumber(client, queueId);

    const ticket = await TicketModel.create(client, {
      queueNumber,
      customerId: customer_id,
      queueId,
      timeslotId: slot ? slot.timeslot_id : null,
      pax: paxNum
    });

    // FIX: the deposit amount used to come from the client (amount_paid), so sending 0 skipped
    // the deposit entirely. It is now taken from the shop's own setting.
    const deposit = business.is_deposit ? Number(business.deposit_amount) : 0;
    if (deposit > 0) {
      await TicketModel.addDepositPayment(client, ticket.ticket_id, deposit);
    }

    await client.query('COMMIT');

    const fullTicket = await TicketModel.findFullTicket(ticket.ticket_id);
    const qr_payload = generateSignedPayload(fullTicket.ticket_id, new Date(fullTicket.created_at).getTime());

    res.status(201).json({ success: true, message: 'Booking successful', data: { ...fullTicket, qr_payload } });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    if (error instanceof BookingError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.code === '23503' && /customer/.test(error.constraint || '')) {
      return res.status(401).json({ success: false, message: 'Your account was not found. Please log in again.' });
    }
    console.error('Create ticket error:', error);
    // Outside production, show the real cause so it can be diagnosed from the browser too.
    const detail = process.env.NODE_ENV === 'production' ? '' : ` (${error.message})`;
    res.status(500).json({ success: false, message: `Internal server error${detail}` });
  } finally {
    client?.release();
  }
};

exports.getBusinessAnalytics = async (req, res) => {
  try {
    const stats = await TicketModel.getBusinessAnalytics(req.params.businessId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get business analytics error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/customer/tickets/:customerId
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await TicketModel.findByCustomer(req.user.id);

    const ticketsWithQR = tickets.map((t) => ({
      ...t,
      qr_payload: generateSignedPayload(t.ticket_id, new Date(t.created_at).getTime()),
    }));

    res.json({ success: true, data: ticketsWithQR });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/customer/tickets/:ticketId/cancel
exports.cancelTicket = async (req, res) => {
  const { ticketId } = req.params;
  if (!Number.isInteger(Number(ticketId))) return res.status(400).json({ success: false, message: 'Invalid ticket id.' });
  const customer_id = req.user.id; // จาก token ไม่ใช่จาก body

  try {
    const ticket = await TicketModel.findOwnedByCustomer(ticketId, customer_id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (ticket.status_id !== STATUS.WAITING) {
      return res.status(400).json({ success: false, message: 'Only tickets still waiting can be cancelled.' });
    }

    const updated = await TicketModel.transitionStatus(ticketId, STATUS.WAITING, STATUS.CANCELLED, null, null, 'customer');
    if (!updated) return res.status(409).json({ success: false, message: 'This ticket changed status. Please refresh.' });
    // Customer cancelled in time -> deposit goes back (3 = Refunded). No-shows keep the deposit.
    await pool.query(`UPDATE payment SET status_id = 3 WHERE ticket_id = $1`, [ticketId]);
    res.json({ success: true, message: 'Booking cancelled.', data: updated });
  } catch (error) {
    console.error('Cancel ticket error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/owner/cancelled/:businessId - history of cancelled tickets (customer cancels + no-shows)
exports.getCancelHistory = async (req, res) => {
  try {
    const rows = await TicketModel.findCancelledForBusiness(req.params.businessId);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get cancel history error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/owner/queue/:businessId
// FIX: removed the "hide blacklisted customers" filter. It compared `ticket.customer_id`, a column
// the query never returned, so it never filtered anything - and if it had worked it would have
// silently hidden people who are standing in the shop from the owner's own queue.
exports.getQueueList = async (req, res) => {
  try {
    const tickets = await TicketModel.findActiveForBusiness(req.params.businessId);
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Get queue list error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Moves a ticket between statuses, scoped to both the logged-in owner AND the
// specific shop currently open on their dashboard (req.body.business_id).
// Returns the updated ticket on success, or null if it already answered with an error.
// FIX: it used to return the Express `res` object on errors (truthy), which callers could
// mistake for a ticket.
async function transition(req, res, { from, to, notFoundMessage, cancelledBy = null }) {
  const ownerId = req.user?.id;
  if (!ownerId) {
    res.status(401).json({ success: false, message: 'Please log in again.' });
    return null;
  }

  const businessId = req.body?.business_id;
  if (!businessId) {
    res.status(400).json({ success: false, message: 'Missing shop reference. Please refresh and try again.' });
    return null;
  }

  try {
    const ticket = await TicketModel.transitionStatus(req.params.ticketId, from, to, ownerId, businessId, cancelledBy);
    if (!ticket) {
      res.status(400).json({ success: false, message: notFoundMessage });
      return null;
    }
    res.json({ success: true, data: ticket });
    return ticket;
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
    return null;
  }
}


// Server-side timing rules (the UI used to be the only thing enforcing these).
// rule 'today'    -> ticket must belong to today's queue (Bangkok)
// rule 'afterSlot'-> ticket's day is past, or today and its slot has ended / it is a walk-in
async function timingOk(req, res, rule) {
  const ticketId = Number(req.params.ticketId);
  const businessId = Number(req.body?.business_id);
  if (!Number.isInteger(ticketId) || !Number.isInteger(businessId)) {
    res.status(400).json({ success: false, message: 'Invalid ticket or shop reference.' });
    return false;
  }
  const { rows } = await pool.query(
    `SELECT q.date = ${TicketModel.BKK_TODAY} AS is_today,
            q.date < ${TicketModel.BKK_TODAY} AS is_past,
            (ts.timeslot_id IS NULL OR ts.end_time <= ${TicketModel.BKK_NOW_TIME}) AS slot_ended
       FROM ticket t JOIN queue q ON q.queue_id = t.queue_id
       LEFT JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
      WHERE t.ticket_id = $1 AND q.business_id = $2`, [ticketId, businessId]);
  const r = rows[0];
  if (!r) { res.status(404).json({ success: false, message: 'Ticket not found for this shop.' }); return false; }
  if (rule === 'today' && !r.is_today) {
    res.status(400).json({ success: false, message: 'This ticket is not for today, so it cannot be checked in yet.' });
    return false;
  }
  if (rule === 'afterSlot' && !(r.is_past || (r.is_today && r.slot_ended))) {
    res.status(400).json({ success: false, message: 'Too early to mark as no-show: the booked time has not ended yet.' });
    return false;
  }
  return true;
}

// PATCH /api/owner/tickets/:ticketId/checkin - scanning a customer's QR code
exports.checkInTicket = async (req, res) => {
  const { timestamp, signature } = req.body;
  const ticketId = req.params.ticketId;

  if (!timestamp || !signature || typeof signature !== 'string') {
    return res.status(400).json({ success: false, message: 'QR Code data is missing or invalid.' });
  }

  const expected = Buffer.from(sign(ticketId, timestamp));
  const given = Buffer.from(signature);
  // FIX: constant-time comparison
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return res.status(400).json({ success: false, message: 'QR Code is invalid or has been forged!' });
  }

  if (!(await timingOk(req, res, 'today'))) return;
  await transition(req, res, {
    from: STATUS.WAITING,
    to: STATUS.SERVING,
    notFoundMessage: 'This ticket is not waiting anymore, or belongs to a different shop.'
  });
};

// PATCH /api/owner/tickets/:ticketId/manual-checkin - staff checking someone in by hand
exports.manualCheckInTicket = async (req, res) => {
  if (!(await timingOk(req, res, 'today'))) return;
  await transition(req, res, {
    from: STATUS.WAITING,
    to: STATUS.SERVING,
    notFoundMessage: 'This ticket is not waiting anymore, or belongs to a different shop.'
  });
};

exports.completeTicket = async (req, res) => {
  await transition(req, res, {
    from: STATUS.SERVING,
    to: STATUS.COMPLETED,
    notFoundMessage: 'This ticket is not being served, or belongs to a different shop.'
  });
};

exports.noShowTicket = async (req, res) => {
  if (!(await timingOk(req, res, 'afterSlot'))) return;
  const ticket = await transition(req, res, {
    from: STATUS.WAITING,
    to: STATUS.CANCELLED,
    cancelledBy: 'no_show',
    notFoundMessage: 'Could not mark this ticket as a no-show, or it belongs to a different shop.'
  });

  if (!ticket || !ticket.customer_id) return;

  // Escalate blacklist tier on no-show: 1 Warning -> 2 Temporary Ban -> 3 Permanent Ban.
  // FIX: one atomic upsert (needs the UNIQUE index on blacklist.customer_id from init.sql)
  // instead of read-then-write, which could create duplicate rows for the same customer.
  try {
    await pool.query(
      `INSERT INTO blacklist (elapsed_time, customer_id, tier_id, banned_at)
       VALUES (0, $1, 1, NOW())
       ON CONFLICT (customer_id) DO UPDATE
         SET tier_id = CASE blacklist.tier_id WHEN 1 THEN 2 ELSE 3 END,
             elapsed_time = 0,
             banned_at = NOW()`,
      [ticket.customer_id]
    );
    console.log(`[Blacklist] No-show recorded for customer ${ticket.customer_id}`);

    // Tell the customer by email (never fails the request if mail is down)
    try {
      const ban = await BlacklistModel.getActiveBan(ticket.customer_id);
      const cust = await pool.query('SELECT fname, lname, email FROM customer WHERE customer_id = $1', [ticket.customer_id]);
      if (ban && cust.rows[0]?.email) {
        const c = cust.rows[0];
        await mailer.sendBanEmail(c.email, `${c.fname} ${c.lname}`, ban);
      }
    } catch (mailError) {
      console.error('Ban email error:', mailError.message);
    }
  } catch (error) {
    console.error('Blacklist escalation error:', error);
  }
};
