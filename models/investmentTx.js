const mongoose = require("mongoose");
const { Schema } = mongoose;

const investmentTransactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    investment: {
      type: Schema.Types.ObjectId,
      ref: "investments",
      required: true,
    },

    manager: {
      type: Schema.Types.ObjectId,
      ref: "managers",
      required: true,
    },

    // deposit → money entering investment
    // withdrawal → money going back to user
    // manager_fee → periodic fee deducted
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "manager_fee"],
      required: true,
    },

    from: {
      type: String,
      default: null,
    },

    to: {
      type: String,
      default: null,
    },

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

    comment: {
      type: String,
      default: "",
    },

    transaction_id: {
      type: String,
      default: () =>
        "ITX-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    },

    related_transaction: {
      type: Schema.Types.ObjectId,
      ref: "user_transactions",
      default: null,
    },

    deduction: {
      type: Number,
      default: 0,
    },

    is_deducted: {
      type: Boolean,
      default: false,
    },

    rollover_id: {
      type: Schema.Types.ObjectId,
      ref: "rollover",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

investmentTransactionSchema.index({
  investment: 1,
  type: 1,
  status: 1,
  createdAt: -1,
});

investmentTransactionSchema.index({
  user: 1,
  createdAt: -1,
});

investmentTransactionSchema.index({
  manager: 1,
  createdAt: -1,
});

investmentTransactionSchema.index(
  { transaction_id: 1 },
  { unique: true }
);

investmentTransactionSchema.index({ 
  status: 1, 
  type: 1 
});

const InvestmentTransaction = mongoose.model(
  "investment_transactions",
  investmentTransactionSchema
);

module.exports = InvestmentTransaction;
