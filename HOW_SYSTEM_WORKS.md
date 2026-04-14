# HOW_SYSTEM_WORKS (Current, Code-Aligned)

This document describes the current end-to-end behavior of the LSPU AI-Enhanced Gamified Student Portfolio Platform, aligned to the code in this repository.

Last verified against this codebase: April 13, 2026

---

## 0) One-Page Summary

What the system currently does:

- Students sign in with GitHub OAuth.
- Backend syncs profile + repos and computes:
  - portfolio signals (languages, commits, stars, repo metadata)
  - practice dimensions + career suggestions
  - deterministic XP, level, badges
  - general and per-project learning paths
  - rule-based + peer-based recommendations
- Student activity is tracked for engagement and login analytics.
- Admin/Faculty (staff role) can:
  - manage students, notes, validations, reviews, certificates, interventions
  - view intervention alerts, cohort comparison, evaluation/research analytics
  - export student CSV

What "outcome-based" means in this implementation:

- Progress is inferred from repo/activity signals and learning-step completion, not from formal grade records.

---

## 1) Architecture

Frontend:

- React + TypeScript + Vite + Tailwind (`frontend/`)
- API client in `frontend/src/lib/api.ts`
- JWT tokens stored in `localStorage`

Backend:

- FastAPI + SQLAlchemy (`backend/`)
- Routers:
  - `/auth`
  - `/api`
  - `/admin`
  - `/analytics`

Database:

- SQLite by default (`backend/devpath.db`)
- Optional Postgres through `DATABASE_URL`

AI/Inference:

- Groq APIs when configured
- deterministic fallbacks when Groq unavailable or disabled
- collaborative filtering uses `scikit-learn` cosine similarity

---

## 2) Local Runtime

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Default URLs:

- Backend: `http://127.0.0.1:8000`
- Frontend: `http://localhost:5173`

---

## 3) Configuration

Backend envs (`backend/app/core/config.py`):

Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`

Optional/feature flags:

- `FRONTEND_URL`
- `BACKEND_URL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `INFERENCE_MODE` (`groq` or fallback)
- `ADMIN_LOGIN_USERNAME`, `ADMIN_LOGIN_PASSWORD`
- `FACULTY_LOGIN_USERNAME`, `FACULTY_LOGIN_PASSWORD`

Frontend env:

- `VITE_API_BASE`

---

## 4) Startup and Lightweight Migration

On backend start (`backend/app/main.py`):

1. `Base.metadata.create_all(bind=engine)`
2. If SQLite: runs compatibility `ALTER TABLE` / `CREATE TABLE` checks
3. Applies CORS config
4. Registers routers
5. Exposes `GET /health` with `database_backend` and `production_ready` flags

Note: this is not Alembic-style migration management.

---

## 5) Authentication, Roles, and Sessions

### 5.1 Student OAuth

- `GET /auth/github/login`
- `GET /auth/github/callback`

Callback behavior:

- upserts user + repos
- computes initial inference/gamification
- redirects to frontend with `token` and `username`
- new users go to `/register`, existing users to `/dashboard`

### 5.2 Staff login

- `POST /auth/admin/login`
- `POST /auth/faculty/login`

Both issue staff JWTs using subject `admin:{id}` and role claim (`admin` or `faculty`).

### 5.3 Access guards

- Student guard: `get_current_user`
- Staff guard: `get_current_admin` (accepts `admin` and `faculty` roles)

### 5.4 Frontend token storage

Student keys:

- `devpath_token`
- `devpath_username`

Staff keys:

- `devpath_admin_token`
- `devpath_admin_username`

Heartbeat:

- Non-admin pages ping `GET /api/ping`
- Invalid token clears auth and redirects to `/`

---

## 6) Data Ingestion and Portfolio Core

GitHub ingestion (`backend/app/services/github.py`) includes:

- profile (`/user`)
- repos (`/user/repos` or `/users/{username}/repos`)
- languages (`/repos/{full_name}/languages`)
- commit estimates (contributors-first fallback to commits pagination)
- streak estimation (PushEvent day streak)

Persisted repo fields include:

- `name`, `description`, `language`, `languages`, `language_bytes`
- `stars`, `topics`, `last_push`, `commit_count`, `code_signals`

Portfolio APIs:

- `GET /api/portfolio/{username}`
- `GET /api/user/me/portfolio`
- `PUT /api/user/settings`

---

## 7) Student Profile and Preference Data

Registration and profile fields currently captured:

- display/bio
- student id, program, year level
- career interest
- preferred learning style
- target role
- target certifications (JSON list)

Endpoints:

- `POST /api/register`
- `GET /api/user/me`
- `GET /api/user/{username}`

Important: there is no separate table yet for academic grades/honors/enrolled-courses.

---

## 8) Practice Dimensions and Career Suggestions

Outputs:

- practice dimensions (`label`, `confidence`, `evidence`)
- career suggestions (`title`, `confidence`, `reasoning`)

Modes:

- Groq mode via `services/groq.py`
- deterministic fallback mode via same service path

Domain model used across learning/curriculum:

- `frontend_engineering`
- `backend_systems_engineering`
- `data_science_intelligence`
- `systems_devops_engineering`

---

## 9) Learning Path System

### 9.1 User learning path

Endpoint:

- `GET /api/learning-path/{username}`
- `POST /api/learning-path/steps/status` (manual step status update)

Returns:

- `steps`
- `progress_percent`
- `competency_levels`
- `skill_gaps`

Progress behavior:

- baseline signals stored in `portfolio_settings.learning_path_baseline`
- new signals vs baseline are used to annotate step status
- status persisted in `learning_progress`
- student can manually update status (`todo | in_progress | done`) via API and UI button
- manual `done/in_progress` state is preserved against passive inference refreshes
- if `user.career_interest` targets `Backend Engineer`, generator switches to a BSCS/BSIT-like backend curriculum sequence:
  - DSA-backed API implementation
  - relational database + transactions
  - secure software architecture + testing
  - deployment/observability capstone

### 9.2 Project learning paths

Endpoint:

- `GET /api/learning-path/projects/{username}`

Per-repo steps are tracked using `portfolio_settings.project_learning_path_baseline`.

### 9.3 Curriculum map

Endpoint:

- `GET /api/curriculum-map/{username}`

Returns subject coverage and heatmap payload aligned to the 4 dimension keys.

---

## 10) Gamification and Progression

Core XP logic is deterministic (`services/gamification.py`):

- commit, repo-count, language-diversity, stars, plus bonus XP
- level formula: `max(1, total_xp // 500 + 1)`

Student APIs:

- `POST /api/user/recompute`
- `POST /api/user/claim-badges`
- `GET /api/leaderboard`

Quests/challenges:

- `GET /api/quests/daily`
- `POST /api/quests/daily/claim`
- `GET /api/challenges/weekly`
- `POST /api/challenges/weekly/claim`

---

## 11) Recommendation System and Feedback

### 11.1 Rule recommendations

- `GET /api/recommendations/v2/{username}`

Behavior:

- weak-skill-first rule module generation
- logs `shown` events
- includes peer recommendations from collaborative filtering

### 11.2 Peer recommendations (collaborative filtering)

- implemented in `services/collaborative_filter.py`
- `sklearn.metrics.pairwise.cosine_similarity`
- similarity vector blends:
  - normalized practice-dimension scores
  - recommendation behavior signals (accepted/completed/rated/rejected, feedback density)
  - learning-step completion signal

### 11.3 Action/rating tracking

- `POST /api/recommendations/action`

Allowed actions:

- `shown`, `clicked`, `accepted`, `completed`, `started`, `rejected`, `rated`

Additional fields:

- optional rating (1-5)
- optional feedback text

---

## 12) Certificates and External Learning Accounts

Student APIs:

- `POST /api/certificates/submit`
- `GET /api/certificates/me`
- `POST /api/certificates/auto-sync`
- `GET /api/learning-accounts/me`
- `PUT /api/learning-accounts/me`
- `GET /api/learning-accounts/stats`

Admin APIs:

- `GET /admin/certificates/pending`
- `POST /admin/certificates/review`
- `POST /admin/certificates/review/bulk`

Current auto-sync focus is freeCodeCamp integration.

---

## 13) Surveys and Evaluation Metrics

Student SUS endpoints:

- `POST /api/surveys/sus`
- `GET /api/surveys/sus/me`
- `POST /api/surveys/career-confidence` (pre/post)
- `GET /api/surveys/career-confidence/me`

Admin evaluation/research endpoints:

- `GET /admin/evaluation/metrics`
- `GET /admin/research/analytics`

Computed aggregates include:

- avg SUS
- recommendation acceptance/relevance/rating totals
- formal portfolio-completeness score (rubric-based)
- weekly login/profile update frequencies
- pre/post career-confidence averages and delta

---

## 14) Analytics Endpoints

Student analytics:

- `GET /analytics/engagement`
- `GET /analytics/activity-timeline`
- `GET /analytics/login-activity`
- `GET /analytics/login-trends`
- `GET /analytics/login-live`

Admin analytics:

- `GET /admin/analytics`
- `GET /admin/analytics/deep`
- `POST /admin/analytics/reset`

---

## 15) Admin and Faculty Governance APIs

Student management:

- `GET /admin/students`
- `GET /admin/students/{student_id}/details`
- `POST /admin/students/verify`
- `DELETE /admin/students/{student_id}`
- `DELETE /admin/students` (bulk delete with confirmation token)

Notes:

- `POST /admin/notes`
- `GET /admin/notes/{student_id}`

Project validations:

- `POST /admin/validations`
- `POST /admin/validations/bulk`
- `GET /admin/validations`
- `GET /admin/validations/{student_id}`

Portfolio reviews:

- `POST /admin/portfolio-reviews`
- `GET /admin/portfolio-reviews/{student_id}`

Interventions and risk:

- `POST /admin/interventions`
- `GET /admin/interventions`
- `GET /admin/interventions/{student_id}`
- `GET /admin/intervention-alerts`

Cohort/export:

- `GET /admin/cohort-comparison`
- `GET /admin/export/students.csv`

Student-side related endpoint:

- `GET /api/validations/me`

---

## 16) Frontend Routes (Current)

Defined in `frontend/src/App.tsx`:

- `/`
- `/register`
- `/dashboard`
- `/learning-paths`
- `/project-validations`
- `/training`
- `/achievements`
- `/my-portfolio`
- `/portfolio/:username`
- `/p/:username`
- `/review/:token`
- `/admin-login`
- `/faculty-login`
- `/faculty`
- `/admin` (index)
- `/admin/students`
- `/admin/validations`
- `/admin/certificates`
- `/admin/interventions`
- `/admin/intervention-alerts`
- `/admin/cohort-comparison`
- `/admin/evaluation`
- `/admin/leaderboard`

---

## 17) Data Model (Key Tables)

Core:

- `users`
- `repos`
- `practice_dimensions`
- `career_suggestions`
- `portfolio_settings`
- `learning_progress`
- `badges`

Activity/analytics:

- `activity_logs`
- `engagement_commits`
- `xp_history`
- `login_activity`
- `daily_quest_claims`
- `weekly_challenge_claims`

Recommendations/evaluation:

- `recommendation_actions`
- `sus_survey_responses`

Admin/governance:

- `admin_accounts`
- `admin_notes`
- `project_validations`
- `portfolio_reviews`
- `certificate_records`
- `intervention_plans`

---

## 18) Full Endpoint Inventory (By Router)

### `/auth`

- `GET /auth/github/login`
- `GET /auth/github/callback`
- `POST /auth/admin/login`
- `POST /auth/faculty/login`

### `/api`

- `GET /api/ping`
- `POST /api/logout`
- `GET /api/user/{username}`
- `PUT /api/user/settings`
- `POST /api/register`
- `POST /api/user/recompute`
- `POST /api/user/claim-badges`
- `GET /api/portfolio/{username}`
- `GET /api/user/me/portfolio`
- `GET /api/user/me`
- `GET /api/leaderboard`
- `GET /api/learning-path/{username}`
- `POST /api/learning-path/steps/status`
- `GET /api/curriculum-map/{username}`
- `GET /api/recommendations/v2/{username}`
- `GET /api/digest/weekly/{username}`
- `POST /api/certificates/submit`
- `GET /api/certificates/me`
- `GET /api/validations/me`
- `GET /api/learning-accounts/me`
- `PUT /api/learning-accounts/me`
- `GET /api/learning-accounts/stats`
- `POST /api/certificates/auto-sync`
- `POST /api/recommendations/action`
- `POST /api/surveys/sus`
- `GET /api/surveys/sus/me`
- `POST /api/surveys/career-confidence`
- `GET /api/surveys/career-confidence/me`
- `GET /api/portfolio-completeness/me`
- `GET /api/quests/daily`
- `POST /api/quests/daily/claim`
- `GET /api/challenges/weekly`
- `POST /api/challenges/weekly/claim`
- `GET /api/learning-path/projects/{username}`

### `/admin`

- `DELETE /admin/students`
- `GET /admin/students`
- `GET /admin/students/{student_id}/details`
- `DELETE /admin/students/{student_id}`
- `POST /admin/students/verify`
- `GET /admin/analytics`
- `GET /admin/analytics/deep`
- `POST /admin/analytics/reset`
- `GET /admin/evaluation/metrics`
- `POST /admin/notes`
- `GET /admin/notes/{student_id}`
- `POST /admin/validations`
- `GET /admin/validations`
- `GET /admin/validations/{student_id}`
- `POST /admin/portfolio-reviews`
- `GET /admin/portfolio-reviews/{student_id}`
- `GET /admin/certificates/pending`
- `POST /admin/certificates/review`
- `POST /admin/interventions`
- `GET /admin/interventions`
- `GET /admin/interventions/{student_id}`
- `POST /admin/validations/bulk`
- `POST /admin/certificates/review/bulk`
- `GET /admin/intervention-alerts`
- `GET /admin/cohort-comparison`
- `GET /admin/export/students.csv`
- `GET /admin/research/analytics`

### `/analytics`

- `GET /analytics/engagement`
- `GET /analytics/activity-timeline`
- `GET /analytics/login-activity`
- `GET /analytics/login-trends`
- `GET /analytics/login-live`

---

## 19) Known Implementation Notes and Current Gaps

- SQLite compatibility migrations are runtime-only and not a replacement for full migration tooling.
- `repos.code_signals` exists, but this repo currently stores mostly empty/default values unless explicitly supplied in summary input.
- Faculty login now has dedicated frontend route (`/faculty-login`) and faculty landing view (`/faculty`), but most governance pages are still shared under `/admin/*`.
- Frontend calls `fetchReviewPortfolio()` to `/api/review/`, but there is currently no matching backend `/api/review/` endpoint in this codebase.
- There is no dedicated consent-management or privacy self-service module yet (e.g., user-facing export/delete consent flow pages).
- No formal academic-grade/honors/enrolled-courses schema yet.
- No self-reported skills-proficiency table with progression history yet.
- Learning-path progression now supports manual step status updates, but certificate completion and external-learning account stats are not yet auto-mapped to step completion.
- Collaborative filtering now uses behavior signals from recommendation actions and applies feedback-aware re-ranking; it still benefits from larger data volume over time.

---

## 20) Key File Pointers

- Backend entry: `backend/app/main.py`
- Auth router: `backend/app/routers/auth.py`
- Student router: `backend/app/routers/users.py`
- Admin router: `backend/app/routers/admin.py`
- Analytics routers: `backend/app/routers/analytics.py`, `backend/app/routers/login_analytics.py`
- GitHub service: `backend/app/services/github.py`
- Groq/profile inference: `backend/app/services/groq.py`
- Learning-path engine: `backend/app/services/learning_path.py`
- Collaborative filtering: `backend/app/services/collaborative_filter.py`
- Portfolio completeness rubric: `backend/app/services/portfolio_metrics.py`
- Gamification engine: `backend/app/services/gamification.py`
- Frontend routes: `frontend/src/App.tsx`
- Frontend API client: `frontend/src/lib/api.ts`
- ORM models: `backend/app/models.py`
- API schemas: `backend/app/schemas.py`
