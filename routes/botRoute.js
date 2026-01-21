const express = require('express')
const router = express.Router();
const { botAuth } = require('../middlewares/botAuth');
const { saveUser,getOnboardMessages, updateUserJoinedChannel, isUserExist,getOnboardMessageByCommand } = require('../controllers/bot/botController');
const { getDailyProfitAlerts } = require('../controllers/bot/dailyProfitAlerts');
const { getBroadcastMessages,getBroadcastUsers,markBroadcastDone } = require('../controllers/bot/broadcastController');

router.use(botAuth)

router.post('/save-user',saveUser)

router.post('/joined-channel',updateUserJoinedChannel)
router.get('/user-exists/:id',isUserExist)

router.get('/daily-profit-alerts',getDailyProfitAlerts)

//BROADCAST ROUTES
router.get('/broadcast/messages',getBroadcastMessages)
router.get('/broadcast/users',getBroadcastUsers)
router.post('/broadcast/mark-done',markBroadcastDone)

//ONBOARD ROUTES
router.get('/onboard/list',getOnboardMessages)
router.get("/onboard/by-command", getOnboardMessageByCommand);

module.exports=router