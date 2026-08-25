const TicketModel = require('../models/ticketModel');
const { STATUS } = TicketModel;

// POST /api/customer/tickets - book a slot, or take a walk-in ticket
exports.createTicket = async (req, res) => {
  const { customer_id, business_id, timeslot_id = null, amount_paid = 0, pax = 1 } = req.body;

  const paxNum = Number(pax);
  if (!Number.isInteger(paxNum) || paxNum < 1) {
    return res.status(400).json({ success: false, message: 'Party size must be at least 1.' });
  }

  try {
    // Re-check capacity on the server too, in case two people book at once
    if (timeslot_id) {
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
    }

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

// GET /api/customer/tickets/:customerId
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await TicketModel.findByCustomer(req.params.customerId);
    res.json({ success: true, data: tickets });
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

// GET /api/owner/queue/:businessId - today's waiting + serving tickets
exports.getQueueList = async (req, res) => {
  try {
    const tickets = await TicketModel.findActiveForBusiness(req.params.businessId);
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Get queue list error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Shared handler for the three owner-side status transitions below
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

// PATCH /api/owner/tickets/:ticketId/checkin - customer scanned the QR code
exports.checkInTicket = (req, res) =>
  transition(req, res, {
    from: STATUS.WAITING,
    to: STATUS.SERVING,
    notFoundMessage: 'This ticket is not waiting anymore.'
  });

// PATCH /api/owner/tickets/:ticketId/complete
exports.completeTicket = (req, res) =>
  transition(req, res, {
    from: STATUS.SERVING,
    to: STATUS.COMPLETED,
    notFoundMessage: 'This ticket is not being served.'
  });

// PATCH /api/owner/tickets/:ticketId/no-show
exports.noShowTicket = (req, res) =>
  transition(req, res, {
    from: STATUS.WAITING,
    to: STATUS.CANCELLED,
    notFoundMessage: 'Could not mark this ticket as a no-show.'
  });
