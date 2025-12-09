// worker.js
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/mongoose.js');
connectDB()

console.log("⏳ Cron worker started...");

require('./services/rolloverService.js')
require('./services/intervalservice.js')
require('./services/broadcastWorker.js')