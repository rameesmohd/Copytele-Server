const ScheduledMessage = require("../../models/botMessage/ScheduledMessage");

// ======================================================================
// 📢 Broadcast Message Controller
// ======================================================================

// Create a new scheduled message
const createScheduledMessage = async (req, res) => {
  try {
    const message = await ScheduledMessage.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Scheduled message created successfully",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get all scheduled messages
const getScheduledMessages = async (req, res) => {
  try {
    const messages = await ScheduledMessage.find().sort({ order: 1 });
    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Toggle activation status
const toggleScheduledMessage = async (req, res) => {
  try {
    const message = await ScheduledMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, error: "Message not found" });

    message.isActive = !message.isActive;
    await message.save();

    return res.status(200).json({
      success: true,
      message: `Message ${message.isActive ? "activated" : "deactivated"} successfully`,
      data: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Update scheduled message
const updateScheduledMessage = async (req, res) => {
  try {
    await ScheduledMessage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).json({ success: true, message: "Message updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Delete scheduled message
const deleteScheduledMessage = async (req, res) => {
  try {
    await ScheduledMessage.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Update message order (drag & drop sorting)
const reorderScheduledMessages = async (req, res) => {
  try {
    const { orderedIds } = req.body;

    for (const { id, order } of orderedIds) {
      await ScheduledMessage.findByIdAndUpdate(id, { order });
    }

    return res.status(200).json({ success: true, message: "Message order updated" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ======================================================================
// EXPORTS
// ======================================================================
module.exports = {
  createScheduledMessage,
  getScheduledMessages,
  toggleScheduledMessage,
  updateScheduledMessage,
  deleteScheduledMessage,
  reorderScheduledMessages,
};
