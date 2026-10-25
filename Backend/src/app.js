const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require("cors")


const app = express();
// Render and other reverse proxies terminate TLS before forwarding to Node.
app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map((origin) => origin.trim());
app.use((req, res, next) => {
    const requestOrigin = req.get("origin");
    const sameOrigin = requestOrigin && requestOrigin === `${req.protocol}://${req.get("host")}`;
    cors({
        origin: (origin, callback) => !origin || sameOrigin || allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error("Origin is not allowed by CORS")),
        credentials: true
    })(req, res, next);
});

const authRouter = require("./routes/auth.routes");
const workspaceRouter = require("./routes/workspace.routes");

app.use("/api/auth",authRouter);
app.use("/api/workspace",workspaceRouter);
app.get("/api/health", (_req, res) => {
    const mongoose = require("mongoose");
    const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({ status: "ok", service: "pathfinder-api", database });
});
app.get("/api/ready", (_req, res) => {
    const mongoose = require("mongoose");
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", database: ready ? "connected" : "disconnected" });
});
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
    console.error(err);
    if (err.code === 11000) return res.status(409).json({ message: "An account already exists with that name or email." });
    if (err.name === "CastError") return res.status(400).json({ message: "Invalid identifier." });
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Request body must contain valid JSON." });
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: status === 500 ? "Something went wrong. Please try again." : err.message });
});

module.exports = app;
