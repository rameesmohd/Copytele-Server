// controllers/intervalController.js
const managerModel = require('../models/manager');
const investmentModel = require('../models/investment');
const investmentTransactionModel = require('../models/investmentTx');
const userModel = require('../models/user');
const rebateTransactionModel = require('../models/rebateTx');
const intervalModel = require('../models/interval');
const { default: mongoose } = require('mongoose');
const { toTwoDecimals } = require('../utils/decimal');

/* ============================================================================
   WEEKLY SETTLEMENT LOGIC - intervalHandle
   Accepts an optional intervalId to update the correct interval document.
============================================================================ */
const intervalHandle = async (intervalId = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Fetching weekly managers...");
    // find managers with weekly interval
    const managers = await managerModel
      .find({ trading_interval: "weekly" })
      .session(session);

    const managerIds = managers.map((m) => m._id);

    // fetch all investments for these managers in one go
    const investments = await investmentModel
      .find({ manager: { $in: managerIds } })
      .session(session);

    if (!investments.length) {
      // update interval processed count to 0 if intervalId provided
      if (intervalId) {
        await intervalModel.updateOne(
          { _id: intervalId },
          { total_investments_processed: 0 },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();
      console.log("No investments found for weekly managers.");
      return;
    }

    // Build map of inviters to avoid N+1 queries
    const inviterIds = [
      ...new Set(
        investments
          .filter((inv) => inv.referred_by)
          .map((inv) => String(inv.referred_by))
      ),
    ];

    const inviters = inviterIds.length
      ? await userModel.find({ _id: { $in: inviterIds } }).session(session)
      : [];
    const inviterMap = Object.fromEntries(inviters.map((u) => [String(u._id), u]));

    const processed = new Set();

    const investmentUpdates = [];
    const managerUpdates = [];
    const inviterUpdates = [];
    const feeTransactions = [];
    const rebateTransactions = [];

    let processedCount = 0;
    const updatedManagerSet = new Set();

    for (const inv of investments) {
      // de-dup
      if (processed.has(String(inv._id))) continue;
      processed.add(String(inv._id));

      const profit = toTwoDecimals(inv.current_interval_profit_equity);
      const perfFee = toTwoDecimals(inv.performance_fee_projected);

      if (profit === 0 && perfFee === 0) continue;

      processedCount++;

      const netProfit = toTwoDecimals(profit - perfFee);

      // --------------------- INVITER REBATE ---------------------
      let inviterShare = 0;
      let adjustedPerfFee = perfFee;

      if (inv.referred_by) {
        const inviter = inviterMap[String(inv.referred_by)];
        if (inviter && perfFee > 0) {
          inviterShare = toTwoDecimals(perfFee / 3); // 33% rebate (as you used)
          adjustedPerfFee = toTwoDecimals(perfFee - inviterShare);

          inviterUpdates.push({
            updateOne: {
              filter: { _id: inviter._id },
              update: {
                $inc: {
                  "wallets.rebate": inviterShare,
                  "referral.total_earned_commission": inviterShare,
                },
              },
            },
          });

          rebateTransactions.push({
            user: inviter._id,
            investment: inv._id,
            type: "commission",
            status: "approved",
            amount: inviterShare,
            description: `Weekly rebate distributed`,
          });
        }
      }

      // --------------------- UPDATE INVESTMENT ---------------------
      investmentUpdates.push({
        updateOne: {
          filter: { _id: inv._id },
          update: {
            $inc: {
              total_equity: netProfit,
              net_profit: netProfit,
              performance_fee_paid: perfFee,
            },
            $set: {
              performance_fee_projected: 0,
              current_interval_profit_equity: 0,
              current_interval_profit: 0,
            },
          },
        },
      });

      // --------------------- UPDATE MANAGER ---------------------
      managerUpdates.push({
        updateOne: {
          filter: { _id: inv.manager },
          update: {
            $inc: { total_performance_fee_collected: adjustedPerfFee },
          },
        },
      });

      // create manager fee transaction
      feeTransactions.push({
        user: inv.user,
        investment: inv._id,
        type: "manager_fee",
        status: "success",
        amount: perfFee,
        comment: `Performance fee deducted (${perfFee})`,
      });

      updatedManagerSet.add(String(inv.manager));
    }

    // --------------------- BULK EXECUTION ---------------------
    const jobs = [];

    if (investmentUpdates.length)
      jobs.push(investmentModel.bulkWrite(investmentUpdates, { session }));

    if (managerUpdates.length)
      jobs.push(managerModel.bulkWrite(managerUpdates, { session }));

    if (inviterUpdates.length)
      jobs.push(userModel.bulkWrite(inviterUpdates, { session }));

    if (feeTransactions.length)
      jobs.push(investmentTransactionModel.insertMany(feeTransactions, { session }));

    if (rebateTransactions.length)
      jobs.push(rebateTransactionModel.insertMany(rebateTransactions, { session }));

    // Execute all at once
    await Promise.all(jobs);

    // --------------------- RECALCULATE total_return for affected managers ---------------------
    const updatedManagerIds = Array.from(updatedManagerSet);
    if (updatedManagerIds.length) {
      const mgrs = await managerModel
        .find({ _id: { $in: updatedManagerIds } })
        .session(session);

      const bulkReturnUpdates = [];
      for (const m of mgrs) {
        const deposit = Number(m.total_deposit) || 0;
        const tradeProfit = Number(m.total_trade_profit) || 0;

        const totalReturn = deposit > 0 ? toTwoDecimals((tradeProfit / deposit) * 100) : 0;

        bulkReturnUpdates.push({
          updateOne: {
            filter: { _id: m._id },
            update: { $set: { total_return: totalReturn } },
          },
        });
      }

      if (bulkReturnUpdates.length) {
        await managerModel.bulkWrite(bulkReturnUpdates, { session });
      }
    }

    // --------------------- UPDATE INTERVAL RECORD (if provided) ---------------------
    if (intervalId) {
      await intervalModel.updateOne(
        { _id: intervalId },
        { total_investments_processed: processedCount },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    console.log("✔ Weekly interval settlement completed. Processed:", processedCount);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Interval handling failed:", error);
    throw error;
  }
};

/* ============================================================================
   CREATE NEW WEEKLY INTERVAL AND RUN SETTLEMENT
   - returns the created interval doc
============================================================================ */
const handleInterval = async () => {
  // Close last pending interval (if any)
  const existing = await intervalModel
    .findOne({ status: "pending" })
    .sort({ createdAt: -1 });

  if (existing) {
    existing.status = "completed";
    await existing.save();
  }

  // Compute weekly dates (Sunday..Saturday UTC)
  const today = new Date();
  const dow = today.getUTCDay(); // Sunday = 0

  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - dow);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  // Label like "Nov 23–29 2025"
  const label = `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}–${end.toLocaleDateString("en-US", {
    day: "numeric",
  })} ${start.getUTCFullYear()}`;

  // Compute week index (ISO-like simple week index)
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((today - yearStart) / 86400000 + yearStart.getUTCDay() + 1) / 7);
  const intervalIndex = `${today.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;

  // Create new interval (pending) and pass its id to settlement
  const newInterval = await intervalModel.create({
    period: "weekly",
    status: "pending",
    current_interval_start: start,
    current_interval_end: end,
    current_intervel: label,
    interval_index: intervalIndex,
    total_investments_processed: 0,
  });

  // Run settlement for this new interval (pass id so processedCount writes back)
  await intervalHandle(newInterval._id);

  return newInterval;
};

/* ============================================================================
   TEST API wrapper
============================================================================ */
const intervalInvestmentHandle = async (req, res) => {
  try {
    const newInterval = await handleInterval();
    res.status(200).json({ msg: "Interval investment handling completed successfully", interval: newInterval });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errMsg: "Server side error", error: error.message });
  }
};

module.exports = {
  intervalInvestmentHandle,
  handleInterval,
  intervalHandle,
};
