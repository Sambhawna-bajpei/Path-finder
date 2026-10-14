require("dotenv").config();
const app = require("./src/app");
const connectToDB = require("./src/config/database");
const mongoose = require("mongoose");

async function start() {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be configured in production.");
    }
    if (process.env.MONGO_URI) await connectToDB();
    else console.warn("MONGO_URI is not configured. Health and analysis are available; account and history features require MongoDB.");
    const port = Number(process.env.PORT) || 3000;
    app.listen(port, () => console.log(`Pathfinder API is running on port ${port} (database: ${mongoose.connection.readyState === 1 ? "connected" : "offline"})`));
}

start().catch((error) => {
    console.error("Could not start Pathfinder API:", error.message);
    process.exitCode = 1;
});
