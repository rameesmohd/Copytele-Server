const mongoose = require("mongoose");
const { Schema } = mongoose;

const botUserSchema = new Schema(
  {
    is_active: { type : Boolean,default : true },
    id: { type: Number, required: true },
    username: { type: String, default: null },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    photo_url: { type: String, default: null },
    is_premium: { type: Boolean, default: false },
    referred_by: { type: String, default: null },
    // -------- Funnel & automation flags --------
    is_opened_webapp: { type: Boolean, default: false },
    is_invested: { type: Boolean, default: false },
    is_joined_channel: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Telegram user lookup
botUserSchema.index({ id: 1 }, { unique: true });

// Funnel automation
botUserSchema.index({ is_active: 1 });
botUserSchema.index({ is_joined_channel: 1 });
botUserSchema.index({ is_invested: 1 });

// Referral tracking
botUserSchema.index({ referred_by: 1 });

botUserSchema.index({ is_opened_webapp: 1, is_invested: 1 });

module.exports = mongoose.model("bot_users", botUserSchema);
