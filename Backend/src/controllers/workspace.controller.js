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

function getGeminiConfig() {
    return {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
        fallbackModel: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite"
    };
}

async function generateWithGemini(resumeText, jobDescription, aiConfig) {
    if (!aiConfig.apiKey) return null;
    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": aiConfig.apiKey },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: "You are a careful career coach. Compare the resume to the job description. Never invent experience, credentials, metrics, or skills. Return JSON with score (integer 0-100), matched (string array), missing (string array), questions (exactly 5 role-specific interview questions), and resume (a polished ATS-friendly plain-text resume tailored to the role using only truthful source details; do not present missing skills as possessed skills)." }] },
            contents: [{ role: "user", parts: [{ text: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}` }] }],
            generationConfig: {
                temperature: 0.4,
                responseFormat: {
                    text: {
                        mimeType: "APPLICATION_JSON",
                        schema: {
                            type: "object",
                            properties: {
                                score: { type: "integer" },
                                matched: { type: "array", items: { type: "string" } },
                                missing: { type: "array", items: { type: "string" } },
                                questions: { type: "array", items: { type: "string" } },
                                resume: { type: "string" }
                            },
                            required: ["score", "matched", "missing", "questions", "resume"]
                        }
                    }
                }
            }
        })
    };
    let response;
    let usedModel = aiConfig.model;
    let requestTimeout;
    const models = [...new Set([aiConfig.model, aiConfig.fallbackModel].filter(Boolean))];
    for (const model of models) {
        usedModel = model;
        response = undefined;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                response = await fetch(endpoint, { ...requestOptions, signal: AbortSignal.timeout(45000) });
                requestTimeout = null;
            } catch (error) {
                if (error.name !== "AbortError" && error.name !== "TimeoutError") throw error;
                requestTimeout = error;
                break;
            }
            if (response.status !== 503 || attempt === 2) break;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
        if (response && response.status !== 503) break;
    }
    if (!response && requestTimeout) {
        throw new Error(`Gemini request timed out for ${usedModel} after 45 seconds`);
    }
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const providerMessage = errorBody?.error?.message;
        const detail = typeof providerMessage === "string" ? `: ${providerMessage.slice(0, 500)}` : "";
        throw new Error(`Gemini API (${usedModel}) returned ${response.status}${detail}`);
    }
    const body = await response.json();
    const generatedText = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}";
    const value = JSON.parse(generatedText);
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
    const aiConfig = getGeminiConfig();
    if (aiConfig.apiKey) {
        try { result = await generateWithGemini(resumeText, jobDescription, aiConfig); }
        catch (error) { console.error("Gemini analysis unavailable; using local baseline:", error.message); }
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
