const express = require('express')
const router = express.Router();
const { botAuth } = require('../middlewares/botAuth');
const { saveUser } = require('../controllers/bot/userController');

router.use(botAuth)

router.post('/save-user',saveUser)

module.exports=router