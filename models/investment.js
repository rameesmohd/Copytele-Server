const mongoose = require("mongoose");
const { Schema } = mongoose;

// Helper function to calculate the unlocked date considering only trading days (weekdays)
function calculateUnlockedDate(startDate, lockDuration) {
    // Unlimited lock
    if (lockDuration === null || lockDuration === -1) {
      return null;
    }
    let unlockedDate = new Date(startDate);
    let daysAdded = 0;
  
    while (daysAdded < lockDuration) {
      // Increment the date by 1 day
      unlockedDate.setDate(unlockedDate.getDate() + 1);
  
      // Check if it's a weekday (Monday to Friday)
      const dayOfWeek = unlockedDate.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }
    return unlockedDate;
}

const DepositSchema = new Schema({
  amount: { type: Number, required: true },
  deposited_at: { type: Date, default: Date.now }, // When the deposit was made
  kind: { type: String, enum: ["cash", "bonus"], default: "cash" }, 
  lock_duration: { type: Number, required: true }, // Lock period in days
  unlocked_at: {
    type: Date,
    default: function () {
      return calculateUnlockedDate(this.deposited_at, this.lock_duration);
    },
  },
});

const truncateToTwoDecimals = (num) => {
  return Math.floor(num * 100) / 100;
};

const investmentSchema = new Schema(
  {
    inv_id: { type : String, default:()=>Math.random().toString(36).substring(2, 10).toUpperCase() }, 
    user: { type: Schema.Types.ObjectId, ref: 'users' },
    manager: { type: Schema.Types.ObjectId, ref: 'managers' },
    manager_nickname: { type: String, required: true },
    status: { type: String, enum: ["active", "closed","inactive"], default: "active" },
    trading_interval: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    min_initial_investment: { type: Number, required: true },
    min_top_up: { type: Number, required: true },
    min_withdrawal : { type : Number ,required : true },
    trading_liquidity_period: { type: Number, required: true },
    manager_performance_fee: { type: Number, required: true },

    deposits: [DepositSchema], 

    total_trade_profit: { type: Number, default: 0, set: truncateToTwoDecimals },
    open_trade_profit: { type: Number, default: 0, set: truncateToTwoDecimals },
    closed_trade_profit: { type: Number, default: 0, set: truncateToTwoDecimals },

    total_equity: { type: Number, default: 0, set: truncateToTwoDecimals },
    current_interval_profit: { type: Number, default: 0, set: truncateToTwoDecimals },
    current_interval_profit_equity: { type: Number, default: 0, set: truncateToTwoDecimals },

    total_deposit: { type: Number, default: 0, set: truncateToTwoDecimals },
    total_withdrawal: { type: Number, default: 0, set: truncateToTwoDecimals },

    net_profit: { type: Number, default: 0, set: truncateToTwoDecimals },

    performance_fee_paid: { type: Number, default: 0, set: truncateToTwoDecimals },
    performance_fee_projected: { type: Number, default: 0, set: truncateToTwoDecimals },

    referred_by: { type: Schema.Types.ObjectId, ref: "users" },

    last_rollover: { type: Schema.Types.ObjectId, ref: "rollover" },
  },
  { timestamps: true }
);


// One investment per user per manager
investmentSchema.index(
  { user: 1, manager: 1 },
  { unique: true }
);

// User dashboard
investmentSchema.index({
  user: 1,
  createdAt: -1
});

// Manager dashboard
investmentSchema.index({
  manager: 1,
  createdAt: -1
});

// Referral tracking
investmentSchema.index({
  referred_by: 1,
  createdAt: -1
});

const InvestmentModel = mongoose.model("investments", investmentSchema);
module.exports = InvestmentModel;
