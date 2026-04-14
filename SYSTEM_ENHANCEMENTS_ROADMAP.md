# SYSTEM_ENHANCEMENTS_ROADMAP

This roadmap translates proposed improvements into implementation-ready phases for DevPath.

## Phase 1 (Immediate, 1-2 weeks)

- In-App SUS Survey Reminder
  - Status: Implemented (frontend auto-prompt after 14 days of first seen usage).
  - Notes: Uses `/api/surveys/sus` and `/api/surveys/sus/me`.
- A/B Testing Feature Flags (local baseline)
  - Status: Implemented (frontend feature flags in localStorage).
  - Notes: Enables incremental rollout/testing without backend migration.
- Mobile-First pass on key screens
  - Scope: Dashboard, Learning Paths, Public Portfolio.
  - Success metric: no horizontal overflow and readable cards at 360px width.

## Phase 2 (Core AI and UX, 2-4 weeks)

- Skill Gap Heatmap
  - Backend: Extend `/api/curriculum-map/{username}` with industry target profile overlays.
  - Frontend: Add heatmap panel on Dashboard and Learning Paths.
- AI Career Match Score
  - Backend: Career readiness score per track from repo signals + learning progress.
  - Frontend: Show top 3 tracks with percent readiness and gap drivers.
- Smart Weekly Digest Notifications
  - Backend: Weekly digest generation job every Monday.
  - Delivery: email and in-app inbox cards.
- Progress Ring on Dashboard
  - Frontend: animated circular ring for portfolio completeness and level progress.
- Achievement Showcase
  - Frontend + API: pin top 3 badges for public portfolio recruiter view.

## Phase 3 (Advanced Gamification and Faculty Tools, 4-8 weeks)

- Prestige / Rank System
  - Backend: rank ladder, prestige reset rules, rank flair metadata.
  - Frontend: profile flair, rank badge frame, history timeline.
- Streak Freeze
  - Backend: consumable items inventory and streak validation override.
  - Frontend: one-click consume freeze on missed day.
- Seasonal Events / Hackathon Badges
  - Backend: time-boxed event definitions and claim rules.
  - Frontend: event banner, countdown, and event leaderboard.
- Batch Validation
  - Admin UI: bulk select + approve/reject for certificates and validations.
  - Backend: new bulk endpoints with audit logs.
- Cohort Comparison Dashboard
  - Admin analytics: BSCS vs BSIT, year-level comparisons, trend charts.

## Phase 4 (Research-Grade and Social Intelligence, 8+ weeks)

- Peer-Based Recommendations
  - Backend: collaborative filtering pipeline from recommendation action events.
  - Frontend: "students like you also completed" suggestions.
- Squad/Group Feature
  - Backend: squad membership, group XP, group leaderboard.
  - Frontend: squad panel and weekly group goals.
- AI-Assisted Intervention Alerts
  - Backend: risk scoring for inactivity and low progression.
  - Admin UI: prioritized alert inbox with suggested interventions.
- Faculty Annotation on Portfolio
  - Backend: pinned comment model per project/section.
  - Frontend: visible faculty highlights on owner and optional public mode.
- Research Analytics Page
  - Hidden admin page for SUS average, recommendation acceptance, update frequency, login frequency.

## Recommended Data Additions

- `feature_flags` (server-side rollout control)
- `career_match_scores`
- `industry_skill_benchmarks`
- `peer_recommendation_events`
- `weekly_digest_logs`
- `seasonal_events`, `event_badge_claims`
- `streak_freeze_inventory`
- `squads`, `squad_members`, `squad_xp_history`
- `faculty_annotations`

## Suggested KPI Targets

- SUS response rate: >= 70% of active students
- Recommendation acceptance rate: +20% vs baseline
- Weekly active students: +15% after digest rollout
- 4-week retention: +10% after streak freeze + seasonal events
- Faculty review throughput: 2x after batch validation

## Rollout Strategy

1. Ship behind feature flags.
2. Start with 10% pilot cohort.
3. Compare control vs treatment using research metrics.
4. Expand to 50%, then 100% after stability and KPI gains.
