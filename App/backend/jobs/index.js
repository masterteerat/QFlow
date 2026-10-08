// Job scheduler entry point
// Load and start all background jobs

const { startDailyEmailJob } = require('./dailyEmailJob');
const { startHourlyQueueAlertJob } = require('./hourlyQueueAlertJob');
const { startBlacklistCleanupJob } = require('./blacklistCleanupJob');
const { startSlotRollJob } = require('./slotRollJob');
const { startExpireTicketsJob } = require('./expireTicketsJob');

function startAllJobs() {
  console.log('Starting QFlow background jobs...');
  startDailyEmailJob();
  startHourlyQueueAlertJob();
  startBlacklistCleanupJob();
  startSlotRollJob();
  startExpireTicketsJob();
  console.log('All QFlow background jobs started.');
}

module.exports = { startAllJobs };
