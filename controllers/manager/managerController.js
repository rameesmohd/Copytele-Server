  const investmentModel = require('../../models/investment')
  const managerModel = require('../../models/manager')
  const jwt = require("jsonwebtoken");
  const { fetchAndUseLatestRollover } = require('../rolloverController')
  const { default: mongoose } = require('mongoose');
  const bcrypt = require("bcrypt");
  const managerTradeModel = require('../../models/managerTrades');
  const InvestmentTransaction = require('../../models/investmentTx');

  const getManagerData = async (req, res) => {
    try {
      const { _id } = req.query;

      if (!_id) return res.status(400).json({ errMsg: "Manager ID required" });

      const manager = await managerModel.findById(
        _id,
        {
          password: 0,
          my_investments: 0,
          trade_history: 0,
          growth_data: 0,
          __v: 0
        }
      );

      if (!manager) return res.status(404).json({ errMsg: "Manager not found" });

      const latestRollover = await fetchAndUseLatestRollover();

      return res.status(200).json({
        result: manager,
        rollover: latestRollover
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ errMsg: 'server side error' });
    }
  };

  const fetchMyInvesters = async(req,res)=>{
      try {
          const { manager_id, page = 1, pageSize = 10 } = req.query;
          const skip = (page - 1) * pageSize;
          const manager =new mongoose.Types.ObjectId(manager_id);
          const matchQuery = {manager};

          // Get total count
          const totalCount = await investmentModel.countDocuments(matchQuery);

          // Get paginated data
          const result = await investmentModel
          .find(matchQuery)
          .populate('user', 'email telegram login_type')
          .sort({createdAt : -1})
          .skip(skip)
          .limit(Number(pageSize))
          .lean();

          // Calculate total_funds sum
          const totalAgg = await investmentModel.aggregate([
              { $match: matchQuery },
              {
                  $group: {
                  _id: null,
                  total_funds_sum: { $sum: "$total_funds" }
                  }
              }
          ]);

          const totalFundsSum = totalAgg[0]?.total_funds_sum || 0;

          res.json({
              result,
              total: totalCount,
              page: Number(page),
              total_funds_sum: totalFundsSum
          });
      } catch (error) {
          console.log(error.message);
          res.status(500).json({errMsg : 'sever side error'})
      }
  }

  const login = async (req, res) => {
    try {
      const { id, password } = req.body;

      // 🔍 Validate input
      if (!id || !password) {
        return res.status(400).json({
          success: false,
          errMsg: "Manager ID and Password are required.",
        });
      }

      // 🔎 Find manager
      const manager = await managerModel.findOne({ id });
      if (!manager) {
        return res.status(404).json({
          success: false,
          errMsg: "Manager not found.",
        });
      }

      // 🔐 Validate password (Bcrypt)
      const isMatch = await bcrypt.compare(password, manager.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          errMsg: "Invalid password.",
        });
      }

      // 🎫 Generate JWT token
      const token = jwt.sign(
        { _id: manager._id, role: "manager" },
        process.env.JWT_SECRET_KEY_MANAGER,
        { expiresIn: "24h" }
      );

      // 🍪 Set secure HTTP-only cookie
      res.cookie("managerToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: "/api/manager",
        ...(process.env.NODE_ENV === "production" && {
              domain: process.env.DOMAIN,
        }),
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })

      // 🧹 Remove password from response
      const managerObj = manager.toObject();
      delete managerObj.password;

      return res.status(200).json({
        success: true,
        msg: "Manager logged in successfully",
        token,
        result: managerObj,
      });

    } catch (error) {
      console.error("Manager Login Error:", error);
      res.status(500).json({
        success: false,
        errMsg: "Server error during manager login.",
        error: error.message,
      });
    }
  };

  const managerLogout = (req, res) => {
    try {
      res.clearCookie("managerToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: "/api/manager",
        ...(process.env.NODE_ENV === "production" && {
              domain: process.env.DOMAIN,
        }),
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })

      return res.status(200).json({
        success: true,
        msg: "Manager logged out successfully",
      });
    } catch (error) {
      return res.status(500).json({
        errMsg: "Logout failed",
        error: error.message,
      });
    }
  };

const fetchManager =async(req,res)=>{
    try {
        const {id} = req.query
        const recentTradeslimit = 3
        const manager =  await managerModel.findOne({id : id },{password : 0})
        if(manager){
        const recentTrades = await managerTradeModel
          .find({ manager: manager._id })
          .sort({ createdAt: -1 })       // newest first
          .limit(recentTradeslimit);

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

    if (!manager_id)
      return res.status(400).json({
        success: false,
        message: "Manager ID missing"
      });

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
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      };
    } else if (filter === "month") {
      createdAtFilter = {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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

    /* ----------- BUILD FINAL QUERIES ----------- */
    const baseQuery = { manager: manager_id };
    if (filter !== "all" && createdAtFilter) {
      baseQuery.createdAt = createdAtFilter;
    }

    /* ----------- FETCH TRADES ----------- */
    const trades = await managerTradeModel
      .find(baseQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit) + 1); // Fetch one extra to check if more exist

    /* ----------- FETCH TRANSACTIONS ----------- */
    // const accTransactions = await InvestmentTransaction
    //   .find(baseQuery)
    //   .sort({ createdAt: -1 })
    //   .skip(skip)
    //   .limit(Number(limit) + 1); // Fetch one extra to check if more exist

    // Check if there are more items
    const hasMoreTrades = trades.length > Number(limit);
    // const hasMoreTransactions = accTransactions.length > Number(limit);
    
    // Remove the extra items
    if (hasMoreTrades) trades.pop();
    // if (hasMoreTransactions) accTransactions.pop();

    // Determine if there's more data
    const hasMore = hasMoreTrades 

    return res.json({
      success: true,
      result: {
        trades,
        // accTransactions
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        hasMore: hasMore
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const fetchManagerTransactions = async (req, res) => {
  try {
    const { manager_id, limit = 10, skip = 0, filter = "all" } = req.query;

    if (!manager_id)
    return res.status(400).json({
      success: false,
      message: "Manager ID missing"
    });

    const limitNum = Number(limit);
    const skipNum = Number(skip);

    if (isNaN(limitNum) || isNaN(skipNum)) {
      return res.status(400).json({ errMsg: "Invalid pagination values" });
    }

    // Build query
    const query = {
      manager: manager_id,
      ...(filter !== "all" && { type: filter }), // filter: deposit / withdrawal
    };

    // Count total before pagination
    const totalCount = await InvestmentTransaction.countDocuments(query);

    // Fetch data
    const transactions = await InvestmentTransaction.find(query)
      .sort({ createdAt: -1 }) // latest first
      .limit(limitNum)
      .skip(skipNum)
      .lean();

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
    console.error("Error fetching manager transaction history:", error);
    return res.status(500).json({
      errMsg: "Server error",
      error: error.message,
    });
  }
};

  module.exports = { 
      getManagerData,
      fetchMyInvesters,
      login,
      managerLogout,
      fetchAccountData,
      fetchManager,
      fetchManagerTransactions
  }