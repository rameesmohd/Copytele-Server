const botUserModel = require("../../models/botUsers");
const userModel = require("../../models/user");
const managerTradeModel = require("../../models/managerTrades");
const investorTradeModel = require("../../models/investmentTrades");
const managerModel = require("../../models/manager");
const investmentModel = require("../../models/investment");
/* ---------------- Utils ---------------- */

const getTodayRange = () => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

const fetchManagerProfitToday = async (managerId) => {
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

  return result.length ? Number(result[0].totalProfit.toFixed(2)) : 0;
};

const fetchAllUserProfitsForManager = async (managerId, userIds) => {
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

  const map = new Map();
  results.forEach(r => {
    map.set(r._id.toString(), Number(r.totalProfit.toFixed(2)));
  });

  return map;
};

const getWebAppUsers = async () => {
  const users = await userModel.find(
    { login_type: "telegram" },
    { telegram: 1 }
  ).lean();

  return users
    .filter(u => u.telegram?.id)
    .map(u => ({
      chat_id: Number(u.telegram.id),
      userId: u._id
    }));
};

const getNonWebAppBotUsers = async () => {
  const users = await botUserModel.find({
    is_opened_webapp: false,
    is_invested: false
  }).lean();

  return users.map(u => ({
    chat_id: Number(u.id),
    userId: null
  }));
};

/* ---------------- Message Builder ---------------- */

const buildAlertMessage = ({
  chat_id,
  manager,
  managerProfit,
  userProfit = 0,
  hasInvested
}) => {
  const profitEmoji = userProfit >= 0 ? "📈" : "📉";
  const managerEmoji = managerProfit >= 0 ? "✅" : "⚠️";

  const text = `
📊 *Daily Trading Summary*

👨‍💼 *Manager:* @${manager.nickname || manager.name}
${managerEmoji} *Manager Performance Today:* $${managerProfit.toFixed(2)}

${
  hasInvested
    ? `
📈 *Your Portfolio Update*
${userProfit>0 ? `*Profit :* +$${userProfit.toFixed(2)}` : `*Loss : * $${userProfit.toFixed(2)}`}

${
  userProfit > 0
    ? "Your capital moved in the right direction today. Consistency and discipline drive long-term results."
    : userProfit < 0
    ? "A controlled drawdown occurred today. Risk management remained within defined limits."
    : "Market conditions did not trigger trades for your account today."
}
                                                                                                                                       
🔒 Disciplined risk • Long-term focus
`
    : `
💡 *You are not invested yet.*

Today’s trades were executed using professional strategies and structured risk management.

📌 *Why investors choose this system:*
• No manual trading  
• No market experience required  
• You participate only when real trades occur  

Start copying this manager and let your capital work with discipline.
`
}
`.trim();

  return {
    chat_id,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: hasInvested ? "View Portfolio" : "Start Investing",
            web_app: {
              url: process.env.WEBAPP_URL
            }
          }
        ]
      ]
    }
  };
};


/* ---------------- CONTROLLER ---------------- */

const getDailyProfitAlerts = async (req, res) => {
  try {
    const alerts = [];

    const managers = await managerModel.find().lean();
    if (!managers.length) {
      return res.json({ success: true, alerts });
    }

    const webAppUsers = await getWebAppUsers();
    const nonWebAppUsers = await getNonWebAppBotUsers();

    for (const manager of managers) {
      const managerProfit = await fetchManagerProfitToday(manager._id);
      if (managerProfit <= 0) continue;

      const webAppUserIds = webAppUsers.map(u => u.userId);

      const profitMap = await fetchAllUserProfitsForManager(
        manager._id,
        webAppUserIds
      );

      const investments = await investmentModel.find(
        { user: { $in: webAppUserIds }, manager: manager._id },
        { user: 1 }
      ).lean();

      const investedUsers = new Set(
        investments.map(i => i.user.toString())
      );

      // WebApp users
      for (const u of webAppUsers) {
        alerts.push(
          buildAlertMessage({
            chat_id: u.chat_id,
            manager,
            managerProfit,
            userProfit: profitMap.get(u.userId.toString()) || 0,
            hasInvested: investedUsers.has(u.userId.toString())
          })
        );
      }

      // Non-webapp users
      for (const u of nonWebAppUsers) {
        alerts.push(
          buildAlertMessage({
            chat_id: u.chat_id,
            manager,
            managerProfit,
            hasInvested: false
          })
        );
      }
    }

    return res.json({
      success: true,
      count: alerts.length,
      alerts
    });

  } catch (error) {
    console.error("Daily alert controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate alerts"
    });
  }
};

module.exports = { getDailyProfitAlerts }