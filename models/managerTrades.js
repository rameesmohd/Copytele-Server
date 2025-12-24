const mongoose = require("mongoose");
const { Schema } = mongoose;

const tradeSchema = new Schema(
    {
      manager: { 
        type: Schema.Types.ObjectId, 
        ref: 'manager', 
        required: true,
      },
      symbol : { 
        type: String, 
        required: true 
      },
      manager_volume : {
        type :String ,
        required : true
      },
      type : {
        type :String ,
        enum:['buy','sell'],
        required : true
      },
      open_price: { 
        type: String, 
        required: true 
      }, 
      close_price: { 
        type: String, 
        required: true 
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
      is_distributed : {
        type : Boolean,
        default : false
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
  
// Add index for better query performance
tradeSchema.index({ is_distributed: 1 });
tradeSchema.index({ manager: 1, is_distributed: 1, close_time: -1 });
tradeSchema.index({ manager: 1, close_time: -1 });
tradeSchema.index({ manager: 1, createdAt: -1 });


const managerTradeModel = mongoose.model('manager_trades', tradeSchema);

module.exports = managerTradeModel;