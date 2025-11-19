const mongoose = require("mongoose");
const { Schema } = mongoose;

const intervalSchema = new Schema({
    period: {
        type: String,
        enum: ["daily", "weekly","monthly"],
        required: true,
        default : "weekly"
    },
    status: { 
      type: String, 
      enum: ["pending", "completed", "failed"],
      default: 'pending' 
    },
    current_interval_start: {
        type: Date,
    },
    current_interval_end: { 
        type: Date, 
    },
    current_intervel : {
      type : String
    }
  },{ timestamps: true }
);
  
const intervalModel = mongoose.model('interval', intervalSchema);
module.exports = intervalModel;