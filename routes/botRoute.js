const express = require('express')
const router = express.Router();
const { botAuth } = require('../middlewares/botAuth');
const { saveUser,getOnboardMessages, updateUserJoinedChannel } = require('../controllers/bot/botController');

router.use(botAuth)

router.post('/save-user',saveUser)

router.get('/onboard/list',getOnboardMessages)

router.get('/joined-channel',updateUserJoinedChannel)

module.exports=router