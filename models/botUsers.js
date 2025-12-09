const mongoose = require("mongoose");
const { Schema } = mongoose;

const botUserSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: null },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    photo_url: { type: String, default: null },
    is_premium: { type: Boolean, default: false },
    referred_by:{ type: String, default: null },
    
    //--------Schedule Messages Fileds-------
    is_opened_webapp : {type : Boolean ,default: false},
    is_invested : {type : Boolean,default : false},
    is_joined_channel : {type : Boolean,default :false}
  },
  { timestamps: true }
);

module.exports = mongoose.model("botUser", botUserSchema);
