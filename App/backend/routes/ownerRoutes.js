const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

router.post('/signup', ownerController.signup);
router.post('/login', ownerController.login);

router.get('/businesses/:ownerId', ownerController.getMyBusinesses);
router.get('/queue/:businessId', ownerController.getQueueList);
router.patch('/tickets/:ticketId/checkin', ownerController.checkInTicket);
router.patch('/tickets/:ticketId/complete', ownerController.completeTicket);
router.patch('/tickets/:ticketId/no-show', ownerController.noShowTicket);
router.post('/businesses', ownerController.createBusiness);

module.exports = router;