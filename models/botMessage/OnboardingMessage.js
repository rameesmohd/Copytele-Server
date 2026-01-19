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
      enum: ["url", "webapp", "callback"],
      default: "url"
    },
    url: {
      type: String,
      required: true
    },
    command: { 
      type: String, 
      default: null 
    },
  },
  { _id: false }
);

const onboardingMessageSchema = new mongoose.Schema(
  {
    name: {type: String},
    type: { type: String, enum: ["text", "audio", "video", "image"], required: true },
    caption: { type: String },
    fileId: { type: String },
    buttons: {
      type : [buttonSchema],
      default  :[]
    },
    delayMinutes: { type: Number, default : 0 }, 
    isActive: { type: Boolean, default: false },
    sentCount : { type : Number , default : 0},
    order : { type : Number ,default :0 },
    
    command: { 
      type: String, 
      default: null, 
    },
    inline : {type : Boolean , default : false},
    pin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

onboardingMessageSchema.index({ isActive: 1, order: 1 });
onboardingMessageSchema.index({ order: 1 });
onboardingMessageSchema.index({ command: 1 });


module.exports = mongoose.model("onboarding_messages", onboardingMessageSchema);
