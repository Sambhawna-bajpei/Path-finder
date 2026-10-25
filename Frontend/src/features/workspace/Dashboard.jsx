import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/hooks/useAuth.js";
import { activateResumeVersion, analyzeResume, createApplication, createResumeVersion, deleteApplication, getApplication, listApplications, updateApplication } from "./workspace.api.js";


const skillGroups = ["JavaScript", "TypeScript", "React", "Node.js", "Express", "REST APIs", "PostgreSQL", "SQL", "Python", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Git", "GraphQL", "MongoDB", "Redis", "System design", "Testing", "Jest", "Agile", "Leadership", "Communication", "Mentoring", "Observability", "Data analytics", "Machine learning", "Figma", "Accessibility"];
function buildResume(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const name = lines[0] || "Your Name";
  const summary = lines.find((line) => line.length > 60) || "Results-driven professional with a track record of delivering thoughtful, measurable outcomes.";
  const skills = skillGroups.filter((skill) => text.toLowerCase().includes(skill.toLowerCase()));
  return `${name}\n${lines[1] || "Professional Summary"}\n\nPROFESSIONAL SUMMARY\n${summary}\n\nCORE SKILLS\n${skills.join(" • ") || "Add your relevant skills"}\n\nEXPERIENCE & PROJECTS\n${lines.filter((line) => line.length > 45 && line !== summary).slice(0, 8).join("\n")}\n\nEDUCATION\nAdd your degree, institution, and graduation year.\n\nNote: Review all details and replace suggestions with your verified experience. Never claim skills you do not have.`;
}

export default function Dashboard() {
  const { user, loading: authLoading, handleLogout } = useAuth();
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [result, setResult] = useState(null);
  const [draftResume, setDraftResume] = useState("");
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [applicationForm, setApplicationForm] = useState({ company: "", role: "", location: "", jobUrl: "", status: "Saved" });
  const [versionTitle, setVersionTitle] = useState("");
  const [active, setActive] = useState("overview"); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [notice, setNotice] = useState("");
  const fileRef = useRef(null); const jobFileRef = useRef(null);
  const workspaceKey = user?.id ? `pathfinder:${user.id}` : null;
  useEffect(() => {
    if (!workspaceKey) return;
    setResume(localStorage.getItem(`${workspaceKey}:resume`) || "");
    setJob(localStorage.getItem(`${workspaceKey}:job`) || "");
    try { setResult(JSON.parse(localStorage.getItem(`${workspaceKey}:result`) || "null")); } catch { setResult(null); }
    try { setDraftResume(JSON.parse(localStorage.getItem(`${workspaceKey}:result`) || "null")?.resume || ""); } catch { setDraftResume(""); }
    listApplications().then(setApplications).catch((error) => setNotice(error?.response?.data?.message || "Could not load your job tracker."));
  }, [workspaceKey]);
  const readiness = useMemo(() => result?.score || 0, [result]);
  async function runAnalysis(destination = "analysis") {
    if (!resume.trim() || !job.trim()) { setNotice("Add your resume and a job description to get started."); return; }
    setBusy(true); setNotice("");
    try {
      const next = await analyzeResume({ resumeText: resume, jobDescription: job });
      setResult(next); setDraftResume(next.resume || ""); localStorage.setItem(`${workspaceKey}:resume`, resume); localStorage.setItem(`${workspaceKey}:job`, job); localStorage.setItem(`${workspaceKey}:result`, JSON.stringify(next)); setNotice("Your role analysis is ready."); setActive(destination);
    } catch (error) { setNotice(error?.response?.data?.message || "Could not analyze this application. Check the API connection and try again."); }
    finally { setBusy(false); }
  }
  async function uploadFile(file, target = "resume") {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setNotice("Please choose a file smaller than 5 MB."); return; }
    setUploading(true);
    setNotice(`Reading ${file.name}…`);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let text;
      if (extension === "pdf") {
        const [pdfjsLib, pdfWorker] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const document = await loadingTask.promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
        }
        await loadingTask.destroy();
        text = pages.join("\n");
      } else if (extension === "docx") {
        const mammothModule = await import("mammoth");
        const mammoth = mammothModule.default || mammothModule;
        const extracted = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = extracted.value;
      } else if (["txt", "md"].includes(extension)) {
        text = await file.text();
      } else {
        throw new Error("Choose a PDF, DOCX, TXT, or Markdown file.");
      }
      if (text.trim().length < 30) throw new Error("We couldn't find enough text. Try a text-based PDF, DOCX, or TXT file.");
      const maxLength = target === "job" ? 30000 : 100000;
      if (text.length > maxLength) throw new Error(`This document contains too much text (${text.length.toLocaleString()} characters). Keep it under ${maxLength.toLocaleString()} characters.`);
      if (target === "job") { setJob(text); localStorage.setItem(`${workspaceKey}:job`, text); }
      else { setResume(text); localStorage.setItem(`${workspaceKey}:resume`, text); }
      setResult(null);
      setActive("overview");
      setNotice(`${file.name} uploaded and text extracted. Continue to role analysis.`);
    } catch (error) { setNotice(error.message || "Could not read this file. Try a PDF, DOCX, TXT, or Markdown file."); }
    finally { setUploading(false); }
  }
  function handleFileSelection(event, target) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (file) void uploadFile(file, target);
  }
  async function openApplication(id) {
    try {
      const application = await getApplication(id);
      setSelectedApplication(application); setResume(application.resumeText || ""); setJob(application.jobDescription || "");
      setResult(application.result || null);
      setDraftResume(application.versions?.find((version) => version._id === application.currentVersionId)?.content || application.result?.resume || "");
      setActive("resume"); setNotice(`Opened ${application.role}${application.company ? ` at ${application.company}` : ""}.`);
    } catch (error) { setNotice(error?.response?.data?.message || "Could not open this application."); }
  }
  async function handleCreateApplication(event) {
    event.preventDefault();
    if (!applicationForm.role.trim()) { setNotice("Add a role title to save this application."); return; }
    try {
      const application = await createApplication({ ...applicationForm, resumeText: resume, jobDescription: job, result, resumeDraft: draftResume || result?.resume || "" });
      setApplications((current) => [application, ...current]);
      setApplicationForm({ company: "", role: "", location: "", jobUrl: "", status: "Saved" });
      setNotice("Job application saved to your tracker.");
    } catch (error) { setNotice(error?.response?.data?.message || "Could not save this application."); }
  }
  async function handleApplicationStatus(id, status) {
    try {
      const updated = await updateApplication(id, { status });
      setApplications((current) => current.map((item) => item._id === id ? { ...item, ...updated } : item));
      if (selectedApplication?._id === id) setSelectedApplication(updated);
    } catch (error) { setNotice(error?.response?.data?.message || "Could not update the application status."); }
  }
  async function handleDeleteApplication(id) {
    try {
      await deleteApplication(id); setApplications((current) => current.filter((item) => item._id !== id));
      if (selectedApplication?._id === id) setSelectedApplication(null);
      setNotice("Application removed from your tracker.");
    } catch (error) { setNotice(error?.response?.data?.message || "Could not delete this application."); }
  }
  async function handleSaveVersion(event) {
    event.preventDefault();
    if (!selectedApplication) { setNotice("Open a tracked application before saving a resume version."); return; }
    if (!draftResume.trim()) { setNotice("Add resume draft content before saving a version."); return; }
    try {
      const updated = await createResumeVersion(selectedApplication._id, { title: versionTitle.trim() || `Resume draft ${new Date().toLocaleDateString()}`, content: draftResume });
      setSelectedApplication(updated); setApplications((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated } : item));
      setVersionTitle(""); setNotice("Resume version saved.");
    } catch (error) { setNotice(error?.response?.data?.message || "Could not save this resume version."); }
  }
  async function handleActivateVersion(versionId) {
    try {
      const updated = await activateResumeVersion(selectedApplication._id, versionId);
      setSelectedApplication(updated); setDraftResume(updated.versions?.find((version) => version._id === updated.currentVersionId)?.content || "");
      setResult(updated.result || null); setApplications((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated } : item));
      setNotice("Resume version restored as the current draft.");
    } catch (error) { setNotice(error?.response?.data?.message || "Could not restore this resume version."); }
  }
  function downloadResume() { const blob = new Blob([draftResume || result?.resume || buildResume(resume)], { type: "text/plain" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "tailored-resume.txt"; anchor.click(); URL.revokeObjectURL(url); }
  const tabs = [["overview", "Overview", "◫"], ["applications", "Applications", "▣"], ["analysis", "Role analysis", "⌕"], ["interview", "Interview prep", "◎"], ["resume", "Resume studio", "▤"]];
  if (authLoading) return <div className="auth-loading"><span className="brand-mark">p</span><p>Opening your workspace…</p></div>;
  if (!user) return <div className="login-page"><aside className="login-aside"><a className="brand" href="/"><span className="brand-mark">p</span><span>pathfinder<span className="brand-dot">.</span></span></a><div className="login-aside-content"><div className="eyebrow"><span/> YOUR CAREER, IN FOCUS</div><h1>Get ready for<br/>what’s <em>next.</em></h1><p>Create an account or sign in to upload your resume, compare a job description, find skill gaps, and prepare your application.</p></div><span className="login-aside-foot">Your career materials stay tied to your account.</span></aside><main className="auth-side"><section className="form-container"><h1>Start with your account</h1><p>Your workspace keeps your analysis and drafts together.</p><div className="gate-actions"><Link className="primary-button auth-submit" to="/register">Create an account →</Link><Link className="secondary-auth" to="/login">I already have an account · Sign in</Link></div></section></main></div>;
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="/"><span className="brand-mark">p</span><span>pathfinder<span className="brand-dot">.</span></span></a><div className="workspace-label">WORKSPACE</div><nav>{tabs.map(([key, label, icon]) => { const locked = key !== "overview" && key !== "applications" && !result; return <button key={key} className={`nav-link ${active === key ? "selected" : ""} ${locked ? "locked" : ""}`} disabled={locked} title={locked ? "Complete resume and job-description analysis first" : ""} onClick={() => setActive(key)}><span className="nav-icon">{icon}</span>{label}{key === "analysis" && result && <span className="nav-count">1</span>}{locked && <span className="nav-lock">⌑</span>}</button>; })}</nav><div className="sidebar-bottom"><div className="plan-card"><span className="plan-icon">✳</span><strong>Your next move, made clear.</strong><p>Build confidence one step at a time.</p><div className="plan-meter"><i /></div><small>Profile strength <b>{readiness}%</b></small></div><button className="user-chip" onClick={() => user ? handleLogout().then(() => setNotice("You’ve signed out.")) : setNotice("Your workspace is saved in this browser.")}><span className="avatar">{(user?.username || "Jordan Lee").split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span><span><b>{user?.username || "Jordan Lee"}</b><small>{user?.email || "Personal workspace"}</small></span><span className="dots">···</span></button></div></aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{tabs.find(([key]) => key === active)?.[1]}</b></div><div className="top-actions"><span className="save-state"><i /> Saved locally</span>{user ? <button className="quiet-link" onClick={() => handleLogout().then(() => setNotice("You’ve signed out."))}>Sign out</button> : <><Link to="/login" className="quiet-link">Sign in</Link><Link to="/register" className="top-cta">Create account <span>↗</span></Link></>}</div></header>
    <div className="content-wrap">{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {active === "overview" && <><div className="welcome-row"><div><div className="eyebrow"><span /> YOUR CAREER, IN FOCUS</div><h1>Make your next move<br /><span>with confidence.</span></h1><p className="welcome-copy">A little clarity goes a long way. See how your experience maps to the role you want.</p></div><div className="welcome-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-sun">✳</div><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✳</span><div className="art-card"><span>ROLE FIT</span><b>{readiness}%</b><small>looking good</small></div></div></div>
        <div className="overview-grid"><section className="card setup-card"><div className="section-top"><div><span className="step-label">YOUR RESUME</span><h2>Start with your experience</h2><p>Upload a resume and check the extracted text before moving on.</p></div><span className="card-icon">01</span></div><label className="field-label">YOUR RESUME <span>PDF, DOCX, TXT or Markdown · max 5 MB</span></label><button disabled={uploading} className={`upload-box ${resume ? "file-added" : ""}`} onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); uploadFile(e.dataTransfer.files?.[0], "resume"); }}><span className="upload-symbol">↑</span><span><b>{resume ? "Resume added · " : "Choose your resume · "}<u>browse files</u></b><small>{resume ? `${resume.length.toLocaleString()} characters extracted. Click to replace.` : "PDF, Word DOCX, TXT, or Markdown. Maximum 5 MB."}</small></span><span className="upload-arrow">↗</span></button><input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={(e) => handleFileSelection(e, "resume")}/><label className="field-label job-label" htmlFor="job-description">JOB DESCRIPTION <span>PDF, DOCX, TXT or Markdown · max 5 MB</span></label><button disabled={uploading} className={`upload-box job-upload ${job ? "file-added" : ""}`} onClick={() => jobFileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); uploadFile(e.dataTransfer.files?.[0], "job"); }}><span className="upload-symbol">↑</span><span><b>{job ? "Job description added · " : "Choose a job description · "}<u>browse files</u></b><small>{job ? `${job.length.toLocaleString()} characters extracted. Click to replace.` : "Upload the job posting you want to target."}</small></span><span className="upload-arrow">↗</span></button><input ref={jobFileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={(e) => handleFileSelection(e, "job")}/><details className="paste-details"><summary>Or paste the job description</summary><textarea id="job-description" className="job-input" value={job} onChange={(e) => { setJob(e.target.value); localStorage.setItem(`${workspaceKey}:job`, e.target.value); }} placeholder="Paste a job description here…" rows="4"/></details><div className="form-footer"><span className="privacy-note">⌑ &nbsp;Your information is saved to this account.</span><button className="primary-button" disabled={busy || resume.trim().length < 30 || job.trim().length < 30} onClick={runAnalysis}>{busy ? "Analyzing your fit…" : "Find my skill gaps"}<span>→</span></button></div></section>
          <section className="card snapshot-card"><div className="section-top"><div><span className="step-label">YOUR SNAPSHOT</span><h2>{result ? "Your starting point." : "Your first role analysis."}</h2></div><span className="snapshot-icon">✳</span></div><div className="score-block"><div className="score-ring" style={{ "--score": `${readiness * 3.6}deg` }}><div><b>{readiness}</b><small>/ 100</small></div></div><div><strong>{result ? "Role alignment" : "Waiting for your files"}</strong><p>{result ? "Your experience compared with the target role." : "Upload both documents to see how your experience matches."}</p></div></div><div className="snapshot-divider"/><div className="stat-row"><div><span className="stat-check">✓</span><span><b>{result?.matched?.length || 0} matching strengths</b><small>Skills that already shine</small></span></div><button disabled={!result} onClick={() => setActive("analysis")}>View all →</button></div><div className="stat-row"><div><span className="stat-gap">↗</span><span><b>{result?.missing?.length || 0} areas to explore</b><small>Your next growth opportunities</small></span></div><button disabled={!result} onClick={() => setActive("analysis")}>Explore →</button></div><div className="snapshot-bottom"><span>✦</span> Every great career starts with a clear picture.</div></section></div>
        <div className="bottom-prompt"><span className="prompt-icon">✳</span><div><b>Small steps make meaningful progress.</b><p>Start with a role analysis, then build your interview confidence.</p></div><button onClick={() => setActive("interview")}>Explore interview prep <span>→</span></button></div></>}
      {active === "applications" && <><div className="page-heading"><div className="eyebrow"><span /> YOUR JOB SEARCH, ORGANIZED</div><h1>Keep every opportunity <em>moving.</em></h1><p>Track roles, update progress, and keep each tailored resume with the right application.</p></div><form className="card application-create" onSubmit={handleCreateApplication}><div className="section-top"><div><span className="step-label">ADD AN OPPORTUNITY</span><h2>Start tracking a role</h2><p>Save the role you are preparing for. Resume and job description drafts are attached from your current workspace.</p></div><span className="card-icon">＋</span></div><div className="application-form-grid"><label>Role title<input required maxLength="160" value={applicationForm.role} onChange={(e) => setApplicationForm({ ...applicationForm, role: e.target.value })} placeholder="e.g. Product Designer" /></label><label>Company<input maxLength="160" value={applicationForm.company} onChange={(e) => setApplicationForm({ ...applicationForm, company: e.target.value })} placeholder="Company name" /></label><label>Location<input maxLength="160" value={applicationForm.location} onChange={(e) => setApplicationForm({ ...applicationForm, location: e.target.value })} placeholder="Remote or city" /></label><label>Job posting URL<input type="url" value={applicationForm.jobUrl} onChange={(e) => setApplicationForm({ ...applicationForm, jobUrl: e.target.value })} placeholder="https://…" /></label><label>Status<select value={applicationForm.status} onChange={(e) => setApplicationForm({ ...applicationForm, status: e.target.value })}>{["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"].map((status) => <option key={status}>{status}</option>)}</select></label></div><div className="form-footer"><span className="privacy-note">{result ? `Current role match: ${result.score}/100` : "You can add the resume and job description from your overview first."}</span><button className="primary-button" type="submit">Save application <span>→</span></button></div></form><div className="application-list-heading"><div><span className="step-label">YOUR PIPELINE</span><h2>{applications.length} {applications.length === 1 ? "application" : "applications"}</h2></div></div>{applications.length ? <div className="application-list">{applications.map((application) => <article className="card application-card" key={application._id}><div className="application-card-main"><span className="application-company-mark">{(application.company || application.role).slice(0, 1).toUpperCase()}</span><div className="application-card-title"><h3>{application.role}</h3><p>{application.company || "Company not set"}{application.location ? ` · ${application.location}` : ""}</p><small>Added {new Date(application.createdAt).toLocaleDateString()} · {application.versions?.length || 0} resume versions · {application.result?.score || 0}% match</small></div></div><div className="application-card-actions"><label className="status-control"><span>Status</span><select value={application.status} onChange={(e) => handleApplicationStatus(application._id, e.target.value)}>{["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"].map((status) => <option key={status}>{status}</option>)}</select></label>{application.jobUrl && <a className="download-button" href={application.jobUrl} target="_blank" rel="noreferrer">View job ↗</a>}<button className="primary-button" type="button" onClick={() => openApplication(application._id)}>Resume versions →</button><button className="application-delete" type="button" onClick={() => handleDeleteApplication(application._id)} aria-label={`Delete ${application.role}`}>Delete</button></div></article>)}</div> : <div className="card application-empty"><span>▣</span><h3>Your tracker is ready</h3><p>Save your first role above to track its status and keep resume drafts organized.</p></div>}</>}
      {active === "analysis" && <><div className="page-heading"><div className="eyebrow"><span /> YOUR ROLE, DECODED</div><h1>Here’s where you <em>stand.</em></h1><p>A clearer picture of what you bring and what to focus on next.</p><button className="primary-button run-small" disabled={busy} onClick={runAnalysis}>{busy ? "Analyzing…" : "Refresh analysis →"}</button></div><div className="analysis-summary card"><div className="score-ring large-ring" style={{ "--score": `${readiness * 3.6}deg` }}><div><b>{readiness}</b><small>/ 100</small></div></div><div className="summary-copy"><span className="step-label">YOUR ROLE ALIGNMENT</span><h2>{readiness >= 75 ? "You’re closer than you think." : "You have a good foundation."}</h2><p>Your experience already covers {result.matched?.length || 0} relevant capabilities. A few focused growth areas can help round out your story for this role.</p></div><div className="summary-tag"><i />{result.generatedBy === "ai" ? "AI-powered role analysis" : "Skills baseline analysis"}</div></div><div className="analysis-columns"><section className="card skill-card"><div className="section-top"><div><span className="step-label">WHAT YOU ALREADY BRING</span><h2>Your matching strengths</h2></div><span className="count-pill green-pill">{result.matched?.length || 0} skills</span></div><p className="card-description">Experience that maps directly to what this role needs.</p><div className="skill-list">{(result.matched || []).map((s) => <span className="skill-tag matched-tag" key={s}><i>✓</i>{s}</span>)}{!result.matched?.length && <p className="empty-hint">No matching skills detected. Review your resume and job description text.</p>}</div></section><section className="card skill-card"><div className="section-top"><div><span className="step-label">ROOM TO GROW</span><h2>Your next opportunities</h2></div><span className="count-pill amber-pill">{result.missing?.length || 0} areas</span></div><p className="card-description">Skills the role mentions that weren’t found in your resume.</p><div className="skill-list">{(result.missing || []).map((s) => <span className="skill-tag missing-tag" key={s}><i>↗</i>{s}</span>)}{!result.missing?.length && <p className="empty-hint">No additional skill gaps were detected.</p>}</div></section></div><div className="insight-banner"><span>✦</span><div><b>A helpful idea</b><p>Choose one growth area and look for a small project or learning resource to build practical experience.</p></div><button onClick={() => setActive("interview")}>Practice for this role →</button></div></>}
      {active === "interview" && <><div className="page-heading"><div className="eyebrow"><span /> YOUR PRACTICE SPACE</div><h1>Walk in feeling <em>ready.</em></h1><p>Thoughtful questions to help you find the stories only you can tell.</p></div><div className="interview-hero card"><div className="interview-icon">◎</div><div><span className="step-label">{result.generatedBy === "ai" ? "AI-GENERATED FOR YOUR ROLE" : "BUILT-IN ROLE PRACTICE"}</span><h2>Make space for your best stories.</h2><p>These role-focused questions give you a clear place to begin your interview preparation.</p></div><div className="question-count"><b>{result.questions?.length || 0}</b><small>questions</small></div></div><div className="question-list">{(result.questions || []).map((q, i) => <article className="question-card card" key={q}><span className="question-number">{String(i + 1).padStart(2, "0")}</span><div className="question-content"><span className="step-label">{i % 2 ? "ROLE-SPECIFIC" : "BEHAVIORAL"}</span><h3>{q}</h3><details><summary>How to approach this</summary><p>Set the scene, explain the specific action you took, and share the outcome. Include a detail or metric that makes the story yours.</p></details></div><button className="save-question" title="Save question" onClick={(e) => { e.currentTarget.classList.toggle("is-saved"); e.currentTarget.textContent = e.currentTarget.classList.contains("is-saved") ? "♥" : "♡"; }}>♡</button></article>)}</div><div className="bottom-prompt"><span className="prompt-icon">✦</span><div><b>Your resume can tell a clearer story, too.</b><p>Build a role-focused draft from your experience.</p></div><button onClick={() => setActive("resume")}>Open resume studio <span>→</span></button></div></>}
      {active === "resume" && <><div className="page-heading"><div className="eyebrow"><span /> YOUR EXPERIENCE, WELL TOLD</div><h1>Make your story <em>stand out.</em></h1><p>A thoughtful starting draft, tailored to bring your most relevant experience forward.</p></div><div className="resume-grid"><section className="card resume-editor"><div className="section-top"><div><span className="step-label">YOUR SOURCE MATERIAL</span><h2>Your resume</h2></div><button className="text-button" onClick={() => fileRef.current?.click()}>↑ Upload a file</button></div><textarea className="resume-textarea" value={resume} onChange={(e) => { setResume(e.target.value); localStorage.setItem(`${workspaceKey}:resume`, e.target.value); }} placeholder="Paste your resume text here…"/><input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={(e) => handleFileSelection(e, "resume")}/><div className="resume-actions"><span>Changes save to your account workspace.</span><button className="primary-button" disabled={busy || resume.trim().length < 30 || job.trim().length < 30} onClick={() => runAnalysis("resume")}>{busy ? "Updating your draft…" : "Update my draft →"}</button></div></section><section className="card resume-preview"><div className="section-top"><div><span className="step-label">{result?.generatedBy === "ai" ? "AI-OPTIMIZED ATS DRAFT" : "ATS-FRIENDLY DRAFT"}</span><h2>A clearer first impression.</h2></div><button className="download-button" onClick={downloadResume}>↓ Download</button></div><div className="resume-paper"><textarea className="resume-draft-editor" value={draftResume || result?.resume || buildResume(resume)} onChange={(e) => setDraftResume(e.target.value)} aria-label="Editable ATS-friendly resume draft" /></div><p className="resume-disclaimer">A starting point, not a substitute for your judgment. Review every detail and keep your experience accurate.</p><div className="version-manager"><div className="section-top"><div><span className="step-label">VERSION HISTORY</span><h2>{selectedApplication ? `${selectedApplication.role}${selectedApplication.company ? ` · ${selectedApplication.company}` : ""}` : "Save drafts by application"}</h2></div>{selectedApplication && <span className="count-pill green-pill">{selectedApplication.versions?.length || 0} versions</span>}</div>{selectedApplication ? <><form className="version-save-form" onSubmit={handleSaveVersion}><input maxLength="120" value={versionTitle} onChange={(e) => setVersionTitle(e.target.value)} placeholder="Name this version, e.g. Product role v2" aria-label="Resume version name"/><button className="primary-button" type="submit">Save version</button></form><div className="version-list">{(selectedApplication.versions || []).slice().reverse().map((version) => <article className="version-row" key={version._id}><span className="version-marker">▤</span><div><b>{version.title}</b><small>{new Date(version.createdAt).toLocaleString()}</small></div>{version._id === selectedApplication.currentVersionId ? <span className="current-version">Current</span> : <button type="button" className="text-button" onClick={() => handleActivateVersion(version._id)}>Restore</button>}</article>)}{!selectedApplication.versions?.length && <p className="empty-hint">Save this draft to start a version history.</p>}</div></> : <p className="card-description">Save this analysis in <button type="button" className="inline-action" onClick={() => setActive("applications")}>Applications</button>, then open its resume versions here.</p>}</div></section></div></>}
    </div><footer className="site-footer"><span>pathfinder<span className="brand-dot">.</span></span><span>Built for the next chapter. &nbsp;·&nbsp; Your data stays in this browser.</span><a href="mailto:hello@pathfinder.local">A little feedback? ↗</a></footer></main>
  </div>;
}
