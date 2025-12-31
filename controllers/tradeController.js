const { default: mongoose } = require('mongoose');
const investmentModel = require('../models/investment');
const investorTradeModel = require('../models/investmentTrades');
const managerModel = require('../models/manager')
const managerTradeModel = require('../models/managerTrades')
const managerGrowthChart = require('../models/managerGrowthChart')
const userPortfolioChart = require('../models/userPortfolioChart')
const { ObjectId } = require('mongoose').Types;
const dayjs = require('dayjs');

const addTradeToManager = async (req, res) => {
  try {
    const { formData, manager_id } = req.body;
    const {
      close_price,
      close_time,
      manager_profit,
      manager_volume,
      open_price,
      open_time,
      symbol,
      type,
      swap,
      take_profit,
      stop_loss,
      tp_hit,
      sl_hit
    } = formData;

    if (!formData || !manager_id) {
      return res.status(400).json({ success: false, msg: "Missing required fields" });
    }

    // Format numbers
    const formatNum = (v) => Number(v || 0).toFixed(2);

    const newTrade = new managerTradeModel({
      manager: manager_id,
      symbol,
      type,
      manager_volume,
      open_price,
      close_price,
      open_time: new Date(open_time),
      close_time: new Date(close_time),
      manager_profit: Number(manager_profit),
      swap: formatNum(swap), 
      take_profit,
      stop_loss,
      tp_hit,
      sl_hit
    });

    await newTrade.save();

    return res.status(200).json({
      success: true,
      result: newTrade,
      msg: "Trade added successfully",
    });
  } catch (error) {
    console.log("Add Trade Error:", error);
    res.status(500).json({ success: false, msg: "server side error" });
  }
};

const getTrades=async(req,res)=>{
    try {
        const {_id,distributed} = req.query
        // Validate _id
        if (!ObjectId.isValid(_id)) {
            return res.status(400).json({ errMsg: 'Invalid manager ID' });
        }

        // Query trades based on distribution status
        const tradeData = await managerTradeModel.find({
            manager: _id,
            is_distributed: distributed === 'true', // Convert query parameter to boolean
        }).sort({createdAt:-1});

        res.status(200).json({result : tradeData})
    } catch (error) {
        console.log(error);
        res.status(500).json({errMsg : 'sever side error'})
    }
}

const toTwoDecimals = (v) => {
  const n = Number(v);
  if (isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
};

const rollOverTradeDistribution = async (rollover_id) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const unDistributedTrades = await managerTradeModel
      .find({ is_distributed: false })
      .session(session);

    if (!unDistributedTrades.length) {
      await session.commitTransaction();
      session.endSession();
      return 0;
    }

    const bulkInvestmentUpdates = [];
    const bulkManagerUpdates = [];
    const bulkTradeUpdates = [];
    const investorTradeRows = [];

    let totalProfitDistributed = 0;

    const touchedManagers = new Set();
    const touchedUsers = new Set(); 

    // ------------------------------------------------------------
    // LOOP THROUGH TRADES
    // ------------------------------------------------------------
    for (const trade of unDistributedTrades) {
      const tradeProfit = toTwoDecimals(trade.manager_profit);
      totalProfitDistributed = toTwoDecimals(totalProfitDistributed + tradeProfit);

      const manager = await managerModel.findById(trade.manager).session(session);
      if (!manager) continue;

      touchedManagers.add(manager._id.toString());

      // Retrieve active investments
      const investments = await investmentModel
        .find({ manager: manager._id, status: "active" })
        .session(session);

      const totalFunds = investments.reduce(
        (sum, inv) => sum + (Number(inv.total_equity) || 0),
        0
      );

      if (totalFunds <= 0) continue;

      // ------------------------------------------------------------
      // DISTRIBUTE PROFIT TO EACH INVESTMENT
      // ------------------------------------------------------------
      for (const investment of investments) {
        if ((investment.total_equity || 0) < 1) continue;

        const investorProfit = toTwoDecimals(
          (investment.total_equity / totalFunds) * tradeProfit
        );

        const performanceFee = toTwoDecimals(
          (investorProfit * (investment.manager_performance_fee || 0)) / 100
        );

        // Save user id for portfolio chart
        touchedUsers.add(String(investment.user));

        bulkInvestmentUpdates.push({
          updateOne: {
            filter: { _id: investment._id },
            update: {
              $inc: {
                current_interval_profit: investorProfit,
                current_interval_profit_equity: investorProfit,
                total_trade_profit: investorProfit,
                closed_trade_profit: investorProfit,
                total_equity: investorProfit,
                performance_fee_projected: performanceFee,
              },
              $set: { last_rollover: rollover_id },
            },
          },
        });

        investorTradeRows.push({
          manager: manager._id,
          investment: investment._id,
          user : investment.user,
          manager_trade: trade._id,
          type: trade.type,
          symbol: trade.symbol,
          manager_volume: trade.manager_volume,
          open_price: trade.open_price,
          close_price: trade.close_price,
          swap: trade.swap,
          open_time: trade.open_time,
          close_time: trade.close_time,
          manager_profit: investorProfit,
          investor_profit: investorProfit,
          rollover_id,
          take_profit:trade.take_profit,
          stop_loss:trade.stop_loss,
          tp_hit:trade.tp_hit,
          sl_hit:trade.sl_hit
        });
      }

      // ------------------------------------------------------------
      // MANAGER GROWTH CHART (UPDATED)
      // ------------------------------------------------------------
      const chartDate = dayjs(trade.close_time).startOf("day").toDate();
      const previousEquity = Number(manager.total_funds) - tradeProfit || 1;
      const newEquity = Number(manager.total_funds) || 1;

      // Calculate return based on equity change
      const dailyReturn = toTwoDecimals((newEquity / previousEquity - 1) * 100);
      let compoundReturn = 0

      // Check if entry exists for the same day
      const existingChart = await managerGrowthChart
        .findOne({ manager: manager._id, date: chartDate })
        .session(session);

      if (existingChart) {
        // Compound calculation: growth = (1+a)(1+b)-1
        const compounded =
          (1 + existingChart.value / 100) * (1 + dailyReturn / 100) - 1;

        existingChart.value = toTwoDecimals(compounded * 100);
        compoundReturn = existingChart.value;
        await existingChart.save({ session });
      } else {
        await managerGrowthChart.create(
          [
            {
              manager: manager._id,
              date: chartDate,
              value: dailyReturn, // store percent value
            },
          ],
          { session }
        );
      }

      // Mark trade as distributed
      bulkTradeUpdates.push({
        updateOne: {
          filter: { _id: trade._id },
          update: { $set: { is_distributed: true } },
        },
      });

      // Update manager stats
      bulkManagerUpdates.push({
        updateOne: {
          filter: { _id: manager._id },
          update: {
            $inc: {
              closed_trade_profit: tradeProfit,
              total_trade_profit: tradeProfit,
              total_funds: tradeProfit,
              compound: compoundReturn,
            },
          },
        },
      });
    }

    // ------------------------------------------------------------
    // BULK EXECUTION
    // ------------------------------------------------------------
    if (bulkInvestmentUpdates.length)
      await investmentModel.bulkWrite(bulkInvestmentUpdates, { session });

    if (investorTradeRows.length)
      await investorTradeModel.insertMany(investorTradeRows, { session });

    if (bulkTradeUpdates.length)
      await managerTradeModel.bulkWrite(bulkTradeUpdates, { session });

    if (bulkManagerUpdates.length)
      await managerModel.bulkWrite(bulkManagerUpdates, { session });

    // ------------------------------------------------------------
    // RECALCULATE MANAGER RETURN
    // ------------------------------------------------------------
    const managerIds = Array.from(touchedManagers);

    const managers = await managerModel
      .find({ _id: { $in: managerIds } })
      .session(session);

    for (const m of managers) {
      const deposit = Number(m.total_deposit) || 0;
      const tradeProfit = Number(m.total_trade_profit) || 0;

      let totalReturn = 0;
      if (deposit > 0) {
        totalReturn = toTwoDecimals((tradeProfit / deposit) * 100);
      }

      await managerModel.updateOne(
        { _id: m._id },
        { $set: { total_return: totalReturn } },
        { session }
      );
    }

    // ------------------------------------------------------------
    // USER PORTFOLIO RETURN GROWTH CHART (PERCENTAGE LIKE MANAGER)
    // ------------------------------------------------------------
    if (touchedUsers.size) {
      const userIds = Array.from(touchedUsers).map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const userStats = await investmentModel.aggregate([
        { $match: { user: { $in: userIds }, status: "active" } },
        {
          $group: {
            _id: "$user",
            totalDeposit: { $sum: { $ifNull: ["$total_deposit", 0] } },
            totalTradeProfit: { $sum: { $ifNull: ["$total_trade_profit", 0] } },
          },
        },
      ]).session(session);

      const chartDate = dayjs().startOf("day").toDate();
      const userChartBulk = [];

      for (const u of userStats) {
        const userId = u._id;
        const deposit = Number(u.totalDeposit) || 0;
        const tradeProfit = Number(u.totalTradeProfit) || 0;

        let totalReturn = 0;
        if (deposit > 0) {
          totalReturn = toTwoDecimals((tradeProfit / deposit) * 100);
        }

        userChartBulk.push({
          updateOne: {
            filter: { user: userId, date: chartDate },
            update: { $set: { value: totalReturn } }, // value now = % return
            upsert: true,
          },
        });
      }

      if (userChartBulk.length) {
        await userPortfolioChart.bulkWrite(userChartBulk, { session });
      }
    }

    // ------------------------------------------------------------
    // COMMIT TRANSACTION
    // ------------------------------------------------------------
    await session.commitTransaction();
    session.endSession();

    return toTwoDecimals(totalProfitDistributed);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error in trade distribution:", error);
    return 0;
  }
};

const updateTradeToManager = async (req, res) => {
  try {
    const { trade_id, formData } = req.body;

    if (!trade_id || !formData) {
      return res.status(400).json({ success: false, msg: "Invalid request" });
    }

    // Extract only allowed fields
    const update = {
      symbol: formData.symbol,
      type: formData.type,
      manager_volume: formData.manager_volume,
      open_price: formData.open_price,
      close_price: formData.close_price,
      open_time: formData.open_time ? new Date(formData.open_time) : undefined,
      close_time: formData.close_time ? new Date(formData.close_time) : undefined,
      manager_profit: Number(formData.manager_profit || 0),
      swap: formData.swap,
      take_profit: formData.take_profit ?? null,
      stop_loss: formData.stop_loss ?? null,
      tp_hit: formData.tp_hit ?? false,
      sl_hit: formData.sl_hit ?? false,
    };

    // Remove undefined values to avoid overwriting
    Object.keys(update).forEach(
      (key) => update[key] === undefined && delete update[key]
    );

    const updated = await managerTradeModel.findOneAndUpdate(
      { _id: trade_id, is_distributed: false },
      { $set: update },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        msg: "Trade not found or already distributed",
      });
    }

    return res.json({
      success: true,
      msg: "Trade updated successfully",
      result: updated,
    });
  } catch (error) {
    console.log("Update Trade Error:", error);
    res.status(500).json({ success: false, msg: "server side error" });
  }
};

const deleteTradeToManager = async (req, res) => {
  try {
    const { tradeId } = req.query;

    if (!tradeId) {
      return res.status(400).json({
        success: false,
        msg: "Trade ID is required",
      });
    }

    const deleted = await managerTradeModel.findOneAndDelete({
      _id: tradeId,
      is_distributed: false, // ❗ prevent deleting if distributed
    });

    if (!deleted) {
      return res.status(400).json({
        success: false,
        msg: "Cannot delete. Trade not found or already distributed.",
      });
    }

    return res.json({
      success: true,
      msg: "Trade deleted successfully",
      result: deleted,
    });

  } catch (error) {
    console.log("❌ Delete Trade Error:", error);
    return res.status(500).json({
      success: false,
      msg: "Server error",
    });
  }
};


module.exports = { 
    addTradeToManager,
    updateTradeToManager,
    deleteTradeToManager,
    getTrades,
    rollOverTradeDistribution
}