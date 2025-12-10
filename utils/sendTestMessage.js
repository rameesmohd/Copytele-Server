const { sendMessageSafe } = require("./sendBotMessage")

const sendTestMessage = async (msg) => {
  try {
    const channelId = process.env.ALERT_CHANNEL_ID;

    if (!channelId) {
      console.log("❌ TEST_CHANNEL_ID is missing in .env");
      return false;
    }

    const payload = {
      chat_id: channelId,        // <-- send to channel
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
        payload.text = msg.caption || "(no caption)";
        sendMessageSafe("sendMessage", payload);
        break;

      case "image":
        if (!media) return console.log("⚠ Missing image fileId");
        payload.photo = media;
        payload.caption = msg.caption || "";
        sendMessageSafe("sendPhoto", payload);
        break;

      case "video":
        if (!media) return console.log("⚠ Missing video fileId");
        payload.video = media;
        payload.caption = msg.caption || "";
        sendMessageSafe("sendVideo", payload);
        break;

      case "audio":
        if (!media) return console.log("⚠ Missing audio fileId");
        payload.audio = media;
        payload.caption = msg.caption || "";
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

module.exports = {sendTestMessage}