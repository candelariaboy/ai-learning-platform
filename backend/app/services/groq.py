import json
import re
import logging
from collections import Counter
import time
import requests

logger = logging.getLogger(__name__)
_GROQ_COOLDOWN_UNTIL = 0.0
_GROQ_COOLDOWN_SECONDS = 120.0

LANGUAGE_GROUPS = {
    "frontend": {"JavaScript", "TypeScript", "HTML", "CSS", "Vue", "Svelte"},
    "backend": {
        "Python",
        "C#",
        "Java",
        "Go",
        "Ruby",
        "PHP",
        "Node",
        "Node.js",
        "SQL",
        "PostgreSQL",
        "SQLite",
    },
    "data": {"Jupyter Notebook", "Python", "R", "SQL", "PostgreSQL", "SQLite"},
    "systems": {"C", "C++", "Rust"},
}

CURRICULUM_LABELS = {
    "frontend": "Frontend and Web Development",
    "backend": "Backend and Software Engineering",
    "data": "Data Management and AI",
    "systems": "Systems, Networking, and DevOps",
}

CAREER_KEYWORDS = {
    "Frontend Engineer": {"react", "vue", "svelte", "astro", "next", "ui", "css", "tailwind", "frontend"},
    "Backend Engineer": {"api", "rest", "graphql", "backend", "fastapi", "flask", "django", "express"},
    "Full-Stack Engineer": {"fullstack", "full-stack", "mern", "mean"},
    "Data Analyst": {"jupyter", "notebook", "data", "analysis", "pandas", "numpy"},
    "Machine Learning Engineer": {"ml", "machine learning", "model", "scikit", "tensorflow"},
    "DevOps Engineer": {"docker", "kubernetes", "ci", "cd", "pipeline", "deploy", "devops"},
    "Mobile Developer": {"android", "ios", "react native", "flutter", "mobile"},
    "Security Engineer": {"security", "auth", "oauth", "jwt", "encryption"},
    "QA Engineer": {"test", "testing", "unit", "integration", "e2e"},
}

ACADEMIC_CAREER_LABELS = {
    "Frontend Engineer": "Frontend Engineer",
    "Backend Engineer": "Backend Engineer",
    "Full-Stack Engineer": "Full-Stack Engineer",
    "Data Analyst": "Data Analyst",
    "Machine Learning Engineer": "Machine Learning Engineer",
    "DevOps Engineer": "DevOps Engineer",
    "Mobile Developer": "Mobile Developer",
    "Security Engineer": "Security Engineer",
    "QA Engineer": "QA Engineer",
}


def _academicize_career_suggestions(careers: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for item in careers or []:
        raw_title = str(item.get("title") or "").strip()
        if not raw_title:
            continue
        mapped_title = ACADEMIC_CAREER_LABELS.get(raw_title, raw_title)
        raw_reason = str(item.get("reasoning") or "").strip()
        if raw_reason:
            mapped_reason = f"{raw_reason} Aligned to BSCS/BSIT curriculum outcomes."
        else:
            mapped_reason = "Recommended from your repository signals and aligned to BSCS/BSIT curriculum outcomes."
        normalized.append(
            {
                "title": mapped_title,
                "confidence": int(item.get("confidence") or 0),
                "reasoning": mapped_reason,
            }
        )
    return normalized


def strip_bscs_prefix(title: str | None) -> str:
    """Remove leading 'BSCS/BSIT Track:' prefix from a title if present."""
    if not title:
        return ""
    return re.sub(r"^\s*BSCS/BSIT Track:\s*", "", str(title), flags=re.IGNORECASE).strip()


def _dedupe_evidence(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _normalize_inference(payload: dict) -> dict:
    practice = payload.get("practice_dimensions", []) or []
    careers = payload.get("career_suggestions", []) or []
    normalized_by_group: dict[str, dict] = {}
    for item in practice:
        evidence = item.get("evidence", []) or []
        label = (item.get("label") or "").lower()
        group = None
        if "frontend" in label or "web" in label or "ui" in label:
            group = "frontend"
        elif "backend" in label or "software engineering" in label or "api" in label:
            group = "backend"
        elif "data" in label or "ml" in label or "ai" in label:
            group = "data"
        elif "systems" in label or "tooling" in label or "devops" in label or "network" in label:
            group = "systems"
        if group:
            allowed = LANGUAGE_GROUPS[group]
            filtered = [lang for lang in evidence if lang in allowed]
            normalized_item = {
                "label": CURRICULUM_LABELS[group],
                "confidence": int(item.get("confidence") or 0),
                "evidence": _dedupe_evidence(filtered)[:3],
            }
            existing = normalized_by_group.get(group)
            if not existing or normalized_item["confidence"] > int(existing.get("confidence") or 0):
                normalized_by_group[group] = normalized_item
        else:
            item["evidence"] = _dedupe_evidence(evidence)[:3]

    ordered_practice = [normalized_by_group[group] for group in ("frontend", "backend", "data", "systems") if group in normalized_by_group]
    if not ordered_practice:
        for item in practice:
            item["evidence"] = _dedupe_evidence(item.get("evidence", []) or [])[:3]
        ordered_practice = practice
    return {
        "practice_dimensions": ordered_practice,
        "career_suggestions": _academicize_career_suggestions(careers),
    }


def _heuristic_inference(repos: list[dict]) -> dict:
    def normalize_language(value: str | None) -> str:
        if not value:
            return "Unknown"
        if value.lower() == "jupyter notebook":
            return "Python"
        return value

    languages = []
    repo_text = []
    for repo in repos:
        repo_languages = repo.get("languages") or []
        if isinstance(repo_languages, list) and repo_languages:
            languages.extend([normalize_language(lang) for lang in repo_languages])
        else:
            languages.append(normalize_language(repo.get("language")))
        code_signals = repo.get("code_signals") or {}
        repo_text.extend(
            [
                str(repo.get("name") or ""),
                str(repo.get("description") or ""),
                " ".join(repo.get("topics") or []),
                " ".join([str(item) for item in (code_signals.get("keywords") or [])]),
                " ".join([str(item) for item in (code_signals.get("frameworks") or [])]),
            ]
        )
    lang_counts = Counter(languages)
    total = max(1, sum(lang_counts.values()))

    def unique_evidence(allowed: set[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for lang in languages:
            if lang in allowed and lang not in seen:
                seen.add(lang)
                result.append(lang)
            if len(result) >= 3:
                break
        return result

    def confidence_for(group: str) -> int:
        hits = sum(count for lang, count in lang_counts.items() if lang in LANGUAGE_GROUPS[group])
        return min(100, max(30, int((hits / total) * 120)))

    practice_dimensions = [
        {
            "label": CURRICULUM_LABELS["frontend"],
            "confidence": confidence_for("frontend"),
            "evidence": unique_evidence(LANGUAGE_GROUPS["frontend"]),
        },
        {
            "label": CURRICULUM_LABELS["backend"],
            "confidence": confidence_for("backend"),
            "evidence": unique_evidence(LANGUAGE_GROUPS["backend"]),
        },
        {
            "label": CURRICULUM_LABELS["data"],
            "confidence": confidence_for("data"),
            "evidence": unique_evidence(LANGUAGE_GROUPS["data"]),
        },
        {
            "label": CURRICULUM_LABELS["systems"],
            "confidence": confidence_for("systems"),
            "evidence": unique_evidence(LANGUAGE_GROUPS["systems"]),
        },
    ]

    text = " ".join(repo_text).lower()
    keyword_scores = {}
    for role, keywords in CAREER_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in text)
        keyword_scores[role] = hits

    role_scores = {
        "Frontend Engineer": practice_dimensions[0]["confidence"] + keyword_scores.get("Frontend Engineer", 0) * 8,
        "Backend Engineer": practice_dimensions[1]["confidence"] + keyword_scores.get("Backend Engineer", 0) * 8,
        "Full-Stack Engineer": int((practice_dimensions[0]["confidence"] + practice_dimensions[1]["confidence"]) / 2)
        + keyword_scores.get("Full-Stack Engineer", 0) * 8,
        "Data Analyst": practice_dimensions[2]["confidence"] + keyword_scores.get("Data Analyst", 0) * 8,
        "Machine Learning Engineer": practice_dimensions[2]["confidence"] + keyword_scores.get("Machine Learning Engineer", 0) * 8,
        "DevOps Engineer": practice_dimensions[3]["confidence"] + keyword_scores.get("DevOps Engineer", 0) * 8,
        "Mobile Developer": practice_dimensions[0]["confidence"] + keyword_scores.get("Mobile Developer", 0) * 8,
        "Security Engineer": practice_dimensions[1]["confidence"] + keyword_scores.get("Security Engineer", 0) * 8,
        "QA Engineer": practice_dimensions[1]["confidence"] + keyword_scores.get("QA Engineer", 0) * 6,
    }

    sorted_roles = sorted(role_scores.items(), key=lambda item: item[1], reverse=True)
    career_suggestions = []
    for role, score in sorted_roles:
        if score < 30:
            continue
        if role == "Frontend Engineer":
            reason = "Frontend-heavy stack detected from UI languages and repo themes."
        elif role == "Backend Engineer":
            reason = "Backend signals (APIs, server frameworks) show strong service-side focus."
        elif role == "Full-Stack Engineer":
            reason = "Balanced frontend and backend signals suggest end-to-end product delivery."
        elif role == "Data Analyst":
            reason = "Data tooling and notebooks suggest analysis-oriented work."
        elif role == "Machine Learning Engineer":
            reason = "ML keywords and data stack indicate model-building practice."
        elif role == "DevOps Engineer":
            reason = "Deployment/tooling keywords suggest infrastructure and release focus."
        elif role == "Mobile Developer":
            reason = "Mobile stack keywords indicate app development focus."
        elif role == "Security Engineer":
            reason = "Auth/security keywords suggest security-oriented work."
        else:
            reason = "Testing signals suggest QA focus."
        career_suggestions.append(
            {
                "title": role,
                "confidence": min(100, int(score)),
                "reasoning": reason,
            }
        )
        if len(career_suggestions) >= 3:
            break

    practice_dimensions = [item for item in practice_dimensions if item["confidence"] >= 30]
    career_suggestions = [item for item in career_suggestions if item["confidence"] >= 30]

    return _normalize_inference(
        {
            "practice_dimensions": practice_dimensions[:4],
            "career_suggestions": career_suggestions[:3],
        }
    )


def infer_practice_and_careers(
    api_key: str,
    model: str,
    repos: list[dict],
) -> dict:
    global _GROQ_COOLDOWN_UNTIL
    if not api_key:
        return _heuristic_inference(repos)
    if time.time() < _GROQ_COOLDOWN_UNTIL:
        return _heuristic_inference(repos)

    prompt = {
        "role": "user",
        "content": (
            "You are an AI career and practice analyzer. "
            "Analyze the user's GitHub repos and infer practice dimensions "
            "and career suggestions. Return JSON with keys: practice_dimensions "
            "(array of {label, confidence, evidence}) and career_suggestions "
            "(array of {title, confidence, reasoning}). "
            "Confidence is 0-100. Evidence is a short list of repo signals.\n\n"
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
        _GROQ_COOLDOWN_UNTIL = time.time() + _GROQ_COOLDOWN_SECONDS
        logger.warning("Groq inference unavailable, using heuristic fallback: %s", str(exc)[:240])
        return _heuristic_inference(repos)
    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        return _heuristic_inference(repos)
    try:
        data = json.loads(content)
        normalized = _normalize_inference(data)
        titles = [item.get("title") for item in normalized.get("career_suggestions", [])]
        if len(set(titles)) < max(1, len(titles)):
            return _heuristic_inference(repos)
        return normalized
    except (json.JSONDecodeError, TypeError):
        return _heuristic_inference(repos)
