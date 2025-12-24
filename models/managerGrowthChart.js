const mongoose = require("mongoose");
const { Schema } = mongoose;

const compountProfitChartSchema = new Schema(
  {
    manager: {
      type: Schema.Types.ObjectId,
      ref: "managers",
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
  {
    timestamps: true,
  }
);

compountProfitChartSchema.index({ manager: 1, date: 1 });

const compountProfitChartModel = mongoose.model(
  "compount_profit_chart",
  compountProfitChartSchema
);

module.exports = compountProfitChartModel;