const OnboardingMessage = require("../../models/botMessage/OnboardingMessage");

const createOnboardMessage = async (req, res) => {
  try {
    const count = await OnboardingMessage.countDocuments();
    const payload = { ...req.body, order: count + 1 };

    const msg = await OnboardingMessage.create(payload);
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const getOnboardMessages = async (req, res) => {
  try {
    const data = await OnboardingMessage.find().sort({ order: 1 });
    res.json(data);
  } catch (err) {
    console.log(err);
    
    res.status(500).json({ error: err.message });
  }
}

const updateOnboardMessage = async (req, res) => {
  try {
    const updated = await OnboardingMessage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 📌 Delete onboarding message
const deleteOnboardMessage = async (req, res) => {
  try {
    await OnboardingMessage.findByIdAndDelete(req.params.id);

    // Rebalance ordering after deletion
    const items = await OnboardingMessage.find().sort({ order: 1 });
    items.forEach((item, index) => (item.order = index + 1));
    await Promise.all(items.map((i) => i.save()));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const toggleOnboardMessage = async (req, res) => {
  try {
    const msg = await OnboardingMessage.findById(req.params.id);
    msg.sent = !msg.sent;
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 📌 Reorder drag-drop
const reorderOnboardMessage= async (req, res) => {
  try {
    const { orderedIds } = req.body; // [{id, order}]

    for (const { id, order } of orderedIds) {
      await OnboardingMessage.findByIdAndUpdate(id, { order });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
    createOnboardMessage,
    reorderOnboardMessage,
    toggleOnboardMessage,
    deleteOnboardMessage,
    updateOnboardMessage,
    getOnboardMessages
}
