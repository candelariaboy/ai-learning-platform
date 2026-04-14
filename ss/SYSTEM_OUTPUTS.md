# SYSTEM_OUTPUTS

This file lists the current user-facing outputs of DevPath, including UI data and representative API response shapes.

## 1) Student-Facing Outputs

### Dashboard
Student dashboard surfaces:

- profile summary (username, display name, avatar)
- progression metrics (XP, level, next level XP, streak)
- practice dimensions with confidence and evidence
- career suggestions with confidence and reasoning
- badge catalog with achieved and claimed states
- repository summaries (language, stars, pushes, commits)

### Learning Paths
Learning paths page surfaces:

- competency levels per dimension
- skill gaps with priority labels
- personalized step-by-step recommendations
- step metadata (difficulty, reward XP, tag, status)
- progress percentage at user level and per-project level

### Portfolio
Portfolio views (owner/public) surface:

- profile intro and about
- featured repos and stack signals
- badges and strengths
- configurable social/contact links

### Quests and Challenges
Gamification side panels/actions surface:

- daily quests list with eligibility and claim state
- weekly challenges list with eligibility and claim state
- reward claim results (XP changes and claim confirmation)

### Research Prompt Output
Dashboard may display a usability modal:

- 2-week SUS reminder modal (score slider + optional feedback)
- submit action confirmation toast
- dismiss option (`Remind me later`)
- visible only when `sus_auto_prompt` flag is enabled and no SUS response exists

### Certificates and Learning Accounts
Learning/certificate pages surface:

- submitted certificates and review status
- connected learning account identifiers
- auto-sync summaries and stats

## 2) Admin-Facing Outputs

### Student Directory
Admin student table surfaces:

- identity (id, username, display name, avatar)
- online state derived from last seen
- XP, level, repo count, claimed badges count

### Faculty Intervention Alerts
Admin dashboard now surfaces:

- risk-scored students needing intervention
- reasons (no login, no commits, low learning-path interaction)
- suggested action text for faculty

### Analytics
Admin analytics surfaces:

- top-level metrics (students, repos, avg XP, avg level, pending validations)
- deep analytics (activity timeline buckets, top languages, total events)
- login trends and live login buckets

### Student Support Workflows
Admin tools surface:

- advisor notes
- project validation records
- batch validation (bulk create validations)
- pending certificate reviews and review actions
- batch certificate review (verify/reject all selected)
- intervention plans

### Cohort and Research Outputs

- cohort comparison by program and year level
- research KPI snapshot (SUS average, recommendation acceptance, login/update frequency)
- CSV export for class reporting

## 3) Representative API Outputs

### GET /api/user/{username}

```json
{
  "profile": {
    "username": "student1",
    "display_name": "Student One",
    "avatar_url": "https://...",
    "bio": "Aspiring full-stack developer",
    "xp": 1650,
    "level": 4,
    "next_level_xp": 2000,
    "streak_days": 7
  },
  "practice_dimensions": [
    {
      "label": "Frontend Engineering",
      "confidence": 74,
      "evidence": ["TypeScript", "React", "CSS"]
    }
  ],
  "career_suggestions": [
    {
      "title": "Frontend Engineer",
      "confidence": 79,
      "reasoning": "Frontend-heavy signals detected from repositories."
    }
  ],
  "badges": [
    {
      "label": "Repo Builder 3",
      "rarity": "common",
      "achieved": true,
      "claimed": false,
      "reward_xp": 50,
      "category": "Repo Builder",
      "category_icon": "📦"
    }
  ],
  "repos": [
    {
      "name": "portfolio-app",
      "language": "TypeScript",
      "languages": ["TypeScript", "CSS", "HTML"],
      "stars": 2,
      "last_push": "2026-03-29T10:10:00Z",
      "commit_count": 45
    }
  ]
}
```

### GET /api/learning-path/{username}

```json
{
  "username": "student1",
  "progress_percent": 42,
  "competency_levels": [
    {
      "dimension_key": "frontend_engineering",
      "dimension": "Frontend Engineering",
      "description": "Web and Application Development",
      "score_percent": 36,
      "level": "Beginner",
      "evidence": ["JavaScript", "CSS"]
    }
  ],
  "skill_gaps": [
    {
      "dimension_key": "frontend_engineering",
      "current_level": "Beginner",
      "target_level": "Advanced",
      "priority": "High",
      "gap_summary": "Build foundational competency"
    }
  ],
  "steps": [
    {
      "title": "Build responsive pages with semantic HTML, modern CSS, and JavaScript fundamentals.",
      "reason": "Strengthens missing beginner competencies.",
      "tag": "frontend_engineering",
      "difficulty": "Beginner",
      "reward_xp": 140,
      "status": "todo",
      "priority": "High",
      "progression_step": 1,
      "evidence": ["portfolio-app", "TypeScript"]
    }
  ]
}
```

### GET /analytics/engagement

```json
{
  "weekly_commits": [
    {
      "week_start": "2026-03-23T00:00:00",
      "commit_count": 18
    }
  ],
  "xp_growth": [
    {
      "week_start": "2026-03-23T00:00:00",
      "xp_gained": 220
    }
  ],
  "learning_progress": [
    {
      "learning_step": "Build API integration",
      "status": "done"
    }
  ],
  "engagement_score": 81
}
```

### GET /analytics/login-activity

```json
{
  "daily_counts": [
    {
      "date": "2026-03-29",
      "count": 1
    }
  ],
  "peak_hours": [
    {
      "hour": 20,
      "count": 7
    }
  ],
  "weekly_active": [
    {
      "week_start": "2026-03-24",
      "active_users": 25
    }
  ],
  "streak": {
    "current_streak": 6
  },
  "recent_logins": [
    {
      "login_timestamp": "2026-03-29T20:12:30",
      "device": "Mozilla/5.0"
    }
  ]
}
```

### POST /api/surveys/sus

```json
{
  "username": "student1",
  "score": 84,
  "feedback": "UI feels smooth on mobile.",
  "created_at": "2026-04-01T10:40:00"
}
```

### GET /admin/students

```json
[
  {
    "id": 12,
    "username": "student1",
    "display_name": "Student One",
    "avatar_url": "https://...",
    "level": 3,
    "xp": 1240,
    "repo_count": 6,
    "badges_claimed": 4,
    "online": true,
    "last_seen": "2026-03-29 11:20:30"
  }
]
```

### GET /admin/analytics

```json
{
  "total_students": 120,
  "total_repos": 540,
  "avg_xp": 980,
  "avg_level": 2,
  "pending_validations": 17
}
```

## 4) Output Rules and Interpretation

### Learning level bands

- 0-39 => Beginner
- 40-69 => Intermediate
- 70-100 => Advanced

### Gap priority

- lowest-score dimensions are prioritized first
- priority labels are High, Medium, Low

### Gamification outputs

- XP is computed from commits, repo count, stars, and language diversity
- level increments every 500 XP
- badge rarity controls reward XP at claim time

## 5) Final Outcomes Students Actually Receive

The system's practical outcomes for students are:

- clear competency map per dimension
- ranked skill gaps with priority
- actionable learning steps with evidence and reward XP
- visible growth through XP, level, badges, and progress tracking
