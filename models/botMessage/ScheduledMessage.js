const mongoose = require("mongoose");

const buttonSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["url", "webapp"],
      default: "url"
    },
    url: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const scheduledMessageSchema = new mongoose.Schema(
  {
    name  : { type: String },
    type: { type: String, enum: ["text", "audio", "video", "image"], required: true },
    caption: { type: String },
    fileId: { type: String },
    buttons: {
      type: [buttonSchema],
      default: []
    },

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

    isActive: { type: Boolean, default: false },
    isSend: { type: Boolean, default: false }, // only meaningful for 'once'
    sentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

scheduledMessageSchema.index({ isActive: 1, order: 1 });
scheduledMessageSchema.index({ isActive: 1, sendAt: 1 });

module.exports = mongoose.model("scheduled_messages", scheduledMessageSchema);
