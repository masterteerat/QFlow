// Small in-memory rate limiter (per process). Key = IP + email so one attacker can't hammer one account.
// For multiple server instances use a shared store (e.g. Redis / express-rate-limit).
function rateLimit({ windowMs, max, message = 'Too many attempts. Please try again later.' }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const key = `${req.ip}|${email}`;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset <= now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    if (++h.count > max) {
      res.set('Retry-After', Math.ceil((h.reset - now) / 1000));
      return res.status(429).json({ success: false, message });
    }
    next();
  };
}
module.exports = { rateLimit };
