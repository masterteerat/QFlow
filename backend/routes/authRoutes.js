const express = require('express');
const router = express.Router();
const {
  registerCustomer,
  loginCustomer,
  registerOwner,
  loginOwner,
} = require('../controllers/authController');

router.post('/customer/register', registerCustomer);
router.post('/customer/login', loginCustomer);
router.post('/owner/register', registerOwner);
router.post('/owner/login', loginOwner);

module.exports = router;
