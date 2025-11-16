const mongoose = require("mongoose");
const { Schema } = mongoose;

const withdrawalSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      index: true,
      required: true,
    },

    wallet_id: {
      type: String,
      index: true,
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
      index: true,
    },

    network_fee: {
      type: Number,   // FIXED (was "Type")
      default: 0,
    },

    crypto_txid: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    recipient_address: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // Helps avoid duplicate uppercase/lowercase issues
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
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
      default: null,
      trim: true,
    },

    transaction_id: {
      type: String,
      default: () =>
        Math.random().toString(36).substring(2, 10).toUpperCase(),
      index: true,
    },

    related_transaction: {
      type: Schema.Types.ObjectId,
      ref: "user_transactions", // FIXED — should relate to wallet history
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const withdrawalModel = mongoose.model("withdrawals", withdrawalSchema);
module.exports = withdrawalModel;
