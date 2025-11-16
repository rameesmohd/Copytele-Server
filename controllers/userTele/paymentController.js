const {TronWeb}  = require('tronweb');
const depositsModel = require('../../models/deposit');
const userTransactionModel = require('../../models/userTx')
const userModel = require('../../models/user')

const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Function to create a new TronWeb instance
const createTronWebInstance = (privateKey) => {
    return new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: privateKey
    });
};

// Function to initialize USDT contract
const initializeUsdtContract = async (tronWebInstance) => {
    return await tronWebInstance.contract().at(USDT_CONTRACT_ADDRESS);
};


// Endpoint to generate a unique TRC20 deposit address
const trc20CreateDeposit = async (req, res) => {
  try {
    let { amount } = req.query;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ errMsg: "Unauthorized user" });
    }

    // Convert amount → number
    amount = Number(amount);

    if (!amount || amount < 10) {
      return res.status(400).json({ errMsg: "Invalid amount. Minimum is $10" });
    }

    // Check existing pending deposit
    const existing = await depositsModel.findOne({
      user: user._id,
      payment_mode: "USDT-TRC20",
      status: "pending"
    });

    // -------------------------------
    // CASE 1 → New deposit request
    // -------------------------------
    if (!existing) {
      const tronWebInstance = createTronWebInstance(process.env.PRIVATE_KEY);

      // Generate address
      const {
        address: { base58: payment_address },
        privateKey
      } = tronWebInstance.utils.accounts.generateAccount();

      const newDeposit = await depositsModel.create({
        user: user._id,
        user_id: user.user_id,
        wallet_id: user.wallets.main_id,
        payment_mode: "USDT-TRC20",
        amount,
        payment_address,
        private_key: privateKey
      });

      return res.status(200).json({
        success: true,
        result: {
          address: newDeposit.payment_address,
          deposit_id: newDeposit._id
        }
      });
    }

    // -------------------------------
    // CASE 2 → User already generated address
    // update amount only
    // -------------------------------
    if (existing.amount !== amount) {
      await depositsModel.updateOne(
        { _id: existing._id },
        { $set: { amount } }
      );
    }

    return res.status(200).json({
      success: true,
      result: {
        address: existing.payment_address,
        deposit_id: existing._id
      }
    });

  } catch (error) {
    console.error("TRC20 deposit error:", error);
    return res.status(500).json({
      errMsg: "Server error creating deposit"
    });
  }
};

const trc20CheckAndTransferPayment = async (req, res) => {
  try {
    const { deposit_id } = req.body;

    if (!deposit_id) {
      return res.status(400).json({
        status: "error",
        msg: "No data to execute in body",
      });
    }

    const pendingPayment = await depositsModel.findOne({
      _id: deposit_id,
      payment_mode: "USDT-TRC20",
      status: "pending",
    });

    if (!pendingPayment) {
      return res.status(400).json({
        status: "error",
        message: "Order not exists!",
      });
    }

    // Init TRON contract
    const tronWebInstance = createTronWebInstance(pendingPayment.private_key);
    const usdtContract = await initializeUsdtContract(tronWebInstance);

    // Get balance
    const usdtBalance = await usdtContract.methods
      .balanceOf(pendingPayment.payment_address)
      .call();

    const balance = parseFloat(tronWebInstance.fromSun(usdtBalance.toString()));
    console.log("TRC20 balance:", balance);

    // If user has enough balance
    if (balance <= 10) {

      // Mark deposit as approved
      const processingPayment = await depositsModel.findOneAndUpdate(
        { _id: deposit_id },
        {
          $set: {
            status: "approved",
            is_payment_recieved: true,
          },
        },
        { new: true }
      );

      const userData = await userModel.findOne({ _id: processingPayment.user });
      if (!userData) {
        return res.status(402).json({ message: "User not found" });
      }

      const amountToCredit = Math.round(balance * 100) / 100;

      // Save transaction history
      const newUserTransaction = new userTransactionModel({
        user: processingPayment.user,
        type: "deposit",
        payment_mode: "USDT-TRC20",
        amount: amountToCredit,
        description: "USDT TRC20 deposit",
        transaction_id: processingPayment.transaction_id,
      });

      await newUserTransaction.save();

      // Update user wallet
      const updatedUserData = await userModel.findOneAndUpdate(
        { _id: userData._id },
        {
          $inc: { "wallets.main": amountToCredit },
        },
        { new: true, select: "-password" }
      );

      return res.status(200).json({
        status: "success",
        amount: amountToCredit,
        transaction_id: processingPayment.transaction_id,
        userData: updatedUserData,
        date : newUserTransaction.createdAt
      });
    }

    return res.status(200).json({
      status: "failure",
      message: "Payment not completed.",
    });
  } catch (error) {
    console.error("TRC20 Check Error:", error);
    return res.status(500).json({
      status: "failure",
      message: "Server error.",
    });
  }
};

//---------------------------------BEP20-------------------------------

const { Web3 } = require('web3');
const { ethers } = require("ethers");
const withdrawalModel = require('../../models/withdraw');

const USDT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955"; // BEP-20 USDT contract

// ✅ Proper Ankr RPC URL format with API key
const ANKR_API_KEY = process.env.ANKR_API_KEY; // Your API key from Ankr
const RPC_URL =  `https://rpc.ankr.com/bsc/${ANKR_API_KEY}`;

// Initialize Web3 with authenticated endpoint
const web3 = new Web3(RPC_URL);

// USDT Contract ABI
const usdtAbi = [
    {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "type": "function"
    }
];

// Initialize contract
const usdtContract = new web3.eth.Contract(usdtAbi, USDT_ADDRESS);

// Generate wallet function
const generateWallet = () => {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey
    };
};

// Helper function to check USDT balance
const checkUsdtBalance = async (address) => {
    try {
        const balance = await usdtContract.methods.balanceOf(address).call();
        // USDT has 18 decimals on BSC
        const balanceInUsdt = Number(balance) / 1e18;
        return balanceInUsdt;
    } catch (error) {
        console.error("Error checking balance:", error);
        throw error;
    }
};

// Endpoint to generate a unique address and amount for payment
const bep20CreateDeposit = async (req, res) => {
    try {
        let { amount } = req.query;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ errMsg: "Unauthorized user" });
        }

        // Convert amount to number
        amount = Number(amount);

        if (!amount || amount < 10) {
            return res.status(400).json({ errMsg: 'Invalid amount. Minimum is $10' });
        }

        const existing = await depositsModel.findOne({ 
            user: user._id,
            payment_mode: "USDT-BEP20", 
            status: 'pending' 
        });

        // -------------------------------
        // CASE 1 → New deposit request
        // -------------------------------
        if (!existing) {
            const { address, privateKey } = generateWallet();
            
            const newDeposit = await depositsModel.create({
                user: user._id,
                user_id: user.user_id,
                wallet_id: user.wallets.main_id,
                payment_mode: "USDT-BEP20",
                amount,
                payment_address: address,
                private_key: privateKey,
            });

            return res.status(200).json({
                success: true,
                result: {
                    address: newDeposit.payment_address,
                    deposit_id: newDeposit._id,
                    amount: amount
                }
            });
        } 

        // -------------------------------
        // CASE 2 → User already has pending deposit
        // Update amount only
        // -------------------------------
        if (existing.amount !== amount) {
            await depositsModel.updateOne(
                { _id: existing._id },
                { $set: { amount, updatedAt: new Date() } }
            );
        }

        return res.status(200).json({
            success: true,
            result: {
                address: existing.payment_address,
                deposit_id: existing._id,
            }
        });
        
    } catch (error) {
        console.error("BEP20 deposit error:", error);
        return res.status(500).json({
            errMsg: "Server error creating deposit"
        });
    }
};

const getUSDTBEPBalance = async (walletAddress) => {
    try {
        const balance = await usdtContract.methods.balanceOf(walletAddress).call();
        return Number(balance) / 10 ** 18; // Convert using 18 decimal places
    } catch (error) {
        console.error("Error fetching balance:", error);
        return 0;
    }
};

const bep20CheckAndTransferPayment = async (req,res) => {
    const { deposit_id } = req.body;

    console.log(req.body);
    
    if(!deposit_id) {
        return res.status(400).json({status: 'error', msg: 'No data to execute in body'});
    }

    const pendingPayment = await depositsModel.findOne({_id : deposit_id ,payment_mode : "USDT-BEP20",status: 'pending'});

    if (!pendingPayment) return  res.status(400).json({ status: 'error', message: 'Order not exists!.' });;

    try {
        const balance = await getUSDTBEPBalance(pendingPayment.payment_address)
        console.log('balance :',balance);

        if (balance <= 10) {
            //-------------------------DB_Operations---------------------------//
            const proccessingPayment = await depositsModel.findOneAndUpdate(
                { _id : deposit_id},
                { $set : {
                    status: 'approved',
                    is_payment_recieved : true
                }},
                { new: true }
            );

            const userData = await userModel.findOne({ _id: proccessingPayment.user });
            if (!userData) {
                return res.status(402).json({message : 'user not found'});
            }

            const amountToCredit = Math.round(balance * 100) / 100;
            
            const newUserTrasaction = new userTransactionModel({
                user: proccessingPayment.user,
                type: 'deposit',
                payment_mode : 'USDT-BEP20',
                amount: amountToCredit,
                description : 'Deposit from BEP20 wallet',
                transaction_id : proccessingPayment.transaction_id
            });
            await newUserTrasaction.save()


            const updatedUserData = await userModel.findOneAndUpdate(
              { _id: userData._id },
              {
                $inc: { 'wallets.main': amountToCredit }
              },
              { new: true, select: '-password' }
            );

            //trasfer to company wallet logic here--
            
            return res.status(200).json({ 
                status: 'success' ,
                amount : amountToCredit,
                transaction_id: proccessingPayment.transaction_id,
                userData : updatedUserData,
                date : newUserTrasaction.createdAt
            });
        }
        return res.status(200).json({ status: 'failure', message: 'Payment not completed.' });
    } catch (error) {
        if (error.response) {   
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
            console.error('Error response headers:', error.response.headers);
        } else if (error.request) {
            console.error('Error request data:', error.request);
        } else {
            console.error('Error message:', error);
        }
        return res.status(500).json({ status: 'failure', message: 'server side error.' });
    }
};

const withdrawFromMainWallet = async (req, res) => {
  try {
    let { recipient, amount, method } = req.body;
    
    let network_fee = 3 //3 usdt fee

    // Convert amount to Number
    amount = Number(amount);
    network_fee = Number(network_fee);

    // ---------------- VALIDATIONS ----------------
    if (!recipient) {
      return res.status(400).json({ errMsg: "Recipient address is required." });
    }

    if (!amount || amount < 10) {
      return res.status(400).json({ errMsg: "Minimum withdrawal amount is 10 USDT." });
    }

    if (network_fee < 0 || network_fee === undefined) {
      return res.status(400).json({ errMsg: "Network fee is required." });
    }

    if (!method) {
      return res.status(400).json({ errMsg: "Invalid withdrawal method" });
    }

    const payment_mode = method.toUpperCase() // normalize: USDT-TRC20, USDT-BEP20

    // ---------------- USER CHECK ----------------
    const user = await userModel.findById(req.user._id).select("wallets is_blocked");
    if (!user) {
      return res.status(404).json({ errMsg: "User not found" });
    }

    if (user.is_blocked) {
      return res.status(403).json({ errMsg: "User blocked by admin" });
    }

    const walletBalance = Number(user.wallets.main);

    if (walletBalance < amount) {
      return res.status(400).json({ errMsg: "Insufficient wallet balance" });
    }

    // ---------------- CREATE WITHDRAW REQUEST ----------------
    const withdrawRequest = await withdrawalModel.create({
      user: user._id,
      wallet_id: user.wallets.main_id,
      payment_mode,
      amount,
      recipient_address: recipient,
      network_fee,
      status: "pending",
    });

    // ---------------- CREATE TRANSACTION HISTORY ----------------
    const tx = await userTransactionModel.create({
      user: user._id,
      type: "withdrawal",
      payment_mode,
      amount,
      description: `Withdrawal request`,
      related_transaction: withdrawRequest._id,
      transaction_id: withdrawRequest.transaction_id,
      status: "pending",
    });

    // ---------------- UPDATE USER WALLET (ATOMIC) ----------------
    const amountToDeduct = Math.round(amount * 100) / 100;
    const updatedUser = await userModel.findOneAndUpdate(
      { _id: user._id },
      { $inc: { "wallets.main": -amountToDeduct }},
      { new: true, select: "-password" }
    );

    // ---------------- RETURN ----------------
    return res.status(200).json({
      status: "success",
      result: {
        user: updatedUser,
        withdrawal: withdrawRequest,
        transaction: tx,
      },
    });
  } catch (error) {
    console.error("Withdrawal Error:", error);
    return res.status(500).json({
      status: "error",
      errMsg: "Server error processing withdrawal",
      details: error.message,
    });
  }
};


module.exports = { 
    trc20CreateDeposit,
    trc20CheckAndTransferPayment,
    bep20CreateDeposit,
    bep20CheckAndTransferPayment,

    withdrawFromMainWallet
}

