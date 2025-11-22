const express = require('express');
const { getManagerData, fetchMyInvesters, login, managerLogout } = require('../controllers/manager/managerController');
const { addTradeToManager , getTrades } = require('../controllers/tradeController');
const { intervalInvestmentHandle } = require('../controllers/intervalController')
const { fetchInvestmentTransactions, fetchInvestmentTrades, fetchAllInvestmentTransactions }=require('../controllers/manager/invController');
const { fetchUser } = require('../controllers/master/masterController');
const { verifyToken } = require('../middlewares/managerAuth')
const router = express.Router();

router.post('/login',login)

router.use(verifyToken)

router.route('/manager')
        .get(getManagerData)

router.route('/trade')
        .get(getTrades)
        .post(addTradeToManager)

router.route('/investments')
        .get(fetchMyInvesters)

router.route('/interval-test')
        .get(intervalInvestmentHandle)

router.get('/transactions',fetchInvestmentTransactions)
router.get('/trades',fetchInvestmentTrades)
router.get('/user',fetchUser)

router.route('/deposits')
        .get(fetchAllInvestmentTransactions)

router.get('/logout',managerLogout)


module.exports= router

