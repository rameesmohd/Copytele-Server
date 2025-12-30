// helper to move sendAt forward based on scheduleType
const getNextSendAt = (msg) => {
  if (!msg?.sendAt) return null;

  const base = new Date(msg.sendAt);

  switch (msg.scheduleType) {
    case "daily":
      base.setDate(base.getDate() + 1);
      return base;

    case "weekly":
      base.setDate(base.getDate() + 7);
      return base;

    case "every_n_days": {
      const days = Number(msg.nDays) > 0 ? Number(msg.nDays) : 1;
      base.setDate(base.getDate() + days);
      return base;
    }

    default:
      return null; // once / unknown
  }
};

module.exports = getNextSendAt;
