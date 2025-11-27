const userModel = require("../../models/user")
const jwt = require('jsonwebtoken');

const createToken = (userId) => {
    return jwt.sign({ userId }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

const teleUser = async (req, res) => {
  try {
    const { id, first_name, last_name, username, photo_url, is_premium } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing Telegram user ID",
      });
    }

    // Check existing user
    let user = await userModel.findOne({ user_id: id });
    console.log(user);
    
    /* ------------------------------------------------------
       EXISTING USER 
    ------------------------------------------------------ */
    if (user) {
      const token = createToken(user._id);
      user.currToken = token;
      await user.save();

      return res
        .cookie("userToken", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
          ...(process.env.NODE_ENV === "production" && {
            domain: process.env.DOMAIN,
          }),
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .status(200)
        .json({
          success: true,
          message: "User logged in successfully",
          data: user,
        });
    }

    /* ------------------------------------------------------
       NEW USER 
    ------------------------------------------------------ */

    // Generate token first
    const tempUser = new userModel({
      login_type: "telegram",
      telegram: {
        id,
        first_name,
        last_name,
        username,
        photo_url,
        is_premium,
      },
      user_id: id,
    });

    const token = createToken(tempUser._id);
    tempUser.currToken = token;

    const newUser = await tempUser.save();

    return res
      .cookie("userToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        ...(process.env.NODE_ENV === "production" && { domain: process.env.DOMAIN }),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        success: true,
        message: "New Telegram user created successfully",
        data: newUser,
      });

  } catch (error) {
    console.error("Telegram login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


module.exports = {
    teleUser,
}


// 🧾 Step 5: (Optional) Verify the data server-side

// If you want to verify authenticity of the user (prevent spoofing),
// Telegram provides an HMAC hash in initData that you can verify with your bot token.

// In your backend (Node.js example):

// import crypto from "crypto";

// export function verifyTelegramAuth(initData, botToken) {
//   const urlParams = new URLSearchParams(initData);
//   const hash = urlParams.get("hash");
//   urlParams.delete("hash");

//   const dataCheckString = [...urlParams.entries()]
//     .sort(([a], [b]) => a.localeCompare(b))
//     .map(([k, v]) => `${k}=${v}`)
//     .join("\n");

//   const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
//   const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

//   return computedHash === hash;
// }