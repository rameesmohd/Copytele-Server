const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  user_id :{
    type : String,
    unique: true,
    required : true,
  },
  email : {
    type : String,
    set: v => v.toLowerCase()
  },
  first_name: {
    type: String,
    required: true,
  },
  is_verified : {
    type : Boolean,
    default : false
  },
  join_date : {
    type: Date,
    required : true,
  },
  start_date : {
    type: Date,
    default :Date.now
  },
  is_upgraded : {
    type: Boolean,
    default : false
  },
  ip_address :{
    type : String
  },
  is_blocked : {
    type : Boolean,
    default : false
  },
});

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ userId: 1 });
userSchema.index({ join_date: -1 });
userSchema.index({ ip_address: 1 });

const userModel = new mongoose.model("users", userSchema);
module.exports = userModel;