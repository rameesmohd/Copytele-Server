const userModel = require('../../models/user')
const managerModel = require('../../models/manager')
const depositModel = require('../../models/deposit')
const ticketModel = require('../../models/tickets')
const withdrawModel = require('../../models/withdraw')
const jwt = require("jsonwebtoken");
const userTransactionModel = require('../../models/userTx');
const { default: mongoose } = require('mongoose');
const { fetchAndUseLatestRollover } = require('../rolloverController')
const { buildPaginatedQuery } = require('../../controllers/common/buildPaginationQuery')
const { sendEmailToUser } = require('../../assets/html/verification')
const bcrypt = require("bcrypt");

const fetchUser =async(req,res)=>{
    try {
        const { query, skip, limit } = buildPaginatedQuery(req.query, ['email user_id']);
    
        // Total count for pagination
        const total = await userModel.countDocuments(query);
        
        const result =  await userModel
        .find(query,{password : 0})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const latestRollover = await fetchAndUseLatestRollover()
        return res.status(200).json({
            result :result,
            rollover : latestRollover,total
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({ errMsg: 'Error fetching users' });
    }
}

const addManager = async (req, res) => {
  try {
    const data = req.body;

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);
    data.password = hashedPassword;

    const newManager = new managerModel(data);
    await newManager.save();

    res.status(201).json({ msg: "Manager added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      errMsg: "Error adding Manager, please try again",
      error: error.message,
    });
  }
};

const fetchManagers=async(req,res)=>{
    try {
        const Managers =  await managerModel.find({},{growth_data:0,})
        return res.status(200).json({result : Managers})
    } catch (error) {
        console.log(error);
        res.status(500).json({ errMsg: 'Error adding Manager,please try again' ,error : error.message})
    }
}

const updateManager = async (req, res) => {
  try {
    const { _id, password, ...updates } = req.body;
    console.log(password);
    console.log("password");
    console.log(updates);
    

    
    // 🔐 If updating password, hash it
    if (password) {
      updates.password = await bcrypt.hash(password, 12);
    }

    const Manager = await managerModel.findOneAndUpdate(
      { _id },
      { $set: updates },
      { new: true }
    );

    if (!Manager) {
      return res.status(404).json({ errMsg: "Manager not found" });
    }

    return res.status(200).json({
      result: Manager,
      msg: "Manager data updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      errMsg: "Error updating Manager, please try again",
      error: error.message,
    });
  }
};


const masterLogin = async (req, res) => {
  try {
    const { id, password } = req.body;

    // 🔍 Basic validation
    if (!id || !password) {
      return res.status(400).json({
        success: false,
        errMsg: "ID and Password are required.",
      });
    }

    // 🔐 Master credentials from ENV
    const MASTER_ID = process.env.MASTER_USERNAME;
    const MASTER_PASS = process.env.MASTER_PASS;

    if (id !== MASTER_ID || password !== MASTER_PASS) {
      return res.status(401).json({
        success: false,
        errMsg: "Invalid master credentials",
      });
    }

    // 🎫 Generate JWT
    const token = jwt.sign(
      { role: "master", master_id: MASTER_ID },
      process.env.JWT_SECRET_KEY_MASTER,
      { expiresIn: "24h" }
    );

    // 🍪 Set secure HTTP-only cookie
    res.cookie("masterToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/api/master",
      ...(process.env.NODE_ENV === "production" && {
            domain: process.env.DOMAIN,
      }),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })

    return res.status(200).json({
      success: true,
      msg: "Master logged in successfully",
      token,
    });

  } catch (error) {
    console.error("Master Login Error:", error);
    return res.status(500).json({
      success: false,
      errMsg: "Server error during master login",
      error: error.message,
    });
  }
};

const masterLogout = (req, res) => {
  try {
    res.clearCookie("masterToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/api/master",
      ...(process.env.NODE_ENV === "production" && {
            domain: process.env.DOMAIN,
      }),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })

    return res.status(200).json({
      success: true,
      msg: "Master logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      errMsg: "Logout failed",
      error: error.message,
    });
  }
};


const fetchDeposits=async(req,res)=>{
    try {
        let userIds = [];   
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const matchedUsers = await userModel
                .find({ email: searchRegex })
                .select('_id');
            userIds = matchedUsers.map((u) => u._id);
        }    

        const { query, skip, limit, page } = buildPaginatedQuery(
            req.query,
            ['email', 'transaction_id', 'wallet_id'],
            { userIds }
        );
          
        // Total count for pagination
        const total = await depositModel.countDocuments(query);
    
        // Paginated results
        const deposits = await depositModel
            .find(query, { private_key: 0, payment_address: 0 })
            .populate({ path: 'user', select: 'login_type telegram email first_name last_name' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalAmountAgg = await depositModel.aggregate([
            { $match: query },
            {
                $group: {
                _id: null,
                totalDepositedAmount: { $sum: { $toDouble: "$amount" } }
                }
            }
        ]);
            
        const totalDepositedAmount = totalAmountAgg[0]?.totalDepositedAmount || 0;

        return res.status(200).json({
            result : deposits,
            total, 
            currentPage: page,
            totalDepositedAmount
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ errMsg: 'Error fetching deposits, please try again', error: error.message });
    }
}
  
const fetchWithdrawals=async(req,res)=>{
    try {
        let userIds = [];   
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const matchedUsers = await userModel
                .find({ email: searchRegex })
                .select('_id');
            userIds = matchedUsers.map((u) => u._id);
        }    

        const { query, skip, limit, page } = buildPaginatedQuery(
            req.query,
            ['email', 'transaction_id', 'wallet_id'],
            { userIds }
        );
      
        // Total count for pagination
        const total = await withdrawModel.countDocuments(query);

        const withdrawals =  await withdrawModel
        .find(query)
        .populate({ path: "user", select: "login_type telegram email first_name last_name" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalAmountAgg = await withdrawModel.aggregate([
            { $match: query },
            {
                $group: {
                _id: null,
                totalWithdrawedAmount: { $sum: { $toDouble: "$amount" } }
                }
            }
        ]);
            
        const totalWithdrawedAmount = totalAmountAgg[0]?.totalWithdrawedAmount || 0;

        res.status(200).json({
            result : withdrawals,total, 
            currentPage: page,
            totalWithdrawedAmount
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ errMsg: 'Error fetching deposits, please try again', error: error.message });
    }
}

const getPendingKYCRequests = async (req, res) => {
  try {
    const pendingUsers = await userModel.find(
      { 
        "kyc.is_verified": false,
        $or: [
          { "kyc.identify_proof_status": "submitted" },
          { "kyc.residential_proof_status": "submitted" },

          { "kyc.identify_proof_status": "verified" },
          { "kyc.residential_proof_status": "verified" },
        ]
      },
      {
        first_name: 1,
        last_name: 1,
        email: 1,
        user_id: 1,
        country: 1,
        "kyc.is_verified": 1,
        "kyc.identify_proof_status": 1,
        "kyc.residential_proof_status": 1,
        "kyc.identify_proof": 1,
        "kyc.residential_proof": 1,
        createdAt: 1,
        login_type : 1,
        telegram : 1
      }
    )
    .sort({ createdAt: -1 });

    res.status(200).json({ success: true, result: pendingUsers });
  } catch (error) {
    console.error("Error fetching KYC requests:", error);
    res.status(500).json({ success: false, message: "Error fetching KYC requests" });
  }
};


const approveKycDocs = async (req, res) => {
  try {
    const { role, record_id, status } = req.body;
    console.log( role, record_id, status);
    
    if (role !== "identify_proof" && role !== "residential_proof") {
      return res.status(400).json({ success: false, message: "Invalid payload!" });
    }

    const user = await userModel.findById(record_id)

    const key =
      role === "identify_proof"
        ? "kyc.identify_proof_status"
        : "kyc.residential_proof_status";

    if (status === "verified" && user[key]!=status) {
      await userModel.updateOne(
        { _id: record_id },
        { $set: { [key]: status } }
      );
    }

    if (status === "unavailable" && user[key]!=status) {
      await userModel.updateOne(
        { _id: record_id },
        {
          $set: { [key]: status },
          $inc: { "kyc.step": -1 }
        }
      );
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error approving KYC docs",
      error
    });
  }
};

const approveKyc = async (req, res) => {
  try {
    const { _id } = req.body;

    const user = await userModel.findById(_id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Validate both docs & email status
    if (
      user.kyc.is_email_verified &&
      user.kyc.identify_proof_status === "verified" &&
      user.kyc.residential_proof_status === "verified"
    ) {
      await userModel.findByIdAndUpdate(_id, {
        $set: {
          "kyc.is_verified": true,
          "kyc.step": 4,
        },
      });

      return res.status(200).json({ success: true, message: "KYC Approved successfully" });
    }

    return res.status(400).json({
      success: false,
      message: "Documents not fully verified for KYC approval",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error approving KYC",
      error,
    });
  }
};


const handleWithdraw = async (req, res) => {
    try {
        const { _id, status } = req.body;

        // Validate status
        if (status !== 'approved' && status !== 'rejected') {
            return res.status(400).json({ errMsg: "Invalid status value" });
        }

        const withdrawData = await withdrawModel.findOne({_id,status : 'pending'})

        if(!withdrawData){
           return res.status(400).json({ errMsg: "Data not found", error });
        }

        // Update withdrawal status
        await withdrawModel.updateOne({ _id:withdrawData._id }, { $set: { status } });
        await userTransactionModel.updateOne({related_transaction : withdrawData._id},{$set: { status }})
        if(status=='rejected'){
            await userModel.updateOne({_id:withdrawData.user},
                { $inc: { 'my_wallets.main_wallet': withdrawData.amount }}
            )
        }
        return res.status(200).json({ msg: `Withdrawal ${status} successfully` });
    } catch (error) {
        res.status(500).json({ errMsg: "Error approving withdrawal", error });
    }
};

const addToWallet = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { email, amount, comment,type,payment_mode } = req.body;
        console.log(req.body);

        if(!email || !amount || !comment || !type || !payment_mode){
            return res.status(400).json({ errMsg: "Invalid inputs!", error });
        }
        
        // Find the user within the transaction
        const user = await userModel.findOne({ email }).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ errMsg: "User not found!!" });
        }

        // Create new user transaction
        const newUserTransaction = new userTransactionModel({
            user: user._id,
            type,
            payment_mode,
            status: 'approved',
            amount: amount,
            transaction_type: 'deposits',
            description: comment || '',
        });

        await newUserTransaction.save({ session });

        // Update the user's wallet balance
        const walletUpdate = await userModel.findOneAndUpdate(
            { _id: user._id },
            { $inc: { 'my_wallets.main_wallet': amount } },
            { session }
        );

        if (!walletUpdate) {
            throw new Error("Failed to update wallet balance");
        }

        // Commit transaction if everything is successful
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({ msg: "Funds added successfully" });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error adding funds:", error);
        return res.status(500).json({ errMsg: "Error adding funds", error });
    }
};

const fetchHelpRequests=async(req,res)=>{
    try {
        const {status} = req.query
        const query = {}
        if(status){
            query.status = status
        }
        const tickets = (await ticketModel.find(query).populate("user_id","email user_id")).reverse()
        return res.status(200).json({result : tickets})
    } catch (error) {
        console.error("Error fetching help requests : ", error);
        return res.status(500).json({ errMsg: "Error fetching help requests", error });
    }
}

const changeHelpRequestStatus=async(req,res)=>{
    try {
        const { ticket_id } = req.query
        await ticketModel.updateOne({_id : ticket_id},{$set : {status : "resolved"}})
        return res.status(200).json({success : true})
    } catch (error) {
        console.error("Error fetching help requests : ", error);
        return res.status(500).json({ errMsg: "Error fetching help requests", error });
    }
}

const changeUserEmail = async (req, res) => {
    try {
      const { newEmail, user_id } = req.body;
  
      if (!newEmail || !user_id) {
        return res.status(400).json({ errMsg: "newEmail and user_id are required" });
      }
  
      const updatedUser = await userModel.findByIdAndUpdate(
        user_id,
        { $set: { email: newEmail } },
        { new: true, runValidators: true } 
      );
  
      if (!updatedUser) {
        return res.status(404).json({ errMsg: "User not found" });
      }
  
      return res.status(200).json({ msg: "Email updated successfully"});
    } catch (error) {
      console.error("Error changing email:", error);
      return res.status(500).json({ errMsg: "Error changing email", error });
    }
  };

const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_SECRET_KEY);

const sendEmail = async (req, res) => {
  try {
    const { to, subject, title, desOne, desTwo,desThree, username } = req.body;

    if (!to || !subject || !title || !desOne) {
      return res.status(400).json({ success: false, msg: 'Missing fields' });
    }

    try {
        await resend.emails.send({
          from: process.env.WEBSITE_MAIL,
          to,
          subject,
          html: sendEmailToUser({title,username,desOne,desTwo,desThree}),
        });
    } catch (emailError) {
        console.error("Error sending email:", emailError);
        return res.status(500).json({ errMsg: "Failed to send verification email." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
  


module.exports = {
    fetchUser,
    changeUserEmail,
    addManager,
    fetchManagers,
    updateManager,
    masterLogin,
    fetchDeposits,
    fetchWithdrawals,
    getPendingKYCRequests,
    approveKycDocs,
    approveKyc,
    handleWithdraw,
    addToWallet,
    sendEmail,

    fetchHelpRequests,
    changeHelpRequestStatus,

    masterLogout
}