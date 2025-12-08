// worker.js
const dotenv = require('dotenv');
const connectDB = require('./config/mongoose.js');
dotenv.config();
connectDB()

console.log("⏳ Cron worker started...");
require('./services/rolloverService.js')
require('./services/intervalservice.js')