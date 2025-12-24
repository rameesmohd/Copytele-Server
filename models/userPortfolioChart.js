const mongoose = require("mongoose");
const { Schema } = mongoose;

const userPortfolioChartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);


userPortfolioChartSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model(
  "user_portfolio_chart",
  userPortfolioChartSchema
);
