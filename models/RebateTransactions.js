const mongoose = require("mongoose");
const { Schema } = mongoose;

const RebateTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  investment_id: { type: mongoose.Schema.Types.ObjectId, ref: "investments" },
  amount: Number,
  type: String, // earned, withdrawal, adjusted
  status: String,
  description: String,
  date: { type: Date, default: Date.now }
});

const RebateTransaction = mongoose.model("rebate_transactions", RebateTransactionSchema);
module.exports = RebateTransaction;
