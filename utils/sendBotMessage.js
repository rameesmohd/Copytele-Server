import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

let queue = [];
let sending = false;

const processQueue = async () => {
  if (sending || queue.length === 0) return;
  sending = true;
  const job = queue.shift();
  try {
    await axios.post(`${API_URL}/${job.method}`, job.payload);
    console.log("📨 Sent to", job.payload.chat_id);
  } catch (err) {
    console.log("❌ Telegram Send Error:", err);
  }

  sending = false;
  setTimeout(processQueue, 1200);
};

export const sendMessageSafe = (method, payload) => {
  queue.push({ method, payload });
  // console.log("FINAL PAYLOAD:", JSON.stringify(payload, null, 2));
  if (method === "sendVideo" && !payload.video) {
    // console.log("❌ Skipping sendVideo: no video provided");
    return;
  }
  
  processQueue();
};
