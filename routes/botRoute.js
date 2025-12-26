const express = require('express')
const router = express.Router();
const { botAuth } = require('../middlewares/botAuth');
const { saveUser,getOnboardMessages, updateUserJoinedChannel } = require('../controllers/bot/botController');
const { getDailyProfitAlerts } = require('../controllers/bot/dailyProfitAlerts');

router.use(botAuth)

router.post('/save-user',saveUser)

router.get('/onboard/list',getOnboardMessages)

router.post('/joined-channel',updateUserJoinedChannel)

router.get('/daily-profit-alerts',getDailyProfitAlerts)

module.exports=router