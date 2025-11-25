const express = require('express')
const router = express.Router();
const { verifyUser } = require('../middlewares/userAuth')
const auth = require('../controllers/userTele/authController');
const user = require('../controllers/userTele/userController');
const payment = require('../controllers/userTele/paymentController');
const investment = require('../controllers/userTele/invController');
const manager = require('../controllers/manager/managerController')
const chart = require('../controllers/chartController');
const { fetchCountryList } = require('../controllers/common/fetchCountryList')

router.post('/user',auth.teleUser)

router.get('/list-countries',fetchCountryList)

router.use(verifyUser)

router.post('/user/update-details',user.updateUserDetails)


router.route('/deposit/usdt-trc20')
      .get(payment.trc20CreateDeposit) 
      .post(payment.trc20CheckAndTransferPayment)

router.route('/deposit/usdt-bep20')
      .get(payment.bep20CreateDeposit) 
      .post(payment.bep20CheckAndTransferPayment)

router.post('/withdraw/crypto',payment.withdrawFromMainWallet)

router.get('/wallet',user.fetchUserWallet)

router.get('/transactions',user.fetchUserWalletTransactions)

router.get("/account-history/user",user.fetchAccountData)
      
router.post('/invest',investment.makeInvestment)

router.get('/porfolio',investment.fetchInvestment)

router.route('/withdraw/investment')
      .get(investment.getWithdrawSummary)
      .post(investment.handleInvestmentWithdrawal)

router.post('/portfolio/history',investment.fetchInvTransactions)

router.get('/manager-portfolio',manager.fetchManager)
router.get("/account-history/manager",manager.fetchAccountData)

router.get("/chart/daily", chart.getDailyChart);
router.get("/chart/weekly", chart.getWeeklyChart);
router.get("/chart/monthly", chart.getMonthlyChart);
router.get("/chart",chart.getUserGrowthChart)


module.exports=router