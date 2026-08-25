const crypto = require('crypto');
const pool = require('../config/db'); // เพิ่มการเรียกใช้ database ตรงนี้เพื่อดึงเวลา
const TicketModel = require('../models/ticketModel');
const { STATUS } = TicketModel;

const SECRET_KEY = process.env.QR_SECRET || 'your-secret-key-2026';

// ฟังก์ชันสร้าง HMAC Signature แบบแนบไปใน QR Code
function generateSignedPayload(ticketId) {
  const timestamp = Date.now();
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${ticketId}:${timestamp}`)
    .digest('hex');

  return JSON.stringify({ ticketId, timestamp, signature });
}

// POST /api/customer/tickets - book a slot, or take a walk-in ticket
exports.createTicket = async (req, res) => {
  const { customer_id, business_id, timeslot_id = null, amount_paid = 0, pax = 1 } = req.body;

  const paxNum = Number(pax);
  if (!Number.isInteger(paxNum) || paxNum < 1) {
    return res.status(400).json({ success: false, message: 'Party size must be at least 1.' });
  }

  try {
    if (timeslot_id) {
      // 1. เช็คว่ามีรอบเวลานี้อยู่จริง และเช็คจำนวนที่ว่าง (Capacity)
      const availability = await TicketModel.getSlotAvailability(timeslot_id);
      if (!availability) {
        return res.status(404).json({ success: false, message: 'Time slot not found.' });
      }
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 13);
      const slotDate = new Date(availability.date);
      if (slotDate < today || slotDate > maxDate) {
        return res.status(400).json({ success: false, message: 'This time slot is outside the bookable window.' });
      }
      const remaining = availability.max_capacity - Number(availability.booked_pax);
      if (paxNum > remaining) {
        return res.status(409).json({
          success: false,
          message: `Only ${remaining} spot${remaining === 1 ? '' : 's'} left in this slot.`
        });
      }

      // ==========================================
      // 🚀 2. ส่วนที่เพิ่มใหม่: เช็คเวลาทับซ้อน (Overlapping Booking)
      // ==========================================
      // 2.1 ดึงเวลาเริ่มและจบของ timeslot ที่ลูกค้าเลือกมาเปรียบเทียบ
      const slotInfo = await pool.query(
        'SELECT start_time, end_time FROM time_slot WHERE timeslot_id = $1',
        [timeslot_id]
      );

      if (slotInfo.rows.length > 0) {
        const { start_time, end_time } = slotInfo.rows[0];

        // 2.2 Query เช็คว่า "ลูกค้ารายนี้" มีการจองคิวในวันเดียวกันที่เวลาทับซ้อนกันหรือไม่
        const overlapQuery = `
          SELECT t.ticket_id
          FROM ticket t
          JOIN queue q ON q.queue_id = t.queue_id
          JOIN time_slot ts ON ts.timeslot_id = t.timeslot_id
          WHERE t.customer_id = $1
            AND q.date = $2
            AND t.status_id NOT IN ($5, $6) -- ยกเว้นคิวที่ถูกยกเลิก (4) หรือเสร็จสิ้นไปแล้ว (3)
            AND ts.start_time < $4 -- เวลาเริ่มของคิวเดิม < เวลาจบของคิวใหม่
            AND ts.end_time > $3   -- เวลาจบของคิวเดิม > เวลาเริ่มของคิวใหม่
        `;
        const overlapValues = [
          customer_id, 
          availability.date, 
          start_time, 
          end_time, 
          STATUS.CANCELLED, 
          STATUS.COMPLETED
        ];
        
        const { rows: overlapRows } = await pool.query(overlapQuery, overlapValues);

        // ถ้า Query แล้วเจอข้อมูล แปลว่าเวลาทับซ้อน ให้ตีกลับทันที
        if (overlapRows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'คุณมีการจองคิวในช่วงเวลานี้อยู่แล้ว (เวลาทับซ้อนกัน) กรุณาเลือกเวลาอื่นครับ'
          });
        }
      }
      // ==========================================
    }

    // 3. ถ้าเวลาไม่ทับซ้อนและมีที่ว่าง ก็ทำการสร้างคิวตามปกติ
    const queueId = await TicketModel.findOrCreateTodayQueue(business_id);
    const queueNumber = await TicketModel.nextQueueNumber(queueId);

    const ticket = await TicketModel.create({
      queueNumber,
      customerId: customer_id,
      queueId,
      timeslotId: timeslot_id,
      pax: paxNum
    });

    if (amount_paid > 0) {
      await TicketModel.addDepositPayment(ticket.ticket_id, amount_paid);
    }

    const fullTicket = await TicketModel.findFullTicket(ticket.ticket_id);
    res.status(201).json({ success: true, message: 'Booking successful', data: fullTicket });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: error.message });
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
    const tickets = await TicketModel.findByCustomer(req.params.customerId);
    
    // แนบ QR payload เข้าไปในตั๋วแต่ละใบเพื่อให้ Frontend เอาไปเจน QR Code ได้
    const ticketsWithQR = tickets.map((t) => ({
      ...t,
      qr_payload: generateSignedPayload(t.ticket_id),
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
  const { customer_id } = req.body;

  try {
    const ticket = await TicketModel.findOwnedByCustomer(ticketId, customer_id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (ticket.status_id !== STATUS.WAITING) {
      return res.status(400).json({ success: false, message: 'Only tickets still waiting can be cancelled.' });
    }

    const updated = await TicketModel.transitionStatus(ticketId, STATUS.WAITING, STATUS.CANCELLED);
    res.json({ success: true, message: 'Booking cancelled.', data: updated });
  } catch (error) {
    console.error('Cancel ticket error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/owner/queue/:businessId
exports.getQueueList = async (req, res) => {
  try {
    const tickets = await TicketModel.findActiveForBusiness(req.params.businessId);
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Get queue list error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

async function transition(req, res, { from, to, notFoundMessage }) {
  try {
    const ticket = await TicketModel.transitionStatus(req.params.ticketId, from, to);
    if (!ticket) {
      return res.status(400).json({ success: false, message: notFoundMessage });
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// PATCH /api/owner/tickets/:ticketId/checkin
exports.checkInTicket = async (req, res) => {
  const { timestamp, signature } = req.body;
  const ticketId = req.params.ticketId;

  // ถ้ามีการสแกน QR Code จะมีข้อมูลนี้ส่งมาเพื่อยืนยัน
  if (timestamp && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(`${ticketId}:${timestamp}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'QR Code is invalid or has been forged!' });
    }
  }

  return transition(req, res, {
    from: STATUS.WAITING,
    to: STATUS.SERVING,
    notFoundMessage: 'This ticket is not waiting anymore.'
  });
};

exports.completeTicket = (req, res) =>
  transition(req, res, {
    from: STATUS.SERVING,
    to: STATUS.COMPLETED,
    notFoundMessage: 'This ticket is not being served.'
  });

exports.noShowTicket = (req, res) =>
  transition(req, res, {
    from: STATUS.WAITING,
    to: STATUS.CANCELLED,
    notFoundMessage: 'Could not mark this ticket as a no-show.'
  });