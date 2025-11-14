const {TronWeb}  = require('tronweb');
const depositsModel = require('../../models/deposit');

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


//---------------------------------BEP20-------------------------------

const { Web3 } = require('web3');
const { ethers } = require("ethers");

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
                amount: amount
            }
        });
        
    } catch (error) {
        console.error("BEP20 deposit error:", error);
        return res.status(500).json({
            errMsg: "Server error creating deposit"
        });
    }
};

module.exports = { 
    trc20CreateDeposit,
    bep20CreateDeposit
}

