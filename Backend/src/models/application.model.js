const mongoose = require("mongoose");

const resumeVersionSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, maxlength: 30000 },
    createdAt: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    company: { type: String, trim: true, maxlength: 160, default: "" },
    role: { type: String, required: true, trim: true, maxlength: 160 },
    location: { type: String, trim: true, maxlength: 160, default: "" },
    jobUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    status: { type: String, enum: ["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"], default: "Saved" },
    notes: { type: String, maxlength: 5000, default: "" },
    resumeText: { type: String, maxlength: 100000, default: "" },
    jobDescription: { type: String, maxlength: 30000, default: "" },
    result: {
        score: { type: Number, min: 0, max: 100, default: 0 },
        matched: { type: [String], default: [] },
        missing: { type: [String], default: [] },
        questions: { type: [String], default: [] },
        resume: { type: String, maxlength: 30000, default: "" },
        generatedBy: { type: String, enum: ["ai", "baseline"], default: "baseline" }
    },
    versions: { type: [resumeVersionSchema], default: [] },
    currentVersionId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });

module.exports = mongoose.model("application", applicationSchema);
