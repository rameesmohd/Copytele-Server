const managerGrowthChart = require("../models/managerGrowthChart");
const managerModel = require("../models/manager");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
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

module.exports={
  fetchChartData,
  getDailyChart,
  getWeeklyChart,
  getMonthlyChart
}