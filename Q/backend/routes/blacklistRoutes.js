const express = require('express');
const router = express.Router();
const blacklist = require('../controllers/blacklistController');
const { requireAuth, requireRole, requireSelf, requirePermission, requireBusinessOwner } = require('../middleware/rbac');

// All blacklist routes require authentication and must be the business owner
const ownerOnly = [requireAuth, requireRole('owner')];

// ---------- owner only ----------
router.get('/businesses/:businessId/blacklist', ...ownerOnly,
  requireBusinessOwner(), blacklist.getBlacklist);

router.post('/businesses/:businessId/blacklist', ...ownerOnly,
  requireBusinessOwner(), blacklist.addToBlacklist);

router.delete('/businesses/:businessId/blacklist/:customerId', ...ownerOnly,
  requireBusinessOwner(), blacklist.removeFromBlacklist);

module.exports = router;