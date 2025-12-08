const mongoose = require('mongoose');
const { Schema } = mongoose;

const userMessageJobSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'botUser', required: true },
    chat_id: { type: Number, required: true },
    template_key: { type: String, required: true }, 
    send_at: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserMessageJob', userMessageJobSchema);