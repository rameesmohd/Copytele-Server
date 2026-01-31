const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // e.g. "-1001234567890"

const isUserInChannel = async (userId) => {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`;
    const res = await axios.get(url);
    const status = res.data?.result?.status;

    console.log(`User ${userId} status =>`, status);

    return ["member", "administrator", "creator"].includes(status);
  } catch (err) {
    if (err?.response?.status === 429) {
      console.log("Rate limit hit, retry later:", err.response.data);
    } else {
      console.log("API Error:", err?.message);
      console.log("User err status =>`,", err?.response?.data?.description || err?.message);
    }
    return false; 
  }
};

module.exports = {
  isUserInChannel,
};
