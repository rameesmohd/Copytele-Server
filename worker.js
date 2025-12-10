// worker.js
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/mongoose.js');
connectDB()

console.log("⏳ Cron worker started...");

require('./cron/rolloverService.js')
require('./cron/intervalservice.js')

require('./cron/broadcastWorker.js')
// require('./cron/dailyProfitAlert.js')
