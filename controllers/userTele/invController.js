const investmentModel = require('../../models/investment');
const managerModel = require('../models/manager');
const { default: mongoose } = require('mongoose');
const InvestmentTransaction = require('../../models/investmentTx');
const UserTransaction = require('../../models/userTx');

const makeDeposit = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {

      const { managerId, amount, ref } = req.body;
      const userId = req.user._id;

      if (!userId || !managerId || !amount || amount <= 0) {
        throw new Error("Invalid input data");
      }

      // Fetch user + manager
      const [user, manager] = await Promise.all([
        userModel.findById(userId).session(session),
        managerModel.findById(managerId).session(session),
      ]);

      if (!user || !manager) {
        throw new Error("User or manager not found");
      }

      // Check balance
      if (amount > user.wallets.main) {
        throw new Error("Insufficient balance");
      }

      // Check minimum investment
      if (amount < manager.min_initial_investment) {
        throw new Error(
          `Minimum investment is $${manager.min_initial_investment}`
        );
      }

      // Deduct from user wallet
      await userModel.findByIdAndUpdate(
        userId,
        {
          $inc: { "wallets.main": -amount },
        },
        { session }
      );

      // Count current investments for unique ID generation
      const invCount = await investmentModel.countDocuments().session(session);

      // Identify inviter
      let inviter = null;
      if (ref) {
        inviter = await userModel.findOne({ user_id: ref }).session(session);
      } else if (user.referral?.referred_by) {
        inviter = await userModel.findById(user.referral.referred_by).session(session);
      }

      // Create investment
      const investmentData = {
        inv_id: 21000 + invCount,
        user: user._id,
        manager: manager._id,
        manager_nickname: manager.nickname,
        trading_interval: manager.trading_interval,
        min_initial_investment: manager.min_initial_investment,
        min_top_up: manager.min_top_up,
        trading_liquidity_period: manager.trading_liquidity_period,
        min_withdrawal: manager.min_withdrawal,

        // totals start at zero
        total_funds: 0,
        total_deposit: 0,

        // fees
        manager_performance_fee: manager.performance_fees_percentage,

        // deposits list empty initially
        deposits: [],

        // referral tracking
        referred_by: inviter ? inviter._id : null,
      };

      const [investment] = await investmentModel.create([investmentData], {
        session,
      });

      // Add referral investment entry
      if (inviter && inviter._id.toString() !== user._id.toString()) {
        await userModel.findByIdAndUpdate(
          inviter._id,
          {
            $push: {
              "referral.investments": {
                investment_id: investment._id,
                rebate_received: 0,
              },
            },
          },
          { session }
        );
      }

      // Create user transaction (WALLET → INVESTMENT)
      await UserTransaction.create(
        [
          {
            user: user._id,
            investment: investment._id,
            type: "transfer",
            status: "completed",
            amount,
            description: `Transferred $${amount} to investment manager ${manager.nickname}`,
            payment_mode: "main-wallet",
          },
        ],
        { session }
      );

      // Create investment transaction entry
      await InvestmentTransaction.create(
        [
          {
            user: user._id,
            manager: manager._id,
            investment: investment._id,
            type: "deposit",
            status: "pending",
            amount,
            description: `Initial investment to manager ${manager.nickname}`,
          },
        ],
        { session }
      );

      // Increment manager's total investors
      await managerModel.findByIdAndUpdate(
        managerId,
        { $inc: { total_investors: 1 } },
        { session }
      );

      return res.status(201).json({
        msg: "Investment created successfully",
        investmentId: investment._id,
        result: investment,
      });
    });
  } catch (error) {
    console.error("Deposit error:", error);
    return res.status(500).json({
      errMsg: error.message || "Server error",
    });
  } finally {
    session.endSession();
  }
};


module.exports={
    makeDeposit
}