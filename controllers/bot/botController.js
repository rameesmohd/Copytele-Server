const OnboardingMessage = require('../../models/botMessage/OnboardingMessage');
const BotUser = require('../../models/botUsers');
const { isUserInChannel } = require('../../utils/isUserInChannel');
const { sendNewBotUserAlert } = require("./botAlerts");

const saveUser = async (req, res) => {
  try {
    const payload = req.body;
    const telegramId = payload.telegramId;

    const update = {
      username: payload.username,
      first_name: payload.first_name,
      last_name: payload.last_name,
      photo_url: payload.photo_url,
      is_premium: payload.is_premium,
    };

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
      { $set: update },
      { upsert: true, new: true }
    );

    if(!updatedUser.is_joined_channel){
      isUserInChannel(telegramId).then(isMember => {
        if(isMember){
          BotUser.updateOne(
            { id: telegramId },
            { $set: { is_joined_channel: true } }
          ).exec(); 
        }
      })
    }

    // Notify only for new bot user
    if (!existingUser) {
      sendNewBotUserAlert(payload);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOnboardMessages = async (req, res) => {
  try {
    const data = await OnboardingMessage
      .find({ isActive: true })
      .sort({ order: 1 });

    res.json(data);
  } catch (err) {
    console.error("Onboard fetch error:", err);
    res.status(500).json({ error: err.message });
  }
};

const updateUserJoinedChannel = async (req, res) => {
  try {
    const { id, user } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing user id",
      });
    }

    await BotUser.updateOne(
      { id },
      {
        $set: {
          is_joined_channel: true,
        },
        $setOnInsert: {
          id,
          username: user?.username || null,
          first_name: user?.first_name || null,
          last_name: user?.last_name || null,
          photo_url: user?.photo_url || null,
          is_premium: user?.is_premium || false,
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update joined channel error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { 
  saveUser,
  getOnboardMessages,
  updateUserJoinedChannel 
};
