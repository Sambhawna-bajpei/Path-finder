const mongoose = require("mongoose");

const blacklistTokenSchema = new mongoose.Schema({
    token: {
        type: String, 
        required: [true, "Token is required"]
    },
    expiresAt: { type: Date, required: true, expires: 0 }
},{
    timestamps: true
});


const tokenBlacklistModel = mongoose.model("blacklistTokens", blacklistTokenSchema);


module.exports = tokenBlacklistModel;
