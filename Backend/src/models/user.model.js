const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username:{ type:String, unique:true, required:true, trim:true, minlength:2, maxlength:60 },
    email:{
        type:String,
        unique:true,
        required:true,
        lowercase:true,
        trim:true,
    },
    password:{
        type:String,
        required: true,

    }
})


const userModel = mongoose.model("user",userSchema);

module.exports = userModel;
