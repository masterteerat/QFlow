process.env.TZ = 'Asia/Bangkok'; // Node local time is always Bangkok, regardless of host/container TZ
require('dotenv').config({ quiet: true });
for (const k of ['JWT_SECRET', 'QR_SECRET', 'DATABASE_URL']) {
  if (!process.env[k]) { console.error(`Missing required env var ${k}`); process.exit(1); }
}
// A placeholder secret means anyone can forge login tokens and QR codes: refuse to start in production.
for (const k of ['JWT_SECRET', 'QR_SECRET']) {
  const v = String(process.env[k]);
  const weak = v.length < 16 || /^change[-_ ]?me/i.test(v) || /^(secret|password|test)$/i.test(v);
  if (!weak) continue;
  if (process.env.NODE_ENV === 'production') { console.error(`${k} is a placeholder or shorter than 16 characters. Set a long random value (e.g. openssl rand -hex 32).`); process.exit(1); }
  console.warn(`[Security] ${k} looks like a placeholder - fine for local testing, but production will refuse to start with it.`);
}
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
const app = require('./app');
const { startAllJobs } = require('./jobs');

const { migrate } = require('./utils/migrate');

process.on('SIGTERM', () => process.exit(0));
const PORT = process.env.PORT || 3000;

// Bring an older database up to date first, then start serving and the background jobs.
migrate().finally(() => {
  startAllJobs(); // daily email, queue alerts, blacklist cleanup, slot roll
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
