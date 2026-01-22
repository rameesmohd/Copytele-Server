const botUsers = require("../models/botUsers");

const getAudienceQuery = (msg) => {
  switch (msg.audience) {
    case "all":
      return {};
    
    case "single":
      return msg.singleUserId ? { id: msg.singleUserId } : { _id: null };
    
    case "not_opened_webapp":
      return { is_opened_webapp: false };
    
    case "not_invested":
      return { is_invested: false };
    
    case "invested":
      return { is_invested: true };
    
    case "not_joined_channel":
      return { is_joined_channel: false };
    
    default:
      return { _id: null }; // No match
  }
};

const getAudienceCount = async (msg) => {
  const query = getAudienceQuery(msg);
  return await botUsers.countDocuments(query);
};

const getAudienceUsersPaginated = async (msg, skip, limit) => {
  const query = getAudienceQuery(msg);
  
  const users = await botUsers.find({...query,is_active:true}, { id: 1 })
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