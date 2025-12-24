const mongoose = require("mongoose");

const twoDecimalPlaces = (value) =>
  Number(parseFloat(value || 0).toFixed(2));

const userSchema = new mongoose.Schema(
  {
    login_type: {
      type: String,
      enum: ["telegram", "web"],
      required: true,
    },

    user_id: {
      type: String,
    },

    telegram: {
      id: {
        type: String,
      },
      username: String,
      first_name: String,
      last_name: String,
      photo_url: String,
      is_premium: Boolean,
    },

    /* ---------------- WEB ---------------- */
    email: {
      type: String,
      lowercase: true,
    },
    password: String,

    /* ---------------- PROFILE ---------------- */
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
    total_earned_commission: { 
      type: Number, 
      default: 0, 
      set: twoDecimalPlaces 
    },
    total_referrals: { 
      type: Number, 
      default: 0 
    },
    referred_by: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "users" 
    },
    referrals: [
      { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "users" 
      }
    ],
    investments: [
      {
        investment_id: { type: mongoose.Schema.Types.ObjectId, ref: "investments" },
        rebate_recieved: { type: Number, default: 0, set: twoDecimalPlaces },
        date: { type: Date, default: Date.now }
      }
    ]
  },

  currToken : String
}, { timestamps: true });

// Telegram login
userSchema.index(
  { "telegram.id": 1 },
  { unique: true, sparse: true }
);

// Unified login (telegram + web)
userSchema.index(
  { user_id: 1 },
  { unique: true, sparse: true }
);

// Web login
userSchema.index(
  { email: 1 },
  { unique: true, sparse: true }
);

// Referral system
userSchema.index({ "referral.referred_by": 1 });

// Admin listing (optional but safe)
userSchema.index({ createdAt: -1 });


module.exports = mongoose.model("users", userSchema);
