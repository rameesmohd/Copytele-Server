const mongoose = require("mongoose");
const { Schema } = mongoose;

const investmentTransactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },

    investment: {
      type: Schema.Types.ObjectId,
      ref: "investments",
      required: true,
      index: true,
    },

    manager: {
      type: Schema.Types.ObjectId,
      ref: "managers",
      required: true,
      index: true,
    },

    // deposit → money entering investment
    // withdrawal → money going back to user
    // manager_fee → monthly/weekly fee deducted
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "manager_fee"],
      required: true,
      index: true,
    },

    // From and To show source/destination reference
    from: {
      type: String,
      default: null,
    },

    to: {
      type: String,
      default: null,
    },

    // unified status naming across app:
    // pending → waiting for manager approval / blockchain validation
    // success → fully completed
    // failed → reversed
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Optional description
    comment: {
      type: String,
      default: "",
    },

    transaction_id: {
      type: String,
      unique: true,
      default: () =>
        "ITX-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      index: true,
    },

    // Reference to the user transaction if it exists
    related_transaction: {
      type: Schema.Types.ObjectId,
      ref: "user_transactions",
      default: null,
    },

    // For manager_fee or penalties
    deduction: {
      type: Number,
      default: 0,
    },

    is_deducted: {
      type: Boolean,
      default: false,
    },

    // For rollover tracking of investment life cycle
    rollover_id: {
      type: Schema.Types.ObjectId,
      ref: "rollover",
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/* ------- Indexes for faster queries ------- */
investmentTransactionSchema.index({ user: 1, createdAt: -1 });
investmentTransactionSchema.index({ investment: 1, createdAt: -1 });
investmentTransactionSchema.index({ manager: 1 });
investmentTransactionSchema.index({ type: 1 });

const InvestmentTransaction = mongoose.model(
  "investment_transactions",
  investmentTransactionSchema
);

module.exports = InvestmentTransaction;
