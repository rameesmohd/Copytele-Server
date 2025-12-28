const managerGrowthChart = require("../models/managerGrowthChart");
const managerModel = require("../models/manager");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
const { default: mongoose } = require("mongoose");
const userPortfolioChart = require("../models/userPortfolioChart");
const { fetchAndUseLatestRollover } = require("./rolloverController");
const rolloverModel = require("../models/rollover");
dayjs.extend(isoWeek);

const getDailyChart = async (req, res) => {
  try {
    const { manager_id, days = 90 } = req.query;

    if (!manager_id)
      return res.status(400).json({ error: "manager_id is required" });

    const start = dayjs().subtract(days, "day").startOf("day").toDate();

    const data = await managerGrowthChart
      .find({
        manager: manager_id,
        date: { $lte: new Date(), $gte: start }
      })
      .sort({ date: 1 });

    res.json({
      manager_id,
      range: `${days} days`,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const getWeeklyChart = async (req, res) => {
  try {
    const { manager_id, weeks = 12 } = req.query;

    if (!manager_id)
      return res.status(400).json({ error: "manager_id is required" });

    const start = dayjs().subtract(weeks * 7, "day").startOf("day").toDate();

    const rows = await managerGrowthChart
      .find({ manager: manager_id, date: { $gte: start } })
      .sort({ date: 1 });

    const weekly = {};

    for (const row of rows) {
      const weekNumber = dayjs(row.date).isoWeek();
      const year = dayjs(row.date).year();

      const weekStart = dayjs(row.date).startOf("isoWeek");
      const weekEnd = dayjs(row.date).endOf("isoWeek");

      const readableLabel = `${weekStart.format("MMM D")}–${weekEnd.format("D")}`;

      const key = `${year}-W${String(weekNumber).padStart(2, "0")}`;

      if (!weekly[key]) {
        weekly[key] = {
          grow: 1,
          label: readableLabel,
        };
      }

      weekly[key].grow *= 1 + row.value / 100;
    }

    const result = Object.keys(weekly).map((key) => ({
      week: weekly[key].label,
      value: Number(((weekly[key].grow - 1) * 100).toFixed(2)),
    }));

    res.json({ manager_id, weeks, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


const getMonthlyChart = async (req, res) => {
  try {
    const { manager_id, months = 12 } = req.query;

    if (!manager_id)
      return res.status(400).json({ error: "manager_id is required" });

    const start = dayjs().subtract(months, "month").startOf("month").toDate();

    const rows = await managerGrowthChart
      .find({ manager: manager_id, date: { $gte: start } })
      .sort({ date: 1 });

    const monthly = {};
    for (const row of rows) {
      const month = dayjs(row.date).format("YYYY-MM");

      if (!monthly[month]) monthly[month] = 1;

      monthly[month] *= 1 + row.value / 100;
    }

    const result = Object.keys(monthly).map((key) => ({
      month: key,
      value: Number(((monthly[key] - 1) * 100).toFixed(2)),
    }));

    res.json({ manager_id, months, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const fetchChartData=async(req,res)=>{
    try {
        const data = await managerGrowthChart
        .find({ manager: req.params.managerId })
        .sort({ date: 1 })
        .select({ date: 1, value: 1, _id: 0 });
        
        return res.status(200).json({ result : data });
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// Get User Portfolio Growth Chart
const getUserGrowthChart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { filter = "30D" } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }

    let dateFilter = {};
    const now = Date.now();

    // ===== PRESET FILTERS =====
    if (filter === "7D") {
      dateFilter.date = { $gte: new Date(now - 7 * 86400000) };
    } else if (filter === "30D") {
      dateFilter.date = { $gte: new Date(now - 30 * 86400000) };
    } else if (filter === "90D") {
      dateFilter.date = { $gte: new Date(now - 90 * 86400000) };
    } else if (filter === "1Y") {
      dateFilter.date = { $gte: new Date(now - 365 * 86400000) };
    } else if (filter === "ALL") {
      // no filter → return everything
    }

    const chart = await userPortfolioChart
      .find({ user: userId, ...dateFilter })
      .sort({ date: 1 })
      .select({ date: 1, value: 1, _id: 0 });
        
    const latestRollover = await fetchAndUseLatestRollover()

    return res.json({
      success: true,
      data: chart,
      rollover : latestRollover
    });

  } catch (err) {
    console.log("Growth chart error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


module.exports={
  //=======MANAGER==============
  fetchChartData,
  getDailyChart,
  getWeeklyChart,
  getMonthlyChart,
  //==============================
  //             USER
  //==============================
  getUserGrowthChart
}