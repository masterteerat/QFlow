const NAME_REGEX = /^[\p{L}\p{M}'.\- ]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{8,9}$/; // 0XXXXXXXX(X) - 9 or 10 digits, starts with 0
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validateName(value, label) {
  if (typeof value !== 'string' || !value.trim() || !NAME_REGEX.test(value.trim())) {
    return `${label} is invalid.`;
  }
  return null;
}

function validateSignupInput({ fname, lname, phone_number, email, password }) {
  return (
    validateName(fname, 'First name') ||
    validateName(lname, 'Last name') ||
    (phone_number && !PHONE_REGEX.test(phone_number)
      ? 'Phone number is invalid. Must be 9-10 digits starting with 0.'
      : null) ||
    (!email || !EMAIL_REGEX.test(String(email).trim()) ? 'Email is invalid.' : null) ||
    (!password || !PASSWORD_REGEX.test(password)
      ? 'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
      : null)
  );
}

// FIX: updateProfile used to pass req.body straight to SQL with no validation
// (missing fname -> NOT NULL violation -> 500).
function validateProfileInput({ fname, lname, phone_number }) {
  return (
    validateName(fname, 'First name') ||
    validateName(lname, 'Last name') ||
    (phone_number && !PHONE_REGEX.test(phone_number)
      ? 'Phone number is invalid. Must be 9-10 digits starting with 0.'
      : null)
  );
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

module.exports = { validateSignupInput, validateProfileInput, normalizeEmail };
