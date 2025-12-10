const cron =require("node-cron");
const BotUser =require("../models/botUsers.js");
const ScheduledMessage =require("../models/botMessage/ScheduledMessage.js");
const { sendMessageSafe } =require("../utils/sendBotMessage.js");
const getNextSendAt = require('../utils/getNextSendAt.js')
const getAudienceUsers = require('../utils/getAudience.js')

//-----------TEST 20 Sec--------------------
// cron.schedule("*/20 * * * * *", async () => {

// ----------HOURLY-------------------------
cron.schedule("0 0 * * * *", async () => {

  console.log("⏱ Checking scheduled messages...");
  const now = new Date();

  const scheduled = await ScheduledMessage.find({
    isActive: true,
    $or: [
      { scheduleType: "once", isSend: false, sendAt: { $lte: now } },
      { scheduleType: "daily", sendAt: { $lte: now } },
      { scheduleType: "weekly", sendAt: { $lte: now } },
      { scheduleType: "every_n_days", sendAt: { $lte: now } },
    ],
  });

  if (!scheduled.length) {
    console.log("ℹ No messages to send right now");
    return;
  }

  for (let msg of scheduled) {
    console.log(`\n📨 Processing message ${msg._id} [${msg.scheduleType}]`);

    // 1️⃣ Resolve audience list
    const targets = await getAudienceUsers(msg);
    const totalTargets = targets.length;

    if (!totalTargets) {
      console.log(`⚠ No users found for audience "${msg.audience}". Skipping send.`);
    } else {
      console.log(`📤 Sending to ${totalTargets} users...`);

      // 2️⃣ Build and send for each user
      for (const user of targets) {
        const chatId = user.telegramId || user.id;
        if (!chatId) {
          console.log("⚠ No chat_id found, skipping user");
          continue;
        }

        const payload = {
          chat_id: chatId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard:
              msg.buttons
                ?.filter(
                  (btn) =>
                    btn.text &&
                    btn.url &&
                    typeof btn.url === "string" &&
                    btn.url.startsWith("http")
                )
                .map((btn) => [{ text: btn.text, url: btn.url }]) || [],
          },
        };

        const media = msg.fileId;

        switch (msg.type) {
          case "text":
            payload.text = msg.caption || "";
            sendMessageSafe("sendMessage", payload);
            break;

          case "image":
            if (!media) {
              console.log("⚠ Image fileId missing, skipped");
              continue;
            }
            payload.photo = media;
            payload.caption = msg.caption || "";
            sendMessageSafe("sendPhoto", payload);
            break;

          case "video":
            if (!media) {
              console.log("⚠ Video fileId missing, skipped");
              continue;
            }
            payload.video = media;
            payload.caption = msg.caption || "";
            sendMessageSafe("sendVideo", payload);
            break;

          case "audio":
            if (!media) {
              console.log("⚠ Audio fileId missing, skipped");
              continue;
            }
            payload.audio = media;
            payload.caption = msg.caption || "";
            sendMessageSafe("sendAudio", payload);
            break;

          default:
            console.log("⚠ Unknown type:", msg.type);
        }
      }
    }

    // 3️⃣ Update message status & next sendAt
    msg.sentCount += totalTargets;

    if (msg.scheduleType === "once") {
      // mark as completed & deactivate
      msg.isSend = true;
      msg.isActive = false;
      console.log(`✅ One-time message ${msg._id} completed.`);
    } else {
      // recurring: calculate next send time
      const next = getNextSendAt(msg, now);

      if (next) {
        msg.sendAt = next;
        console.log(
          `🔁 Recurring message ${msg._id} rescheduled to ${next.toISOString()}`
        );
      } else {
        // fallback: deactivate if something is off
        msg.isActive = false;
        console.log(
          `⚠ No next date for message ${msg._id}. Deactivating as safety.`
        );
      }
    }

    await msg.save();
  }
});