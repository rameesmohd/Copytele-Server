const botUserModel = require("../models/botUsers");
const userModel = require("../models/user");
const managerTradeModel = require("../models/managerTrades");
const investorTradeModel = require("../models/investmentTrades");
const { sendMessageSafe } = require("../utils/sendBotMessage");
const managerModel = require('../models/manager')
const cron = require("node-cron");

const fetchManagerProfitToday = async (managerId) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const trades = await managerTradeModel.find({
      manager: managerId,
      is_distributed : true,
      close_time: { $gte: startOfDay, $lte: endOfDay }
    });

    const profit = trades.reduce((sum, t) => sum + (t.manager_profit || 0), 0);

    return Number(profit.toFixed(2))
  } catch (error) {
    console.log("Manager profit fetch error:", error);
    return 0
  }
};

const fetchUserProfitToday = async (userId, managerId) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all investor trades for this manager
    const trades = await investorTradeModel.find({
      user: userId,
      manager: managerId,
      close_time: { $gte: startOfDay, $lte: endOfDay }
    });

    const profit = trades.reduce((sum, t) => sum + t.investor_profit, 0);
    return Number(profit.toFixed(2));
  } catch (error) {
    console.error("Investor profit fetch error:", error);
    return 0;
  }
};

const sendMessageToUser = async (user, manager, managerProfit, userProfit) => {
  const chatId = user.id || user.telegram?.id;

  if (!chatId) return;
  
  const text = `
📈 *Daily Profit Update*

👨‍💼 Manager *@${manager.nickname}* Profit Today: *$${managerProfit.toFixed(2)}*
👤 Your Profit Share Today: *$${userProfit.toFixed(2)}*
  `;

  await sendMessageSafe("sendMessage", {
    chat_id: chatId,
    parse_mode: "Markdown",
    text: text.trim()
  });
};

const getWebAppNotOpenedBotUsers = async () => {
  const users = await botUserModel.find({
    is_opened_webapp: false,
    is_invested: false
  });
  return users
};

const getWebAppUsers = async () => {
  const users = await userModel.find(
    { login_type: "telegram" },
    { telegram: 1 }
  );

  return users.map(u => ({
    id: Number(u.telegram.id),
    telegram: u.telegram,
    _id: u._id
  }));
};

cron.schedule("0 0 23 * * *", async () => {
  try {
    console.log("📊 Sending simplified daily profit updates...");

    const managers = await managerModel.find();
    const webAppUsers = await getWebAppUsers();
    const nonWebAppUsers = await getWebAppNotOpenedBotUsers()

    for (const manager of managers) {
      const managerProfit = await fetchManagerProfitToday(manager._id);

      for (const user of webAppUsers) {
        const userProfit = await fetchUserProfitToday(user._id, manager._id);

        await sendMessageToUser(
          user,
          manager,
          managerProfit,
          userProfit
        );
      }

      for (const user of nonWebAppUsers) {
        const userProfit = 0

        await sendMessageToUser(
          user,
          manager,
          managerProfit,
          userProfit
        );
      }  

    }

    console.log("✅ Daily profit messages sent.");

  } catch (err) {
    console.log("Cron error:", err);
  }
});
