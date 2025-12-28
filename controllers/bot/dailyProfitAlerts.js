// controllers/dailyAlertsController.js
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
        manager: managerId,
        user: { $in: userIds },
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

/* ---------------- Message Builder ---------------- */

const buildAlertMessage = ({
  chat_id,
  manager,
  managerProfit,
  userProfit = 0,
  hasInvested
}) => {
  const text = `
<blockquote><b>Manager:</b> ${manager.nickname || manager.name}
<b>Today’s Performance:</b> $${managerProfit.toFixed(2)}
<b>Your Portfolio:</b> ${userProfit > 0 ? "+" : ""}$${userProfit.toFixed(2)}</blockquote>

${
  hasInvested
    ? userProfit > 0
      ? "<b>Positive progress today.</b>"
      : userProfit < 0
      ? "<b>Controlled drawdown within risk limits.</b>"
      : "<b>No trades executed today.</b>"
    : `
<b>The best part?</b>
Our followers earned this while sleeping, working, or spending time with family.
`
}
Check the full breakdown here ⬇️
`.trim();

  return {
    chat_id,
    payload: {
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: hasInvested ? "📊 View Portfolio" : "Start Investing",
              web_app: { url: process.env.WEBAPP_URL }
            }
          ]
        ]
      }
    }
  };
};

/* ---------------- CONTROLLER WITH PAGINATION ---------------- */

const getDailyProfitAlerts = async (req, res) => {
  try {
    const offset = Number(req.query.offset || 0);
    const limit = Math.min(Number(req.query.limit || 500), 1000);
    
    const alerts = [];

    const managers = await managerModel.find().lean();
    if (!managers.length) {
      return res.json({ success: true, alerts: [] });
    }

    const webAppUsers = await userModel
      .find({ login_type: "telegram" }, { telegram: 1 })
      .lean();

    const nonWebAppUsers = await botUserModel
      .find({ is_opened_webapp: false, is_invested: false })
      .lean();

    const allUsers = [
      ...webAppUsers.map(u => ({ chat_id: Number(u.telegram.id), userId: u._id })),
      ...nonWebAppUsers.map(u => ({ chat_id: Number(u.id), userId: null }))
    ];

    const pageUsers = allUsers.slice(offset, offset + limit);

    for (const manager of managers) {
      const managerProfit = await fetchManagerProfitToday(manager._id);
      // if (managerProfit <= 0) continue;

      const webUserIds = pageUsers.filter(u => u.userId).map(u => u.userId);
      const profitMap = await fetchAllUserProfitsForManager(manager._id, webUserIds);

      const investments = await investmentModel.find(
        { user: { $in: webUserIds }, manager: manager._id },
        { user: 1 }
      ).lean();

      const investedSet = new Set(investments.map(i => i.user.toString()));

      for (const u of pageUsers) {
        alerts.push(
          buildAlertMessage({
            chat_id: u.chat_id,
            manager,
            managerProfit,
            userProfit: u.userId ? profitMap.get(u.userId.toString()) || 0 : 0,
            hasInvested: u.userId ? investedSet.has(u.userId.toString()) : false
          })
        );
      }
    }

    return res.json({
      success: true,
      offset,
      limit,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error("Daily alert controller error:", error);
    return res.status(500).json({ success: false });
  }
};

module.exports = { getDailyProfitAlerts };
