const express = require('express');
const cors = require('cors');
const path = require('path');

const helmet = require('helmet');
const fs = require('fs');
const authenticate = require('./middleware/authMiddleware');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginOpenerPolicy: false }));
// Same-origin by default. For a separate frontend origin set CORS_ORIGIN=https://app.example.com (comma-separated).
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Populates req.user from the Authorization: Bearer <token> header, when present.
app.use(authenticate);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// FIX: all API routes are mounted HERE, before the catch-all below.
// Before, server.js mounted /api/blacklist AFTER `app.get('*')`, so GET requests
// to it returned index.html instead of JSON. server.js also mounted owner/customer twice.
app.post('/api/logout', async (req, res) => {
  if (!req.user?.id) return res.json({ success: true });
  try { await authenticate.revokeAll(req.user.role, req.user.id); } catch (e) { console.error('Logout error:', e.message); }
  res.json({ success: true });
});
app.get('/api/health', (req, res) => res.json({ success: true }));
// Lets the frontend know whether to show the Quick Login (test) buttons.
app.get('/api/config', (req, res) => res.json({ success: true, devLogin: require('./utils/devLogin').isDevLoginEnabled() }));
app.use('/api/customer', require('./routes/customerRoutes'));
app.use('/api/owner', require('./routes/ownerRoutes'));
app.use('/api/blacklist', require('./routes/blacklistRoutes'));

// Unknown /api paths -> JSON 404 (not the React page)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// React Router handles everything else client-side
app.get('*', (req, res) => {
  const index = path.join(__dirname, 'public', 'index.html');
  if (!fs.existsSync(index)) {
    return res.status(404).send('Frontend not built. Run `npm run build` in App/frontend (it outputs to backend/public).');
  }
  res.sendFile(index);
});

// Last-resort error handler: always JSON, never an HTML stack trace
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
