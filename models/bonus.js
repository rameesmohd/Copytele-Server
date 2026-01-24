const mongoose = require("mongoose");
const { Schema } = mongoose;

const BonusSchema = new Schema(
  {
    manager: {
      type: Number,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["claim", "coupon"],
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"], 
      default: "inactive",  
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    code: {
      type: String,
      default: null,
      trim: true,
      index: true,
      sparse: true,
    },

    max_uses: {
      type: Number,
      default: null, // null = unlimited uses
      min: 1,
    },

    used_count: {
      type: Number,
      default: 0,
      min: 0,
    },

    comment: {
      type: String,
      default: "",
      trim: true,
    },

    expire_on: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Optional: prevent duplicate coupon codes (if you use codes)
BonusSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: "string" } } }
);

module.exports = mongoose.model("bonus", BonusSchema);
