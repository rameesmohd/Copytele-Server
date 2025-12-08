// cron/userJobsCron.js
const cron = require('node-cron');
const UserMessageJob = require('../models/UserMessageJob');
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

cron.schedule('*/1 * * * *', async () => {
  const now = new Date();
  const jobs = await UserMessageJob.find({
    status: 'pending',
    send_at: { $lte: now },
  }).limit(200); // safety limit

  for (const job of jobs) {
    try {
      if (job.template_key === 'onboarding_day1') {
        await bot.telegram.sendMessage(
          job.chat_id,
          'Here’s how to start copying traders on 4xMeta 📈'
        );
      } else if (job.template_key === 'onboarding_day2') {
        await bot.telegram.sendMessage(
          job.chat_id,
          'Tip: Fund your wallet and choose a strategy to begin.'
        );
      }

      job.status = 'sent';
      await job.save();
    } catch (e) {
      console.log('❌ Error sending user message job', job._id, e);
      job.status = 'failed';
      await job.save();
    }
  }
});
