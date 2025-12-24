const mongoose = require("mongoose");
const { Schema } = mongoose;

const withdrawalSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    wallet_id: {
      type: String,
      required: true,
    },

    payment_mode: {
      type: String,
      enum: [  
        "USDT-TRC20",
        "USDT-BEP20",
        "USDT-ERC20"
      ],
      required: true,
    },

    network_fee: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Blockchain transaction hash (after payout)
    crypto_txid: {
      type: String,
      default: null,
      trim: true,
      unique: true,
      sparse: true, // ✅ allows multiple nulls
    },

    recipient_address: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    is_payment_sent: {
      type: Boolean,
      default: false,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    transaction_id: {
      type: String,
      unique: true,
      index: true,
      default: () =>
        "WDR-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    },

    related_transaction: {
      type: Schema.Types.ObjectId,
      ref: "user_transactions",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });
withdrawalSchema.index({ payment_mode: 1, status: 1 });

const WithdrawalModel = mongoose.model("withdrawals", withdrawalSchema);
module.exports = WithdrawalModel;
