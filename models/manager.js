const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ---------------------------------------------------------
   SAFE DECIMAL TRUNCATION (Prevents NaN, Always 2 Decimals)
--------------------------------------------------------- */
const toTwoDecimals = (value) => {
  const n = Number(value);
  if (isNaN(n)) return 0;
  return Math.floor(n * 100) / 100;
};

/* ---------------------------------------------------------
   MANAGER SCHEMA
--------------------------------------------------------- */
const managerSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    id: {
      type: String,
      unique: true,
      default: () => Math.floor(1000000 + Math.random() * 9000000),
      index: true,
    },

    img_url: {
      type: String,
      default: "https://api.dicebear.com/7.x/miniavs/svg?seed=8",
    },

    password: {
      type: String,
      required: true,
    },

    nickname: {
      type: String,
      required: true,
      trim: true,
    },

    platform: {
      type: String,
      enum: ["mt4", "mt5"],
      required: true,
      index: true,
    },

    account_type: {
      type: String,
      enum: ["standard", "raw"],
      required: true,
    },

    performance_fees_percentage: {
      type: Number,
      default: 25,
      set: toTwoDecimals,
    },

    security_deposit: {
      type: Number,
      default: 0,
      set: toTwoDecimals,
    },

    trading_interval: {
      type: String,
      enum: ["weekly", "daily", "monthly"],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    open_trade_profit: {
      type: Number,
      default: 0,
      set: toTwoDecimals,
    },

    closed_trade_profit: {
      type: Number,
      default: 0,
      set: toTwoDecimals,
    },

    total_trade_profit: {
      type: Number,
      default: 0,
      set: toTwoDecimals,
    },

    min_initial_investment: {
      type: Number,
      required: true,
    },

    min_top_up: {
      type: Number,
      required: true,
    },

    min_withdrawal: {
      type: Number,
      required: true,
    },

    referral_perc: {
      type: Number,
      default: 0,
    },

    total_funds: {
      type: Number,
      default: 0,
      set: toTwoDecimals,
      index: true,
    },

    risks: {
      type: Number,
      min: 1,
      max: 10,
      required: true,
    },

    compound: {
      type: Number,
      default: 0,
    },

    total_return: {
      type: Number,
      default: 0,
      set: toTwoDecimals,
    },

    total_deposit: { 
      type: Number, 
      default: 0.0 ,
      set: toTwoDecimals
    },

    total_investors: {
      type: Number,
      default: 0,
      index: true,
    },

    win_rate: {
      type: Number,
      default: 0,
    },

    leverage: {
      type: String,
      enum: ["1:50", "1:100", "1:200", "1:500", "1:1000"],
      required: true,
    },

    max_drawdown: {
      type: Number,
      default: 0,
    },

    trading_liquidity_period: {
      type: Number,
      default: 30,
    },

    total_performance_fee_collected: {
      type: Number,
      default: 0,
      set: toTwoDecimals,
    },
    joined_at : {
      type : Date
    }
  },
  { timestamps: true }
);

/* ---------------------------------------------------------
   PRE-SAVE HOOK FOR NUMERIC SAFETY
--------------------------------------------------------- */
managerSchema.pre("save", function (next) {
  const decimalFields = [
    "open_trade_profit",
    "closed_trade_profit",
    "total_trade_profit",
    "total_funds",
    "performance_fees_percentage",
    "security_deposit",
    "total_return",
    "total_performance_fee_collected",
  ];

  decimalFields.forEach((field) => {
    if (this[field] !== undefined) {
      this[field] = toTwoDecimals(this[field]);
    }
  });

  next();
});

/* ---------------------------------------------------------
   VIRTUAL FIELDS (Auto Computed)
--------------------------------------------------------- */

// ROI percentage
managerSchema.virtual("roi").get(function () {
  if (this.total_funds <= 0) return 0;
  return toTwoDecimals((this.total_return / this.total_funds) * 100);
});

// Total profit = closed + open
managerSchema.virtual("overall_profit").get(function () {
  return toTwoDecimals(this.open_trade_profit + this.closed_trade_profit);
});

/* ---------------------------------------------------------
   CLEAN RESPONSE (Hide Sensitive Data)
--------------------------------------------------------- */
managerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

/* ---------------------------------------------------------
   CREATE MODEL
--------------------------------------------------------- */
const managerModel = mongoose.model("managers", managerSchema);
module.exports = managerModel;
