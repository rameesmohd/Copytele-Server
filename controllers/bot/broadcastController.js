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
        { scheduleType: "once", sendAt: { $lte: now } },
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
              // 🔹 WebApp button
              btn.type === "webapp"
                ? {
                    text: btn.text,
                    web_app: { url: btn.url },
                  }

              // 🔹 Callback button
              : btn.type === "callback"
                ? {
                    text: btn.text,
                    callback_data: btn.command || btn.data || btn.text,
                  }

              // 🔹 Normal URL button
              : {
                    text: btn.text,
                    url: btn.url,
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

const markInactive =  async (req, res) => {
  try {
    const { chat_id, reason } = req.body;

    if (!chat_id) {
      return res.status(400).json({ success: false, message: "chat_id is required" });
    }

    const updated = await BotUser.updateOne(
      { id: Number(chat_id) },
      {
        $set: {
          is_active: false,
          inactive_reason: reason || "inactive",
          inactive_at: new Date(),
        },
      }
    );

    return res.json({ success: true, updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};

const markSecondInactive =  async (req, res) => {
  try {
    const { chat_id } = req.body;

    if (!chat_id) {
      return res.status(400).json({ success: false, message: "chat_id is required" });
    }

    const updated = await BotUser.updateOne(
      { id: Number(chat_id) },
      {
        $set: {
          is_second_bot : false
        },
      }
    );

    return res.json({ success: true, updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};

module.exports = { 
    getBroadcastMessages,
    getBroadcastUsers,
    markBroadcastDone,
    markInactive,
    markSecondInactive
};