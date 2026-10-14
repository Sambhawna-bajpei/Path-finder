const SKILLS = ["JavaScript", "TypeScript", "React", "Node.js", "Express", "REST APIs", "PostgreSQL", "SQL", "Python", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Git", "GraphQL", "MongoDB", "Redis", "System design", "Testing", "Jest", "Agile", "Leadership", "Communication", "Mentoring", "Observability", "Data analytics", "Machine learning", "Figma", "Accessibility"];
const analysisModel = require("../models/analysis.model");

function buildResume(text, missing) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const name = lines[0] || "Your Name";
    const summary = lines.find((line) => line.length > 60) || "Results-driven professional with a track record of delivering thoughtful, measurable outcomes.";
    const skills = SKILLS.filter((skill) => text.toLowerCase().includes(skill.toLowerCase()));
    const experience = lines.filter((line) => line.length > 45 && line !== summary).slice(0, 8).join("\n");
    return `${name}\n${lines[1] || "Professional Summary"}\n\nPROFESSIONAL SUMMARY\n${summary}\n\nCORE SKILLS\n${[...skills, ...missing.slice(0, 3).map((skill) => `${skill} (developing)`)].join(" • ") || "Add your relevant skills"}\n\nEXPERIENCE & PROJECTS\n${experience || "Add your relevant experience and projects."}\n\nEDUCATION\nAdd your degree, institution, and graduation year.\n\nNote: Review all details and replace suggestions with your verified experience. Never claim skills you do not have.`;
}

function makeQuestions(matched, missing) {
    const core = matched[0] || "your core technical skills";
    const focus = missing[0] || "system design";
    return [
        `Tell me about a project where you used ${core} to solve a difficult problem.`,
        `How would you approach ${focus} in this role?`,
        "Describe a time you improved a product using feedback or data.",
        "What trade-offs would you consider when designing a scalable solution?",
        "Tell me about a time you partnered across teams to deliver an outcome."
    ];
}

async function generateWithAI(resumeText, jobDescription) {
    if (!process.env.OPENAI_API_KEY) return null;
    const response = await fetch(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: "You are a careful career coach. Compare the resume to the job description. Never invent experience, credentials, metrics, or skills. Return valid JSON with keys score (integer 0-100), matched (string array), missing (string array), questions (exactly 5 role-specific interview questions), and resume (a polished ATS-friendly plain-text resume tailored to the role using only truthful source details; do not present missing skills as possessed skills)." },
                { role: "user", content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}` }
            ]
        }),
        signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const body = await response.json();
    const value = JSON.parse(body.choices?.[0]?.message?.content || "{}");
    if (!Number.isFinite(Number(value.score)) || !Array.isArray(value.matched) || !Array.isArray(value.missing) || !Array.isArray(value.questions) || typeof value.resume !== "string") {
        throw new Error("AI response did not match the expected format");
    }
    return {
        score: Math.min(100, Math.max(0, Math.round(Number(value.score)))),
        matched: value.matched.slice(0, 30).map(String),
        missing: value.missing.slice(0, 30).map(String),
        questions: value.questions.slice(0, 5).map(String),
        resume: value.resume.slice(0, 30000),
        generatedBy: "ai"
    };
}

async function analyzeResumeController(req, res) {
    const { resumeText, jobDescription } = req.body || {};
    if (typeof resumeText !== "string" || resumeText.trim().length < 30) {
        return res.status(400).json({ message: "Add at least 30 characters of resume text." });
    }
    if (typeof jobDescription !== "string" || jobDescription.trim().length < 30) {
        return res.status(400).json({ message: "Add a job description with at least 30 characters." });
    }
    if (resumeText.length > 100000 || jobDescription.length > 30000) {
        return res.status(413).json({ message: "The resume or job description is too large." });
    }
    const source = resumeText.toLowerCase();
    const target = jobDescription.toLowerCase();
    const matched = SKILLS.filter((skill) => source.includes(skill.toLowerCase()) && target.includes(skill.toLowerCase()));
    const missing = SKILLS.filter((skill) => target.includes(skill.toLowerCase()) && !source.includes(skill.toLowerCase()));
    const score = Math.min(98, Math.max(24, Math.round(46 + (matched.length / Math.max(matched.length + missing.length, 1)) * 54)));
    let result = { score, matched, missing, questions: makeQuestions(matched, missing), resume: buildResume(resumeText, missing), generatedBy: "baseline" };
    if (process.env.OPENAI_API_KEY) {
        try { result = await generateWithAI(resumeText, jobDescription); }
        catch (error) { console.error("AI analysis unavailable; using local baseline:", error.message); }
    }
    if (req.user) {
        const analysis = await analysisModel.create({ user: req.user.id, resumeText, jobDescription, result });
        return res.json({ result, analysisId: analysis._id, createdAt: analysis.createdAt });
    }
    return res.json({ result, analysisId: null });
}

async function listAnalysesController(req, res) {
    const analyses = await analysisModel.find({ user: req.user.id }).select("result.score result.matched result.missing createdAt updatedAt").sort({ createdAt: -1 }).limit(50).lean();
    return res.json({ analyses });
}

async function getAnalysisController(req, res) {
    const analysis = await analysisModel.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!analysis) return res.status(404).json({ message: "Analysis not found." });
    return res.json({ analysis });
}

async function deleteAnalysisController(req, res) {
    const analysis = await analysisModel.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!analysis) return res.status(404).json({ message: "Analysis not found." });
    return res.status(204).end();
}

module.exports = { analyzeResumeController, listAnalysesController, getAnalysisController, deleteAnalysisController };
