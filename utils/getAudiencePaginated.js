const botUsers = require("../models/botUsers");
const getAudienceQuery = (msg) => {
  const baseQuery = { is_active: true }; // ✅ Core filter

  switch (msg.audience) {
    case "all":
      return baseQuery;
    
    case "single":
      return msg.singleUserId 
        ? { ...baseQuery, id: msg.singleUserId } 
        : { _id: null };
    
    case "not_opened_webapp":
      return { ...baseQuery, is_opened_webapp: false };
    
    case "not_invested":
      return { ...baseQuery, is_invested: false };
    
    case "invested":
      return { ...baseQuery, is_invested: true };
    
    case "not_joined_channel":
      return { ...baseQuery, is_joined_channel: false };

    case "not_claimed_bonus":
      return { ...baseQuery, is_claimed_bonus: false, is_invested: false };

    case "claimed_bonus":
      return { ...baseQuery, is_claimed_bonus: true, is_invested: false };

    default:
      return { _id: null };
  }
};

const getAudienceCount = async (msg) => {
  const query = getAudienceQuery(msg);
  return await botUsers.countDocuments(query);
};

const getAudienceUsersPaginated = async (msg, skip, limit) => {
  const query = getAudienceQuery(msg); 
  
  const users = await botUsers.find(query, { id: 1 })
    .skip(Number(skip))
    .limit(Math.min(Number(limit), 500))
    .lean();

  return users;
};

module.exports = {
    getAudienceUsersPaginated,
    getAudienceCount,
    getAudienceQuery
}