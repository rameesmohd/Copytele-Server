const express = require('express')
const router = express.Router();
const { verifyUser } = require('../middlewares/userAuth')
const user = require('../controllers/user/authController');
const payment = require('../controllers/user/paymentController');

router.route('/user')
      .post(user.teleUser)

router.use(verifyUser)

router.route('/deposit/usdt-trc20')
      .get(payment.trc20CreateDeposit) 

router.route('/deposit/usdt-bep20')
      .get(payment.bep20CreateDeposit) 

module.exports=router