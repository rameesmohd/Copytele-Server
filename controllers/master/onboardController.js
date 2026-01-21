const OnboardingMessage = require("../../models/botMessage/OnboardingMessage");
const { sendTestMessage } = require("../../utils/sendTestMessage");

// ✅ helper: normalize empty command
const normalizePayload = (body = {}) => {
  const payload = { ...body };

  if (typeof payload.command === "string") {
    const c = payload.command.trim();
    payload.command = c.length ? c : null;
  }

  if (payload.inline !== undefined) {
    payload.inline = !!payload.inline;
  }

  return payload;
};

const createOnboardMessage = async (req, res) => {
  try {
    const count = await OnboardingMessage.countDocuments();
    const payload = normalizePayload({ ...req.body, order: count + 1 });

    const msg = await OnboardingMessage.create(payload);
    res.json(msg);
  } catch (err) {
    // ✅ if command is unique, handle duplicate key error
    if (err?.code === 11000) {
      return res.status(400).json({ error: "Command already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

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
    const payload = normalizePayload(req.body);

    const updated = await OnboardingMessage.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ error: "Command already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

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
    msg.isActive = !msg.isActive;
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

const testOnboardMessage=async(req,res)=>{
  try {
     const msg = await OnboardingMessage.findById(req.params.id);
 
     if (!msg) return res.status(404).json({ success: false, message: "Message not found" });
 
     await sendTestMessage(msg);
 
     return res.status(200).json({ success: true, message: "Test message sent" });
   } catch (err) {
     console.error("Test message error:", err);
     return res.status(500).json({ success: false });
   }
}



module.exports = {
    createOnboardMessage,
    reorderOnboardMessage,
    toggleOnboardMessage,
    deleteOnboardMessage,
    updateOnboardMessage,
    getOnboardMessages,
    testOnboardMessage,
}
