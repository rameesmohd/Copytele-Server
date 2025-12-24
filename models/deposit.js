const mongoose = require("mongoose");
const crypto = require("crypto");
const { Schema } = mongoose;

const depositSchema = new Schema(
  {
    // Internal user reference (PRIMARY)
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    // External / Telegram / public user id (SECONDARY)
    user_id: {
      type: String,
      required: true,
    },

    payment_mode: {
      type: String,
      enum: ["USDT-TRC20","USDT-BEP20"],
      required: true,
    },

    // Blockchain tx hash (filled after confirmation)
    crypto_txid: {
      type: String,
      default: null,
    },

    payment_address: {
      type: String,
      required: true,
    },

    // ⚠️ NEVER expose this field in API responses
    private_key: {
      type: String,
      required: true,
      select: false, // 🔒 security
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    is_payment_recieved: {
      type: Boolean,
      default: false,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      default: "",
    },

    transaction_id: {
      type: String,
      unique: true,
      index: true,
      default: () =>
        crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(),
    },

    related_transaction: {
      type: Schema.Types.ObjectId,
      ref: "investment_transactions",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

depositSchema.index(
  { 
    user: 1, 
    payment_mode: 1, 
    status: 1 
  },
);

depositSchema.index({
  status: 1,
  createdAt: -1,
});

depositSchema.index({
  user_id: 1,
});

const DepositsModel = mongoose.model("deposits", depositSchema);
module.exports = DepositsModel;
