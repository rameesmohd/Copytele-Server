const investmentModel = require('../../models/investment');
const investmentTransactionModel = require('../../models/investmentTx');
const userTransactionModel = require('../../models/userTx');
const userModel = require('../../models/user')
const managerModel = require('../../models/manager');
const investmentTradesModel =require('../../models/investmentTrades');
const rolloverModel = require('../../models/rollover');
const { default: mongoose } = require('mongoose');

// Common helper (use truncation as you preferred)
const toTwoDecimals = (value) => {
  const n = Number(value);
  if (isNaN(n)) return 0;
  return Math.floor(n * 100) / 100;
};

/**
 * Approve deposit transaction (atomic, retries on write-conflict)
 * - transactionId: investmentTransaction _id
 * - rollover_id: optional rollover id to attach
 */
const approveDepositTransaction = async (transactionId, rollover_id) => {
  let retries = 3;

  while (retries > 0) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Atomically mark transaction approved (only if still pending)
        const transaction = await investmentTransactionModel.findOneAndUpdate(
          { _id: transactionId, status: "pending" },
          { status: "success", rollover_id },
          { session, new: true }
        );

        if (!transaction) {
          // Nothing to do (already approved or missing)
          throw new Error("Transaction not found or already processed");
        }

        // Load investment (must exist)
        const investment = await investmentModel.findById(transaction.investment).session(session);
        if (!investment) throw new Error("Investment not found");

        // Prepare deposit entry with truncation
        const depositAmount = toTwoDecimals(transaction.amount || 0);
        let depositObj = {};

        if(transaction.kind=="bonus"){
           depositObj = {
            amount: depositAmount,
            lock_duration: null,
            deposited_at: new Date(),
            kind: "bonus",
            unlocked_at: undefined, // your DepositSchema default will compute unlocked_at
          };
        } else{
          // Prepare deposit entry with truncation
          depositObj = {
            amount: depositAmount,
            lock_duration: investment.trading_liquidity_period,
            deposited_at: new Date(),
            kind : "cash",
            unlocked_at: undefined, // your DepositSchema default will compute unlocked_at
          };
        }

        // Update investment: add deposit and increment totals (use total_equity & total_deposit)
        await investmentModel.findByIdAndUpdate(
          investment._id,
          {
            $inc: {
              total_equity: depositAmount,
              total_deposit: depositAmount,
            },
            $push: { deposits: depositObj },
            $set: { last_rollover: rollover_id },
          },
          { session }
        );

        // Fetch manager and determine if this user is a new investor for that manager
        const manager = await managerModel.findById(investment.manager).session(session);
        if (!manager) throw new Error("Manager not found");

        // Check if there are OTHER investments for this user & manager (excluding current investment)
        const otherInvestmentsCount = await investmentModel.countDocuments({
          manager: manager._id,
          user: investment.user,
          _id: { $ne: investment._id },
        }).session(session);

        const isNewInvestor = otherInvestmentsCount === 0;

        // Update manager totals
        const managerInc = { total_funds: depositAmount,total_deposit : depositAmount };
        if (isNewInvestor) managerInc.total_investors = 1;

        await managerModel.findByIdAndUpdate(
          manager._id,
          { $inc: managerInc },
          { session }
        );

        // Optionally: you might want to record processed transaction id into rollover (handled by caller)
      });

      session.endSession();
      return true;
    } catch (error) {
      // endSession before possibly retrying
      session.endSession();

      // Write conflict -> retry
      if (error && error.codeName === "WriteConflict") {
        retries--;
        console.log(`Write conflict - retrying deposit approve. Attempts left: ${retries}`);
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      // Not retryable
      console.error("approveDepositTransaction failed:", error.message || error);
      return false;
    }
  }

  console.log("approveDepositTransaction failed after retries.");
  return false;
};

/**
 * Approve withdrawal transaction (atomic)
 * - withdrawTransactionId: investmentTransaction _id
 * - rollover_id: optional rollover id to attach
 *
 * NOTE: This function includes a temporary "always reject" switch. Set `TEMP_ALL_REJECT = false`
 * to enable the real processing flow.
 */
const approveWithdrawalTransaction = async (withdrawTransactionId, rollover_id) => {
  const TEMP_ALL_REJECT = false; // flip to "true" if you want temporary global rejection

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const withdrawTransaction = await investmentTransactionModel.findOne({ _id: withdrawTransactionId }).session(session);
      if (!withdrawTransaction) {
        throw new Error("Withdrawal transaction not found.");
      }

      const investment = await investmentModel.findById(withdrawTransaction.investment).session(session);
      if (!investment) throw new Error("Linked investment not found.");

      const user = await userModel.findById(withdrawTransaction.user).session(session);
      if (!user) throw new Error("User not found.");

      // Temporary global reject flag
      if (TEMP_ALL_REJECT) {
        withdrawTransaction.status = "rejected";
        withdrawTransaction.comment = `Unsettled provider credit.`;
        await withdrawTransaction.save({ session });
        throw new Error("Temporary global rejection enabled"); // aborts transaction and returns false below
      }

      // Numeric handling
      const amount = toTwoDecimals(withdrawTransaction.amount || 0);
      const deduction = toTwoDecimals(withdrawTransaction.deduction || 0);
      const alreadyDeducted = !!withdrawTransaction.is_deducted;

      let finalAmount = amount;

      // If there is a performance fee deduction and not yet deducted, create fee tx and subtract
      if (deduction > 0 && !alreadyDeducted) {
        finalAmount = toTwoDecimals(amount - deduction);

        // Create performance fee transaction (manager fee)
        const feeTx = new investmentTransactionModel({
          user: withdrawTransaction.user,
          investment: investment._id,
          manager: investment.manager,
          type: "manager_fee",
          status: "success",
          amount: deduction,
          rollover_id,
          comment: `Performance fee of ${deduction} deducted`,
        });

        await feeTx.save({ session });

        // Mark original withdraw tx as deduction-applied so we don't double deduct
        withdrawTransaction.is_deducted = true;
        withdrawTransaction.deduction = deduction;
      }

      // Update user's wallet balances - use your stored wallets schema (wallets.main)
      // ensure property exists
      if (!user.wallets) user.wallets = { main: 0, rebate: 0, main_id: undefined, rebate_id: undefined };

      user.wallets.main = toTwoDecimals((user.wallets.main || 0) + finalAmount);

      // Create user transaction record (userTransactionModel shape may vary in your app)
      const userTx = new userTransactionModel({
        user: user._id,
        investment: investment._id,
        type: "transfer",
        status: "completed",
        from: `INV_${investment.inv_id}`,
        to: `WALL_${user.wallets.main_id || "UNKNOWN"}`,
        amount: finalAmount,
        transaction_id: withdrawTransaction.transaction_id,
        related_transaction: withdrawTransaction._id,
        description: `Withdraw from investment ${investment.inv_id}`,
        transaction_type: "investment_transactions",
        createdAt: new Date(),
      });

      // Mark withdrawal as approved and attach rollover id
      withdrawTransaction.status = "success";
      withdrawTransaction.rollover_id = rollover_id;

      // Save all in the same session
      await Promise.all([
        withdrawTransaction.save({ session }),
        user.save({ session }),
        userTx.save({ session }),
      ]);

      // Optionally you might want to decrement investment.total_equity or total_withdrawal and update manager totals
      // await investmentModel.findByIdAndUpdate(
      //   investment._id,
      //   {
      //     $inc: { total_withdrawal: finalAmount, total_equity: -finalAmount },
      //   },
      //   { session }
      // );
 
      // Update manager totals
      await managerModel.findByIdAndUpdate(
        investment.manager,
        { $inc: { total_funds: -finalAmount } },
        { session }
      );
    });

    session.endSession();
    return true;
  } catch (error) {
    session.endSession();

    // If we intentionally triggered temporary rejection, we'll get here with that error
    if (error && error.message === "Temporary global rejection enabled") {
      console.log("Withdrawal temporarily rejected by admin flag.");
      return false;
    }

    console.error("approveWithdrawalTransaction failed:", error.message || error);
    return false;
  }
};

module.exports = {
    approveDepositTransaction,
    approveWithdrawalTransaction,
}