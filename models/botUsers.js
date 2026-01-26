const mongoose = require("mongoose");
const { Schema } = mongoose;

const botUserSchema = new Schema(
  {
    id: { type: Number, required: true },
    username: { type: String, default: null },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    photo_url: { type: String, default: null },
    is_premium: { type: Boolean, default: false },
    referred_by: { type: String, default: null },
    
    is_active: { type : Boolean,default : true },
    inactive_reason: { type: String, default: null },
    inactive_at: { type: Date, default: null },
    
    is_second_bot : {type : Boolean,default : false },
    // -------- Funnel & automation flags --------
    is_opened_webapp: { type: Boolean, default: false },
    is_invested: { type: Boolean, default: false },
    is_joined_channel: { type: Boolean, default: false },
    is_claimed_bonus: { type: Boolean, default: false },
  },
  { timestamps: true }
);

botUserSchema.index({ id: 1 }, { unique: true });

botUserSchema.index({ is_active: 1, is_opened_webapp: 1 });
botUserSchema.index({ is_active: 1, is_invested: 1 });
botUserSchema.index({ is_active: 1, is_joined_channel: 1 });
botUserSchema.index({ is_active: 1, is_invested: 1, is_claimed_bonus: 1 });

botUserSchema.index({ referred_by: 1 });

module.exports = mongoose.model("bot_users", botUserSchema);
