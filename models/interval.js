const mongoose = require("mongoose");
const { Schema } = mongoose;

const intervalSchema = new Schema({
    period: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        required: true,
        default: "weekly"
    },

    status: { 
        type: String, 
        enum: ["pending", "completed", "failed"],
        default: "pending"
    },

    // Date range of current interval
    current_interval_start: { type: Date, required: true },
    current_interval_end: { type: Date, required: true },

    // Readable string: "Feb 18–24 2025"
    current_intervel: { type: String, required: true },

    // Unique interval number
    interval_index: { type: String }, // Example: "2025-W07"

    // How many investments were updated?
    total_investments_processed: { type: Number, default: 0 }
    
}, { timestamps: true });

intervalSchema.index({ status: 1, createdAt: -1 });
intervalSchema.index({ interval_index: 1 }, { unique: true });
  
const intervalModel = mongoose.model('interval', intervalSchema);
module.exports = intervalModel;