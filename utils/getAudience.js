// helpers/getAudience.js

const BotUser = require("../models/botUsers.js");
const { isUserInChannel } = require("./checkUserInChannel.js");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const getAudienceUsers = async (msg) => {
  switch (msg.audience) {
    case "all":
      return BotUser.find();

    case "single":
      if (!msg.singleUserId) return [];
      return [{ telegramId: msg.singleUserId }];

    case "not_opened_webapp":
      return BotUser.find({ is_opened_webapp: false });

    case "not_invested":
      return BotUser.find({ is_invested: false });

    case "invested":
      return BotUser.find({ is_invested: true });

    case "not_joined_channel": {
      console.log("🔍 Checking users who have not joined channel...");

      const users = await BotUser.find({ is_joined_channel: false });
      console.log(`Total users to verify: ${users.length}`);

      const result = [];
      const CONCURRENCY = 10;
      let index = 0;

      while (index < users.length) {
        const slice = users.slice(index, index + CONCURRENCY);

        await Promise.all(
          slice.map(async (user) => {
            const joined = await isUserInChannel(user.id);

            if (!joined) {
              result.push(user);
            } else {
              await BotUser.findOneAndUpdate(
                { id: user.id },
                { is_joined_channel: true }
              );
            }
          })
        );

        index += CONCURRENCY;
        await delay(300); // small pause to avoid rate-limit spike
      }

      console.log(`📌 Final not-joined count = ${result.length}`);
      return result;
    }

    default:
      return [];
  }
};

module.exports = getAudienceUsers;
