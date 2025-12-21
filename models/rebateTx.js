const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const rebateTransactionSchema = new Schema(
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
      sparse : true
    },
    type: {
      type: String,
      enum: ["commission", "withdrawal", "transfer"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
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
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Auto-generate unique transaction ID before save (if missing)
 */
rebateTransactionSchema.pre("save", function (next) {
  if (!this.transaction_id) {
    this.transaction_id = uuidv4().split("-")[0].toUpperCase(); // e.g. "3F7A2B9C"
  }
  next();
});

// Compound index for fast reporting
rebateTransactionSchema.index({ user: 1, createdAt: -1 });
rebateTransactionSchema.index({ type: 1, createdAt: -1 });

const rebateTransactionModel =
  mongoose.models.rebate_transactions ||
  mongoose.model("rebate_transactions", rebateTransactionSchema);

module.exports = rebateTransactionModel;
