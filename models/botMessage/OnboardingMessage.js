const mongoose = require("mongoose");

const onboardingMessageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["text", "audio", "video", "image"], required: true },
    caption: { type: String },
    fileId: { type: String },
    buttons: [{ text: String, url: String }],
    delayMinutes: { type: Number, default : 0 }, 
    isActive: { type: Boolean, default: false },
    sentCount : { type : Number , default : 0},
    order : { type : Number ,default :0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("OnboardingMessage", onboardingMessageSchema);
