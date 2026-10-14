const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const tokenBlackListModel = require("../models/blacklist.model");
const mongoose = require("mongoose");

function setTokenCookie(res, token) {
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 * 1000, path: "/" });
}

function publicUser(user) {
    return { id: user._id, username: user.username, email: user.email };
}

async function registerUserController(req,res){
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: "Account services are unavailable until MongoDB is connected." });
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if(username.length < 2 || username.length > 60 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128){
        return res.status(400).json({
            message: "Provide a name (2–60 characters), valid email, and password (8–128 characters)."
        })
    }

    const isUserAlreadyExists = await userModel.findOne({
        $or: [{ username },{ email }]
    });
    if(isUserAlreadyExists){
        return res.status(400).json({
            message: "User already exists"
        })
    }

    const hash = await bcrypt.hash(password,10);

    const user = await userModel.create({
        username,
        email,
        password: hash
    })

    const token = jwt.sign(
        { id: user._id, username: user.username},
        process.env.JWT_SECRET || "development-only-change-this-secret",
        {expiresIn: "1d"}
    )

    setTokenCookie(res, token);

    res.status(201).json({
        message: "User registered successfully",
        user: publicUser(user)
    })
}

async function loginUserController(req,res){
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: "Account services are unavailable until MongoDB is connected." });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const user = await userModel.findOne({ email });

    if(!user){
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const isPasswordValid = await bcrypt.compare(password,user.password);

    if(!isPasswordValid){
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const token = jwt.sign(
        { id: user._id, username: user.username},
        process.env.JWT_SECRET || "development-only-change-this-secret",
        {expiresIn: "1d"}
    )
    setTokenCookie(res, token);

    res.status(200).json({
        message: "User logged in successfully",
        user: publicUser(user)
    })
}
  
async function logoutUserController(req,res){
    const token  = req.cookies.token;

    let blacklistFailed = false;
    if(token && mongoose.connection.readyState === 1){
        try {
            const decoded = jwt.decode(token);
            await tokenBlackListModel.create({ token, expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000) });
        } catch (error) {
            blacklistFailed = true;
            console.error("Could not blacklist logout token:", error.message);
        }
    }
    res.clearCookie("token",{ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });

    res.status(200).json({
        message: blacklistFailed ? "Signed out on this device. The token will expire automatically." : "User logged out successfully"
    })
}


async function getMeController(req,res){
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(401).json({ message: "Account no longer exists." });

    res.status(200).json({
        message: "User fetched successfully",
        user: publicUser(user)
    })
}

module.exports={
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController
}

















