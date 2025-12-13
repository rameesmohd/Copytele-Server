const mongoose = require("mongoose");
const { Schema } = mongoose;

const userPortfolioChart = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      index: true,
      required: true,
    },
    date: { 
      type: Date, 
      required: true, 
      index: true 
    }, 
    value: { 
      type: Number, 
      required: true 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("user_portfolio_chart", userPortfolioChart);
