// const mongoose = require("mongoose");
// require("dotenv").config();

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URL);
//     console.log("MongoDB connected successfully");
//   } catch (error) {
//     console.error("Error connecting to MongoDB:", error.message);
//   }
// };

// module.exports = connectDB;

// config/database.js - Clean & Simple Production Version
const mongoose = require("mongoose");
require("dotenv").config();

let isConnected = false;

const connectDB = async () => {
  // Return if already connected
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log("Using existing MongoDB connection");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      // Connection Pool
      maxPoolSize: 20,
      minPoolSize: 5,
      
      // Timeouts
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      
      // Reliability
      retryWrites: true,
      retryReads: true,
      
      // Performance
      compressors: ["zlib"],
    });

    isConnected = true;
    console.log("✅ MongoDB connected:", mongoose.connection.host);

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB disconnected");
  process.exit(0);
});

module.exports = connectDB;