const express = require('express')
const router = express.Router();
const { 
        fetchUser,
        addManager ,
        fetchManagers,
        updateManager,
        masterLogin,
        fetchDeposits,
        fetchWithdrawals,
        getPendingKYCRequests,
        approveKycDocs,
        approveKyc,
        handleWithdraw,
        addToWallet,
        changeUserEmail,
        sendEmail,
        masterLogout,
        fetchBotUsers,
        fetchBotUsersStats
    } =require('../controllers/master/masterController')
const { fetchAddressBalance } = require('../controllers/userTele/paymentController')
const {verifyToken} = require('../middlewares/masterAuth')
const { 
    createScheduledMessage,
    getScheduledMessages,
    toggleScheduledMessage, 
    updateScheduledMessage, 
    deleteScheduledMessage,
    testScheduledMessage,
} = require('../controllers/master/schedulerController')

const { 
    createOnboardMessage,
    getOnboardMessages,
    toggleOnboardMessage, 
    updateOnboardMessage, 
    deleteOnboardMessage,
    reorderOnboardMessage,
    testOnboardMessage,
    getOnboardMessageByCommand
} = require('../controllers/master/onboardController')

router.post('/login',masterLogin)

router.use(verifyToken)

// router.route('/help-center')
//     .get(fetchHelpRequests)
//     .patch(changeHelpRequestStatus)

router.route('/users')
    .get(fetchUser)

router.get('/bot-users',fetchBotUsers)
router.get('/bot-users/stats',fetchBotUsersStats)

router.route('/manager')
    .get(fetchManagers)
    .post(addManager)
    .patch(updateManager)

router.route('/deposits')
    .get(fetchDeposits)
    
router.get('/fetch-address',fetchAddressBalance)

router.route('/withdrawals')
    .get(fetchWithdrawals)
    .patch(handleWithdraw)

router.route('/kyc-requests')
    .get(getPendingKYCRequests)
    .patch(approveKycDocs)
    .post(approveKyc)

router.post('/add-to-wallet',addToWallet)
router.post('/send-email',sendEmail)
router.post('/change-email',changeUserEmail)

router.get('/schedule/list',getScheduledMessages)
router.post('/schedule/create',createScheduledMessage)
router.patch('/schedule/toggle/:id',toggleScheduledMessage)
router.patch("/schedule/update/:id", updateScheduledMessage)
router.patch("/schedule/delete/:id", deleteScheduledMessage)
router.post("/schedule/test/:id",testScheduledMessage)

router.get('/onboard/list',getOnboardMessages)
router.post('/onboard/create',createOnboardMessage)
router.patch('/onboard/toggle/:id',toggleOnboardMessage)
router.patch("/onboard/update/:id", updateOnboardMessage)
router.patch("/onboard/delete/:id", deleteOnboardMessage)
router.patch("/onboard/reorder", reorderOnboardMessage)
router.post("/onboard/test/:id", testOnboardMessage)

router.get('/logout',masterLogout)

module.exports= router

