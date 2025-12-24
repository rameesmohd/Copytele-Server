const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const rebateTransactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    investment: {
      type: Schema.Types.ObjectId,
      ref: "investments",
      default: null,
    },

    type: {
      type: String,
      enum: ["commission", "withdrawal", "transfer"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
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
      unique: true, // ✅ guaranteed uniqueness
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================
   AUTO TRANSACTION ID
   ========================= */
rebateTransactionSchema.pre("save", function (next) {
  if (!this.transaction_id) {
    this.transaction_id = uuidv4()
      .replace(/-/g, "")
      .slice(0, 10)
      .toUpperCase();
  }
  next();
});

// User rebate timeline
rebateTransactionSchema.index({
  user: 1,
  createdAt: -1,
});

// User + status filtering (approved, pending)
rebateTransactionSchema.index({
  user: 1,
  status: 1,
  createdAt: -1,
});

rebateTransactionSchema.index({
  investment: 1 
});

rebateTransactionSchema.index({
  investment: 1,
  createdAt: -1,
});

const rebateTransactionModel =
  mongoose.models.rebate_transactions ||
  mongoose.model("rebate_transactions", rebateTransactionSchema);

module.exports = rebateTransactionModel;
