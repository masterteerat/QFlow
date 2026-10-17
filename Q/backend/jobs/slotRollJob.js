const cron = require('node-cron');
const BusinessModel = require('../models/businessModel');

// Keeps every time-slot shop's rolling 14-day window topped up.
// Without this, slots were generated once and customers ran out of dates after two weeks.
async function rollOnce(label) {
  try {
    const inserted = await BusinessModel.rollSlotWindow();
    console.log(`[SlotRollJob] ${label}: added ${inserted} slots`);
  } catch (error) {
    console.error('[SlotRollJob] Error:', error);
  }
}

function startSlotRollJob() {
  console.log('[SlotRollJob] Scheduler configured daily at 00:05 Asia/Bangkok');
  cron.schedule('5 0 * * *', () => rollOnce('daily run'), { timezone: 'Asia/Bangkok' });
  rollOnce('startup run'); // also catches up if the server was down at midnight
}

module.exports = { startSlotRollJob };
