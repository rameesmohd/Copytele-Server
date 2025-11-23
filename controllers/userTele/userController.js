const managerModel = require('../../models/manager');
const userTransactionModel = require('../../models/userTx')
const managerTrades = require('../../models/managerTrades')

const fetchUserWallet = async (req, res) => {
  try {
    const user = req.user;
    let limit = 5
    let skip = 0

    if (isNaN(limit) || isNaN(skip)) {
      return res.status(400).json({ errMsg: "Invalid pagination values" });
    }

    /* ------------------------------
       CALCULATE TOTAL DEPOSITED 
    -------------------------------*/
    const depositedAgg = await userTransactionModel.aggregate([
      { $match: { user: user._id, type: "deposit", status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalDeposited = depositedAgg[0]?.total || 0;

    /* ------------------------------
       CALCULATE TOTAL WITHDRAWN 
    -------------------------------*/
    const withdrawnAgg = await userTransactionModel.aggregate([
      { $match: { user: user._id, type: "withdrawal", status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalWithdrawn = withdrawnAgg[0]?.total || 0;

    /* ------------------------------
         FETCH TRANSACTIONS
    -------------------------------*/
    const transactions = await userTransactionModel
      .find({ user: user._id })
      .sort({ createdAt: -1 }) // newest first (MT5 style)
      .skip(skip)
      .limit(limit)
      .lean();

    /* ------------------------------
         TOTAL COUNT FOR PAGINATION
    -------------------------------*/
    const totalCount = await userTransactionModel.countDocuments({
      user: user._id,
    });

    return res.status(200).json({
      status: "success",
      result: {
        user,
        totalWithdrawn,
        totalDeposited,
        netGain: user.wallets.main - (totalDeposited - totalWithdrawn) || 0,
        transactions,
        pagination: {
          total: totalCount,
          limit,
          skip,
          hasMore: skip + transactions.length < totalCount,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errMsg: "Server error!", error: error.message });
  }
};

const fetchUserWalletTransactions = async (req, res) => {
  try {
    const { limit = 10, skip = 0, filter = "all" } = req.query;
    const user = req.user;

    const limitNum = Number(limit);
    const skipNum = Number(skip);

    if (isNaN(limitNum) || isNaN(skipNum)) {
      return res.status(400).json({ errMsg: "Invalid pagination values" });
    }

    // Build query dynamically
    const query = {
      user: user._id,
      ...(filter !== "all" && { type: filter }),
    };

    // Get total count before limit/skip
    const totalCount = await userTransactionModel.countDocuments(query);

    // Fetch paginated results
    const transactions = await userTransactionModel
      .find(query)
      .limit(limitNum)
      .skip(skipNum)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      result: {
        transactions,
        pagination: {
          total: totalCount,
          limit: limitNum,
          skip: skipNum,
          hasMore: skipNum + transactions.length < totalCount,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errMsg: "Server error!", error: error.message });
  }
};

const fetchManager =async(req,res)=>{
    try {
        const {id} = req.query
        const recentTradeslimit = 3
        const manager =  await managerModel.findOne({id : id },{password : 0})
        const recentTrades = await managerTrades
          .find({ manager: manager._id })
          .sort({ createdAt: -1 })       // newest first
          .limit(recentTradeslimit);

        if(manager){
            return res.status(200).json({
              status : "success",
              manager,
              recentTrades
            })
        }else{
            return res.status(200).json({errMsg : "Invalid id"})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ errMsg: 'Server error!', error: error.message });
    }
}

const fetchManagerRecentTrades =async(req,res)=>{
    try {
        const { id } = req.query
        const limit = 3 
        const manager =  await managerTrades.findOne({id : id },{password : 0})
        if(manager){
            return res.status(200).json({result : manager})
        }else{
            return res.status(200).json({errMsg : "Invalid id"})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ errMsg: 'Server error!', error: error.message });
    }
}


module.exports = {
    fetchUserWallet,
    fetchUserWalletTransactions,

    fetchManager
}