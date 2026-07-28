const express = require('express');
const router = express.Router();

const auth = require('../controllers/ownerAuthController');
const business = require('../controllers/businessController');
const ticket = require('../controllers/ticketController');

router.post('/signup', auth.signup);
router.post('/login', auth.login);

router.get('/businesses/:ownerId', business.getMyBusinesses);
router.post('/businesses', business.createBusiness);

router.get('/queue/:businessId', ticket.getQueueList);
router.patch('/tickets/:ticketId/checkin', ticket.checkInTicket);
router.patch('/tickets/:ticketId/complete', ticket.completeTicket);
router.patch('/tickets/:ticketId/no-show', ticket.noShowTicket);

module.exports = router;
