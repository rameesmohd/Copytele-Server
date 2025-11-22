const investmentModel = require('../../models/investment');
const investmentTransactionModel = require('../../models/investmentTx');
const userTransactionModel = require('../../models/userTx');
const userModel = require('../../models/user')
const managerModel = require('../../models/manager');
const investmentTradesModel =require('../../models/invTrades');
const rolloverModel = require('../../models/rollover');
const { default: mongoose } = require('mongoose');

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
      select: "email telegram login_type"
    })
    .sort({ createdAt: -1 });
    res.status(200).json({result : myInvestmentDeposits})
  } catch(error) { 
    console.error(error);
    return res.status(500).json({ errMsg: 'Server error!', error: error.message });
  }
}



module.exports = {
    fetchInvestmentTransactions,
    fetchInvestmentTrades,
    fetchAllInvestmentTransactions          
}