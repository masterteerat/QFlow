// Quick Login (test accounts) is only available when ENABLE_DEV_LOGIN=true AND NODE_ENV is not 'production'.
// Both conditions are required so a real deployment can never expose it by accident.
function isDevLoginEnabled() {
  return process.env.ENABLE_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production';
}
module.exports = { isDevLoginEnabled };
