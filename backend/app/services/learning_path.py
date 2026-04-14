from __future__ import annotations

from collections import Counter
import json
import logging
import requests
import re
import time

logger = logging.getLogger(__name__)
_GROQ_LP_COOLDOWN_UNTIL = 0.0
_GROQ_LP_COOLDOWN_SECONDS = 120.0

FRAMEWORK_KEYWORDS = {
    "react",
    "next",
    "vue",
    "nuxt",
    "svelte",
    "angular",
    "remix",
}

BACKEND_KEYWORDS = {
    "api",
    "backend",
    "server",
    "fastapi",
    "flask",
    "django",
    "express",
    "nestjs",
    "spring",
}

DATABASE_KEYWORDS = {
    "postgres",
    "postgresql",
    "mysql",
    "sqlite",
    "mongodb",
    "redis",
    "database",
    "orm",
}

TEST_KEYWORDS = {
    "test",
    "testing",
    "pytest",
    "jest",
    "vitest",
    "mocha",
    "cypress",
    "playwright",
}

DEPLOY_KEYWORDS = {
    "ci",
    "cd",
    "deploy",
    "docker",
    "kubernetes",
    "vercel",
    "render",
    "railway",
    "netlify",
}

FRONTEND_LANGS = {"javascript", "typescript", "html", "css"}
BACKEND_LANGS = {"python", "java", "c#", "go", "ruby", "php", "node", "node.js"}

DIMENSION_DEFINITIONS = {
    "frontend_engineering": {
        "label": "Frontend Engineering",
        "subtitle": "Web and Application Development",
    },
    "backend_systems_engineering": {
        "label": "Backend Systems Engineering",
        "subtitle": "Software Engineering and Backend Development",
    },
    "data_science_intelligence": {
        "label": "Data Science & Intelligence",
        "subtitle": "Data Management and Intelligent Systems",
    },
    "systems_devops_engineering": {
        "label": "Systems & DevOps Engineering",
        "subtitle": "Systems Administration, Networking, and DevOps",
    },
}

LEVEL_ORDER = ["Beginner", "Intermediate", "Advanced"]

COMPETENCY_ACTIVITY_MAP = {
    "frontend_engineering": {
        "Beginner": [
            "Build responsive pages with semantic HTML, modern CSS, and JavaScript fundamentals.",
            "Implement reusable UI components and client-side routing in a small app.",
        ],
        "Intermediate": [
            "Integrate APIs, state management, and form validation in a multi-page application.",
            "Apply accessibility and component testing for critical user flows.",
        ],
        "Advanced": [
            "Optimize rendering performance, bundle strategy, and production monitoring.",
            "Ship a production-ready frontend module with robust test coverage and error handling.",
        ],
    },
    "backend_systems_engineering": {
        "Beginner": [
            "Build REST endpoints with structured routing and controller patterns.",
            "Implement CRUD operations and schema validation for core entities.",
        ],
        "Intermediate": [
            "Add authentication, authorization, and secure secret/config management.",
            "Write integration tests and standardized API error handling.",
        ],
        "Advanced": [
            "Design scalable service architecture with caching, queues, or async workers.",
            "Tune backend performance and observability for production workloads.",
        ],
    },
    "data_science_intelligence": {
        "Beginner": [
            "Prepare and clean datasets, then produce exploratory analysis reports.",
            "Model relational data and write SQL queries for reporting use cases.",
        ],
        "Intermediate": [
            "Build feature pipelines and evaluate ML models with clear metrics.",
            "Create dashboards or notebooks that communicate insights to stakeholders.",
        ],
        "Advanced": [
            "Deploy model inference services with monitoring for drift and data quality.",
            "Implement experiment tracking and versioning for reproducible ML workflows.",
        ],
    },
    "systems_devops_engineering": {
        "Beginner": [
            "Use Linux shell and scripting to automate repetitive project tasks.",
            "Containerize one project and document local environment setup.",
        ],
        "Intermediate": [
            "Set up CI/CD pipelines with lint, test, and deployment gates.",
            "Configure logging, alerting, and basic infrastructure security controls.",
        ],
        "Advanced": [
            "Design reliable deployment strategies (blue/green or rolling) with rollback plans.",
            "Improve reliability with infrastructure monitoring, scaling, and incident playbooks.",
        ],
    },
}


def _repo_tokens(repo: dict) -> set[str]:
    tokens: set[str] = set()
    for key in ("name", "description"):
        value = repo.get(key) or ""
        tokens.update(value.lower().replace("-", " ").split())
    for topic in repo.get("topics") or []:
        tokens.add(str(topic).lower())
    for lang in repo.get("languages") or []:
        tokens.add(str(lang).lower())
    if repo.get("language"):
        tokens.add(str(repo.get("language")).lower())
    code_signals = repo.get("code_signals") or {}
    for keyword in code_signals.get("keywords") or []:
        tokens.add(str(keyword).lower())
    for framework in code_signals.get("frameworks") or []:
        tokens.add(str(framework).lower())
    for test_fw in code_signals.get("testing_frameworks") or []:
        tokens.add(str(test_fw).lower())
    for architecture in code_signals.get("architecture") or []:
        tokens.add(str(architecture).lower())
    testing = code_signals.get("testing") or {}
    if testing.get("has_tests"):
        tokens.add("testing")
        tokens.add("test")
    devops = code_signals.get("devops") or {}
    if devops.get("has_ci"):
        tokens.add("ci")
    if devops.get("has_docker"):
        tokens.add("docker")
    if devops.get("has_kubernetes"):
        tokens.add("kubernetes")
    return tokens


def score_to_competency_level(score: int) -> str:
    if score <= 39:
        return "Beginner"
    if score <= 69:
        return "Intermediate"
    return "Advanced"


def _dimension_key_from_label(label: str) -> str:
    normalized = (label or "").strip().lower()
    if "frontend" in normalized:
        return "frontend_engineering"
    if "backend" in normalized:
        return "backend_systems_engineering"
    if "data" in normalized or "intelligence" in normalized or "ai" in normalized or "ml" in normalized:
        return "data_science_intelligence"
    return "systems_devops_engineering"


def build_competency_levels(practice_dimensions: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for item in practice_dimensions or []:
        key = _dimension_key_from_label(str(item.get("label") or ""))
        score = int(item.get("confidence") or 0)
        definition = DIMENSION_DEFINITIONS[key]
        by_key[key] = {
            "dimension_key": key,
            "dimension": definition["label"],
            "description": definition["subtitle"],
            "score_percent": max(0, min(100, score)),
            "level": score_to_competency_level(score),
            "evidence": (item.get("evidence") or [])[:3],
        }

    for key, definition in DIMENSION_DEFINITIONS.items():
        if key not in by_key:
            by_key[key] = {
                "dimension_key": key,
                "dimension": definition["label"],
                "description": definition["subtitle"],
                "score_percent": 0,
                "level": "Beginner",
                "evidence": [],
            }

    return sorted(by_key.values(), key=lambda item: item["score_percent"])


def identify_skill_gaps(competency_levels: list[dict]) -> list[dict]:
    ordered = sorted(competency_levels, key=lambda item: item.get("score_percent", 0))
    total = len(ordered)
    gaps: list[dict] = []
    for index, item in enumerate(ordered):
        if item["level"] == "Advanced":
            gap = "Maintain and optimize"
        elif item["level"] == "Intermediate":
            gap = "Progress to advanced implementation"
        else:
            gap = "Build foundational competency"

        if index <= 1:
            priority = "High"
        elif index == 2:
            priority = "Medium"
        else:
            priority = "Low"

        if total <= 2:
            priority = "High" if index == 0 else "Medium"

        gaps.append(
            {
                "dimension_key": item["dimension_key"],
                "dimension": item["dimension"],
                "score_percent": item["score_percent"],
                "current_level": item["level"],
                "target_level": "Advanced",
                "priority": priority,
                "gap_summary": gap,
            }
        )
    return gaps


def _priority_xp(priority: str, level: str) -> int:
    base = {"High": 140, "Medium": 110, "Low": 90}.get(priority, 90)
    level_bonus = {"Beginner": 0, "Intermediate": 20, "Advanced": 35}.get(level, 0)
    return base + level_bonus


def _dimension_keywords(dimension_key: str) -> set[str]:
    keyword_map = {
        "frontend_engineering": FRONTEND_LANGS.union(FRAMEWORK_KEYWORDS).union({"ui", "frontend", "web"}),
        "backend_systems_engineering": BACKEND_LANGS.union(BACKEND_KEYWORDS).union({"backend", "service", "api"}),
        "data_science_intelligence": {
            "python",
            "sql",
            "postgresql",
            "mysql",
            "sqlite",
            "mongodb",
            "pandas",
            "numpy",
            "jupyter",
            "notebook",
            "ml",
            "ai",
            "data",
        },
        "systems_devops_engineering": DEPLOY_KEYWORDS.union({"docker", "kubernetes", "linux", "bash", "powershell", "devops", "ci", "cd"}),
    }
    return keyword_map.get(dimension_key, set())


def _rank_repos_for_dimension(repos: list[dict], dimension_key: str) -> list[dict]:
    keywords = _dimension_keywords(dimension_key)
    ranked: list[tuple[int, dict]] = []
    for repo in repos:
        tokens = _repo_tokens(repo)
        matches = sum(1 for token in tokens if token in keywords)
        commit_count = int(repo.get("commit_count") or 0)
        score = (matches * 10) + min(20, commit_count // 2)
        ranked.append((score, repo))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [repo for _, repo in ranked]


def _repo_context_for_dimension(repos: list[dict], dimension_key: str) -> tuple[list[str], list[str]]:
    ranked = _rank_repos_for_dimension(repos, dimension_key)
    target_repos = ranked[:2] if ranked else []
    repo_names = [str(repo.get("name") or "").strip() for repo in target_repos if str(repo.get("name") or "").strip()]
    tech_signals: list[str] = []
    for repo in target_repos:
        langs = repo.get("languages") or []
        if isinstance(langs, list):
            tech_signals.extend([str(lang) for lang in langs if lang])
        if repo.get("language"):
            tech_signals.append(str(repo.get("language")))
        code_signals = repo.get("code_signals") or {}
        tech_signals.extend([str(framework) for framework in (code_signals.get("frameworks") or []) if framework])
        tech_signals.extend([str(keyword) for keyword in (code_signals.get("keywords") or [])[:6] if keyword])
    unique_signals: list[str] = []
    for signal in tech_signals:
        if signal not in unique_signals:
            unique_signals.append(signal)
    return repo_names[:2], unique_signals[:2]


def _is_backend_career_interest(career_interest: str | None) -> bool:
    if not career_interest:
        return False
    normalized = career_interest.strip().lower()
    if not normalized:
        return False
    if normalized in {"be", "backend"}:
        return True
    return "backend" in normalized and ("engineer" in normalized or "developer" in normalized or "software" in normalized)


def _backend_curriculum_track(
    repos: list[dict],
    competency_levels: list[dict],
    max_steps: int,
) -> list[dict]:
    repo_names = [str(repo.get("name") or "").strip() for repo in repos if str(repo.get("name") or "").strip()]
    top_repos = repo_names[:2]

    languages: list[str] = []
    for repo in repos:
        repo_languages = repo.get("languages") or []
        if isinstance(repo_languages, list):
            languages.extend([str(lang).lower() for lang in repo_languages if lang])
        if repo.get("language"):
            languages.append(str(repo.get("language")).lower())
    lang_counts = Counter(languages)
    sorted_langs = [lang.upper() for lang, _ in lang_counts.most_common(2)]
    primary_signal = sorted_langs[0] if sorted_langs else "Backend stack"

    backend_score = 0
    for item in competency_levels:
        if item.get("dimension_key") == "backend_systems_engineering":
            backend_score = int(item.get("score_percent") or 0)
            break
    level_hint = "Beginner" if backend_score < 40 else "Intermediate" if backend_score < 70 else "Advanced"

    evidence = (top_repos + sorted_langs)[:3] or ["Backend Engineer goal", "BSCS/BSIT-aligned progression"]
    track = [
        {
            "title": "BSCS/BSIT Core 1: Implement DSA-backed API services",
            "reason": (
                f"Target role is Backend Engineer. Start with algorithmic thinking and clean API design, "
                f"similar to core BSCS/BSIT programming and data structures courses. Current backend level is {level_hint}."
            ),
            "tag": "backend_systems_engineering",
            "dimension_key": "backend_systems_engineering",
            "tags": ["backend", "data-structures", "algorithms", "bscs-bsit", "api-design"],
            "difficulty": "Beginner",
            "reward_xp": 120,
            "evidence": evidence,
            "priority": "High",
            "dimension": "Backend Systems Engineering",
            "competency_level": "Beginner",
            "progression_step": 1,
        },
        {
            "title": "BSCS/BSIT Core 2: Build relational data layer with transactions",
            "reason": (
                "Progress to database systems outcomes: schema normalization, indexing, and transaction-safe CRUD "
                "to mirror BSCS/BSIT data management curriculum."
            ),
            "tag": "data_science_intelligence",
            "dimension_key": "data_science_intelligence",
            "tags": ["backend", "sql", "database-systems", "transactions", "bscs-bsit"],
            "difficulty": "Intermediate",
            "reward_xp": 140,
            "evidence": evidence,
            "priority": "High",
            "dimension": "Data Science & Intelligence",
            "competency_level": "Intermediate",
            "progression_step": 2,
        },
        {
            "title": f"BSCS/BSIT Core 3: Engineer secure service architecture in {primary_signal}",
            "reason": (
                "Apply software engineering principles used in BSCS/BSIT (layered architecture, authN/authZ, "
                "validation, testing) for production-grade backend services."
            ),
            "tag": "backend_systems_engineering",
            "dimension_key": "backend_systems_engineering",
            "tags": ["backend", "software-engineering", "security", "testing", "bscs-bsit"],
            "difficulty": "Intermediate",
            "reward_xp": 160,
            "evidence": evidence,
            "priority": "Medium",
            "dimension": "Backend Systems Engineering",
            "competency_level": "Intermediate",
            "progression_step": 3,
        },
        {
            "title": "BSCS/BSIT Core 4: Deploy and observe a scalable backend capstone",
            "reason": (
                "Finish with systems and DevOps integration (containerization, CI/CD, observability, performance tuning), "
                "matching upper-year BSCS/BSIT capstone and operations outcomes."
            ),
            "tag": "systems_devops_engineering",
            "dimension_key": "systems_devops_engineering",
            "tags": ["backend", "devops", "deployment", "observability", "capstone"],
            "difficulty": "Advanced",
            "reward_xp": 180,
            "evidence": evidence,
            "priority": "Medium",
            "dimension": "Systems & DevOps Engineering",
            "competency_level": "Advanced",
            "progression_step": 4,
        },
    ]
    return track[:max_steps]


def generate_personalized_learning_path(
    competency_levels: list[dict],
    repos: list[dict],
    career_interest: str | None = None,
    max_steps: int = 12,
) -> list[dict]:
    if _is_backend_career_interest(career_interest):
        return _backend_curriculum_track(repos, competency_levels, max_steps=max_steps)

    repo_names = [str(repo.get("name") or "").strip() for repo in repos if str(repo.get("name") or "").strip()]
    top_repo_names = repo_names[:3]
    fallback_evidence = top_repo_names if top_repo_names else ["Repository signals"]

    gaps = identify_skill_gaps(competency_levels)
    steps: list[dict] = []
    for gap in gaps:
        dimension_key = gap["dimension_key"]
        current_level = gap["current_level"]
        start_index = LEVEL_ORDER.index(current_level)
        progression_levels = LEVEL_ORDER[start_index:]
        priority = gap["priority"]
        dimension_label = gap["dimension"]
        target_repo_names, target_signals = _repo_context_for_dimension(repos, dimension_key)
        primary_repo = target_repo_names[0] if target_repo_names else None

        for progression_index, level in enumerate(progression_levels, start=1):
            activity_candidates = COMPETENCY_ACTIVITY_MAP[dimension_key][level]
            for activity in activity_candidates:
                title = activity if not primary_repo else f"{activity} ({primary_repo})"
                evidence = (target_repo_names + target_signals)[:3] or fallback_evidence[:3]
                steps.append(
                    {
                        "title": title,
                        "reason": (
                            f"{dimension_label} is currently at {current_level}. "
                            f"This task strengthens {level.lower()} competencies and supports outcome-based progression. "
                            f"Recommended using your project context: {', '.join(evidence)}."
                        ),
                        "tag": dimension_key,
                        "dimension_key": dimension_key,
                        "tags": [
                            dimension_key,
                            level.lower(),
                            "competency-based",
                            "obe-aligned",
                            "priority-" + priority.lower(),
                        ],
                        "difficulty": level,
                        "reward_xp": _priority_xp(priority, level),
                        "evidence": evidence,
                        "priority": priority,
                        "dimension": dimension_label,
                        "competency_level": level,
                        "progression_step": progression_index,
                    }
                )
                if len(steps) >= max_steps:
                    return steps
    return steps[:max_steps]


def _rule_based_learning_path(repos: list[dict]) -> list[dict]:
    if not repos:
        return [
            {
                "title": "Foundation: Build your first programming project",
                "reason": "No repos found yet. Start with one beginner project so the system can analyze your strengths and weaknesses accurately.",
                "tag": "programming",
                "tags": ["programming", "foundation", "beginner"],
                "difficulty": "Beginner",
                "reward_xp": 80,
                "evidence": ["No repository activity detected yet"],
            }
        ]

    tokens = set()
    languages: list[str] = []
    total_commits = 0
    for repo in repos:
        tokens.update(_repo_tokens(repo))
        langs = repo.get("languages") or []
        if isinstance(langs, list):
            languages.extend([str(lang).lower() for lang in langs if lang])
        language = repo.get("language")
        if language:
            languages.append(str(language).lower())
        total_commits += int(repo.get("commit_count") or 0)

    lang_counts = Counter(languages)
    sorted_langs = [lang for lang, _ in lang_counts.most_common(3)]
    repo_names = [str(repo.get("name") or "").strip() for repo in repos if str(repo.get("name") or "").strip()]
    top_repos = repo_names[:3]
    has_frontend_lang = any(lang in FRONTEND_LANGS for lang in lang_counts)
    has_backend_lang = any(lang in BACKEND_LANGS for lang in lang_counts)

    has_frontend_framework = any(keyword in tokens for keyword in FRAMEWORK_KEYWORDS)
    has_backend = any(keyword in tokens for keyword in BACKEND_KEYWORDS) or has_backend_lang
    has_database = any(keyword in tokens for keyword in DATABASE_KEYWORDS)
    has_tests = any(keyword in tokens for keyword in TEST_KEYWORDS)
    has_deploy = any(keyword in tokens for keyword in DEPLOY_KEYWORDS)

    def pick_evidence(defaults: list[str]) -> list[str]:
        evidence = top_repos[:2] + sorted_langs[:2]
        if evidence:
            return evidence[:3]
        return defaults[:3]

    steps: list[dict] = []

    if has_frontend_lang and not has_frontend_framework:
        steps.append(
            {
                "title": "Web Development: Build UI using a modern framework",
                "reason": "Your repos use JavaScript/TypeScript but show limited framework usage. This strengthens core web engineering outcomes.",
                "tag": "frontend",
                "tags": ["web-development", "frontend", "framework"],
                "evidence": pick_evidence(["JavaScript/TypeScript detected"]),
            }
        )

    if has_frontend_lang and not has_backend:
        steps.append(
            {
                "title": "Software Engineering: Add a backend API layer",
                "reason": "Most projects appear frontend-focused. Add REST endpoints and service logic to strengthen software engineering depth.",
                "tag": "backend",
                "tags": ["software-engineering", "backend", "api"],
                "evidence": pick_evidence(["Frontend-heavy repositories"]),
            }
        )

    if not has_database:
        steps.append(
            {
                "title": "Data Management: Design and integrate a real database",
                "reason": "No database signals detected. Add schema design and CRUD operations to cover core data management competencies.",
                "tag": "database",
                "tags": ["data-management", "database", "sql"],
                "evidence": pick_evidence(["No SQL/database topics found"]),
            }
        )

    if not has_tests:
        steps.append(
            {
                "title": "Quality Assurance: Add unit and integration tests",
                "reason": "Testing signals are limited. Add automated tests to match software testing and quality outcomes.",
                "tag": "testing",
                "tags": ["testing", "quality-assurance", "software-engineering"],
                "evidence": pick_evidence(["Limited test-related keywords"]),
            }
        )

    if not has_deploy:
        steps.append(
            {
                "title": "Systems and DevOps: Deploy one project end-to-end",
                "reason": "Deployment signals are missing. Add CI/CD and production deployment to strengthen systems operations skills.",
                "tag": "deployment",
                "tags": ["systems", "devops", "deployment"],
                "evidence": pick_evidence(["No CI/CD or deployment topics found"]),
            }
        )

    if total_commits < 30:
        steps.append(
            {
                "title": "Study Discipline: Build a consistent commit habit",
                "reason": "Low commit volume detected. Consistent weekly commits help document learning progress and project maturity.",
                "tag": "habits",
                "tags": ["version-control", "habits", "portfolio"],
                "evidence": [f"Estimated commits: {total_commits}"],
            }
        )

    group_scores = {
        "frontend": sum(count for lang, count in lang_counts.items() if lang in FRONTEND_LANGS),
        "backend": sum(count for lang, count in lang_counts.items() if lang in BACKEND_LANGS),
        "data": sum(count for lang, count in lang_counts.items() if lang in {"python", "r", "sql", "jupyter notebook"}),
        "systems": sum(count for lang, count in lang_counts.items() if lang in {"c", "c++", "rust", "go"}),
    }
    strongest_area = max(group_scores, key=group_scores.get) if group_scores else "backend"
    capstone_by_area = {
        "frontend": "Capstone: Build a full frontend product with accessibility and testing",
        "backend": "Capstone: Build a scalable API service with security and testing",
        "data": "Capstone: Build an end-to-end data pipeline and analytics dashboard",
        "systems": "Capstone: Build automation and deployment tooling for a real project",
    }
    steps.append(
        {
            "title": capstone_by_area.get(strongest_area, capstone_by_area["backend"]),
            "reason": "Your strongest repo signals should be leveraged for a deeper capstone-level project while continuing curriculum progression.",
            "tag": "capstone",
            "tags": ["capstone", "project-integration", strongest_area],
            "evidence": pick_evidence(["Top repo signals detected"]),
        }
    )

    progression = ["Beginner", "Intermediate", "Advanced"]
    for index, step in enumerate(steps):
        step["difficulty"] = progression[min(index, len(progression) - 1)]
        step["reward_xp"] = 80 + (index * 20)

    # Keep the list concise.
    return steps[:4] if steps else [
        {
            "title": "Advanced Practice: Deepen your strongest stack",
            "reason": "Your repos already cover major areas. Focus on an advanced capstone aligned to your strongest technologies.",
            "tag": "advanced",
            "tags": ["advanced", "capstone"],
            "difficulty": "Advanced",
            "reward_xp": 140,
            "evidence": pick_evidence(["Strong cross-domain repo signals"]),
        }
    ]


def _rule_based_project_path(repo: dict) -> list[dict]:
    tokens = _repo_tokens(repo)
    langs = []
    if isinstance(repo.get("languages"), list):
        langs.extend([str(lang).lower() for lang in repo.get("languages") if lang])
    if repo.get("language"):
        langs.append(str(repo.get("language")).lower())
    lang_counts = Counter(langs)

    has_frontend_lang = any(lang in FRONTEND_LANGS for lang in lang_counts)
    has_backend_lang = any(lang in BACKEND_LANGS for lang in lang_counts)
    has_frontend_framework = any(keyword in tokens for keyword in FRAMEWORK_KEYWORDS)
    has_backend = any(keyword in tokens for keyword in BACKEND_KEYWORDS) or has_backend_lang
    has_database = any(keyword in tokens for keyword in DATABASE_KEYWORDS)
    has_tests = any(keyword in tokens for keyword in TEST_KEYWORDS)
    has_deploy = any(keyword in tokens for keyword in DEPLOY_KEYWORDS)

    repo_name = repo.get("name") or "this project"
    steps: list[dict] = []

    if has_frontend_lang and not has_frontend_framework:
        steps.append(
            {
                "title": f"Add a frontend framework to {repo_name}",
                "reason": "JavaScript/TypeScript detected but no framework keywords found.",
                "tag": "frontend",
                "evidence": [repo_name],
            }
        )
    if has_frontend_lang and not has_backend:
        steps.append(
            {
                "title": f"Create a REST API for {repo_name}",
                "reason": "Looks frontend-focused. Add a backend to showcase full-stack skills.",
                "tag": "backend",
                "evidence": [repo_name],
            }
        )
    if not has_database:
        steps.append(
            {
                "title": f"Add persistence to {repo_name}",
                "reason": "No database keywords detected. Add storage for real-world usage.",
                "tag": "database",
                "evidence": [repo_name],
            }
        )
    if not has_tests:
        steps.append(
            {
                "title": f"Write tests for {repo_name}",
                "reason": "Testing keywords are missing. Add unit/integration tests.",
                "tag": "testing",
                "evidence": [repo_name],
            }
        )
    if not has_deploy:
        steps.append(
            {
                "title": f"Deploy {repo_name}",
                "reason": "No deployment signals. Publish it to a hosting platform.",
                "tag": "deployment",
                "evidence": [repo_name],
            }
        )

    return steps[:5] if steps else [
        {
            "title": f"Enhance {repo_name} with advanced features",
            "reason": "Core signals already present. Add performance, security, or scaling improvements.",
            "tag": "advanced",
            "evidence": [repo_name],
        }
    ]


def _normalize_steps(payload: dict, max_steps: int = 4) -> list[dict]:
    steps = payload.get("steps") or []
    normalized: list[dict] = []
    for item in steps:
        title = (item.get("title") or "").strip()
        reason = (item.get("reason") or "").strip()
        if not title or not reason:
            continue
        evidence = item.get("evidence") or []
        if isinstance(evidence, str):
            evidence = [evidence]
        if not isinstance(evidence, list):
            evidence = []
        cleaned = []
        for ev in evidence:
            ev = str(ev).strip()
            if ev:
                cleaned.append(ev)
        tags = item.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        if not isinstance(tags, list):
            tags = []
        tags_cleaned = []
        for tag in tags:
            tag = str(tag).strip()
            if tag:
                tags_cleaned.append(tag)
        normalized.append(
            {
                "title": title,
                "reason": reason,
                "tag": (item.get("tag") or "").strip() or None,
                "evidence": cleaned[:3] if cleaned else None,
                "difficulty": (item.get("difficulty") or "").strip() or None,
                "reward_xp": int(item.get("reward_xp")) if isinstance(item.get("reward_xp"), (int, float, str)) and str(item.get("reward_xp")).isdigit() else None,
                "tags": tags_cleaned[:5] if tags_cleaned else None,
            }
        )
    return normalized[:max_steps]


def _extract_json(content: str) -> dict | None:
    if not content:
        return None
    content = content.strip()
    if content.startswith("{") and content.endswith("}"):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return None
    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def build_signal_set(repos: list[dict], include_repo_identity: bool = True) -> set[str]:
    signals: set[str] = set()
    for repo in repos:
        signals.update(_repo_tokens(repo))
        for lang in repo.get("languages") or []:
            signals.add(str(lang).lower())
        if repo.get("language"):
            signals.add(str(repo.get("language")).lower())
        for topic in repo.get("topics") or []:
            signals.add(str(topic).lower())
        if include_repo_identity:
            name = repo.get("name") or ""
            if name:
                signals.add(str(name).lower())
            desc = repo.get("description") or ""
            if desc:
                signals.add(str(desc).lower())
    return signals


def annotate_steps_with_status(steps: list[dict], signals: set[str]) -> tuple[list[dict], int]:
    completed = 0
    total = len(steps) if steps else 0
    updated: list[dict] = []
    for step in steps:
        tags = []
        if step.get("tags"):
            tags.extend([str(tag).lower() for tag in step.get("tags") or []])
        if step.get("tag"):
            tags.append(str(step.get("tag")).lower())
        matched = any(tag in signals for tag in tags)

        status = "done" if matched else "todo"
        if status == "done":
            completed += 1
        updated.append({**step, "status": status})

    progress = int((completed / total) * 100) if total else 0
    return updated, progress


def infer_learning_path(
    api_key: str,
    model: str,
    repos: list[dict],
    detected_skills: list[str] | None = None,
    project_keywords: list[str] | None = None,
    practice_dimensions: list[dict] | None = None,
) -> list[dict]:
    global _GROQ_LP_COOLDOWN_UNTIL
    if not api_key:
        return _rule_based_learning_path(repos)
    if time.time() < _GROQ_LP_COOLDOWN_UNTIL:
        return _rule_based_learning_path(repos)

    detected_skills = detected_skills or []
    project_keywords = project_keywords or []
    practice_dimensions = practice_dimensions or []

    prompt = {
        "role": "user",
        "content": (
            "You are an AI educational advisor for computing students. "
            "Use the student's GitHub repositories, detected skills, project keywords, "
            "interests (if any), and practice dimensions to generate a personalized, "
            "step-by-step learning path. Return ONLY valid JSON.\n\n"
            "JSON format:\n"
            "{\n"
            '  "steps": [\n'
            '    {"step": 1, "title": "Task title", "reason": "Why recommended", "tags": ["React", "frontend"], '
            '"difficulty": "Beginner|Intermediate|Advanced", "reward_xp": 100, '
            '"evidence": ["Repo name", "Tech signal"]}\n'
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- Provide 3-4 steps.\n"
            "- Each step is a concrete project/task (not just a skill name).\n"
            "- Base reasons on repo signals (languages, topics, commit patterns, repo names).\n"
            "- Align the sequence to undergraduate computing curriculum areas.\n"
            "- Prioritize gaps in practice dimensions (Frontend and Web Development, Backend and Software Engineering, Data Management and AI, Systems/Networking/DevOps).\n"
            "- Show progressive difficulty (Beginner -> Intermediate -> Advanced).\n"
            "- Include 1-3 evidence items per step.\n\n"
            f"Detected skills: {json.dumps(detected_skills)}\n"
            f"Project keywords: {json.dumps(project_keywords)}\n"
            f"Practice dimensions: {json.dumps(practice_dimensions)}\n"
            f"Repos: {json.dumps(repos)}"
        ),
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [prompt],
                "temperature": 0.4,
            },
            timeout=6,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        _GROQ_LP_COOLDOWN_UNTIL = time.time() + _GROQ_LP_COOLDOWN_SECONDS
        logger.warning("Groq learning-path inference unavailable, using fallback: %s", str(exc)[:240])
        return _rule_based_learning_path(repos)

    data = response.json()
    content = data["choices"][0]["message"]["content"]
    parsed = _extract_json(content)
    if parsed:
        steps = _normalize_steps(parsed, max_steps=4)
        if steps:
            return steps
    return _rule_based_learning_path(repos)


def infer_project_learning_paths(
    api_key: str,
    model: str,
    repos: list[dict],
    detected_skills: list[str] | None = None,
    project_keywords: list[str] | None = None,
    practice_dimensions: list[dict] | None = None,
) -> list[dict]:
    global _GROQ_LP_COOLDOWN_UNTIL
    if not repos:
        return []

    detected_skills = detected_skills or []
    project_keywords = project_keywords or []
    practice_dimensions = practice_dimensions or []

    if not api_key:
        return [
            {
                "repo_name": repo.get("name") or "Unnamed repo",
                "steps": _rule_based_project_path(repo),
            }
            for repo in repos
        ]
    if time.time() < _GROQ_LP_COOLDOWN_UNTIL:
        return [
            {
                "repo_name": repo.get("name") or "Unnamed repo",
                "steps": _rule_based_project_path(repo),
            }
            for repo in repos
        ]

    prompt = {
        "role": "user",
        "content": (
            "You are an AI educational advisor for computing students. "
            "Generate a per-project learning path aligned to each GitHub repo. Return ONLY valid JSON.\n\n"
            "JSON format:\n"
            "{\n"
            '  "projects": [\n'
            '    {"repo_name": "Repo name", "steps": [\n'
            '       {"step": 1, "title": "Task title", "reason": "Why this helps", "tags": ["React", "frontend"], '
            '"difficulty": "Beginner|Intermediate|Advanced", "reward_xp": 80, '
            '"evidence": ["Repo/tech signal"]}\n'
            "    ]}\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- Provide 3-5 steps per repo.\n"
            "- Steps must be aligned to the specific repo.\n"
            "- Reasons must reference repo signals (languages, topics, description).\n"
            "- Keep it student-friendly and actionable.\n\n"
            f"Detected skills: {json.dumps(detected_skills)}\n"
            f"Project keywords: {json.dumps(project_keywords)}\n"
            f"Practice dimensions: {json.dumps(practice_dimensions)}\n"
            f"Repos: {json.dumps(repos)}"
        ),
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [prompt],
                "temperature": 0.4,
            },
            timeout=6,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        _GROQ_LP_COOLDOWN_UNTIL = time.time() + _GROQ_LP_COOLDOWN_SECONDS
        logger.warning("Groq project learning-path inference unavailable, using fallback: %s", str(exc)[:240])
        return [
            {
                "repo_name": repo.get("name") or "Unnamed repo",
                "steps": _rule_based_project_path(repo),
            }
            for repo in repos
        ]

    content = response.json()["choices"][0]["message"]["content"]
    parsed = _extract_json(content)
    if not parsed:
        return [
            {
                "repo_name": repo.get("name") or "Unnamed repo",
                "steps": _rule_based_project_path(repo),
            }
            for repo in repos
        ]

    projects = parsed.get("projects") or []
    normalized_projects: list[dict] = []
    for item in projects:
        repo_name = (item.get("repo_name") or "").strip() or "Unnamed repo"
        steps = _normalize_steps({"steps": item.get("steps") or []}, max_steps=5)
        if not steps:
            steps = _rule_based_project_path({"name": repo_name})
        normalized_projects.append({"repo_name": repo_name, "steps": steps})

    if not normalized_projects:
        return [
            {
                "repo_name": repo.get("name") or "Unnamed repo",
                "steps": _rule_based_project_path(repo),
            }
            for repo in repos
        ]

    return normalized_projects
