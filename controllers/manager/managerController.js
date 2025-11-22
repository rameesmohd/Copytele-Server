const investmentModel = require('../../models/investment')
const managerModel = require('../../models/manager')
const jwt = require("jsonwebtoken");
const { fetchAndUseLatestRollover } = require('../rolloverController')
const { default: mongoose } = require('mongoose');
const bcrypt = require("bcrypt");

const getManagerData=async(req,res)=>{
    try {
        const {_id} = req.query
        const manager = await managerModel.findById({_id},{
            password:0,
            my_investments:0,
            trade_history:0,
            growth_data:0,
            _v: 0
        })
        const latestRollover = await fetchAndUseLatestRollover()
        res.status(200).json({result : manager,rollover : latestRollover})
    } catch (error) {
        res.status(500).json({errMsg : 'sever side error'})
    }
}

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



module.exports = { 
    getManagerData,
    fetchMyInvesters,
    login,
    managerLogout
}