const express = require('express');
const router = express.Router();
const { rateLimit } = require('../utils/rateLimit');
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const otpLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const resendLimit = rateLimit({ windowMs: 60 * 1000, max: 1, message: 'Please wait a minute before requesting another code.' });

const auth = require('../controllers/customerAuthController');
const { requireAuth, requireRole, requireSelf, requirePermission } = require('../middleware/rbac');
const business = require('../controllers/businessController');
const ticket = require('../controllers/ticketController');

const customerOnly = [requireAuth, requireRole('customer')];

// ---------- public ----------
router.post('/signup', auth.signup);
router.post('/login', loginLimit, auth.login);
router.post('/dev-login', auth.devLogin);
router.post('/verify-otp', otpLimit, auth.verifyOTP);
router.post('/resend-otp', resendLimit, auth.resendOTP);
router.post('/google-login', auth.googleLogin);

router.get('/businesses', business.getBusinesses);
router.get('/categories', business.getCategories);

// ---------- customer only ----------
router.post('/tickets', ...customerOnly,
  requirePermission('ticket', 'create'), ticket.createTicket);

router.get('/tickets/:customerId', ...customerOnly,
  requireSelf('customerId'), requirePermission('ticket', 'read'), ticket.getMyTickets);

router.patch('/tickets/:ticketId/cancel', ...customerOnly,
  requirePermission('ticket', 'cancel'), ticket.cancelTicket);

router.get('/notification-preference', ...customerOnly,
  requirePermission('ticket', 'read'), auth.getNotificationPreference);

router.patch('/notification-preference', ...customerOnly,
  requirePermission('ticket', 'read'), auth.updateNotificationPreference);

router.get('/unsubscribe', auth.unsubscribe);
router.get('/ban-status', ...customerOnly, auth.getBanStatus);

router.get('/profile/:id', ...customerOnly, requireSelf('id'), auth.getProfile);
router.put('/profile/:id', ...customerOnly, requireSelf('id'), auth.updateProfile);

module.exports = router;