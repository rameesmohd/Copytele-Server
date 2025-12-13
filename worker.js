// worker.js
require('dotenv').config();

// --- Connect DB ---
const connectDB = require('./config/mongoose.js');

(async () => {
  try {
    await connectDB();
    console.log("📡 MongoDB connected for Cron Worker");
  } catch (err) {
    console.error("❌ MongoDB Connection Error in Worker:", err);
    process.exit(1); // prevent running cron without DB
  }

  console.log("⏳ Cron Worker Started...");
  
  try {
    require('./cron/rolloverService.js');
    require('./cron/intervalservice.js');

    require('./cron/broadcastWorker.js');
    require('./cron/dailyProfitAlert.js');

    console.log("✅ All cron jobs initialized");
  } catch (err) {
    console.error("❌ Error loading cron jobs:", err);
  }

})();
