// helper to move sendAt forward based on scheduleType
const getNextSendAt=(msg, now)=> {
  const base = now || new Date();

  if (msg.scheduleType === "daily") {
    return new Date(base.getTime() + 24 * 60 * 60 * 1000);
  }

  if (msg.scheduleType === "weekly") {
    return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  if (msg.scheduleType === "every_n_days") {
    const days = msg.nDays || 1;
    return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // "once" or unknown: no next send
  return null;
}

module.exports= getNextSendAt
