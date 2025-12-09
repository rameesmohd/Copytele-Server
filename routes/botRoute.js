const express = require('express')
const router = express.Router();
const { botAuth } = require('../middlewares/botAuth');
const { saveUser,getOnboardMessages } = require('../controllers/bot/botController');

router.use(botAuth)

router.post('/save-user',saveUser)

router.get('/onboard/list',getOnboardMessages)

module.exports=router