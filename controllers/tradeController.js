const { default: mongoose } = require('mongoose');
const investmentModel = require('../models/investment');
const investorTradeModel = require('../models/investmentTrades');
const managerModel = require('../models/manager')
const managerTradeModel = require('../models/managerTrades')
const managerGrowthChart = require('../models/managerGrowthChart')
const userPortfolioChart = require('../models/userPortfolioChart')
const { ObjectId } = require('mongoose').Types;
const dayjs = require('dayjs');

const addTradeToManager=async(req,res)=>{
    try {
        const { formData , manager_id } = req.body
        const {
            close_price,
            close_time,
            manager_profit,
            manager_volume,
            open_price,
            open_time,
            symbol,
            type,
            swap    
        } = formData

        const newTrade =new managerTradeModel({
            manager : manager_id,
            symbol,
            manager_volume,
            type,
            open_price,
            close_price,
            swap,
            open_time,
            close_time,
            manager_profit
        })
        
        await newTrade.save()
        res.status(200).json({result : newTrade,msg:'Trade added successfully'})
    } catch (error) {
        console.log(error);
        res.status(500).json({errMsg : 'sever side error'})
    }
}

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
        });
      }

      // ------------------------------------------------------------
      // MANAGER GROWTH CHART
      // ------------------------------------------------------------
      const chartDate = dayjs(trade.close_time).startOf("day").toDate();
      const lastEquity = Number(manager.total_funds) || 1;
      const dailyPercent = toTwoDecimals((tradeProfit / lastEquity) * 100);

      const existingChart = await managerGrowthChart
        .findOne({ manager: manager._id, date: chartDate })
        .session(session);

      if (existingChart) {
        const newValue =
          (1 + existingChart.value / 100) * (1 + dailyPercent / 100) - 1;
        existingChart.value = toTwoDecimals(newValue * 100);
        await existingChart.save({ session });
      } else {
        await managerGrowthChart.create(
          [
            {
              manager: manager._id,
              date: chartDate,
              value: dailyPercent,
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

module.exports = { 
    addTradeToManager,
    getTrades,
    rollOverTradeDistribution
}