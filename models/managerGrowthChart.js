const mongoose = require("mongoose");
const { Schema } = mongoose;

const compountProfitChart = new Schema({
    manager: {   
      type: Schema.Types.ObjectId, 
      index : true,
      ref: 'managers',  
    },
    date: { 
      type: Date, 
      required: true 
    },
    value: { 
      type: Number, 
      required: true 
    }
  },
  {
    timestamps: true,
  }
);
  
const compountProfitChartModel = mongoose.model('compountProfitChart', compountProfitChart);
module.exports = compountProfitChartModel;