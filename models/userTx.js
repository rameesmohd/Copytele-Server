const mongoose = require("mongoose");
const { Schema } = mongoose;

const transactionSchema = new Schema({
    user: { 
      type: Schema.Types.ObjectId, 
      ref: "users", 
      required: true,
      index: true
    },

    // deposit / withdrawal / transfer / profit
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "transfer"],
      required: true,
      index: true
    },

    // blockchain network or system wallet
    payment_mode: {
        type: String,
        enum: [
          "main-wallet",
          "USDT-TRC20",
          "USDT-BEP20",
          "USDT-ERC20",
          "bank-transfer"
        ],
        default: "main-wallet",
    },

    // Status only needed for deposit/withdrawal
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    // OPTIONAL: Investment reference
    investment: {
      type: Schema.Types.ObjectId,
      ref: "investments",
      default: null,
      index: true
    },

    // Descriptions like:
    // "Deposit from TRC20 wallet"
    // "Transferred to Investment #INV123"
    // "Profit credited from Investment #INV123"
    description: {
      type: String,
      default: ""
    },

    transaction_id: {
      type: String,
      default: () => "TX-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      index: true
    },
},
    { timestamps: true }
);

transactionSchema.index({ createdAt: -1 });

const UserTransaction = mongoose.model("user_transactions", transactionSchema);
module.exports = UserTransaction;
