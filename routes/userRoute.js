const express = require('express')
const router = express.Router();
const { verifyUser } = require('../middlewares/userAuth')
const auth = require('../controllers/userTele/authController');
const user = require('../controllers/userTele/userController');
const payment = require('../controllers/userTele/paymentController');
const investment = require('../controllers/userTele/invController');
const manager = require('../controllers/manager/managerController')
const chart = require('../controllers/chartController');

router.route('/user')
      .post(auth.teleUser)

router.use(verifyUser)

router.route('/deposit/usdt-trc20')
      .get(payment.trc20CreateDeposit) 
      .post(payment.trc20CheckAndTransferPayment)

router.route('/deposit/usdt-bep20')
      .get(payment.bep20CreateDeposit) 
      .post(payment.bep20CheckAndTransferPayment)

router.route('/withdraw/crypto')
      .post(payment.withdrawFromMainWallet)

router.route('/wallet')
      .get(user.fetchUserWallet)

router.route('/transactions')
      .get(user.fetchUserWalletTransactions)

router.route('/manager-portfolio')
      .get(user.fetchManager)

router.route('/invest')
      .post(investment.makeInvestment)

router.route('/porfolio')
      .get(investment.fetchInvestment)

router.route('/portfolio/history')
      .post(investment.fetchInvTransactions)

router.get("/chart/daily", chart.getDailyChart);
router.get("/chart/weekly", chart.getWeeklyChart);
router.get("/chart/monthly", chart.getMonthlyChart);

router.get("/account-history/manager",manager.fetchAccountData)

module.exports=router