const crypto = require("crypto");
require("dotenv").config();

const canonicalPayload = (data = {}) => {
  return Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      const value = data[key];

      if (value === undefined) return acc;

      acc[key] =
        value === null ? "null" : String(value);

      return acc;
    }, {});
};

const botAuth = (req, res, next) => {
  try {
    const signature = req.headers["x-signature"];
    if (!signature) {
      return res.status(401).json({
        success: false,
        message: "Missing signature header",
      });
    }

    const payload =
      req.method === "GET"
        ? (req.query || {})
        : (req.body || {});

    if (typeof payload !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid payload",
      });
    }

    const canonical = canonicalPayload(payload);

    const calculated = crypto
      .createHmac("sha256", process.env.BOT_SECRET)
      .update(JSON.stringify(canonical))
      .digest("hex");

    if (signature !== calculated) {
      console.error("🔐 Signature mismatch", {
        expected: calculated,
        received: signature,
        canonical,
      });

      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid signature",
      });
    }

    next();
  } catch (err) {
    console.error("botAuth error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal authentication error",
    });
  }
};

module.exports = { botAuth };
