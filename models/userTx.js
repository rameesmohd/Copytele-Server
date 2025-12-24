const mongoose = require("mongoose");
const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    // deposit / withdrawal / transfer
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "transfer"],
      required: true,
    },

    // blockchain / internal wallet
    payment_mode: {
      type: String,
      enum: [
        "main-wallet",
        "USDT-TRC20",
        "USDT-BEP20",
        "USDT-ERC20",
        "bank-transfer",
        "rebate-wallet",
      ],
      default: "main-wallet",
    },

    // Only meaningful for deposit / withdrawal
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    from: {
      type: String,
      default: null,
    },

    to: {
      type: String,
      default: null,
    },

    // Optional investment reference
    investment: {
      type: Schema.Types.ObjectId,
      ref: "investments",
      default: null,
    },

    description: {
      type: String,
      default: "",
    },

    transaction_id: {
      type: String,
      default: () =>
        "TX-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Main transaction filtering + pagination
transactionSchema.index({
  user: 1,
  type: 1,
  status: 1,
  createdAt: -1,
});

// Wallet timeline (MT5-style history)
transactionSchema.index({
  user: 1,
  createdAt: -1,
});

// Investment-related account view
transactionSchema.index({
  investment: 1,
  user: 1,
  createdAt: -1,
});

// Audit / reconciliation
transactionSchema.index({
  transaction_id: 1,
});

const UserTransaction = mongoose.model("user_transactions", transactionSchema);
module.exports = UserTransaction;
