const BotUser = require('../../models/botUsers')

//     telegramId,
//     first_name,
//     last_name,
//     username,
//     language_code,
//     is_premium 

const saveUser=async(req,res)=>{
    try {
        const payload = req.body
        await BotUser.findOneAndUpdate(
            { id: payload.telegramId },
            { $set: payload },
            { upsert: true, new: true }
        );
        return res.status(200).json({success: true})
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false,message : error.message})
    }
}

module.exports = { 
    saveUser
}