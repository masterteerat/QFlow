const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.post('/signup', customerController.signup);
router.post('/login', customerController.login);
router.get('/businesses', customerController.getBusinesses);
router.post('/tickets', customerController.createTicket);
router.get('/tickets/:customerId', customerController.getMyTickets);
router.patch('/tickets/:ticketId/cancel', customerController.cancelTicket);

module.exports = router;