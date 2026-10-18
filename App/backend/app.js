process.env.TZ = 'Asia/Bangkok'; // Node local time is always Bangkok, regardless of host/container TZ
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
app.use(express.json({ limit: '100kb' }));

// Where the built React app lives: backend/public (Docker / `npm run build`), or the frontend's own
// dist folder as a fallback when it was built in place.
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(PUBLIC_DIR));

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
  const index = path.join(PUBLIC_DIR, 'index.html');
  if (!fs.existsSync(index)) {
    return res.status(404).send('Frontend not built. Run `npm run build` in App/frontend (it outputs to backend/public).');
  }
  res.sendFile(index);
});

// Last-resort error handler: always JSON, never an HTML stack trace
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Bad client input is the client's problem: 400 / 413, not a 500
  if (err.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Request is too large.' });
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
  }
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ success: false, message: 'Bad request.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
