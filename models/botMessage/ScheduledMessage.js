const mongoose = require("mongoose");

const scheduledMessageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["text", "audio", "video", "image"], required: true },
    caption: { type: String },
    fileId: { type: String },
    buttons: [{ text: String, url: String }],

    // when to send next
    sendAt: { type: Date, required: true },

    // recurrence setup
    scheduleType: {
      type: String,
      enum: ["once", "daily", "weekly", "every_n_days"],
      default: "once",
    },
    nDays: { type: Number, default: null }, // used only for every_n_days

    // audience filters
    audience: {
      type: String,
      enum: [
        "all",
        "single",
        "not_opened_webapp",
        "not_invested",
        "not_joined_channel",
        "invested",
      ],
      default: "all",
    },
    singleUserId: { type: String, default: null },

    isActive: { type: Boolean, default: true },
    isSend: { type: Boolean, default: false }, // only meaningful for 'once'
    sentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScheduledMessage", scheduledMessageSchema);
