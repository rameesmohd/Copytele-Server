const mongoose = require("mongoose");
const { Schema } = mongoose;

const rolloverSchema = new Schema({
  period: {
    type: String,
    enum: ["15min", "4hr", "daily"],
    required: true,
  },

  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },

  start_time: { type: Date, required: true },

  processed_at: { type: Date },

  next_rollover_time: { type: Date, required: true },

  processed_transactions: [
    { type: mongoose.Schema.Types.ObjectId, ref: "investment_transactions" },
  ],

  failure_reason: { type: String },

  summary: {
    total_deposits: { type: Number, default: 0 },
    total_withdrawals: { type: Number, default: 0 },
    profit_distributed: { type: Number, default: 0 },
  },

}, { timestamps: true });

const rolloverModel = mongoose.model('rollover', rolloverSchema);
module.exports = rolloverModel;