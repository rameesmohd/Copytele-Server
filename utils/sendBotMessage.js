const axios = require("axios");
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

let queue = [];
let isProcessing = false;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    const { method, payload } = job;

    try {
      await axios.post(`${API_URL}/${method}`, payload);
      console.log("📨 Sent to", payload.chat_id);
    } catch (err) {
      const data = err?.response?.data;

      if (data?.error_code === 429) {
        const retryAfter = data.parameters.retry_after * 1000;
        console.log(`⏳ Rate limited. Retrying after ${retryAfter / 1000}s`);
        queue.unshift(job);
        await delay(retryAfter);
      } else {
        console.log("❌ Telegram Error:", data || err.message);
      }
    }

    await delay(100);
  }

  isProcessing = false;
};

const sendMessageSafe = (method, payload) => {
  if (!method || !payload) return;

  const mediaKey = {
    sendVideo: "video",
    sendPhoto: "photo",
    sendAudio: "audio",
    sendDocument: "document"
  }[method];

  if (mediaKey && !payload[mediaKey]) {
    console.log(`⚠️ Skipped ${method}: Missing ${mediaKey}`);
    return;
  }

  queue.push({ method, payload });

  if (queue.length === 1) processQueue();
};

module.exports = {
  sendMessageSafe
};
