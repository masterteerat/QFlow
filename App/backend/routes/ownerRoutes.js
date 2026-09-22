const express = require('express');
const router = express.Router();
const multer = require('multer');

const auth = require('../controllers/ownerAuthController');
const business = require('../controllers/businessController');
const ticket = require('../controllers/ticketController');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/business/');
    },
    filename: (req, file, cb) => {
      const ext = file.originalname.split('.').pop();
      cb(null, `business-${Date.now()}.${ext}`);
    }
  }),
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

router.post('/signup', auth.signup);
router.post('/login', auth.login);
router.post('/dev-login', auth.devLogin);
router.post('/verify-otp', auth.verifyOTP);
router.post('/resend-otp', auth.resendOTP);

router.get('/businesses', business.getMyBusinesses);
router.get('/businesses/:businessId', business.getBusinessById);
router.post('/businesses', upload.single('image'), business.createBusiness);
router.put('/businesses/:businessId', upload.single('image'), business.updateBusiness);
router.get('/businesses/:businessId/schedule', business.getSchedule);
router.put('/businesses/:businessId/schedule', business.updateSchedule);

router.get('/queue/:businessId', ticket.getQueueList);
router.get('/analytics/:businessId', ticket.getBusinessAnalytics);
router.patch('/tickets/:ticketId/checkin', ticket.checkInTicket);
router.patch('/tickets/:ticketId/complete', ticket.completeTicket);
router.patch('/tickets/:ticketId/no-show', ticket.noShowTicket);

router.get('/profile/:id', auth.getProfile);
router.put('/profile/:id', auth.updateProfile);

router.post('/google-login', auth.googleLogin);

module.exports = router;