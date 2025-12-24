const mongoose = require("mongoose");
const { Schema } = mongoose;

const rolloverSchema = new Schema(
  {
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

    start_time: {
      type: Date,
      required: true,
    },

    processed_at: {
      type: Date,
      default: null,
    },

    next_rollover_time: {
      type: Date,
      required: true,
    },

    processed_transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: "investment_transactions",
      },
    ],

    failure_reason: {
      type: String,
      default: null,
    },

    summary: {
      total_deposits: { type: Number, default: 0 },
      total_withdrawals: { type: Number, default: 0 },
      profit_distributed: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

rolloverSchema.index({ status: 1, start_time: -1 });
rolloverSchema.index({ status: 1, next_rollover_time: 1 });
rolloverSchema.index({ createdAt: -1 });

const rolloverModel = mongoose.model('rollover', rolloverSchema);
module.exports = rolloverModel;