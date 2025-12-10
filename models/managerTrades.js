const mongoose = require("mongoose");
const { Schema } = mongoose;

const tradeSchema = new Schema(
    {
      manager: { 
        type: Schema.Types.ObjectId, 
        ref: 'manager', 
        required: true,
        index: true
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
      }  
    },
    {
      timestamps: true, 
    }
);
  
const managerTradeModel = mongoose.model('manager_trades', tradeSchema);

module.exports = managerTradeModel;