const investmentModel = require('../../models/investment');
const investmentTransactionModel = require('../../models/investmentTx');
const userTransactionModel = require('../../models/userTx');
const userModel = require('../../models/user')
const managerModel = require('../../models/manager');
const investmentTradesModel =require('../../models/invTrades');
const rolloverModel = require('../../models/rollover');
const { default: mongoose } = require('mongoose');

const getLatestPendingRollover = async () => {
  const latestRollover = await rolloverModel.findOne({ status: "completed" }).sort({ start_time: -1 });
  console.log(latestRollover);
  
  return latestRollover;
};

const fetchAndUseLatestRollover = async () => {
  const latestPendingRollover = await getLatestPendingRollover();
  if (!latestPendingRollover) {
    console.log("No rollovers found!");
    return;
  }
  console.log("Latest Rollover ID:", latestPendingRollover._id);
  return latestPendingRollover
};

const makeDeposit = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { userId, managerId, amount, ref } = req.body;

      if (!userId || !managerId || amount <= 0) {
        throw new Error("Invalid input data!");
      }

      // Fetch user and manager
      const [user, manager] = await Promise.all([
        userModel.findById(userId).session(session),
        managerModel.findById(managerId).session(session),
      ]);

      if (!user || !manager) {
        throw new Error("Invalid credentials!");
      }

      if (amount > user.my_wallets.main_wallet) {
        throw new Error("Insufficient balance.");
      }

      if (amount < manager.min_initial_investment) {
        throw new Error(`Minimum investment is ${manager.min_initial_investment} USD.`);
      }

      // Deduct user balance
      await userModel.findByIdAndUpdate(userId, {
        $inc: { "my_wallets.main_wallet": -amount },
      }, { session });

      // Count investments
      const invCount = await investmentModel.countDocuments({}, { session });

      // Find inviter
      let inviter = null;
      if (ref) {
        inviter = await userModel.findOne({ user_id: ref }).session(session);
      } else if (user.referral.referred_by) {
        inviter = user.referral.referred_by;
      }

      // Create investment entry
      const investment = await investmentModel.create(
        [{
          inv_id: 21000 + invCount,
          user: user._id,
          manager: manager._id,
          manager_nickname: manager.nickname,
          total_funds: 0,
          trading_interval: manager.trading_interval,
          min_initial_investment: manager.min_initial_investment,
          min_top_up: manager.min_top_up,
          trading_liquidity_period: manager.trading_liquidity_period,
          total_deposit: 0,
          manager_performance_fee: manager.performance_fees_percentage,
          min_withdrawal: manager.min_withdrawal,
          deposits: [],
          referred_by: inviter ? inviter._id : null,
        }],
        { session }
      );

      // Handle Referral
      if (inviter && inviter._id.toString() !== user._id.toString()) {
        await userModel.findByIdAndUpdate(inviter._id, {
          $push: {
            "referral.investments": {
              investment_id: investment[0]._id,
              rebate_received: 0,
            },
          },
        }, { session });
      }

      // Create transactions
      const userTransaction = new userTransactionModel({
        user: user._id,
        investment: investment[0]._id,
        type: "transfer",
        status: "approved",
        amount: amount,
        from: `WALL${user.my_wallets.main_wallet_id || "UNKNOWN"}`,
        to: `INV${investment[0].inv_id || "UNKNOWN"}`,
        description: `Transferred to investment manager ${manager.nickname}.`,
        transaction_type: "investment_transactions",
      });

      const investmentTransaction = new investmentTransactionModel({
        user: user._id,
        investment: investment[0]._id,
        manager: manager._id,
        type: "deposit",
        status: "pending",
        from: `WALL${user.my_wallets.main_wallet_id || "UNKNOWN"}`,
        to: `INV${investment[0].inv_id || "UNKNOWN"}`,
        amount: amount,
        description: `Initial investment to manager ${manager.nickname}'s portfolio.`,
        related_transaction: userTransaction._id,
      });

      await Promise.all([
        userTransaction.save({ session }),
        investmentTransaction.save({ session }),
      ]);

      // Update manager's total investors count
      await managerModel.findByIdAndUpdate(managerId, {
        $inc: { total_investors: 1 },
      }, { session });

      return res.status(201).json({
        result: investment[0],
        investmentId: investment[0]._id,
        msg: "Investment created successfully!",
      });
    });

  } catch (error) {
    console.error("Deposit error:", error);
    return res.status(500).json({ errMsg: "Server error!", error: error.message });

  } finally {
    session.endSession();
  }
};

const approveDepositTransaction = async (transactionId, rollover_id) => {
  let retries = 3;

  while (retries > 0) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Atomically find & approve transaction
        const transaction = await investmentTransactionModel.findOneAndUpdate(
          { _id: transactionId, status: "pending" },
          { status: "approved", rollover_id },
          { session, new: true }
        );

        if (!transaction) {
          console.log("Transaction not found or already approved");
          throw new Error("Transaction not found");
        }

        // Fetch investment
        const investment = await investmentModel.findById(transaction.investment).session(session);
        if (!investment) throw new Error("Investment not found");

        // Create deposit object
        const deposit = {
          amount: transaction.amount,
          lock_duration: investment.trading_liquidity_period,
          deposited_at: new Date(),
        };

        // Update investment fields
        await investmentModel.findByIdAndUpdate(investment._id, {
          $inc: { total_funds: transaction.amount, total_deposit: transaction.amount },
          $push: { deposits: deposit }
        }, { session });

        // Fetch and update manager
        const manager = await managerModel.findById(investment.manager).session(session);
        if (!manager) throw new Error("Manager not found");

        const isNewInvestor = !(await investmentModel.exists({ manager: manager._id, user: investment.user }));

        await managerModel.findByIdAndUpdate(manager._id, {
          $inc: { total_funds: transaction.amount, ...(isNewInvestor && { total_investors: 1 }) }
        }, { session });
      });

      session.endSession();
      return true;
    } catch (error) {
      session.endSession();
      if (error.codeName === "WriteConflict") {
        retries--;
        console.log(`Retrying transaction... Attempts left: ${retries}`);
        await new Promise(res => setTimeout(res, 500)); // Small delay before retry
      } else {
        console.error("Error approving transaction:", error);
        return false;
      }
    }
  }

  console.log("Transaction failed after retries.");
  return false;
};

const fetchInvestmentTransactions=async(req,res)=>{
    try {
      const { id } = req.query
      const response = await investmentTransactionModel.find({investment : id})
      if(response){
          res.status(200).json({result : response})
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ errMsg: 'Server error!', error: error.message });
    }
}

const topUpInvestment =async(req,res)=>{
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
      const { userId, investmentId, amount } = req.body;

      // Fetch user and investment
      const user = await userModel.findById(userId).session(session);
      const investment = await investmentModel.findById(investmentId).populate("manager").session(session);

      if (!user || !investment) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ errMsg: 'Invalid user or investment!' });
    }

    // Validate balance
    if (amount > user.my_wallets.main_wallet) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ errMsg: 'Insufficient balance. Please deposit more funds.' });
    }

    // Validate minimum top-up amount
    if (amount < investment.min_top_up) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ errMsg: `Minimum top-up is ${investment.min_top_up} USD.` });
    }
      // Deduct wallet balance atomically
      await userModel.findByIdAndUpdate(userId, {
        $inc: { "my_wallets.main_wallet": -amount }
    }, { session });

      const userTransaction = new userTransactionModel({
        user : user._id,
        investment : investment._id,
        type : 'transfer',
        status : 'approved',
        from : `WALL${user.my_wallets.main_wallet_id}`,
        to : `INV${investment.inv_id}`,
        amount : amount , 
        transaction_type : 'investment_transactions',
        comment : `Top-up to investment with manager ${investment.manager_nickname}.`
      })
      
      const investmentTransaction = new investmentTransactionModel({
        user : user._id,
        investment : investment._id,
        manager : investment.manager,
        type : 'deposit',
        from : `WALL${user.my_wallets.main_wallet_id}`,
        to : `INV${investment.inv_id}`,
        status : 'pending',
        amount : amount , 
        comment : `Top-up added to manager ${investment.manager_nickname}'s portfolio.`
      })

      await userTransaction.save({ session });
      await investmentTransaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
          result: investment,
          investmentId: investment._id,
          msg: "Deposit added successfully!"
      });

  } catch (error) {
      console.log(error);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ errMsg: "Server error!", error: error.message });
  }
};
  
const fetchMyInvestments =async(req,res)=>{
    try {
        const { id } = req.query
        const investments = await investmentModel.find({user : id},{deposits:0})

        if(!investments){
            return res.status(200).json({msg:"No investments yet!"})
        }

        return res.status(200).json({result : investments})
    } catch (error) {
        console.log(error);
        res.status(500).json({ errMsg: 'Server error!', error: error.message });
    }
}


const fetchInvestment =async(req,res)=>{
    try {
        const { id } = req.query
        console.log(id);
        
        const investment = await investmentModel.findById(id)
        
        if(!investment){
            return res.status(200).json({msg:"No investments yet!"})
        }

        console.log('investment :',investment);

        const lastRollover = await fetchAndUseLatestRollover()
        
        return res.status(200).json({result : investment,rollover : lastRollover})
    } catch (error) {
        console.log(error);
        res.status(500).json({ errMsg: 'Server error!', error: error.message });
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

// Function to calculate the sum of deposits in the last 30 trading days
const getDepositsInLast30TradingDays=(investment)=> {
  try {
    if (!investment) {
      throw new Error('Investment not found');
    }

    // Get the date 30 trading days ago
    const startDate = getDateNTradingDaysAgo(investment.trading_liquidity_period);

    // Filter deposits made in the last 30 trading days
    const recentDeposits = investment.deposits.filter(deposit => 
      new Date(deposit.deposited_at) >= startDate
    );

    // Calculate the sum of recent deposits
    const totalRecentDeposits = recentDeposits.reduce(
      (acc, deposit) => acc + deposit.amount, 
      0
    );

    console.log(`Total deposits in the last trading liquidity periods: $${totalRecentDeposits}`);
    return { totalRecentDeposits, recentDeposits };
  } catch (error) {
    console.error('Error fetching deposits:', error.message);
    throw error;
  }
}

const handleInvestmentWithdrawal = async (req, res) => {
  try {
    const { investmentId, amount: withdrawalAmountRaw } = req.body;

    // Ensure withdrawalAmount is a valid number
    const withdrawalAmount = Number(withdrawalAmountRaw);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({ errMsg: 'Invalid withdrawal amount.' });
    }

    const investment = await investmentModel.findById(investmentId);
    if (!investment) return res.status(400).json({ errMsg: 'Investment not found.'})

    const { totalRecentDeposits } = getDepositsInLast30TradingDays(investment);

    const availableEquityForWithdraw = 
      Number(investment.total_funds) - Number(totalRecentDeposits);

    let withdrawTransaction;
    // console.log('availableEquityForWithdraw:', availableEquityForWithdraw, 'Requested:', withdrawalAmount);
    const user = await userModel.findById(investment.user);
    
    //------------------------------Temporary All Reject,comment to disable-------------------------
    withdrawTransaction = new investmentTransactionModel({
      user: investment.user,
      investment: investment._id,
      manager: investment.manager,
      type: 'withdrawal',
      status: 'pending',
      from : `INV${investment.inv_id}`,
      to : `WALL${user.my_wallets.main_wallet_id}`,
      amount: withdrawalAmount,
      // comment: `Liquidity Period is active`
    });
    await withdrawTransaction.save();
    return res.status(200).json({ msg: 'Withdrawal submitted successfully.' });
    // ------------------------------------test------------------------------------

    if (withdrawalAmount <= availableEquityForWithdraw) {
      // Case 1: Withdraw from available unlocked equity
      withdrawTransaction = new investmentTransactionModel({
        user: investment.user,
        investment: investment._id,
        manager: investment.manager,
        from : `INV${investment.inv_id}`,
        to : `WALL${user.my_wallets.main_wallet_id}`,
        type: 'withdrawal',
        status: 'pending',
        transaction_type : 'investment_transactions',
        amount: withdrawalAmount,
        comment: ''
      });

      await withdrawTransaction.save();

      await investmentModel.findByIdAndUpdate(investmentId, {
        $inc: { 
          total_withdrawal: withdrawalAmount, 
          total_funds: -withdrawalAmount 
        }
      });

    } 
    // else if (
    //   withdrawalAmount > availableEquityForWithdraw &&
    //   withdrawalAmount <= availableEquityForWithdraw + Number(investment.current_interval_profit_equity)
    // ) {
    //   // Case 2: Withdraw using profits
    //   const deductFromCurrentIntervalEquity = withdrawalAmount - availableEquityForWithdraw;
    //   console.log('deductFromCurrentIntervalEquity:', deductFromCurrentIntervalEquity);

    //   const performanceFee = (deductFromCurrentIntervalEquity * Number(investment.manager_performance_fee)) / 100;

    //   const amountAfterPerformanceFee = deductFromCurrentIntervalEquity - performanceFee;
    //   console.log('amountAfterPerformanceFee:', amountAfterPerformanceFee);

    //   // Update investment fields
    //   investment.total_funds -= availableEquityForWithdraw;
    //   investment.current_interval_profit_equity -= deductFromCurrentIntervalEquity;
    //   investment.performance_fee_projected -= performanceFee;
    //   investment.performance_fee_paid += performanceFee;
    //   investment.total_withdrawal += withdrawalAmount;

    //   // Save the withdrawal transaction
    //   withdrawTransaction = new investmentTransactionModel({
    //     user: investment.user,
    //     investment: investment._id,
    //     manager: investment.manager,
    //     from : `INV${investment.inv_id}`,
    //     to : `WALL${user.my_wallets.main_wallet_id}`,
    //     type: 'withdrawal',
    //     status: 'pending',
    //     amount: withdrawalAmount,
    //     deduction : performanceFee,
    //     comment: ``
    //   });

    //   await withdrawTransaction.save();
    //   await investment.save();
    // } 
    else {
      // Case 3: Insufficient balance
      if(withdrawalAmount < Number(investment.total_funds)){
        withdrawTransaction = new investmentTransactionModel({
          user: investment.user,
          investment: investment._id,
          manager: investment.manager,
          type: 'withdrawal',
          status: 'rejected',
          from : `INV${investment.inv_id}`,
          to : `WALL${user.my_wallets.main_wallet_id}`,
          amount: withdrawalAmount,
          comment: `Liquidity Period is active`
        });
        await withdrawTransaction.save();
        return res.status(200).json({ errMsg: 'Liquidity Period is active' });
      }

      return res.status(400).json({ errMsg: 'Insufficient balance to withdraw the requested amount.' });
    }

    // Approve the withdrawal
    // await approveInvestmentWithdrawal(withdrawTransaction._id);

    console.log('Withdrawal processed successfully.');
    return res.status(200).json({ msg: 'Withdrawal processed successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ errMsg: 'Server error!', error: error.message });
  }
};

const approveWithdrawalTransaction = async (withdrawTransactionId,rollover_id) => {
  try {
    const withdrawTransaction = await investmentTransactionModel.findById(withdrawTransactionId)

    if (!withdrawTransaction) {
      // throw new Error('Withdrawal transaction not found.');
      console.log('Withdrawal transaction not found.');
      return false
    }

    const { user, investment, amount, deduction = 0, is_deducted } = withdrawTransaction;

    const userData = await userModel.findById(user);
    if (!userData) {
      // throw new Error('User not found.');
      console.log('User not found.');
      return false
    }
    //------------------Temporary All Reject,comment to disable------------------------------------------------>>
      withdrawTransaction.status = 'rejected'
      withdrawTransaction.comment = `Unsettled provider credit.`
      await withdrawTransaction.save()
      return false
    //-------------------------------------------------------------------------------->>

    // Calculate amounts using Number() to ensure proper numeric operations
    const performanceFee = Number(deduction);
    const withdrawalAmount = Number(amount);
    let finalAmount = withdrawalAmount;
    console.log('aaaaaaaaaaaaa',finalAmount);
    
    // Handle performance fee deduction if applicable
    if (performanceFee > 0 && !is_deducted) {
      finalAmount = Number(withdrawalAmount)-Number(performanceFee);

      // Create performance fee deduction transaction
      const feeTransaction = new investmentTransactionModel({
        user: investment.user,
        investment: investment._id,
        manager: investment.manager,
        type: 'manager_fee',
        status: 'success',
        amount: performanceFee,
        rollover_id : rollover_id,
        comment: `Performance fee of ${performanceFee} deducted`,
      });
      await feeTransaction.save();
    }
    
    // Update user's wallet
    userData.my_wallets.main_wallet += finalAmount;

    // Create user transaction for withdrawal
    const userTransaction = new userTransactionModel({
      user: userData._id,
      investment: investment._id,
      type: 'transfer',
      status: 'approved',
      from : `INV${investment.inv_id}`,
      to : `WALL${userData.my_wallets.main_wallet_id}`,
      amount: finalAmount,
      transaction_id:withdrawTransaction.transaction_id,
      related_transaction : withdrawTransaction._id,
      description: `Withdraw from investment ${investment.inv_id}`,
      transaction_type : 'investment_transactions'
    });

    withdrawTransaction.status = 'approved'

    await Promise.all([
      withdrawTransaction.save(),
      userTransaction.save(),
      userData.save()
    ]);

    console.log('Withdrawal added to user wallet successfully.');
    return true
  } catch (error) {
    console.error('Error processing withdrawal:', error.message);
    return false
  }
};

const fetchInvestmentTrades=async(req,res)=>{
  try {
    const {_id} = req.query
    const myInvestmetTrades =  await investmentTradesModel.find({investment:_id})
    return res.status(200).json({result : myInvestmetTrades})
  } catch (error) {
    console.error(error);
    return res.status(500).json({ errMsg: 'Server error!', error: error.message });
  }
}

//-------------------------------------------------------Manager Functions------------------------------------------------//

const fetchAllInvestmentTransactions=async(req,res)=>{
  try {
    const { manager_id ,type} = req.query
    const myInvestmentDeposits = await investmentTransactionModel
    .find({ manager: manager_id, type })
    .populate({
      path: "investment",
      select: "inv_id"
    })
    .populate({
      path: "user",
      select: "email"
    })
    .sort({ createdAt: -1 });
    res.status(200).json({result : myInvestmentDeposits})
  } catch(error) { 
    console.error(error);
    return res.status(500).json({ errMsg: 'Server error!', error: error.message });
  }
}



module.exports = {
    //User
    makeDeposit,
    fetchMyInvestments,
    fetchInvestment,
    fetchInvestmentTransactions,
    topUpInvestment,
    handleInvestmentWithdrawal,
    fetchInvestmentTrades,

    //rollover
    approveDepositTransaction,
    approveWithdrawalTransaction,

    //Manager
    fetchAllInvestmentTransactions          
}