const express = require('express')
const router = express.Router();
const { botAuth } = require('../middlewares/botAuth');
const { saveUser } = require('../controllers/bot/userController');
const { createMessage,listMessages,toggleMessage } = require('../controllers/bot/schedulerController')

router.use(botAuth)

router.post('/save-user',saveUser)

router.post('/schedule/create',createMessage)
router.post('/schedule/list',listMessages)
router.post('/schedule/toggle/:id',toggleMessage)

module.exports=router