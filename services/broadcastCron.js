// cron/broadcastCron.js
const cron = require('node-cron');
const BotMessage = require('../models/botMessages');
const BotUser = require('../models/botUsers');
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// helper to sleep between batches
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

cron.schedule('*/1 * * * *', async () => {  // every minute
  console.log('🔔 Checking scheduled bot messages...');
  const now = new Date();

  const messages = await BotMessage.find({
    is_active: true,
    status: 'pending',
    scheduled_at: { $lte: now },
  });

  for (const msg of messages) {
    try {
      let users = [];

      if (msg.target === 'single' && msg.single_chat_id) {
        users = [{ chat_id: msg.single_chat_id }];
      } else {
        users = await BotUser.find({}, { chat_id: 1, _id: 0 });
      }

      console.log(`📨 Sending "${msg.title}" to ${users.length} users`);

      const batchSize = 25; // safe with Telegram limits
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async ({ chat_id }) => {
            try {
              if (msg.type === 'text') {
                await bot.telegram.sendMessage(chat_id, msg.text || '');
              } else if (msg.type === 'video') {
                await bot.telegram.sendVideo(chat_id, msg.file_id, {
                  caption: msg.text || '',
                });
              } else if (msg.type === 'audio') {
                await bot.telegram.sendAudio(chat_id, msg.file_id, {
                  caption: msg.text || '',
                });
              } else if (msg.type === 'image') {
                await bot.telegram.sendPhoto(chat_id, msg.file_id, {
                  caption: msg.text || '',
                });
              }
            } catch (err) {
              console.log('❌ Failed to send to', chat_id, err.message);
            }
          })
        );

        // small delay between batches
        await sleep(700);
      }

      msg.status = 'sent';
      msg.is_active = false;
      await msg.save();
      console.log(`✅ Broadcast "${msg.title}" completed`);
    } catch (e) {
      console.log('❌ Error sending broadcast', msg._id, e);
      msg.status = 'failed';
      await msg.save();
    }
  }
});
