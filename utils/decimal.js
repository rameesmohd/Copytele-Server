// Ensures we always store values with maximum 2 decimal places
const toTwoDecimals = (num) => {
  if (num == null || isNaN(num)) return 0;
  return Number(Number(num).toFixed(2));
};

module.exports = { toTwoDecimals };
