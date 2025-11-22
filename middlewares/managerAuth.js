const jwt = require("jsonwebtoken");

const verifyToken = async (req, res, next) => {
    const token = req.cookies.managerToken;
    
    if (!token) {
      return res.status(401).json({ errMsg: "Unauthorized" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY_MANAGER);
      
      if (decoded.role !== "manager") throw new Error();
      req.master = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.log('TokenExpiredError');
        return res.status(401).json({error, msg: 'Authentication failed: Token has expired.' });
      }
      return res.status(401).json({error, msg: 'Authentication failed: Invalid token.' });
    }
  };
  
  module.exports = { 
    verifyToken
  }