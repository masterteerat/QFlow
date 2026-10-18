const SubscriptionModel = require('../models/subscriptionModel');

// GET /api/owner/businesses/:businessId/subscription
exports.getSubscription = async (req, res) => {
  try {
    const data = await SubscriptionModel.getForBusiness(Number(req.params.businessId));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/owner/businesses/:businessId/subscription/pay
// DEMO PAYMENT: no real money moves. The "QR code" in the UI is fake; calling this endpoint counts as
// "the shop scanned it and paid". Replace the body with a real payment-provider check before going live.
exports.paySubscription = async (req, res) => {
  const reference = String(req.body?.reference || '').slice(0, 60) || null;
  try {
    const data = await SubscriptionModel.pay(Number(req.params.businessId), reference);
    res.json({ success: true, message: 'Payment received. Thank you!', data });
  } catch (error) {
    console.error('Pay subscription error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
