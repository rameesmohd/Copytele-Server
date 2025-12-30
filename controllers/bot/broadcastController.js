const ScheduledMessage = require("../../models/botMessage/ScheduledMessage");
const BotUser = require("../../models/botUsers");
const { convertToTelegramHtml } = require("../../utils/convertToTelegramHtml");
const getNextSendAt = require("../../utils/getNextSendAt");
const { getAudienceUsersPaginated ,getAudienceCount, getAudienceQuery } = require("../../utils/getAudiencePaginated");

const getBroadcastMessages = async (req, res) => {
  try {
    const now = new Date();    
    const messages = await ScheduledMessage.find({
      isActive: true,
      $or: [
        { scheduleType: "once", isSend: false, sendAt: { $lte: now } },
        { scheduleType: "daily", sendAt: { $lte: now } },
        { scheduleType: "weekly", sendAt: { $lte: now } },
        { scheduleType: "every_n_days", sendAt: { $lte: now } },
      ],
    });

    return res.json({
      success: true,
      messages,
    });
  } catch (err) {
    console.error("❌ getBroadcastMessages error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

const getBroadcastUsers = async (req, res) => {
  try {
    const { message, skip = 0, limit = 500 } = req.query;

    if (!message) {
      return res.json({ success: true, users: [] });
    }

    const msg = await ScheduledMessage.findById(message).lean();
    
    if (!msg || !msg.isActive) {
      return res.json({ success: true, users: [] });
    }

    const telegramCaption = msg.caption ? convertToTelegramHtml(msg.caption) : "";
    
    const targets = await getAudienceUsersPaginated(msg, parseInt(skip), parseInt(limit));

    const users = [];
    for (const user of targets) {

    const chatId = user.id;
    if (!chatId) {
      console.log("⚠ No chat_id found, skipping user");
      continue;
    }

    const payload = {
        chat_id: chatId,
        text: telegramCaption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard:
              msg.buttons?.map((btn) => [
                btn.type === "webapp"
                  ? {
                      text: btn.text,
                      web_app: { url: btn.url }
                    }
                  : {
                      text: btn.text,
                      url: btn.url
                    }
              ]) || []
        },
    };
    
    users.push({ chat_id: chatId, payload, fileId: msg.fileId, type: msg.type }); 

    return res.json({
      success: true,
      users,
    });
    }

    return res.json({
      success: true,
      users,
    });
  } catch (err) {
    console.error("❌ getBroadcastUsers error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

const markBroadcastDone = async (req,res) => {
  try {
    const { message } = req.body;
    const msg = await ScheduledMessage.findById(message);
    if (!msg) return;
  
    if (msg.scheduleType === "once") {
      msg.isActive = false;
      msg.isSend = true;
    } else {
      const next = getNextSendAt(msg);
      if (next) {
        msg.sendAt = next;
      } else {
        msg.isActive = false;
      }
    }
  
    await msg.save();
    res.status(200).json({ success: true });
  } catch (error) {
    console.log("❌ markBroadcastDone error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { 
    getBroadcastMessages,
    getBroadcastUsers,
    markBroadcastDone
};