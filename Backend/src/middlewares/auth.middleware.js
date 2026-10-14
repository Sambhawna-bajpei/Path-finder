const jwt = require("jsonwebtoken");
const tokenBlackListModel = require("../models/blacklist.model");
const mongoose = require("mongoose");


async function authUser(req,res,next){
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: "Account services are unavailable until MongoDB is connected." });
    }
    const token = req.cookies.token;


    if(!token){
        return res.status(401).json({
            message: "Token not provided"
        })
    }
    const isTokenBlackListed = await tokenBlackListModel.findOne({token});

    if(isTokenBlackListed){
        return res.status(401).json({
            message: "Token is invalid"
        })
    }   
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "development-only-change-this-secret");
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid token"
        })
    }
}

async function optionalAuth(req, res, next) {
    if (!req.cookies.token) return next();
    return authUser(req, res, next);
}

module.exports = { authUser, optionalAuth };
