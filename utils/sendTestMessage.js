const { sendMessageSafe } = require("./sendBotMessage");
const { convertToTelegramHtml } = require("../utils/convertToTelegramHtml");

const sendTestMessage = async (msg) => {
  try {
    const channelId = process.env.ALERT_CHANNEL_ID;

    if (!channelId) {
      console.log("❌ TEST_CHANNEL_ID is missing in .env");
      return false;
    }

    // ✅ Convert HTML to Telegram format
    const telegramCaption = msg.caption ? convertToTelegramHtml(msg.caption) : "";

    const payload = {
      chat_id: channelId,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard:
          msg.buttons
            ?.filter(btn => btn.text && btn.url)
            .map(btn => [{ text: btn.text, url: btn.url }]) || []
      }
    };

    const media = msg.fileId;

    switch (msg.type) {
      case "text":
        payload.text = telegramCaption || "(no caption)";
        sendMessageSafe("sendMessage", payload);
        break;

      case "image":
        if (!media) return console.log("⚠ Missing image fileId");
        payload.photo = media;
        payload.caption = telegramCaption;
        sendMessageSafe("sendPhoto", payload);
        break;

      case "video":
        if (!media) return console.log("⚠ Missing video fileId");
        payload.video = media;
        payload.caption = telegramCaption;
        sendMessageSafe("sendVideo", payload);
        break;

      case "audio":
        if (!media) return console.log("⚠ Missing audio fileId");
        payload.audio = media;
        payload.caption = telegramCaption;
        sendMessageSafe("sendAudio", payload);
        break;

      default:
        console.log("❌ Unknown message type:", msg.type);
        return false;
    }

    console.log("📨 Test message sent to channel:", channelId);
    return true;

  } catch (err) {
    console.error("❌ Error sending test message:", err);
    return false;
  }
};

module.exports = { sendTestMessage };