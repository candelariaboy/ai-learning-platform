from __future__ import annotations

from app.models import User


def _truthy_text(value: str | None) -> bool:
    return bool((value or "").strip())


def _safe_list_len(value) -> int:
    if isinstance(value, list):
        return len(value)
    return 0


def compute_portfolio_completeness(
    *,
    user: User,
    repos: list,
    badges_claimed: int,
    certificates_verified: int,
    learning_views: int,
    learning_steps_done: int,
    recommendation_actions_adopted: int,
    portfolio_settings,
) -> dict:
    profile_score = 0
    if _truthy_text(user.display_name):
        profile_score += 4
    if _truthy_text(user.bio):
        profile_score += 4
    if _truthy_text(user.student_id):
        profile_score += 4
    if _truthy_text(user.program):
        profile_score += 4
    if _truthy_text(user.year_level):
        profile_score += 4

    target_score = 0
    if _truthy_text(user.career_interest):
        target_score += 5
    if _truthy_text(user.target_role):
        target_score += 5
    if _safe_list_len(user.target_certifications) > 0:
        target_score += 5

    repo_count = len(repos)
    total_commits = sum(int(getattr(repo, "commit_count", 0) or 0) for repo in repos)
    languages: set[str] = set()
    for repo in repos:
        primary = str(getattr(repo, "language", "") or "").strip().lower()
        if primary:
            languages.add(primary)
        for lang in getattr(repo, "languages", []) or []:
            text = str(lang or "").strip().lower()
            if text:
                languages.add(text)

    evidence_score = 0
    if repo_count > 0:
        evidence_score += 8
    if total_commits >= 10:
        evidence_score += 9
    elif total_commits > 0:
        evidence_score += 5
    if len(languages) >= 3:
        evidence_score += 8
    elif len(languages) >= 1:
        evidence_score += 4

    settings_score = 0
    if portfolio_settings is not None:
        featured_repos = getattr(portfolio_settings, "featured_repos", []) or []
        featured_badges = getattr(portfolio_settings, "featured_badges", []) or []
        social_links = getattr(portfolio_settings, "social_links", {}) or {}
        has_contact = any(
            _truthy_text(str(social_links.get(key) or ""))
            for key in ("email", "linkedin", "phone")
        )
        if _truthy_text(getattr(portfolio_settings, "bio", None)) or _truthy_text(user.bio):
            settings_score += 5
        if _safe_list_len(featured_repos) > 0:
            settings_score += 4
        if _safe_list_len(featured_badges) > 0:
            settings_score += 3
        if _truthy_text(getattr(portfolio_settings, "cover_image", None)):
            settings_score += 1
        if has_contact:
            settings_score += 2

    engagement_score = 0
    if learning_views > 0:
        engagement_score += 5
    if learning_steps_done > 0:
        engagement_score += 5
    if recommendation_actions_adopted > 0:
        engagement_score += 5

    credential_score = 0
    if certificates_verified > 0:
        credential_score += 6
    if badges_claimed > 0:
        credential_score += 4

    breakdown = [
        {"key": "profile_basics", "label": "Profile Basics", "score": profile_score, "max_score": 20},
        {"key": "career_targets", "label": "Career Targets", "score": target_score, "max_score": 15},
        {"key": "repository_evidence", "label": "Repository Evidence", "score": evidence_score, "max_score": 25},
        {"key": "portfolio_curation", "label": "Portfolio Curation", "score": settings_score, "max_score": 15},
        {"key": "learning_engagement", "label": "Learning Engagement", "score": engagement_score, "max_score": 15},
        {"key": "credentials", "label": "Credentials", "score": credential_score, "max_score": 10},
    ]
    total = sum(int(item["score"]) for item in breakdown)
    return {
        "score": max(0, min(100, total)),
        "breakdown": breakdown,
    }
