const mongoose = require("mongoose");

const scheduledMessageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["text", "audio", "video", "image"], required: true },
    caption: { type: String },
    fileId: { type: String },
    buttons: [{ text: String, url: String }],
    delayMinutes: { type: Number, required: true },
    audience: { type: String, enum: ["all", "new", "single"], default: "all" },
    singleUserId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("scheduledMessage", scheduledMessageSchema);
