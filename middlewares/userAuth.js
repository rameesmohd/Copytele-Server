const jwt = require('jsonwebtoken');
const userModel = require('../models/user')
const JWT_SECRET = process.env.JWT_SECRET

const  verifyUser = async(req, res, next) => {
  try {
    const token = req.cookies.userToken;
    
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userModel.findById({_id :decoded.userId});
    
    if (!user || user.currToken !== token) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }

    const { currToken, ...safeUser } = user.toObject();
    req.user = safeUser;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('TokenExpiredError');
      return res.status(401).json({ message: 'Authentication failed: Token has expired.' });
    }
    console.log(error);
    return res.status(401).json({ message: 'Authentication failed: something went error' });
  }
}

module.exports = {
  verifyUser
}