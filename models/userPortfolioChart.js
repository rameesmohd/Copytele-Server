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
    date: { type: Date, required: true, index: true }, // normalized to midnight UTC
    value: { type: Number, required: true }, // total equity (or percent growth — choose one)
  },
  { timestamps: true }
);

module.exports = mongoose.model("userPortfolioChart", userPortfolioChart);
