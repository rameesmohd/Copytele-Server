const cron = require("node-cron");
const rolloverModel = require("../models/rollover");
const investmentTxModel = require("../models/investmentTx");
const { getNextRolloverTime } = require("../utils/getNextRolloverTime");
const {
  approveDepositTransaction,
  approveWithdrawalTransaction,
} = require("../controllers/master/invController");
const { rollOverTradeDistribution } = require("../controllers/tradeController");

//------------------------------------------------------------
//  PROCESS ONE ROLLOVER
//------------------------------------------------------------
const processRollover = async (rolloverId) => {
  try {
    const rollover = await rolloverModel.findOne({
      _id: rolloverId,
      status: "pending",
    });
    if (!rollover) return console.log("❌ Rollover not found:", rolloverId);

    //------------------------------------------------------------
    // 1️⃣ Profit Distribution
    //------------------------------------------------------------
    const profitDistributed = await rollOverTradeDistribution(rolloverId);


    //------------------------------------------------------------
    // 2️⃣ Fetch pending deposits + withdraws
    //------------------------------------------------------------
    const [pendingDeposits, pendingWithdrawals] = await Promise.all([
      investmentTxModel.find({ status: "pending", type: "deposit" }),
      investmentTxModel.find({ status: "pending", type: "withdrawal" }),
    ]);

    const processedTxnIds = [];

    //------------------------------------------------------------
    // 3️⃣ Approve deposits
    //------------------------------------------------------------
    for (const tx of pendingDeposits) {
      const ok = await approveDepositTransaction(tx._id, rolloverId);
      if (ok) processedTxnIds.push(tx._id);
      else console.log("❌ Deposit failed:", tx._id);
    }

    //------------------------------------------------------------
    // 4️⃣ Approve withdrawals
    //------------------------------------------------------------
    for (const tx of pendingWithdrawals) {
      const ok = await approveWithdrawalTransaction(tx._id, rolloverId);
      if (ok) processedTxnIds.push(tx._id);
      else console.log("❌ Withdrawal failed:", tx._id);
    }


    //------------------------------------------------------------
    // 5️⃣ Save processed transactions & summary
    //------------------------------------------------------------
    rollover.status = "completed";
    rollover.processed_at = new Date();
    rollover.processed_transactions = processedTxnIds;

    rollover.summary = {
      total_deposits: pendingDeposits.length,
      total_withdrawals: pendingWithdrawals.length,
      profit_distributed: Number(profitDistributed || 0),
    };

    await rollover.save();

    // console.log(`✅ Rollover ${rolloverId} completed at ${rollover.processed_at}`);
  } catch (error) {
    console.log("❌ Error during rollover:", error);

    // Update failed status
    await rolloverModel.findByIdAndUpdate(rolloverId, {
      status: "failed",
      failure_reason: error?.message || "Unknown Error",
    });
  }
};



//------------------------------------------------------------
//  CREATE NEW ROLLOVER
//------------------------------------------------------------
const createRollover = async (period) => {
  try {
    const now = new Date();

    const rollover = new rolloverModel({
      period,
      start_time: now,
      status: "pending",
      next_rollover_time: getNextRolloverTime(now, period),
      processed_transactions: [],
      summary: {
        total_deposits: 0,
        total_withdrawals: 0,
        profit_distributed: 0,
      },
    });

    await rollover.save();

    // console.log("🆕 Created rollover:", rollover._id);

    await processRollover(rollover._id);
  } catch (err) {
    console.log("❌ Error creating rollover:", err);
  }
};



//------------------------------------------------------------
//  FETCH LATEST COMPLETED ROLLOVER
//------------------------------------------------------------
const fetchLatestCompletedRollover = async () => {
  const last = await rolloverModel
    .findOne({ status: "completed" })
    .sort({ start_time: -1 });

  if (!last) {
    console.log("ℹ️ No completed rollovers found");
    return null;
  }

  console.log("📌 Latest completed rollover:", last._id);
  return last;
};

//------------------------------------------------------------
//  CRON SCHEDULES
//------------------------------------------------------------

// Every 4 hours, Monday–Friday
cron.schedule("0 */4 * * 1-5", () => {
  console.log("⏱ Running scheduled 4hr rollover");
  createRollover("4hr");
});

// 15-minute testing (enable when needed)
// cron.schedule("*/15 * * * *", () => {
//   createRollover("15min");
//   console.log("🧪 Running test 15min rollover");
// });

module.exports = {
  createRollover,
  processRollover,
  fetchLatestCompletedRollover,
};
