const crypto = require("crypto");
require("dotenv").config();

const botAuth = (req, res, next) => {
  try {
    const requestIp = req.ip?.replace("::ffff:", "") || "unknown";
    const signature = req.headers["x-signature"];

    if (!signature) {
      console.log("Missing signature header" )
      return res.status(401).json({ success: false, message: "Missing signature header" });
    }

    // Get payload depending on request type
    const payload = req.method === "GET" ? (req.query || {}) : (req.body || {});

    // Validate payload type
    if (typeof payload !== "object") {
      return res.status(400).json({ success: false, message: "Invalid request payload format" });
    }

    // Calculate hash
    const calculated = crypto
      .createHmac("sha256", process.env.BOT_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

    if (signature !== calculated) {
      console.error("Signature mismatch:", {
        expected: calculated,
        received: signature,
      });
      return res.status(401).json({ success: false, message: "Unauthorized - Invalid signature" });
    }

    // IP whitelist enforcement only in production
    if (process.env.NODE_ENV === "production" && process.env.BOT_SERVER_IP) {
      if (requestIp !== process.env.BOT_SERVER_IP) {
        console.error("IP mismatch:", {
          expected: process.env.BOT_SERVER_IP,
          received: requestIp,
        });
        return res.status(401).json({ success: false, message: "Unauthorized - IP mismatch" });
      }
    }

    next();

  } catch (error) {
    console.error("botAuth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal authentication error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = { botAuth };
