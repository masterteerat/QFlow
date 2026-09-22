const jwt = require('jsonwebtoken');

// Reads the Authorization: Bearer <token> header (if present), verifies it,
// and sets req.user = { id, role } on success.
//
// Non-blocking: if the token is missing or invalid, req.user is left as null
// and the request continues. Routes/controllers that require a logged-in
// user (e.g. ticketController's `transition`) already check `req.user?.id`
// themselves and return 401 when it's missing — this middleware's only job
// is to populate req.user when a valid token IS sent.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  req.user = null;

  if (!token) {
    return next();
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, iat, exp }
  } catch (err) {
    req.user = null;
  }

  next();
}

module.exports = authenticate;