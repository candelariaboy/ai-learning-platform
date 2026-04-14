# LSPU AI-Enhanced Gamified Student Portfolio Platform

LSPU AI-Enhanced Gamified Student Portfolio Platform is a full-stack AI-powered student portfolio platform.
It uses GitHub OAuth, repository analysis, explainable AI insights, and deterministic gamification.

## Stack

- Frontend: React, TypeScript, Tailwind CSS, Framer Motion, Vite
- Backend: FastAPI, SQLAlchemy
- Local DB: SQLite (`backend/devpath.db`)
- AI: Groq API (with fallback heuristic)
- Optional production DB: Supabase Postgres

## Features

- GitHub login and registration flow
- Repo sync and analyzer
- AI practice dimensions with confidence and evidence
- AI career suggestions with reasoning
- Rule-based XP, levels, streaks, badges, achievements
- Achievements claim flow
- Customizable portfolio preview and public share page
- Light/Dark portfolio theme settings
- Leaderboard and multi-page app navigation

## How It Works (Current)

1. Student signs in through GitHub OAuth (`/auth/github/login` -> `/auth/github/callback`) or admin signs in through `/auth/admin/login`.
2. Backend syncs repositories, commit signals, language list, and language byte maps from GitHub.
3. The platform computes practice dimensions and career suggestions (Groq when configured, heuristic fallback otherwise).
4. Gamification is recomputed (XP, level, streak signals, badges), then user data is persisted in SQLite/Postgres.
5. Frontend stores JWT and username, loads dashboard data from `/api/*`, and keeps session alive with `/api/ping` heartbeat.
6. Learning Paths, curriculum map, weekly digest, and recommendation adoption tracking are served through dedicated endpoints.
7. Portfolio Completeness is computed server-side using rule-based buckets (Profile Basics, Career Targets, Repository Evidence, Portfolio Curation, Learning Engagement, Credentials), each with fixed max points summing to 100.
8. Suggested resources are selected per learning step from a curated library with per-type balancing; direct links are used for Certifications/Courses, while Skills use step-aware search links.
9. Admin pages use `/admin/*` and `/analytics/*` endpoints for monitoring, interventions, and research metrics.

For full technical flow, see [HOW_SYSTEM_WORKS.md](HOW_SYSTEM_WORKS.md).

## Learning Path And Resource Logic

- Learning-path steps come from backend analysis (`backend/app/services/learning_path.py`) and are exposed through `/api/learning-path/{username}`.
- Resource suggestions are matched by step signals (title, reason, tags, dimension, difficulty) against a curated catalog in `frontend/src/pages/LearningPathsPage.tsx`.
- The picker balances results by kind per step and avoids repeating the same resource IDs across multiple steps whenever possible.
- Current link behavior:
  - Certifications: open direct provider/certification URLs.
  - Courses: open direct course URLs.
  - Skills: open step-aware scoped links (search/docs query based on the current step).

## Portfolio Completeness Logic

- Endpoint: `GET /api/portfolio-completeness/me`.
- Scoring service: `backend/app/services/portfolio_metrics.py`.
- Buckets and max scores:
  - Profile Basics: 20
  - Career Targets: 15
  - Repository Evidence: 25
  - Portfolio Curation: 15
  - Learning Engagement: 15
  - Credentials: 10
- Total score is clamped to `0-100` and returned with full per-bucket breakdown.

## FINAL SUMMARY (SYSTEM ONLY)

- Ingests student portfolio and GitHub repository data (profile, repositories, commits, language distribution, stars).
- Analyzes practice dimensions, skills, activities, and frequency using AI inference (Groq when configured; deterministic heuristic fallback when not configured).
- Identifies strengths and specializations and generates personalized, outcome-based learning paths (project-level variants and competency-focused steps).
- Deterministic gamification: XP computed from repository activity (commit_xp = commits * 2, repo_xp = repo_count * 50, language_xp = max(0, unique_languages - 1) * 30, stars_xp = total_stars, plus bonus_xp). Levels are bucketed (level = max(1, total_xp // 500 + 1)), with badges, quests, and weekly challenges.
- Recommendation tracking & adoption analytics: records per-action events (shown, clicked, accepted, started, completed) and per-action ratings (1-5) for relevance tracking; endpoints include `GET /api/recommendations/v2/{username}` and `POST /api/recommendations/action`.
- Implementation pointers: backend services live under `backend/app/services` (see `gamification.py`, `learning_path.py`) and routers under `backend/app/routers`; frontend consumers live under `frontend/src/pages` and `frontend/src/lib/api.ts`.


## Project Structure

- `backend/` FastAPI app and data logic
- `frontend/` React app
- `supabase/` optional local Supabase config

## Local Setup

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend runs at `http://127.0.0.1:8000`.

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Environment Variables

### Backend (`backend/.env`)

- `DATABASE_URL` (example: `sqlite:///./devpath.db`)
- `JWT_SECRET`
- `FRONTEND_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GROQ_API_KEY`
- `GROQ_MODEL`

See `backend/.env.example`.

### Frontend (`frontend/.env`)

- `VITE_API_BASE=http://localhost:8000`

See `frontend/.env.example`.

## Common Commands

- Recompute insights (authenticated): `POST /api/user/recompute`
- Claim achievements: `POST /api/user/claim-badges`
- User data: `GET /api/user/{username}`
- Public portfolio: `GET /api/portfolio/{username}`

## Deployment Notes

- Frontend target: Vercel
- Backend target: Render
- For Supabase production, use Postgres connection string in `DATABASE_URL`.

## License

Private project by default. Add a license if you plan to open source.
