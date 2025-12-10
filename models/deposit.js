const mongoose = require("mongoose");
const crypto = require("crypto")
const { Schema } = mongoose;

const depositSchema = new Schema({
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'users', 
      index: true 
    },
    user_id: { 
      type: String, 
      index: true 
    },
    payment_mode : {
        type: String,
        enum : ["USDT-TRC20","USDT-BEP20"],
        required: true
    },
    crypto_txid : {
        type : String
    },
    payment_address : {
      type : String
    },
    private_key : {
      type : String
    },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending',
      index: true 
    },
    is_payment_recieved : {
      type: Boolean,
      default: false
    },
    amount: { 
      type: Number, 
      required: true 
    },
    description: {
      type : String,
      required : false
    },
    transaction_id: { 
      type: String, 
      default: () => crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
    },
    related_transaction: { 
      type: Schema.Types.ObjectId, 
      ref: 'investment_transactions' 
    },
  },
  {
    timestamps: true,
  }
);
  
const depositsModel = mongoose.model('deposits', depositSchema);
module.exports = depositsModel;