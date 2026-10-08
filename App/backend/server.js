require('dotenv').config({ quiet: true });
for (const k of ['JWT_SECRET', 'QR_SECRET', 'DATABASE_URL']) {
  if (!process.env[k]) { console.error(`Missing required env var ${k}`); process.exit(1); }
}
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
const app = require('./app');
const { startAllJobs } = require('./jobs');

// Start background jobs (daily email, queue alerts, blacklist cleanup, slot roll)
startAllJobs();

process.on('SIGTERM', () => process.exit(0));
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
