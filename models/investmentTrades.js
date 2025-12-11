const mongoose = require("mongoose");
const crypto = require("crypto")
const { Schema } = mongoose;

const tradeSchema = new Schema(
    {
      manager: { 
        type: Schema.Types.ObjectId, 
        ref: 'manager', 
        required: true, 
        index : true
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
        index: true
      },
      investment : {
        type: Schema.Types.ObjectId, 
        ref: 'investments', 
        required: true,
        index: true
      },
      manager_trade :  { 
        type: Schema.Types.ObjectId, 
        ref: 'manager_trades', 
        required: true },
      type :{
        type :String,
        enum:['buy','sell'],
        required : true
      },
      symbol : { 
        type: String, 
        required: true 
      },
      manager_volume : {
        type :String ,
        required : true
      },
      open_price: { 
        type: String, 
        required: true 
      }, 
      close_price: { 
        type: String, 
        required: true,
        index: true
      }, 
      swap : {
        type : String, 
        default : 0
      },
      open_time: { 
        type: Date, 
        required: true 
      }, 
      close_time: { 
        type: Date, 
        required: true 
      },
      manager_profit: { 
        type: Number, 
        required: true 
      }, 
      rollover_id : { 
        type: Schema.Types.ObjectId, 
        ref: 'rollover' 
      },
      txid: { 
        type: String, 
        default: () => crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
      },
      investor_profit : { 
        type: Number, 
        required: true 
      }, 
      // ✅ Take Profit & Stop Loss
      take_profit: {
        type: String,
        default: null
      },
      stop_loss: {
        type: String,
        default: null
      },
      // ✅ Flags to track if TP or SL was hit
      tp_hit: {
        type: Boolean,
        default: false
      },
      sl_hit: {
        type: Boolean,
        default: false
      },
    },
    {
      timestamps: true,
    }
  );
  
tradeSchema.index({ manager: 1, createdAt: -1 });
tradeSchema.index({ manager: 1, close_time: -1 });

const investorTradeModel = mongoose.model('investor_trades', tradeSchema);

module.exports = investorTradeModel;