const mongoose = require("mongoose");

const twoDecimalPlaces = (value) => Number(parseFloat(value).toFixed(2));

const userSchema = new mongoose.Schema({
  login_type: {
    type: String,
    enum: ["telegram", "web"],
    required: true
  },

  user_id: { type: String, unique: true, sparse: true },

  /* TELEGRAM USERS */
  telegram: {
    id: { type: String, unique: true, sparse: true },
    username: String,
    first_name: String,
    last_name: String,
    photo_url: String,
    is_premium: Boolean,
  },

  /* WEBSITE USERS */
  email: {
    type: String,
    lowercase: true,
    sparse: true,
  },
  password: { type: String },

  first_name: String,
  last_name: String,
  mobile: String,
  country: String,
  country_code: String,
  date_of_birth: Date,

  is_blocked: { type: Boolean, default: false },

  kyc: {
    is_email_verified: { type: Boolean, default: false },
    is_verified: { type: Boolean, default: false },
    step: { type: Number, default: 0, min: 0, max: 4 },
    identify_proof: [String],
    identify_proof_status: { type: String, enum: ["submitted", "verified", "unavailable"], default: "unavailable" },
    residential_proof: [String],
    residential_proof_status: { type: String, enum: ["submitted", "verified", "unavailable"], default: "unavailable" },
  },

  wallets: {
    main_id: {
      type: String,
      default: () => Math.random().toString(36).substring(2, 10).toUpperCase(),
      unique: true,
    },
    main: { type: Number, default: 0, set: twoDecimalPlaces },

    rebate_id: {
      type: String,
      default: () => Math.random().toString(36).substring(2, 10).toUpperCase(),
      unique: true,
    },
    rebate: { type: Number, default: 0, set: twoDecimalPlaces },
  },

  referral: {
    total_earned_commission: { type: Number, default: 0, set: twoDecimalPlaces },
    total_referrals: { type: Number, default: 0 },
    referred_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    investments: [
      {
        investment_id: { type: mongoose.Schema.Types.ObjectId, ref: "investments" },
        rebate_recieved: { type: Number, default: 0, set: twoDecimalPlaces }
      }
    ]
  },

  currToken : String
}, { timestamps: true });

/* PERFORMANCE INDEXES */
userSchema.index({ login_type: 1 });
userSchema.index({ createdAt: -1 });
// userSchema.index({ "telegram.id": 1 });
userSchema.index({ "referral.referred_by": 1 });
userSchema.index({ "wallets.main": -1 });

module.exports = mongoose.model("users", userSchema);
