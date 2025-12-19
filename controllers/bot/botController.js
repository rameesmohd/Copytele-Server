const OnboardingMessage = require('../../models/botMessage/OnboardingMessage');
const BotUser = require('../../models/botUsers');
const { sendNewBotUserAlert } = require("./botAlerts");

const saveUser = async (req, res) => {
  try {
    const payload = req.body;
    const telegramId = payload.telegramId;

    const existingUser = await BotUser.findOne({ id: telegramId });

    // Prevent self referral
    if (payload.referred_by && payload.referred_by === String(telegramId)) {
      payload.referred_by = null;
    }

    // if user already exists do not overwrite referral
    if (existingUser && existingUser.referred_by) {
      delete payload.referred_by;
    }

    // Upsert botUser
    const updatedUser = await BotUser.findOneAndUpdate(
      { id: telegramId },
      { $set: payload },
      { upsert: true, new: true }
    );

    // Notify only for new bot user
    if (!existingUser) {
      await sendNewBotUserAlert(payload);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOnboardMessages = async (req, res) => {
  try {
    const data = await OnboardingMessage.find({isActive : true}).sort({ order: 1});
    res.json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { saveUser,getOnboardMessages };
