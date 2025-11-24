const investmentTransactionModel = require("../models/investmentTx");
const rolloverModel = require("../models/rollover");
const {
  approveDepositTransaction,
  approveWithdrawalTransaction,
} = require("../controllers/master/invController");
const { rollOverTradeDistribution } = require("../controllers/tradeController");
const mongoose = require("mongoose");

/* -----------------------------------------------------------
   1. Fetch the latest pending rollover (current cycle)
----------------------------------------------------------- */
const fetchAndUseLatestRollover = async () => {
  const rollover = await rolloverModel
    .findOne({ status: "pending" })
    .sort({ start_time: -1 });

  if (!rollover) {
    console.log("⚠ No pending rollover found.");
    return null;
  }

  console.log("🔍 Current Rollover ID:", rollover._id);
  return rollover;
};

/* -----------------------------------------------------------
   2. Approve deposits → distribute trades → approve withdrawals
----------------------------------------------------------- */
const fetchAndApprovePendingInvestmentTransactions = async (rollover_id) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("⚡ Starting rollover execution...");

    // FETCH PENDING TRANSACTIONS IN PARALLEL
    const [pendingDeposits, pendingWithdrawals] = await Promise.all([
      investmentTransactionModel.find({ status: "pending", type: "deposit" }).session(session),
      investmentTransactionModel.find({ status: "pending", type: "withdrawal" }).session(session),
    ]);

    console.log(
      `📥 Pending Deposits: ${pendingDeposits.length} | 📤 Pending Withdrawals: ${pendingWithdrawals.length}`
    );
    
    /* -----------------------------------------
       STEP 1: Distribute trade profits
    ----------------------------------------- */
    console.log("📊 Running trade distribution...");
    await rollOverTradeDistribution(rollover_id, session);

    /* -----------------------------------------
       STEP 2: Approve all deposits first
    ----------------------------------------- */
    for (const tx of pendingDeposits) {
      const ok = await approveDepositTransaction(tx._id, rollover_id, session);
      console.log(`Deposit ${tx._id}: ${ok ? "Approved" : "Failed"}`);
    }

    /* -----------------------------------------
       STEP 3: Approve withdrawals last
    ----------------------------------------- */
    for (const tx of pendingWithdrawals) {
      const ok = await approveWithdrawalTransaction(tx._id, rollover_id, session);
      console.log(`Withdrawal ${tx._id}: ${ok ? "Approved" : "Failed"}`);
    }

    /* -----------------------------------------
       STEP 4: Mark rollover completed
    ----------------------------------------- */
    await rolloverModel.updateOne(
      { _id: rollover_id },
      { $set: { status: "completed", processed_at: new Date() } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    console.log("🎉 Rollover successfully processed!");

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Rollover execution failed:", err);
  }
};

module.exports = {
  fetchAndApprovePendingInvestmentTransactions,
  fetchAndUseLatestRollover,
};
