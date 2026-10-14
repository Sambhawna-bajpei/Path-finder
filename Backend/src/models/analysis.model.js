const mongoose = require("mongoose");

const analysisSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    resumeText: { type: String, required: true, maxlength: 100000 },
    jobDescription: { type: String, required: true, maxlength: 30000 },
    result: {
        score: { type: Number, min: 0, max: 100, required: true },
        matched: { type: [String], default: [] },
        missing: { type: [String], default: [] },
        questions: { type: [String], default: [] },
        resume: { type: String, default: "" },
        generatedBy: { type: String, enum: ["ai", "baseline"], default: "baseline" }
    }
}, { timestamps: true });

module.exports = mongoose.model("analysis", analysisSchema);
