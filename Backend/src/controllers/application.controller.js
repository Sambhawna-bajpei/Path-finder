const mongoose = require("mongoose");
const applicationModel = require("../models/application.model");

const STATUSES = ["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"];
const ownApplication = (id, userId) => applicationModel.findOne({ _id: id, user: userId });

function validateText(value, field, max, required = false) {
    if (typeof value !== "string" || (required && !value.trim())) return `${field} is required.`;
    if (value.length > max) return `${field} must be ${max} characters or fewer.`;
    return null;
}

async function listApplications(req, res) {
    const applications = await applicationModel.find({ user: req.user.id })
        .select("company role location jobUrl status notes result.score versions.title versions.createdAt currentVersionId createdAt updatedAt")
        .sort({ updatedAt: -1 }).lean();
    return res.json({ applications });
}

async function createApplication(req, res) {
    const body = req.body || {};
    for (const error of [
        validateText(body.role, "Role", 160, true),
        validateText(body.company || "", "Company", 160),
        validateText(body.location || "", "Location", 160),
        validateText(body.jobUrl || "", "Job URL", 2048),
        validateText(body.notes || "", "Notes", 5000),
        validateText(body.resumeText || "", "Resume source", 100000),
        validateText(body.jobDescription || "", "Job description", 30000),
    ]) if (error) return res.status(400).json({ message: error });
    if (body.jobUrl && !/^https?:\/\//i.test(body.jobUrl)) return res.status(400).json({ message: "Job URL must start with http:// or https://." });
    const status = STATUSES.includes(body.status) ? body.status : "Saved";
    const result = body.result && typeof body.result === "object" ? body.result : {};
    const draft = typeof body.resumeDraft === "string" ? body.resumeDraft : result.resume || "";
    if (draft.length > 30000) return res.status(413).json({ message: "Resume draft is too large (maximum 30,000 characters)." });
    const application = await applicationModel.create({
        user: req.user.id,
        company: body.company || "",
        role: body.role.trim(),
        location: body.location || "",
        jobUrl: body.jobUrl || "",
        status,
        notes: body.notes || "",
        resumeText: body.resumeText || "",
        jobDescription: body.jobDescription || "",
        result: {
            score: Math.max(0, Math.min(100, Number(result.score) || 0)),
            matched: Array.isArray(result.matched) ? result.matched.slice(0, 40).map(String) : [],
            missing: Array.isArray(result.missing) ? result.missing.slice(0, 40).map(String) : [],
            questions: Array.isArray(result.questions) ? result.questions.slice(0, 10).map(String) : [],
            resume: draft,
            generatedBy: result.generatedBy === "ai" ? "ai" : "baseline"
        },
        versions: draft ? [{ title: "Initial tailored resume", content: draft }] : []
    });
    if (application.versions.length) application.currentVersionId = application.versions[0]._id;
    await application.save();
    return res.status(201).json({ application });
}

async function getApplication(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
    const application = await ownApplication(req.params.id, req.user.id).lean();
    if (!application) return res.status(404).json({ message: "Application not found." });
    return res.json({ application });
}

async function updateApplication(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
    const allowed = ["company", "role", "location", "jobUrl", "status", "notes"];
    const updates = {};
    for (const key of allowed) {
        if (!(key in (req.body || {}))) continue;
        const value = req.body[key];
        if (key === "status" && !STATUSES.includes(value)) return res.status(400).json({ message: "Choose a valid application status." });
        const max = key === "jobUrl" ? 2048 : key === "notes" ? 5000 : 160;
        const error = validateText(value, key, max, key === "role");
        if (error) return res.status(400).json({ message: error });
        if (key === "jobUrl" && value && !/^https?:\/\//i.test(value)) return res.status(400).json({ message: "Job URL must start with http:// or https://." });
        updates[key] = key === "role" ? value.trim() : value;
    }
    const application = await ownApplication(req.params.id, req.user.id);
    if (!application) return res.status(404).json({ message: "Application not found." });
    Object.assign(application, updates);
    await application.save();
    return res.json({ application });
}

async function deleteApplication(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
    const application = await applicationModel.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!application) return res.status(404).json({ message: "Application not found." });
    return res.status(204).end();
}

async function createResumeVersion(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
    const titleError = validateText(req.body?.title, "Version name", 120, true);
    const contentError = validateText(req.body?.content, "Resume draft", 30000, true);
    if (titleError || contentError) return res.status(400).json({ message: titleError || contentError });
    const application = await ownApplication(req.params.id, req.user.id);
    if (!application) return res.status(404).json({ message: "Application not found." });
    const version = application.versions.create({ title: req.body.title.trim(), content: req.body.content });
    application.versions.push(version);
    application.currentVersionId = version._id;
    application.result.resume = req.body.content;
    await application.save();
    return res.status(201).json({ application, version });
}

async function activateResumeVersion(req, res) {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.versionId)) return res.status(400).json({ message: "Invalid application or version identifier." });
    const application = await ownApplication(req.params.id, req.user.id);
    if (!application) return res.status(404).json({ message: "Application not found." });
    const version = application.versions.id(req.params.versionId);
    if (!version) return res.status(404).json({ message: "Resume version not found." });
    application.currentVersionId = version._id;
    application.result.resume = version.content;
    await application.save();
    return res.json({ application });
}

module.exports = { listApplications, createApplication, getApplication, updateApplication, deleteApplication, createResumeVersion, activateResumeVersion };
