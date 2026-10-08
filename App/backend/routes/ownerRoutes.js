const express = require('express');
const router = express.Router();
const { rateLimit } = require('../utils/rateLimit');
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const otpLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const resendLimit = rateLimit({ windowMs: 60 * 1000, max: 1, message: 'Please wait a minute before requesting another code.' });

const auth = require('../controllers/ownerAuthController');
const business = require('../controllers/businessController');
const ticket = require('../controllers/ticketController');
const { requireAuth, requireRole, requireSelf, requirePermission, requireBusinessOwner } = require('../middleware/rbac');

// FIX: the multer config was duplicated here and in businessController. Now there is one copy
// (business.uploadBusinessImage) which also creates the uploads folder and returns JSON errors.
const ownerOnly = [requireAuth, requireRole('owner')];

// ---------- public ----------
router.post('/signup', auth.signup);
router.post('/login', loginLimit, auth.login);
router.post('/dev-login', auth.devLogin);
router.post('/verify-otp', otpLimit, auth.verifyOTP);
router.post('/resend-otp', resendLimit, auth.resendOTP);
router.post('/google-login', auth.googleLogin);

// ---------- owner only ----------
// สังเกต: เช็คสิทธิ์ก่อน upload เสมอ เพราะ multer เขียนไฟล์ลงดิสก์ทันทีที่รับ request
router.get('/businesses', ...ownerOnly,
  requirePermission('business', 'read'), business.getMyBusinesses);

router.get('/businesses/:businessId', ...ownerOnly,
  requirePermission('business', 'read'), requireBusinessOwner(), business.getBusinessById);

router.post('/businesses', ...ownerOnly,
  requirePermission('business', 'create'),
  business.uploadBusinessImage, business.createBusiness);

router.put('/businesses/:businessId', ...ownerOnly,
  requirePermission('business', 'update'), requireBusinessOwner(),
  business.uploadBusinessImage, business.updateBusiness);

router.get('/businesses/:businessId/schedule', ...ownerOnly,
  requirePermission('schedule', 'read'), requireBusinessOwner(), business.getSchedule);

router.put('/businesses/:businessId/schedule', ...ownerOnly,
  requirePermission('schedule', 'update'), requireBusinessOwner(), business.updateSchedule);

router.get('/queue/:businessId', ...ownerOnly,
  requirePermission('queue', 'read'), requireBusinessOwner(), ticket.getQueueList);

router.get('/cancelled/:businessId', ...ownerOnly,
  requirePermission('queue', 'read'), requireBusinessOwner(), ticket.getCancelHistory);

router.get('/analytics/:businessId', ...ownerOnly,
  requirePermission('analytics', 'read'), requireBusinessOwner(), ticket.getBusinessAnalytics);

// ticket transitions: transition() ใน controller เช็ค owner + business_id (body) ให้อยู่แล้ว
router.patch('/tickets/:ticketId/checkin', ...ownerOnly,
  requirePermission('ticket', 'checkin'), ticket.checkInTicket);
router.patch('/tickets/:ticketId/manual-checkin', ...ownerOnly,
  requirePermission('ticket', 'checkin'), ticket.manualCheckInTicket);
router.patch('/tickets/:ticketId/complete', ...ownerOnly,
  requirePermission('ticket', 'complete'), ticket.completeTicket);
router.patch('/tickets/:ticketId/no-show', ...ownerOnly,
  requirePermission('ticket', 'no-show'), ticket.noShowTicket);

router.delete('/businesses/:businessId', ...ownerOnly,
  requirePermission('business', 'delete'), requireBusinessOwner(),
  business.deleteBusiness);

router.get('/profile/:id', ...ownerOnly, requireSelf('id'), auth.getProfile);
router.put('/profile/:id', ...ownerOnly, requireSelf('id'), auth.updateProfile);

module.exports = router;
