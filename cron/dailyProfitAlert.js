const botUserModel = require("../models/botUsers");
const userModel = require("../models/user");
const managerTradeModel = require("../models/managerTrades");
const investorTradeModel = require("../models/investmentTrades");
const { sendMessageSafe } = require("../utils/sendBotMessage");
const managerModel = require('../models/manager');
const cron = require("node-cron");
const investmentModel = require("../models/investment");

// Get start and end of day in UTC
const getTodayRange = () => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

// Fetch manager's profit for today using aggregation (faster)
const fetchManagerProfitToday = async (managerId) => {
  try {
    const { startOfDay, endOfDay } = getTodayRange();

    const result = await managerTradeModel.aggregate([
      {
        $match: {
          manager: managerId,
          is_distributed: true,
          close_time: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$manager_profit" }
        }
      }
    ]);

    return result.length > 0 ? Number(result[0].totalProfit.toFixed(2)) : 0;
  } catch (error) {
    console.error("Manager profit fetch error:", error);
    return 0;
  }
};

// Fetch all user profits for a manager in one query (batch operation)
const fetchAllUserProfitsForManager = async (managerId, userIds) => {
  try {
    const { startOfDay, endOfDay } = getTodayRange();

    const results = await investorTradeModel.aggregate([
      {
        $match: {
          user: { $in: userIds },
          manager: managerId,
          close_time: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: "$user",
          totalProfit: { $sum: "$investor_profit" }
        }
      }
    ]);

    // Create a map for quick lookup: userId -> profit
    const profitMap = new Map();
    results.forEach(result => {
      profitMap.set(result._id.toString(), Number(result.totalProfit.toFixed(2)));
    });

    return profitMap;
  } catch (error) {
    console.error("Batch user profit fetch error:", error);
    return new Map();
  }
};

// Get all WebApp users (who have opened the app)
const getWebAppUsers = async () => {
  try {
    const users = await userModel.find(
      { login_type: "telegram" },
      { telegram: 1, _id: 1 }
    ).lean();

    return users
      .filter(u => u.telegram?.id)
      .map(u => ({
        id: Number(u.telegram.id),
        telegram: u.telegram,
        _id: u._id
      }));
  } catch (error) {
    console.error("Error fetching WebApp users:", error);
    return [];
  }
};

// Get bot users who haven't opened WebApp yet
const getNonWebAppBotUsers = async () => {
  try {
    const users = await botUserModel.find({
      is_opened_webapp: false,
      is_invested : false
    }).lean();

    return users.map(u => ({
      id: u.id,
      telegram: {
        id: String(u.id),
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name
      },
      _id: null // No user document for non-webapp users
    }));
  } catch (error) {
    console.error("Error fetching non-WebApp users:", error);
    return [];
  }
};

// Send message to user
const sendMessageToUser = async (user, manager, managerProfit, userProfit, hasInvested) => {
  const chatId = user.id || user.telegram?.id;

  if (!chatId) {
    console.log(`⚠️ No chatId for user ${user._id || user.id}`);
    return false;
  }

  const profitEmoji = userProfit >= 0 ? "📈" : "📉";
  const managerProfitEmoji = managerProfit >= 0 ? "✅" : "❌";
  
  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: hasInvested 
            ? "📊 View My Portfolio"
            : "🚀 Start Investing",
          url: process.env.WEBAPP_URL
        }
      ]
    ]
  };


  let text = `
${profitEmoji} *Daily Trading Summary*

👨‍💼 *Manager:* @${manager.nickname || manager.name}
${managerProfitEmoji} *Manager’s Profit Today:* $${managerProfit.toFixed(2)}

${hasInvested 
  ? `
${profitEmoji} *Your Profit Share:* $${userProfit.toFixed(2)}

${userProfit > 0 
    ? "🎉 *Great performance today!* Your portfolio grew successfully."
    : userProfit < 0 
      ? "📉 *Minor Drawdown.* Stay steady — the market always corrects back." 
      : "📊 *No trades impacted your account today.*"
  }
` 
  : `
💡 *You're not earning yet.*

Start copying this manager’s trades and grow your capital with professional strategies.

👉 *Tap below to begin your investment journey.*
`
}
`;

  try {
    await sendMessageSafe("sendMessage", {
      chat_id: chatId,
      parse_mode: "Markdown",
      text: text.trim(),
      reply_markup: replyMarkup
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to send message to user ${user._id || user.id}:`, error.message);
    return false;
  }
};

//-----------Test in each 20 Sec-----------------------------------------
// cron.schedule("*/20 * * * * *", async () => {

//-----------At 11:00 PM daily--------------
cron.schedule("0 23 * * *", async () => {
  try {
    // Fetch all managers
    const managers = await managerModel.find();
    
    if (managers.length === 0) {
      console.log("⚠️ No managers found. Exiting.");
      return;
    }

    // Fetch all users once (more efficient)
    const webAppUsers = await getWebAppUsers();
    const nonWebAppUsers = await getNonWebAppBotUsers();
    const allUsers = [...webAppUsers, ...nonWebAppUsers];
    
    if (allUsers.length === 0) {
      console.log("⚠️ No users found. Exiting.");
      return;
    }

    let totalMessagesSent = 0;
    let totalMessagesFailed = 0;

    // Process each manager
    for (const manager of managers) {
      // Get manager's total profit for today
      const managerProfit = await fetchManagerProfitToday(manager._id);

      // Only process if manager had any activity today
      if (managerProfit === 0) {
        console.log(`⏭️ Skipping - no profit/loss for manager ${manager.nickname}`);
        continue;
      }  

      // Batch fetch all user profits for this manager (much faster than individual queries)
      const webAppUserIds = webAppUsers.map(u => u._id);
      console.log(webAppUserIds , "1-webAppUserIds");
      
      const userProfitMap = await fetchAllUserProfitsForManager(manager._id, webAppUserIds);
      console.log(userProfitMap , "2-userProfitMap");
      
      // Query only investments of these users
        const investments = await investmentModel.find(
            { user: { $in: webAppUserIds } },
            { user: 1, manager: 1 }
        ).lean();

        const userInvestmentsMap = new Map();

        for (const inv of investments) {
        const userId = inv.user.toString();
        const managerId = inv.manager.toString();

        if (!userInvestmentsMap.has(userId)) {
            userInvestmentsMap.set(userId, new Set());
        }

        userInvestmentsMap.get(userId).add(managerId);
        }

      // Send to WebApp users
      for (const user of webAppUsers) {
        const userProfit = userProfitMap.get(user._id.toString()) || 0;
        const hasInvested =
            userInvestmentsMap.get(user._id.toString())?.has(manager._id.toString()) || false;

        console.log("3-hasInvested",userProfit,hasInvested);
        
        const sent = await sendMessageToUser(
          user, 
          manager, 
          managerProfit, 
          userProfit,
          hasInvested
        );

        if (sent) {
          totalMessagesSent++;
        } else {
          totalMessagesFailed++;
        }

        // Rate limiting: 50ms delay between messages (max 20 msg/sec)
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Send to non-WebApp users (profit is always $0)
      for (const user of nonWebAppUsers) {
        const sent = await sendMessageToUser(
          user, 
          manager, 
          managerProfit, 
          0, // No investment = $0 profit
          false // hasInvested = false
        );

        if (sent) {
          totalMessagesSent++;
        } else {
          totalMessagesFailed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    }

    console.log(`📨 Messages sent: ${totalMessagesSent}`);
    console.log(`❌ Messages failed: ${totalMessagesFailed}`);
  } catch (err) {
    console.error("❌DAILY PROFIT ALERT CRON JOB ERROR");
    console.error(err);
  }
});