const express = require('express');
const router = express.Router();

const auth = require('../controllers/customerAuthController');
const business = require('../controllers/businessController');
const ticket = require('../controllers/ticketController');

router.post('/signup', auth.signup);
router.post('/login', auth.login);

router.get('/businesses', business.getBusinesses);
router.get('/categories', business.getCategories);

router.post('/tickets', ticket.createTicket);
router.get('/tickets/:customerId', ticket.getMyTickets);
router.patch('/tickets/:ticketId/cancel', ticket.cancelTicket);

router.get('/profile/:id', auth.getProfile);
router.put('/profile/:id', auth.updateProfile);

router.post('/google-login', auth.googleLogin);

module.exports = router;
