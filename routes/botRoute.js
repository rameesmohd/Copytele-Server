const express = require('express')
const router = express.Router();
const { botAuth } = require('../middlewares/botAuth');
const { saveUser,getOnboardMessages, updateUserJoinedChannel } = require('../controllers/bot/botController');
const { getDailyProfitAlerts } = require('../controllers/bot/dailyProfitAlerts');
const { getBroadcastMessages,getBroadcastUsers,markBroadcastDone } = require('../controllers/bot/broadcastController');

router.use(botAuth)

router.post('/save-user',saveUser)

router.get('/onboard/list',getOnboardMessages)

router.post('/joined-channel',updateUserJoinedChannel)

router.get('/daily-profit-alerts',getDailyProfitAlerts)

//BROADCAST ROUTES
router.get('/broadcast/messages',getBroadcastMessages)
router.get('/broadcast/users',getBroadcastUsers)
router.post('/broadcast/mark-done',markBroadcastDone)

module.exports=router