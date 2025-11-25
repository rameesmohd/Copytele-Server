const userTransactionModel = require('../../models/userTx')
const InvestmentTransaction = require('../../models/investmentTx');
const InvestmentTrades  = require('../../models/investmentTrades');
const InvestmentModel = require('../../models/investment')
const UserModel = require('../../models/user')

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


const fetchAccountData = async (req, res) => {
  try {
    const {
      manager_id,
      filter = "month",
      page = 1,
      limit = 20,
      start_date,
      end_date
    } = req.query;

    const user_id = req.user?._id;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        errMsg: "User ID missing"
      });
    }

    if (!manager_id) {
      return res.status(400).json({
        success: false,
        errMsg: "manager ID missing"
      });
    }

    const skip = (page - 1) * limit;
    const now = new Date();

    let createdAtFilter = null;

    /* ----------- PRESET FILTERS ----------- */
    if (filter === "today") {
      createdAtFilter = {
        $gte: new Date(now.setHours(0, 0, 0, 0))
      };
    } else if (filter === "week") {
      createdAtFilter = {
        $gte: new Date(Date.now() - 7 * 86400000)
      };
    } else if (filter === "month") {
      createdAtFilter = {
        $gte: new Date(Date.now() - 30 * 86400000)
      };
    }

    /* ----------- CUSTOM DATE RANGE ----------- */
    if (filter === "custom") {
      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: "Start and End dates required for custom filter"
        });
      }

      createdAtFilter = {
        $gte: new Date(start_date),
        $lte: new Date(end_date + "T23:59:59.999Z")
      };
    }

   /* ----------- FIND USER INVESTMENT FOR THIS MANAGER ----------- */
    const investment = await InvestmentModel.findOne({
      manager: manager_id,
      user: user_id
    }).lean();

    if (!investment) {
      return res.json({
        success: true,
        result: { trades: [], accTransactions: [] },
      });
    }

    /* ----------- BUILD FINAL QUERY ----------- */
    const baseQuery = { };
    if (filter !== "all" && createdAtFilter) {
      baseQuery.createdAt = createdAtFilter;
    }

    /* ----------- FETCH TRADES ----------- */
    const trades = await InvestmentTrades.find({
      ...baseQuery,
      investment: investment._id
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    /* ----------- FETCH ACCOUNT TRANSACTIONS ----------- */
    const accTransactions = await InvestmentTransaction.find({
      ...baseQuery,
      investment: investment._id,
      user: user_id 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    /* ----------- PAGINATION FIX ----------- */
    const maxListCount = Math.max(trades.length, accTransactions.length);

    return res.json({
      success: true,
      result: {
        trades,
        accTransactions
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        hasMore: maxListCount === Number(limit)
      }
    });

  } catch (err) {
    console.log("Fetch Account Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateUserDetails = async (req, res) => {
  try {
    const { country, email, mobile } = req.body;
    const user = req.user;

    const update = {};

    if (country) update.country = country;
    if (mobile) update.mobile = mobile;

    // If email changed → reset verification
    if (email && email !== user.email) {
      // email format validation optional
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }

      update.email = email;
      update["kyc.is_email_verified"] = false; // reset email verification
    }

    const result = await UserModel.findByIdAndUpdate(
      user._id,
      { $set: update },
      { new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      result,
    });

  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
    fetchUserWallet,
    fetchUserWalletTransactions,
    fetchAccountData,

    updateUserDetails,

}