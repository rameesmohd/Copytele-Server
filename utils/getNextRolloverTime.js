// Add fixed time based on period
const addPeriod = (date, period) => {
  const next = new Date(date);

  switch (period) {
    case "15min":
      next.setMinutes(next.getMinutes() + 15);
      break;

    case "4hr":
      next.setHours(next.getHours() + 4);
      break;

    case "daily":
      next.setDate(next.getDate() + 1);
      break;
  }
  return next;
};

// Ensure target date falls on a weekday (Mon–Fri)
const moveToNextWeekday = (date) => {
  const next = new Date(date);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

// Compute next rollover time
const getNextRolloverTime = (currentTime, period) => {
  let next = addPeriod(currentTime, period);
  return moveToNextWeekday(next);
};

module.exports = { getNextRolloverTime };
