const ScheduledMessage = require("../../models/botMessage/ScheduledMessage")

const createMessage =async(req,res)=>{
    try {
        const msg = await ScheduledMessage.create(req.body);
        res.json(msg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const listMessages = async (req, res) => {
  const messages = await ScheduledMessage.find().sort({ createdAt: -1 });
  res.json(messages);
};

const toggleMessage = async (req, res) => {
  const msg = await ScheduledMessage.findById(req.params.id);
  msg.isActive = !msg.isActive;
  await msg.save();
  res.json(msg);
};

module.exports = {
    createMessage,
    listMessages,
    toggleMessage
}