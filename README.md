# Pathfinder

Pathfinder is a career-preparation workspace for comparing a resume with a job description, finding matching skills and growth areas, preparing for interviews, and creating a role-focused resume draft.

## Features

- Resume and job-description uploads for `.pdf`, `.docx`, `.txt`, and `.md` files (maximum 5 MB), with browser-based text extraction for PDF and Word documents.
- Role alignment score with matching skills and suggested growth areas.
- Role-aware interview practice questions with answer guidance.
- Editable resume source and downloadable tailored `.txt` draft.
- Account-first workflow: register or sign in, add a resume and job description, review skill gaps, practice interview questions, then download a tailored resume draft.
- Per-account analysis history stored in MongoDB; resume and job text are kept in that account's browser workspace and in the saved analysis record.
- Per-account job application tracker with company, role, location, job link, status, match score, and saved resume drafts.
- Named resume versions stored with each tracked application, with one-click restore to any earlier draft.
- Gemini-powered role analysis, interview questions, and resume drafting when `GEMINI_API_KEY` is set. Otherwise a clearly labeled local baseline is used.

## Run locally

Requirements: Node.js 18+, npm, and a reachable MongoDB instance for the account-first workflow.

1. Start the API:

   ```powershell
   cd Backend
   npm install
   # Create .env from .env.example if one does not already exist.
   # Set MONGO_URI and JWT_SECRET in .env to enable accounts.
   npm run dev
   ```

2. In a second terminal, start the frontend:

   ```powershell
   cd Frontend
   npm install
   npm run dev
   ```

3. Visit `http://localhost:5173`. The API health endpoint is `http://localhost:3000/api/health`.

After signing in, upload a resume and a job description to run the workflow. Scanned/image-only PDFs need OCR and should be converted to text before uploading. Without a Gemini key, skill matching uses a transparent keyword baseline. Results are guidance, not a hiring decision; review the resume draft for accuracy.

## API

- `GET /api/health` — API liveness and database status.
- `GET /api/ready` — readiness check (requires MongoDB).
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/get-me` — account/session endpoints.
- `POST /api/workspace/analyze` — authenticated role analysis; saves the result to the signed-in account.
- `GET /api/workspace/history`, `GET /api/workspace/history/:id`, `DELETE /api/workspace/history/:id` — authenticated, account-scoped analysis history.
- `GET`, `POST /api/workspace/applications` — list or create account-scoped job applications.
- `GET`, `PATCH`, `DELETE /api/workspace/applications/:id` — read, update status/details, or delete an application.
- `POST /api/workspace/applications/:id/versions` — save a named resume snapshot.
- `PATCH /api/workspace/applications/:id/versions/:versionId/activate` — restore a saved resume snapshot as the current draft.

The health endpoint runs without MongoDB. The account workflow, analysis, history, application tracker, and resume versions require MongoDB.

## Deploy to Vercel and Render

Deploy the React frontend to Vercel and the API to Render. Vercel proxies `/api` to Render, so browser requests and session cookies stay on the Vercel origin.

1. Push this repository to GitHub and create a MongoDB Atlas database. Add a database user and allow network access from Render (Atlas network access settings must permit the service to connect).
2. In Render, choose **New → Blueprint**, connect the repository, and apply `render.yaml`. Set `MONGO_URI` to the Atlas connection string. Add `GEMINI_API_KEY` if you want AI-generated analysis; without it, the app uses its local baseline. Render generates `JWT_SECRET` and supplies `PORT`.
3. In Vercel, import the same repository and set the project root to `Frontend`. The API rewrite in `Frontend/vercel.json` points to `https://pathfinder.onrender.com`; update that host if Render assigned a different service URL. Deploy and note the Vercel production origin.
4. In Render, set `FRONTEND_URL` to the Vercel production origin (for example, `https://your-app.vercel.app`, without a trailing slash) and redeploy. Check `/api/health` and `/api/ready` through the Vercel domain; readiness should report `connected` before using account features.

Render generates `JWT_SECRET` and supplies `PORT`. Keep the Atlas connection string and Gemini key in Render's environment settings, not in source control. The free Render service may sleep when idle, so its first request after inactivity can take longer.

## Configuration

`Backend/.env.example` lists the server settings. Pathfinder uses Gemini for AI generation; keep `GEMINI_API_KEY` in the backend environment file. In local development Vite proxies `/api` to `http://localhost:3000`; in production Vercel proxies `/api` to the Render service.
