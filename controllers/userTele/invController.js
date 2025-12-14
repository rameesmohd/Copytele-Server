const investmentModel = require('../../models/investment');
const ManagerModel = require('../../models/manager');
const UserModel = require('../../models/user')
const { default: mongoose } = require('mongoose');
const InvestmentTransaction = require('../../models/investmentTx');
const UserTransaction = require('../../models/userTx');
const BotUserModel = require('../../models/botUsers')

const makeInvestment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { managerId, amount : rawAmt, ref } = req.body;
      const parsed = Number(rawAmt);
      const amount = Math.floor(parsed * 100) / 100;
      const userId = req.user._id;

      if (!userId || !managerId || !amount || amount <= 0) {
        throw new Error("Invalid input data");
      }

      // Fetch user & manager
      const [user, manager] = await Promise.all([
        UserModel.findById(userId).session(session),
        ManagerModel.findById(managerId).session(session),
      ]);

      if (!user || !manager) throw new Error("User or manager not found");


      // Validate balance
      if (amount > user.wallets.main)
        throw new Error("Insufficient wallet balance");

      // Validate minimum investment
      if (amount < manager.min_initial_investment)
        throw new Error(
          `Minimum investment required is $${manager.min_initial_investment}`
        );

      // Deduct from wallet
      await UserModel.findByIdAndUpdate(
        userId,
        { $inc: { "wallets.main": -amount } },
        { session }
      );

      // Generate investment ID
      const invCount = await investmentModel.countDocuments().session(session);

      //Check already existed
      let investment = await investmentModel.findOne({user :user._id ,manager : manager._id })
      
      if(!investment){
          if (user?.login_type === "telegram") {
            await BotUserModel.findOneAndUpdate(
              { id: user.telegram?.id },
              { $set: { is_invested: true } },
              { session, new: true }
          );}

          // Find inviter
          let inviter = null;
          if (ref) {
            inviter = await UserModel.findOne({ user_id: ref }).session(session);
          } else if (user.referral?.referred_by) {
            inviter = await UserModel.findById(user.referral.referred_by).session(session);
          }
          // Create Investment Entry
          const [newInvestment] = await investmentModel.create(
            [
              {
                inv_id: 21234 + invCount,
                user: user._id,
                manager: manager._id,
                manager_nickname: manager.nickname,

                // Manager settings
                trading_interval: manager.trading_interval,
                trading_liquidity_period: manager.trading_liquidity_period,
                min_initial_investment: manager.min_initial_investment,
                min_top_up: manager.min_top_up,
                min_withdrawal: manager.min_withdrawal,
                manager_performance_fee: manager.performance_fees_percentage,

                // Dashboard totals (start empty)
                total_funds: 0,
                total_deposit: 0,
                deposits: [],

                // Referral
                referred_by: inviter ? inviter._id : null,
              },
            ],
            { session }
          );

          investment = newInvestment

          // Referral tracking
          if (inviter && inviter._id.toString() !== user._id.toString()) {
            await UserModel.findByIdAndUpdate(
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
      }

      // Format from/to IDs
      const fromWallet = `WALL_${user.wallets.main_id || "UNKNOWN"}`;
      const toInvestment = `INV_${investment.inv_id}`;

      // USER TRANSACTION → (Wallet transfer)
      await UserTransaction.create(
        [
          {
            user: user._id,
            investment: investment._id,
            type: "transfer",
            status: "completed",
            amount,
            from: fromWallet,
            to: toInvestment,
            description: `To Manager: ${manager.nickname}`
          },
        ],
        { session }
      );

      // INVESTMENT TRANSACTION (Deposit to manager)
      await InvestmentTransaction.create(
        [
          {
            user: user._id,
            manager: manager._id,
            investment: investment._id,
            type: "deposit",
            status: "pending",
            amount,
            from: fromWallet,
            to: toInvestment,
            description: `Deposit to ${manager.nickname}`,
          },
        ],
        { session }
      );

      // Increase manager investor count
      await ManagerModel.findByIdAndUpdate(
        managerId,
        { $inc: { total_investors: 1 } },
        { session }
      );

      return res.status(201).json({
        status : "success",
        msg: "Investment created successfully",
        investmentId: investment._id,
        result: investment,
      });
    });
  } catch (error) {
    console.error("Investment Error:", error);
    return res.status(500).json({
      errMsg: error.message || "Server error",
    });
  } finally {
    session.endSession();
  }
};

const fetchInvestment=async(req,res)=>{
  try {
    const user = req.user._id
    const manager = req.query.manager
    const investment = await investmentModel.findOne({user,manager})

    return res.status(200).json({
      status : "success",
      result: investment,
    });
  } catch (error) {
    console.error("Investment Error:", error);
    return res.status(500).json({
      errMsg: error.message || "Server error",
    });
  }
}

const fetchInvTransactions = async (req, res) => {
  try {
    const user = req.user;
    const { manager } = req.body;

    if ( !manager) {
      return res.status(400).json({
        status: "failed",
        errMsg: "Manager fields are required",
      });
    }

    const transactions = await InvestmentTransaction.find({
      user: user._id,
      manager,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      result: transactions,
    });
  } catch (error) {
    console.error("Investment Error:", error);
    return res.status(500).json({
      errMsg: error.message || "Server error",
    });
  }
};

// safe rounding for finance (2 decimals)
const toTwoDecimals = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n * 100) / 100;
};

const getWithdrawSummary= async(req,res)=> {
  try {
  const {id : investmentId } = req.query
  if (!mongoose.Types.ObjectId.isValid(investmentId)) {
    return res.status(400).json({
      success: false,
      errMsg: "Invalid or missing investmentId",
    });
  }

  const investment = await investmentModel
    .findById(investmentId)
    .lean();

  if (!investment) {
    return res.status(404).json({
      success: false,
      errMsg: "Investment not found",
    });
  }
  
  // Optionally load user if you need wallet ids etc
  const user = await UserModel.findById(investment.user).lean().catch(() => null);

  // Basic fields (defensive)
  const deposits = Array.isArray(investment.deposits) ? investment.deposits : [];
  const now = new Date();

  // Determine liquidity period in days. Prefer investment.trading_liquidity_period,
  // fallback to deposit.lock_duration for each deposit if present.
  const liquidityDays = Number(investment.trading_liquidity_period) || null;

  // Helper: is a single deposit locked?
  const isDepositLocked = (deposit) => {
    // If deposit has explicit unlocked_at, use it
    if (deposit.unlocked_at) {
      const unlockedAt = new Date(deposit.unlocked_at);
      return unlockedAt > now;
    }

    // if deposit has lock_duration field (days) use that
    if (deposit.lock_duration) {
      const depositedAt = new Date(deposit.deposited_at || deposit.depositedAt || deposit.createdAt);
      if (!depositedAt || isNaN(depositedAt.getTime())) return false;
      const unlock = new Date(depositedAt);
      unlock.setDate(unlock.getDate() + Number(deposit.lock_duration || 0));
      return unlock > now;
    }

    // otherwise, if investment-level liquidityDays provided, compute from deposited_at
    if (liquidityDays != null) {
      const depositedAt = new Date(deposit.deposited_at || deposit.depositedAt || deposit.createdAt);
      if (!depositedAt || isNaN(depositedAt.getTime())) return false;
      const unlock = new Date(depositedAt);
      unlock.setDate(unlock.getDate() + Number(liquidityDays));
      return unlock > now;
    }

    // default: not locked
    return false;
  };

  // Sum total deposits
  const totalDeposits = toTwoDecimals(
    deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0)
  );

  // Partition deposits into locked/unlocked
  let depositsLocked = 0;
  const lockedDepositsArr = [];
  const unlockedDepositsArr = [];

  for (const d of deposits) {
    const amt = Number(d.amount) || 0;
    if (isDepositLocked(d)) {
      depositsLocked += amt;
      lockedDepositsArr.push({
        amount: toTwoDecimals(amt),
        deposited_at: d.deposited_at || d.createdAt,
        unlocked_at: d.unlocked_at || null,
        lock_duration: d.lock_duration || liquidityDays || null,
      });
    } else {
      unlockedDepositsArr.push({
        amount: toTwoDecimals(amt),
        deposited_at: d.deposited_at || d.createdAt,
        unlocked_at: d.unlocked_at || null,
        lock_duration: d.lock_duration || liquidityDays || null,
      });
    }
  }

  depositsLocked = toTwoDecimals(depositsLocked);
  const depositsUnlocked = toTwoDecimals(totalDeposits - depositsLocked);

  // Use stored fields when available
  const totalFunds = toTwoDecimals(investment.total_funds || investment.total_equity || 0);

  // totalProfit: prefer closed_trade_profit if present; add open_trade_profit if you want
  const closedProfit = Number(investment.closed_trade_profit || investment.total_trade_profit || 0);
  const openProfit = Number(investment.open_trade_profit || 0);
  const totalProfit = toTwoDecimals(closedProfit + openProfit);

  // current interval profit (liquid profit that can be used depending on rules)
  const currentIntervalProfit = toTwoDecimals(investment.current_interval_profit_equity || investment.current_interval_profit || 0);

  // Projected performance fee (if stored)
  const performanceFeeProjected = toTwoDecimals(investment.performance_fee_projected || 0);

  // // Withdrawable calculation:
  // // Basic rule used in your code: withdrawable = totalFunds - depositsLocked
  // // (This prevents withdrawing locked principal)
  // let withdrawableBalance = toTwoDecimals(totalFunds - depositsLocked);
  // if (withdrawableBalance < 0) withdrawableBalance = 0;

  // // Optionally, determine how much of withdrawable is profit vs principal:
  // // We estimate principal still locked/available by comparing totalDeposits and depositsLocked.
  // // - Unlocked principal available = min(depositsUnlocked, totalFunds)
  // // - Profit portion of withdrawable = withdrawable - unlocked principal used
  // const unlockedPrincipalAvailable = Math.min(depositsUnlocked, totalFunds);
  // const profitAvailableEstimate = toTwoDecimals(Math.max(0, withdrawableBalance - unlockedPrincipalAvailable));

  // // Safety: if profitAvailableEstimate is tiny negative because of floats, floor to 0
  // const profitAvailable = profitAvailableEstimate < 0 ? 0 : profitAvailableEstimate;

  // Locked principal
  const lockedPrincipal = depositsLocked;

  // Locked profit (current interval)
  const lockedProfit = currentIntervalProfit;

  // Withdrawable = total funds - locked principal - locked profit
  let withdrawableBalance = toTwoDecimals(
    totalFunds - lockedPrincipal - lockedProfit
  );

  if (withdrawableBalance < 0) withdrawableBalance = 0;

  // Unlocked principal available = min(depositsUnlocked, totalFunds)
  const unlockedPrincipalAvailable = Math.min(depositsUnlocked, totalFunds);

  // Profit available = withdrawable portion - principal portion used
  let profitAvailable = withdrawableBalance - unlockedPrincipalAvailable;
  if (profitAvailable < 0) profitAvailable = 0;
  profitAvailable = toTwoDecimals(profitAvailable);

  // Build a friendly response
  const result = {
    investmentId: investment._id,
    userId: investment.user,
    totalDeposits,
    depositsLocked,
    depositsUnlocked,
    lockedDepositsList: lockedDepositsArr,
    unlockedDepositsList: unlockedDepositsArr,
    totalFunds,
    totalProfit,
    currentIntervalProfit,
    performanceFeeProjected,
    lockedProfit: toTwoDecimals(lockedProfit),
    withdrawableBalance,
    profitAvailable,
    unlockedPrincipalAvailable: toTwoDecimals(unlockedPrincipalAvailable),
    liquidityDays: liquidityDays || null,
    // helpful flags
    isFullyLocked: withdrawableBalance <= 0,
    timestamp: new Date().toISOString(),
  };

  return res.status(200).json({
    success : true,
    result,
  })
  } catch (error) {
    console.log(error);
    res.status(500).json({success: false,errMsg : "Server Error",error})
  }
}

// Helper function to calculate the date N trading days ago (only weekdays considered)
const getDateNTradingDaysAgo=(n)=> {
  let targetDate = new Date();
  let daysCount = 0;

  while (daysCount < n) {
    targetDate.setDate(targetDate.getDate() - 1);
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysCount++;
    }
  }
  return targetDate;
}

const getDepositsInLastTradingDays = (investment) => {
  if (!investment) throw new Error("Investment not found.");

  const startDate = getDateNTradingDaysAgo(
    investment.trading_liquidity_period
  );

  const recentDeposits = (investment.deposits || []).filter((d) => {
    const dt = new Date(d.deposited_at);
    return dt >= startDate;
  });

  const totalRecentDeposits = recentDeposits.reduce(
    (sum, d) => sum + Number(d.amount || 0),
    0
  );

  return { totalRecentDeposits, recentDeposits };
};

const handleInvestmentWithdrawal = async (req, res) => {
  try {
    const { id: investmentId, amount: rawAmount } = req.body;
    const userId = req.user._id

    const amount = toTwoDecimals(rawAmount);
    if (!amount || amount <= 0)
      return res.status(400).json({ errMsg: "Invalid withdrawal amount." });

    const investment = await investmentModel.findById(investmentId);
    if (!investment)
      return res.status(400).json({ errMsg: "Investment not found." });
    
    const user = await UserModel.findById(userId);

    if (!user)
      return res.status(400).json({ errMsg: "User not found." });

    /** -----------------------------------------
     * Calculate liquidity-locked deposits
     * ----------------------------------------- */
    const { totalRecentDeposits } = getDepositsInLastTradingDays(investment);

    const availableEquity = toTwoDecimals(
        Number(investment.total_equity) -
        Number(totalRecentDeposits) -
        Number(investment.current_interval_profit)
      );

    // Format from/to IDs
    const fromInvestment = `INV_${investment.inv_id}`;
    const toWallet = `WALL_${user.wallets.main_id || "UNKNOWN"}`;

    /** -----------------------------------------
     * CASE 1: Amount is available (unlocked equity)
     * ----------------------------------------- */
    if (amount <= availableEquity) {
      
      const tx = new InvestmentTransaction({
        user: investment.user,
        investment: investment._id,
        manager: investment.manager,
        from: fromInvestment,
        to: toWallet,
        type: "withdrawal",
        status: "pending",
        amount,
        comment: "",
      });

      await tx.save();

      await investmentModel.findByIdAndUpdate(investment._id, {
        $inc: {
          total_withdrawal: amount,
          total_equity: -amount,
        },
      });

      return res.status(200).json({ msg: "Withdrawal processed successfully." });
    }

    /** -----------------------------------------
     * CASE 2: Liquidity period blocks withdrawal
     * User has funds, but recent deposits are locked
     * ----------------------------------------- */
    if (amount > Number(availableEquity)) {
      const rejectTx = new InvestmentTransaction({
        user: investment.user,
        investment: investment._id,
        manager: investment.manager,
        type: "withdrawal",
        status: "failed",
        from: fromInvestment,
        to: toWallet,
        amount,
        comment: `Liquidity Period is active`,
      });

      await rejectTx.save();

      return res
        .status(200)
        .json({ errMsg: "Liquidity Period is active", blocked: true });
    }

    /** -----------------------------------------
     * CASE 3: Insufficient total funds
     * ----------------------------------------- */
    return res
      .status(400)
      .json({ 
        success : false, 
        errMsg: "Insufficient balance to withdraw." 
    });

  } catch (err) {
    console.error("Withdrawal error:", err);
    return res.status(500).json({
      errMsg: "Server error.",
      error: err.message,
    });
  }
};

const approveWithdrawalTransaction = async (withdrawTransactionId, rollover_id) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawTx = await InvestmentTransaction.findById(withdrawTransactionId)
      .session(session);

    if (!withdrawTx) {
      console.log("Withdrawal Transaction not found");
      await session.abortTransaction();
      return false;
    }

    const userData = await UserModel.findById(withdrawTx.user).session(session);
    if (!userData) {
      console.log("User not found");
      await session.abortTransaction();
      return false;
    }

    const investment = await investmentModel.findById(withdrawTx.investment)
      .session(session);
    if (!investment) {
      console.log("Investment not found");
      await session.abortTransaction();
      return false;
    }

    const amount = Number(withdrawTx.amount);
    const performanceFee = Number(withdrawTx.deduction || 0);
    const isDeducted = withdrawTx.is_deducted;

    let finalAmount = amount;

    /** -----------------------------------------
     * Deduct Manager Performance Fee
     * ----------------------------------------- */
    if (performanceFee > 0 && !isDeducted) {
      finalAmount -= performanceFee;

      const feeTx = new InvestmentTransaction({
        user: userData._id,
        investment: investment._id,
        manager: investment.manager,
        type: "manager_fee",
        status: "success",
        amount: performanceFee,
        rollover_id: rollover_id,
        comment: `Perf fee ${performanceFee} deducted`,
      });

      await feeTx.save({ session });
    }

    /** -----------------------------------------
     * Add Funds to User Wallet
     * ----------------------------------------- */
    userData.wallets.main += finalAmount;

    const manager = await ManagerModel.find({_id : investment.manager})
    /** -----------------------------------------
     * Create User Transaction Record
     * ----------------------------------------- */
    const userTransaction = new UserTransaction({
      user: userData._id,
      investment: investment._id,
      type: "transfer",
      status: "completed",
      from: `INV_${investment.inv_id}`,
      to: `WALL_${userData.wallets.main_id}`,
      amount: finalAmount,
      transaction_id: withdrawTx.transaction_id,
      related_transaction: withdrawTx._id,
      description: `From Manager: ${manager.nickname}`,
    });

    /** -----------------------------------------
     * Mark Withdrawal Transaction As Success
     * ----------------------------------------- */
    withdrawTx.status = "success";

    /** -----------------------------------------
     * Save All in Single Atomic Transaction
     * ----------------------------------------- */
    await Promise.all([
      withdrawTx.save({ session }),
      userData.save({ session }),
      userTransaction.save({ session })
    ]);

    await session.commitTransaction();
    session.endSession();

    console.log("Withdrawal processed successfully.");
    return true;
  } catch (err) {
    console.error("Transaction error:", err);
    await session.abortTransaction();
    session.endSession();
    return false;
  }
};

module.exports={
    makeInvestment,
    fetchInvestment,
    fetchInvTransactions,

//============Withdrawal from Investment=================
    getWithdrawSummary,
    handleInvestmentWithdrawal,
    approveWithdrawalTransaction
}