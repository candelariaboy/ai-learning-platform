from fastapi import APIRouter, Depends, HTTPException, Query, Header
import datetime as dt
import re
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import decode_access_token
from app.db import get_db
from app.models import (
    Badge,
    CareerSuggestion,
    PracticeDimension,
    Repo,
    User,
    PortfolioSettings,
    ActivityLog,
    LearningProgress,
    CertificateRecord,
    ProjectValidation,
    DailyQuestClaim,
    WeeklyChallengeClaim,
    RecommendationAction,
    SusSurveyResponse,
    CareerConfidenceSurveyResponse,
)
from app.schemas import (
    PortfolioResponse,
    PortfolioSettingsIn,
    UserResponse,
    RegistrationIn,
    LeaderboardEntryOut,
    LearningPathResponse,
    LearningStepStatusIn,
    ProjectLearningPathResponse,
    CurriculumMapOut,
    RuleRecommendationListOut,
    WeeklyDigestOut,
    CertificateSubmitIn,
    CertificateOut,
    ProjectValidationOut,
    LearningAccountsIn,
    LearningAccountsOut,
    LearningAccountStatsOut,
    AutoSyncResultOut,
    QuestListOut,
    QuestClaimIn,
    ChallengeListOut,
    ChallengeClaimIn,
    RecommendationActionIn,
    SusSurveyIn,
    SusSurveyOut,
    CareerConfidenceSurveyIn,
    CareerConfidenceSurveyOut,
    PortfolioCompletenessOut,
)


from app.services.github import (
    fetch_commit_streak_days,
    fetch_repos,
    fetch_repo_language_bytes,
    fetch_repo_languages,
    fetch_public_repo_language_bytes,
    fetch_public_repo_languages,
    fetch_public_repos,
    fetch_repo_commit_count,
    summarize_repo,
)
from app.services.groq import infer_practice_and_careers, strip_bscs_prefix
from app.services.gamification import badge_reward_xp, badge_visuals, compute_xp_and_badges
from app.services.learning_path import (
    infer_project_learning_paths,
    build_signal_set,
    annotate_steps_with_status,
    build_competency_levels,
    identify_skill_gaps,
    generate_personalized_learning_path,
)
from app.services.collaborative_filter import get_peer_recommendations
from app.services.engagement_service import refresh_engagement, compute_engagement_score, calculate_learning_progress
from app.models import EngagementCommit, XpHistory
from app.services.engagement_service import week_start_for_date
from app.services.certificate_sync import get_freecodecamp_stats, sync_freecodecamp_certificates
from app.services.portfolio_metrics import compute_portfolio_completeness


router = APIRouter(prefix="/api", tags=["users"])

ADOPTED_RECOMMENDATION_ACTIONS = {"clicked", "accepted", "completed", "started"}

CURRICULUM_SUBJECTS = [
    {
        "code": "CS101",
        "title": "Introduction to Computing",
        "program": "BSCS/BSIT",
        "year_level": 1,
        "focus_dimension_key": "frontend_engineering",
        "recommended_module": "Responsive Web Design",
    },
    {
        "code": "CS102",
        "title": "Computer Programming 1",
        "program": "BSCS/BSIT",
        "year_level": 1,
        "focus_dimension_key": "backend_systems_engineering",
        "recommended_module": "Python Basics",
    },
    {
        "code": "CS203",
        "title": "Data Structures and Algorithms",
        "program": "BSCS",
        "year_level": 2,
        "focus_dimension_key": "backend_systems_engineering",
        "recommended_module": "Algorithm Design",
    },
    {
        "code": "IT204",
        "title": "Database Management Systems",
        "program": "BSIT",
        "year_level": 2,
        "focus_dimension_key": "data_science_intelligence",
        "recommended_module": "Relational Data and SQL",
    },
    {
        "code": "CS305",
        "title": "Software Engineering",
        "program": "BSCS/BSIT",
        "year_level": 3,
        "focus_dimension_key": "backend_systems_engineering",
        "recommended_module": "API Testing and Design",
    },
    {
        "code": "IT306",
        "title": "Network and Security",
        "program": "BSIT",
        "year_level": 3,
        "focus_dimension_key": "systems_devops_engineering",
        "recommended_module": "Cybersecurity Fundamentals",
    },
    {
        "code": "CS307",
        "title": "Intelligent Systems",
        "program": "BSCS",
        "year_level": 3,
        "focus_dimension_key": "data_science_intelligence",
        "recommended_module": "Machine Learning Foundations",
    },
    {
        "code": "CSIT401",
        "title": "Capstone Project",
        "program": "BSCS/BSIT",
        "year_level": 4,
        "focus_dimension_key": "systems_devops_engineering",
        "recommended_module": "DevOps and Deployment",
    },
]

RULE_MODULES = {
    "frontend_engineering": [
        {
            "module_title": "freeCodeCamp: Responsive Web Design Certification",
            "module_url": "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
            "certificate_hint": "Free certificate on completion.",
        },
        {
            "module_title": "MDN Learn: HTML, CSS, and JavaScript",
            "module_url": "https://developer.mozilla.org/en-US/docs/Learn",
            "certificate_hint": "High-quality web docs and guided modules.",
        },
        {
            "module_title": "The Odin Project: Full Stack JavaScript",
            "module_url": "https://www.theodinproject.com/paths/full-stack-javascript",
            "certificate_hint": "Project-based full-stack path.",
            "certificate_hint": "Microsoft learning path with applied labs.",
        },
        {
            "module_title": "IBM SkillsBuild: Backend Development",
            "module_url": "https://skillsbuild.org/",
            "certificate_hint": "Industry learning content with badges/certificates.",
        },
    ],
    "data_science_intelligence": [
        {
            "module_title": "freeCodeCamp: Data Analysis with Python",
            "module_url": "https://www.freecodecamp.org/learn/data-analysis-with-python/",
            "certificate_hint": "Free certificate on completion.",
        },
        {
            "module_title": "Kaggle Learn: Intro to Machine Learning",
            "module_url": "https://www.kaggle.com/learn/intro-to-machine-learning",
            "certificate_hint": "Short practical micro-courses with hands-on notebooks.",
        },
        {
            "module_title": "Google Cloud Skills Boost: Data and ML fundamentals",
            "module_url": "https://www.cloudskillsboost.google/",
            "certificate_hint": "Cloud-based data/ML labs and skill badges.",
        },
    ],
    "systems_devops_engineering": [
        {
            "module_title": "freeCodeCamp: Information Security",
            "module_url": "https://www.freecodecamp.org/learn/information-security/",
            "certificate_hint": "Free certificate on completion.",
        },
        {
            "module_title": "AWS Skill Builder: Cloud Practitioner Essentials",
            "module_url": "https://explore.skillbuilder.aws/learn",
            "certificate_hint": "Cloud and DevOps baseline from AWS.",
        },
        {
            "module_title": "Microsoft Learn: DevOps Engineer learning path",
            "module_url": "https://learn.microsoft.com/en-us/training/career-paths/devops-engineer",
            "certificate_hint": "Structured DevOps preparation path.",
        },
    ],
}


def _pick_rule_module(dimension_key: str, username: str, order_index: int = 0) -> dict | None:
    options = RULE_MODULES.get(dimension_key) or []
    if not options:
        return None
    # Deterministic spread so users get varied providers, not only one platform.
    seed = sum(ord(ch) for ch in f"{username}:{dimension_key}") + int(order_index or 0)
    return options[seed % len(options)]

DAILY_QUESTS = [
    {
        "key": "daily_login",
        "title": "Daily Login",
        "description": "Open your dashboard and stay active today.",
        "reward_xp": 20,
    },
    {
        "key": "daily_learning_view",
        "title": "Learning Path Check",
        "description": "View your learning paths today.",
        "reward_xp": 30,
    },
    {
        "key": "daily_recompute",
        "title": "Insight Refresh",
        "description": "Run a recompute today.",
        "reward_xp": 40,
    },
]

WEEKLY_CHALLENGES = [
    {
        "key": "weekly_commit_10",
        "title": "Commit Sprint",
        "description": "Reach 10 commits this week.",
        "reward_xp": 150,
    },
    {
        "key": "weekly_learning_2",
        "title": "Learning Momentum",
        "description": "Complete 2 learning steps this week.",
        "reward_xp": 120,
    },
    {
        "key": "weekly_cert_1",
        "title": "Certified This Week",
        "description": "Get at least 1 verified certificate this week.",
        "reward_xp": 180,
    },
]


def _add_bonus_xp(db: Session, user: User, reward_xp: int, reason: str) -> None:
    reward = max(0, int(reward_xp or 0))
    if reward <= 0:
        return
    user.bonus_xp = int(user.bonus_xp or 0) + reward
    db.add(user)
    week_start = week_start_for_date(dt.datetime.utcnow())
    row = (
        db.query(XpHistory)
        .filter(XpHistory.user_id == user.id, XpHistory.week_start == week_start)
        .one_or_none()
    )
    if not row:
        row = XpHistory(user_id=user.id, week_start=week_start, xp_gained=reward)
        db.add(row)
    else:
        row.xp_gained = int(row.xp_gained or 0) + reward
    db.add(ActivityLog(user_id=user.id, event="bonus_xp_award", meta={"reason": reason, "xp": reward}))


def _daily_quest_completed(db: Session, user_id: int, quest_key: str, start: dt.datetime, end: dt.datetime) -> bool:
    if quest_key == "daily_login":
        return (
            db.query(ActivityLog)
            .filter(
                ActivityLog.user_id == user_id,
                ActivityLog.event.in_(["login", "heartbeat"]),
                ActivityLog.created_at >= start,
                ActivityLog.created_at < end,
            )
            .count()
            > 0
        )
    if quest_key == "daily_learning_view":
        return (
            db.query(ActivityLog)
            .filter(
                ActivityLog.user_id == user_id,
                ActivityLog.event.in_(["learning_path_view", "project_learning_path_view"]),
                ActivityLog.created_at >= start,
                ActivityLog.created_at < end,
            )
            .count()
            > 0
        )
    if quest_key == "daily_recompute":
        return (
            db.query(ActivityLog)
            .filter(
                ActivityLog.user_id == user_id,
                ActivityLog.event == "recompute",
                ActivityLog.created_at >= start,
                ActivityLog.created_at < end,
            )
            .count()
            > 0
        )
    return False


def _weekly_challenge_completed(db: Session, user_id: int, challenge_key: str, week_start: dt.datetime) -> bool:
    if challenge_key == "weekly_commit_10":
        commits = (
            db.query(EngagementCommit)
            .filter(EngagementCommit.user_id == user_id, EngagementCommit.week_start == week_start)
            .with_entities(func.coalesce(func.sum(EngagementCommit.commit_count), 0))
            .scalar()
        )
        return int(commits or 0) >= 10
    if challenge_key == "weekly_learning_2":
        done = (
            db.query(LearningProgress)
            .filter(
                LearningProgress.user_id == user_id,
                LearningProgress.status == "done",
                LearningProgress.completed_at >= week_start,
            )
            .count()
        )
        return done >= 2
    if challenge_key == "weekly_cert_1":
        count = (
            db.query(CertificateRecord)
            .filter(
                CertificateRecord.user_id == user_id,
                CertificateRecord.status == "verified",
                CertificateRecord.reviewer_id.isnot(None),
                CertificateRecord.verified_at >= week_start,
            )
            .count()
        )
        return count >= 1
    return False


def _dimension_band(score: int) -> str:
    if score >= 70:
        return "strong"
    if score >= 40:
        return "developing"
    return "gap"


def _build_weekly_digest(db: Session, user: User) -> dict:
    week_start = week_start_for_date(dt.datetime.utcnow())
    commits = (
        db.query(EngagementCommit)
        .filter(EngagementCommit.user_id == user.id, EngagementCommit.week_start == week_start)
        .with_entities(func.coalesce(func.sum(EngagementCommit.commit_count), 0))
        .scalar()
    )
    xp_gained = (
        db.query(XpHistory)
        .filter(XpHistory.user_id == user.id, XpHistory.week_start == week_start)
        .with_entities(func.coalesce(func.sum(XpHistory.xp_gained), 0))
        .scalar()
    )
    completed_steps = (
        db.query(LearningProgress)
        .filter(
            LearningProgress.user_id == user.id,
            LearningProgress.status == "done",
            LearningProgress.completed_at >= week_start,
        )
        .count()
    )
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user.id, ActivityLog.created_at >= week_start)
        .all()
    )
    active_days = len({(item.created_at.date().isoformat() if item.created_at else "") for item in logs if item.created_at})
    summary = (
        f"This week: {int(commits or 0)} commits, {int(xp_gained or 0)} XP gained, "
        f"{completed_steps} completed learning steps, active for {active_days} day(s)."
    )
    return {
        "username": user.username,
        "week_start": week_start.date().isoformat(),
        "commits": int(commits or 0),
        "xp_gained": int(xp_gained or 0),
        "completed_steps": completed_steps,
        "active_days": active_days,
        "summary": summary,
    }


def _portfolio_completeness_payload(db: Session, user: User) -> dict:
    repos = db.query(Repo).filter(Repo.user_id == user.id).all()
    settings_row = _get_or_create_portfolio_settings(db, user.id)
    badges_claimed = db.query(Badge).filter(Badge.user_id == user.id, Badge.claimed.is_(True)).count()
    certificates_verified = db.query(CertificateRecord).filter(
        CertificateRecord.user_id == user.id,
        CertificateRecord.status == "verified",
    ).count()
    learning_views = db.query(ActivityLog).filter(
        ActivityLog.user_id == user.id,
        ActivityLog.event.in_(["learning_path_view", "project_learning_path_view"]),
    ).count()
    learning_steps_done = db.query(LearningProgress).filter(
        LearningProgress.user_id == user.id,
        LearningProgress.status == "done",
    ).count()
    recommendation_actions_adopted = db.query(RecommendationAction).filter(
        RecommendationAction.user_id == user.id,
        RecommendationAction.action.in_(list(ADOPTED_RECOMMENDATION_ACTIONS)),
    ).count()

    result = compute_portfolio_completeness(
        user=user,
        repos=repos,
        badges_claimed=badges_claimed,
        certificates_verified=certificates_verified,
        learning_views=learning_views,
        learning_steps_done=learning_steps_done,
        recommendation_actions_adopted=recommendation_actions_adopted,
        portfolio_settings=settings_row,
    )
    return {
        "username": user.username,
        "score": int(result.get("score", 0)),
        "breakdown": result.get("breakdown") or [],
    }





@router.get("/ping")
def ping(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = dt.datetime.utcnow()
    if current_user.freecodecamp_username:
        should_sync = not current_user.last_cert_sync_at
        if current_user.last_cert_sync_at:
            should_sync = (now - current_user.last_cert_sync_at.replace(tzinfo=None)).total_seconds() >= 24 * 60 * 60
        if should_sync:
            sync_freecodecamp_certificates(db, current_user)
    db.add(ActivityLog(user_id=current_user.id, event="heartbeat"))
    db.commit()
    has_recommendation_action = (
        db.query(RecommendationAction)
        .filter(
            RecommendationAction.user_id == current_user.id,
            RecommendationAction.action.in_(list(ADOPTED_RECOMMENDATION_ACTIONS)),
        )
        .count()
        > 0
    )
    return {"ok": True, "has_recommendation_action": has_recommendation_action}


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.last_seen = None
    db.add(ActivityLog(user_id=current_user.id, event="logout"))
    db.add(current_user)
    db.commit()
    return {"ok": True}


def _badge_bonus_xp(badges: list[Badge]) -> int:
    return sum(badge_reward_xp(item.rarity) for item in badges if item.claimed)


def _badge_payload(item: Badge) -> dict:
    visuals = badge_visuals(item.label, item.rarity, item.description)
    reward_xp = badge_reward_xp(item.rarity)
    clean_description = re.sub(r"^\[Category:\s*.+?\]\s*", "", item.description or "").strip()
    return {
        "label": item.label,
        "description": clean_description or item.description,
        "criteria": item.criteria,
        "rarity": item.rarity,
        "achieved": item.achieved,
        "claimed": item.claimed,
        "reward_xp": reward_xp,
        **visuals,
    }


def _safe_fetch_commit_streak_days(username: str, token: str | None = None) -> int:
    try:
        return int(fetch_commit_streak_days(username, token=token) or 0)
    except Exception:
        return 0


def _active_repos_last_30_days(repos: list[Repo]) -> int:
    cutoff = dt.datetime.utcnow() - dt.timedelta(days=30)
    count = 0
    for repo in repos:
        last_push = repo.last_push
        if not last_push:
            continue
        try:
            pushed_at = dt.datetime.fromisoformat(str(last_push))
        except ValueError:
            continue
        if pushed_at.tzinfo is not None:
            pushed_at = pushed_at.astimezone(dt.timezone.utc).replace(tzinfo=None)
        if pushed_at >= cutoff:
            count += 1
    return count


def _weekly_commit_rows(db: Session, user_id: int, *, fallback_commits: int) -> list[dict]:
    rows = (
        db.query(EngagementCommit)
        .filter(EngagementCommit.user_id == user_id)
        .order_by(EngagementCommit.week_start.desc())
        .limit(4)
        .all()
    )
    if rows:
        rows = sorted(rows, key=lambda item: item.week_start)
        return [
            {
                "week_start": item.week_start.isoformat() if item.week_start else None,
                "commit_count": int(item.commit_count or 0),
            }
            for item in rows
            if item.week_start
        ]

    return [
        {
            "week_start": week_start_for_date(dt.datetime.utcnow()).isoformat(),
            "commit_count": int(fallback_commits or 0),
        }
    ]


def _skill_domain_payload(practice_dimensions: list[dict]) -> tuple[list[dict], dict | None]:
    competency_levels = build_competency_levels(practice_dimensions)
    domains = [
        {
            "dimension_key": item["dimension_key"],
            "domain": item["dimension"],
            "description": item["description"],
            "score_percent": int(item["score_percent"]),
            "level": item["level"],
            "evidence": item.get("evidence") or [],
        }
        for item in competency_levels
    ]
    domains.sort(key=lambda item: int(item.get("score_percent") or 0), reverse=True)
    focus = next((item for item in domains if int(item.get("score_percent") or 0) > 0), None)
    return domains, focus


def _build_badge_context(
    db: Session,
    user: User,
    *,
    practice_dimensions: list[dict] | None = None,
    streak_days: int | None = None,
) -> dict:
    if practice_dimensions is None:
        rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
        practice_dimensions = [
            {"label": item.label, "confidence": item.confidence, "evidence": item.evidence}
            for item in rows
        ]

    if streak_days is None:
        streak_days = _safe_fetch_commit_streak_days(user.username, token=user.github_token)

    certificate_verified_count = (
        db.query(CertificateRecord)
        .filter(CertificateRecord.user_id == user.id, CertificateRecord.status == "verified")
        .count()
    )
    certificate_total_count = (
        db.query(CertificateRecord)
        .filter(CertificateRecord.user_id == user.id)
        .count()
    )
    daily_quest_claim_count = (
        db.query(DailyQuestClaim)
        .filter(DailyQuestClaim.user_id == user.id)
        .count()
    )
    weekly_challenge_claim_count = (
        db.query(WeeklyChallengeClaim)
        .filter(WeeklyChallengeClaim.user_id == user.id)
        .count()
    )
    has_portfolio_settings = (
        db.query(PortfolioSettings)
        .filter(PortfolioSettings.user_id == user.id)
        .one_or_none()
        is not None
    )

    return {
        "streak_days": int(streak_days or 0),
        "practice_dimensions": practice_dimensions,
        "certificate_verified_count": certificate_verified_count,
        "certificate_total_count": certificate_total_count,
        "daily_quest_claim_count": daily_quest_claim_count,
        "weekly_challenge_claim_count": weekly_challenge_claim_count,
        "has_portfolio_settings": has_portfolio_settings,
    }


def _sync_badges(db: Session, user_id: int, generated_badges: list[dict]) -> None:
    existing_badges = {
        badge.label: badge
        for badge in db.query(Badge).filter(Badge.user_id == user_id).all()
    }
    seen_labels: set[str] = set()
    for badge in generated_badges:
        seen_labels.add(badge["label"])
        existing = existing_badges.get(badge["label"])
        if existing:
            existing.description = badge["description"]
            existing.criteria = badge["criteria"]
            existing.rarity = badge["rarity"]
            existing.achieved = badge["achieved"]
            if badge["achieved"] is False:
                existing.claimed = False
        else:
            db.add(
                Badge(
                    user_id=user_id,
                    label=badge["label"],
                    description=badge["description"],
                    criteria=badge["criteria"],
                    rarity=badge["rarity"],
                    achieved=badge["achieved"],
                    claimed=badge.get("claimed", False),
                )
            )

    for label, stale in existing_badges.items():
        if label not in seen_labels:
            db.delete(stale)


def _repo_summaries_for_inference(repos: list[Repo]) -> list[dict]:
    return [
        {
            "name": repo.name,
            "description": repo.description,
            "language": repo.language,
            "languages": repo.languages,
            "language_bytes": repo.language_bytes,
            "stars": repo.stars,
            "topics": repo.topics,
            "code_signals": repo.code_signals or {},
            "last_push": repo.last_push,
            "commit_count": repo.commit_count,
        }
        for repo in repos
    ]


def _sync_inference_from_repo_signals(
    db: Session,
    user: User,
    repos: list[Repo],
    *,
    force: bool = False,
) -> tuple[list[PracticeDimension], list[CareerSuggestion], list[dict]]:
    summaries = _repo_summaries_for_inference(repos)
    practice_rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
    career_rows = db.query(CareerSuggestion).filter(CareerSuggestion.user_id == user.id).all()

    should_refresh = force or not practice_rows or not career_rows
    if not should_refresh:
        return practice_rows, career_rows, summaries

    inference = infer_practice_and_careers(
        settings.groq_api_key or "",
        settings.groq_model,
        summaries,
    )
    db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).delete()
    for item in inference.get("practice_dimensions", []):
        db.add(
            PracticeDimension(
                user_id=user.id,
                label=item["label"],
                confidence=item["confidence"],
                evidence=item.get("evidence", []),
            )
        )
    db.query(CareerSuggestion).filter(CareerSuggestion.user_id == user.id).delete()
    for item in inference.get("career_suggestions", []):
        db.add(
            CareerSuggestion(
                user_id=user.id,
                title=strip_bscs_prefix(item.get("title")),
                confidence=item["confidence"],
                reasoning=item["reasoning"],
            )
        )
    db.commit()
    practice_rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
    career_rows = db.query(CareerSuggestion).filter(CareerSuggestion.user_id == user.id).all()
    return practice_rows, career_rows, summaries


@router.get("/user/{username}", response_model=UserResponse)
def get_user(
    username: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if (username or "").strip().lower() == "me":
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing token")
        token = authorization.replace("Bearer ", "", 1)
        try:
            payload = decode_access_token(token, settings.jwt_secret, settings.jwt_issuer)
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid token")
        subject = payload.get("sub")
        try:
            user_id = int(str(subject))
        except (TypeError, ValueError):
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(User).filter(User.id == user_id).one_or_none()
    else:
        user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    repos = db.query(Repo).filter(Repo.user_id == user.id).all()
    streak_days = _safe_fetch_commit_streak_days(user.username, token=user.github_token)
    badge_context = _build_badge_context(db, user, streak_days=streak_days)
    gamification = compute_xp_and_badges([repo.__dict__ for repo in repos], context=badge_context)
    practice_rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
    career_rows = db.query(CareerSuggestion).filter(CareerSuggestion.user_id == user.id).all()
    practice_payload = [{"label": item.label, "confidence": item.confidence, "evidence": item.evidence} for item in practice_rows]
    skill_domains, focus_domain = _skill_domain_payload(practice_payload)

    badge_rows = db.query(Badge).filter(Badge.user_id == user.id).all()
    bonus_xp = _badge_bonus_xp(badge_rows)
    total_xp = gamification.xp + bonus_xp + int(user.bonus_xp or 0)
    level = max(1, total_xp // 500 + 1)
    next_level_xp = level * 500
    has_recommendation_action = (
        db.query(RecommendationAction)
        .filter(
            RecommendationAction.user_id == user.id,
            RecommendationAction.action.in_(list(ADOPTED_RECOMMENDATION_ACTIONS)),
        )
        .count()
        > 0
    )

    total_commits = sum(int(repo.commit_count or 0) for repo in repos)
    weekly_commits = _weekly_commit_rows(db, user.id, fallback_commits=total_commits)
    weekly_avg = float(sum(int(item.get("commit_count") or 0) for item in weekly_commits) / max(1, len(weekly_commits)))
    frequency = {
        "total_commits": total_commits,
        "repo_count": len(repos),
        "active_repos_30d": _active_repos_last_30_days(repos),
        "weekly_commits": weekly_commits,
        "weekly_commit_average": weekly_avg,
        "streak_days": streak_days,
    }

    return {
        "profile": {
            "username": user.username,
            "display_name": user.display_name,
            "bio": user.bio,
            "student_id": user.student_id,
            "program": user.program,
            "year_level": user.year_level,
            "career_interest": user.career_interest,
            "preferred_learning_style": user.preferred_learning_style,
            "target_role": user.target_role,
            "target_certifications": list(user.target_certifications or []),
            "avatar_url": user.avatar_url,
            "level": level,
            "xp": total_xp,
            "next_level_xp": next_level_xp,
            "streak_days": streak_days,
            "has_recommendation_action": has_recommendation_action,
            "is_verified": bool(user.is_verified),
            "verified_at": str(user.verified_at) if user.verified_at else None,
        },
        "practice_dimensions": practice_payload,
        "career_suggestions": [
            {"title": strip_bscs_prefix(item.title), "confidence": item.confidence, "reasoning": item.reasoning}
            for item in career_rows
        ],
        "skill_domains": skill_domains,
        "focus_domain": focus_domain,
        "frequency": frequency,
        "badges": [_badge_payload(item) for item in badge_rows],
        "repos": [
            {
                "name": repo.name,
                "description": repo.description,
                "language": repo.language,
                "languages": repo.languages,
                "language_bytes": repo.language_bytes,
                "code_signals": repo.code_signals or {},
                "stars": repo.stars,
                "last_push": repo.last_push if repo.last_push else None,
                "commit_count": repo.commit_count,
            }
            for repo in repos
        ],
    }


@router.put("/user/settings", response_model=PortfolioResponse)
def update_settings(
    payload: PortfolioSettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload:
        raise HTTPException(status_code=400, detail="Missing payload")

    settings = (
        db.query(PortfolioSettings).filter(PortfolioSettings.user_id == current_user.id).one_or_none()
    )
    if not settings:
        settings = PortfolioSettings(user_id=current_user.id)
        db.add(settings)

    updates = payload.model_dump(exclude_unset=True)
    if "show_sections" in updates:
        current = settings.show_sections or {}
        merged = {**current, **(updates.get("show_sections") or {})}
        updates["show_sections"] = merged

    for field, value in updates.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    response = get_user(current_user.username, db=db)
    return {
        **response,
        "settings": {
            "theme": settings.theme,
            "theme_light": settings.theme_light,
            "theme_dark": settings.theme_dark,
            "section_order": settings.section_order,
            "show_sections": settings.show_sections or {"badges": True, "repos": True, "preview_dark": False},
            "featured_repos": settings.featured_repos,
            "featured_badges": settings.featured_badges,
            "social_links": settings.social_links,
            "bio": settings.bio,
            "cover_image": settings.cover_image,
            "is_public": settings.is_public,
        },
    }


@router.post("/register", response_model=UserResponse)
def register(payload: RegistrationIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.display_name is not None:
        current_user.display_name = payload.display_name
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.student_id is not None:
        current_user.student_id = payload.student_id.strip() or None
    if payload.program is not None:
        current_user.program = payload.program.strip() or None
    if payload.year_level is not None:
        current_user.year_level = payload.year_level.strip() or None
    if payload.career_interest is not None:
        current_user.career_interest = payload.career_interest.strip() or None
    if payload.preferred_learning_style is not None:
        current_user.preferred_learning_style = payload.preferred_learning_style.strip() or None
    if payload.target_role is not None:
        current_user.target_role = payload.target_role.strip() or None
    if payload.target_certifications is not None:
        cleaned = [str(item).strip() for item in payload.target_certifications if str(item).strip()]
        current_user.target_certifications = cleaned
    db.add(ActivityLog(user_id=current_user.id, event="profile_update"))
    db.commit()
    db.refresh(current_user)
    return get_user(current_user.username, db=db)


@router.post("/user/recompute", response_model=UserResponse)
def recompute_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if current_user.github_token:
            repos_raw = fetch_repos(current_user.github_token)
        else:
            repos_raw = fetch_public_repos(current_user.username)
        summaries = []
        for repo in repos_raw:
            repo_name = str(repo.get("name") or "").strip()
            if not repo_name:
                continue
            full_name = repo.get("full_name", "") or f"{current_user.username}/{repo_name}"

            if current_user.github_token:
                try:
                    languages = fetch_repo_languages(current_user.github_token, full_name)
                except Exception:
                    languages = []
                try:
                    language_bytes = fetch_repo_language_bytes(current_user.github_token, full_name)
                except Exception:
                    language_bytes = {}
            else:
                try:
                    languages = fetch_public_repo_languages(full_name)
                except Exception:
                    languages = []
                try:
                    language_bytes = fetch_public_repo_language_bytes(full_name)
                except Exception:
                    language_bytes = {}
            try:
                commit_count = fetch_repo_commit_count(
                    full_name,
                    current_user.username,
                    token=current_user.github_token,
                )
            except Exception:
                commit_count = 0

            summaries.append(
                summarize_repo(
                    repo,
                    languages,
                    commit_count=commit_count,
                    language_bytes=language_bytes,
                )
            )

        db.query(Repo).filter(Repo.user_id == current_user.id).delete()
        for repo in summaries:
            db.add(Repo(user_id=current_user.id, **repo))
    except Exception:
        # Fallback to last synced repos when GitHub is temporarily unavailable.
        repos = db.query(Repo).filter(Repo.user_id == current_user.id).all()
        summaries = _repo_summaries_for_inference(repos)

    inference = infer_practice_and_careers(
        settings.groq_api_key or "", settings.groq_model, summaries
    )
    db.query(PracticeDimension).filter(PracticeDimension.user_id == current_user.id).delete()
    for item in inference.get("practice_dimensions", []):
        db.add(
            PracticeDimension(
                user_id=current_user.id,
                label=item["label"],
                confidence=item["confidence"],
                evidence=item.get("evidence", []),
            )
        )
    db.query(CareerSuggestion).filter(CareerSuggestion.user_id == current_user.id).delete()
    for item in inference.get("career_suggestions", []):
        db.add(
            CareerSuggestion(
                user_id=current_user.id,
                title=strip_bscs_prefix(item.get("title")),
                confidence=item["confidence"],
                reasoning=item["reasoning"],
            )
        )
    practice_for_badges = [
        {"label": item["label"], "confidence": item["confidence"], "evidence": item.get("evidence", [])}
        for item in inference.get("practice_dimensions", [])
    ]
    badge_context = _build_badge_context(
        db,
        current_user,
        practice_dimensions=practice_for_badges,
        streak_days=_safe_fetch_commit_streak_days(current_user.username, token=current_user.github_token),
    )
    gamification = compute_xp_and_badges(summaries, context=badge_context)
    _sync_badges(db, current_user.id, gamification.badges)

    db.add(ActivityLog(user_id=current_user.id, event="recompute"))
    db.commit()
    try:
        refresh_engagement(db, current_user)
    except Exception:
        pass
    return get_user(current_user.username, db=db)


@router.post("/user/claim-badges", response_model=UserResponse)
def claim_badges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_rows = db.query(Badge).filter(
        Badge.user_id == current_user.id, Badge.achieved.is_(True), Badge.claimed.is_(False)
    ).update({Badge.claimed: True})
    db.commit()
    return get_user(current_user.username, db=db)


@router.get("/portfolio/{username}", response_model=PortfolioResponse)
def get_portfolio(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    settings = db.query(PortfolioSettings).filter(PortfolioSettings.user_id == user.id).one_or_none()
    if not settings or not settings.is_public:
        raise HTTPException(status_code=404, detail="Portfolio not public")

    response = get_user(username, db=db)
    return {
        **response,
        "settings": {
            "theme": settings.theme,
            "theme_light": settings.theme_light,
            "theme_dark": settings.theme_dark,
            "section_order": settings.section_order,
            "show_sections": settings.show_sections or {"badges": True, "repos": True, "preview_dark": False},
            "featured_repos": settings.featured_repos,
            "featured_badges": settings.featured_badges,
            "social_links": settings.social_links,
            "bio": settings.bio,
            "cover_image": settings.cover_image,
            "is_public": settings.is_public,
        },
    }


@router.get("/user/me/portfolio", response_model=PortfolioResponse)
def get_owner_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = (
        db.query(PortfolioSettings).filter(PortfolioSettings.user_id == current_user.id).one_or_none()
    )
    if not settings:
        settings = PortfolioSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    response = get_user(current_user.username, db=db)
    return {
        **response,
        "settings": {
            "theme": settings.theme,
            "theme_light": settings.theme_light,
            "theme_dark": settings.theme_dark,
            "section_order": settings.section_order,
            "show_sections": settings.show_sections or {"badges": True, "repos": True, "preview_dark": False},
            "featured_repos": settings.featured_repos,
            "featured_badges": settings.featured_badges,
            "social_links": settings.social_links,
            "bio": settings.bio,
            "cover_image": settings.cover_image,
            "is_public": settings.is_public,
        },
    }


@router.get("/user/me")
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    has_recommendation_action = (
        db.query(RecommendationAction)
        .filter(
            RecommendationAction.user_id == current_user.id,
            RecommendationAction.action.in_(list(ADOPTED_RECOMMENDATION_ACTIONS)),
        )
        .count()
        > 0
    )
    return {
        "id": current_user.id,
        "username": current_user.username,
        "has_recommendation_action": has_recommendation_action,
    }


def _get_or_create_portfolio_settings(db: Session, user_id: int) -> PortfolioSettings:
    settings_row = db.query(PortfolioSettings).filter(PortfolioSettings.user_id == user_id).one_or_none()
    if settings_row:
        return settings_row
    settings_row = PortfolioSettings(user_id=user_id)
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


@router.get("/leaderboard", response_model=list[LeaderboardEntryOut])
def get_leaderboard(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "student").all()
    entries: list[LeaderboardEntryOut] = []
    current_week = week_start_for_date(dt.datetime.utcnow())
    last_week = current_week - dt.timedelta(weeks=1)
    for user in users:
        repos = db.query(Repo).filter(Repo.user_id == user.id).all()
        gamification = compute_xp_and_badges([repo.__dict__ for repo in repos])
        badge_rows = db.query(Badge).filter(Badge.user_id == user.id).all()
        total_xp = gamification.xp + _badge_bonus_xp(badge_rows) + int(user.bonus_xp or 0)
        level = max(1, total_xp // 500 + 1)
        weekly_xp = (
            db.query(XpHistory)
            .filter(XpHistory.user_id == user.id, XpHistory.week_start == current_week)
            .with_entities(func.coalesce(func.sum(XpHistory.xp_gained), 0))
            .scalar()
        )
        last_week_xp = (
            db.query(XpHistory)
            .filter(XpHistory.user_id == user.id, XpHistory.week_start == last_week)
            .with_entities(func.coalesce(func.sum(XpHistory.xp_gained), 0))
            .scalar()
        )
        delta = int(weekly_xp or 0) - int(last_week_xp or 0)
        display_xp = int(weekly_xp or 0)
        if display_xp == 0:
            display_xp = int(total_xp)
        entries.append(
            LeaderboardEntryOut(
                id=user.id,
                username=user.username,
                avatar_url=user.avatar_url,
                level=level,
                xp=display_xp,
                delta=f"{'+' if delta >= 0 else ''}{delta} XP",
            )
        )
    entries.sort(key=lambda entry: entry.xp, reverse=True)
    return entries


@router.get("/learning-path/{username}", response_model=LearningPathResponse)
def get_learning_path(
    username: str,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.add(ActivityLog(user_id=user.id, event="learning_path_view"))
    db.commit()

    portfolio_settings = _get_or_create_portfolio_settings(db, user.id)
    repos = db.query(Repo).filter(Repo.user_id == user.id).all()
    practice_rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
    inference_summaries = _repo_summaries_for_inference(repos)
    summaries = [
        {
            "name": item.get("name"),
            "description": item.get("description"),
            "language": item.get("language"),
            "languages": item.get("languages"),
            "topics": item.get("topics"),
            "code_signals": item.get("code_signals") or {},
            "commit_count": item.get("commit_count"),
        }
        for item in inference_summaries
    ]
    practice_dimensions = [
        {"label": item.label, "confidence": item.confidence, "evidence": item.evidence}
        for item in practice_rows
    ]

    competency_levels = build_competency_levels(practice_dimensions)
    skill_gaps = identify_skill_gaps(competency_levels)
    steps = generate_personalized_learning_path(
        competency_levels,
        summaries,
        career_interest=user.career_interest,
    )

    signals = build_signal_set(summaries, include_repo_identity=False)
    baseline = set(portfolio_settings.learning_path_baseline or [])
    if not baseline:
        portfolio_settings.learning_path_baseline = list(signals)
        db.commit()
        steps_with_status = [{**step, "status": "todo"} for step in steps]
        return {
            "username": user.username,
            "steps": steps_with_status,
            "progress_percent": 0,
            "competency_levels": competency_levels,
            "skill_gaps": skill_gaps,
        }

    new_signals = signals - baseline
    steps, progress_percent = annotate_steps_with_status(steps, new_signals)
    for step in steps:
        title = step.get("title")
        if not title:
            continue
        existing = (
            db.query(LearningProgress)
            .filter(LearningProgress.user_id == user.id, LearningProgress.learning_step == title)
            .one_or_none()
        )
        status = step.get("status") or "todo"
        if existing and (existing.status or "") in {"done", "in_progress"}:
            status = existing.status or status
            step["status"] = status
        if not existing:
            db.add(
                LearningProgress(
                    user_id=user.id,
                    learning_step=title,
                    status=status,
                    completed_at=dt.datetime.utcnow() if status == "done" else None,
                )
            )
        else:
            existing.status = status
            if status == "done" and existing.completed_at is None:
                existing.completed_at = dt.datetime.utcnow()
    completed_steps = sum(1 for step in steps if (step.get("status") or "todo") == "done")
    progress_percent = int((completed_steps / len(steps)) * 100) if steps else 0
    db.commit()
    return {
        "username": user.username,
        "steps": steps,
        "progress_percent": progress_percent,
        "competency_levels": competency_levels,
        "skill_gaps": skill_gaps,
    }


@router.post("/learning-path/steps/status")
def update_learning_step_status(
    payload: LearningStepStatusIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    learning_step = (payload.learning_step or "").strip()
    status = (payload.status or "").strip().lower()
    if not learning_step:
        raise HTTPException(status_code=400, detail="learning_step is required")
    if status not in {"todo", "in_progress", "done"}:
        raise HTTPException(status_code=400, detail="status must be todo, in_progress, or done")

    row = (
        db.query(LearningProgress)
        .filter(
            LearningProgress.user_id == current_user.id,
            LearningProgress.learning_step == learning_step,
        )
        .one_or_none()
    )
    if not row:
        row = LearningProgress(
            user_id=current_user.id,
            learning_step=learning_step,
            status=status,
            completed_at=dt.datetime.utcnow() if status == "done" else None,
        )
        db.add(row)
    else:
        row.status = status
        row.completed_at = dt.datetime.utcnow() if status == "done" else None

    db.add(
        ActivityLog(
            user_id=current_user.id,
            event="learning_step_status_update",
            meta={"learning_step": learning_step, "status": status},
        )
    )
    db.commit()
    return {"ok": True, "learning_step": learning_step, "status": status}


@router.get("/curriculum-map/{username}", response_model=CurriculumMapOut)
def get_curriculum_map(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    practice_rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
    practice_dimensions = [
        {"label": item.label, "confidence": item.confidence, "evidence": item.evidence}
        for item in practice_rows
    ]
    competency_levels = build_competency_levels(practice_dimensions)
    score_by_key = {item["dimension_key"]: int(item["score_percent"]) for item in competency_levels}
    name_by_key = {item["dimension_key"]: item["dimension"] for item in competency_levels}

    subjects = []
    heatmap = []
    for subject in CURRICULUM_SUBJECTS:
        focus_key = subject["focus_dimension_key"]
        coverage = max(0, min(100, score_by_key.get(focus_key, 0)))
        band = _dimension_band(coverage)
        status = "Aligned" if band == "strong" else "Developing" if band == "developing" else "Needs Focus"
        subjects.append(
            {
                **subject,
                "focus_dimension": name_by_key.get(focus_key, focus_key.replace("_", " ").title()),
                "coverage_percent": coverage,
                "status": status,
            }
        )
        for dimension in competency_levels:
            cell_score = coverage if dimension["dimension_key"] == focus_key else int(max(0, dimension["score_percent"] - 15))
            heatmap.append(
                {
                    "subject_code": subject["code"],
                    "dimension_key": dimension["dimension_key"],
                    "dimension": dimension["dimension"],
                    "score_percent": max(0, min(100, cell_score)),
                    "band": _dimension_band(cell_score),
                }
            )

    return {"username": user.username, "subjects": subjects, "heatmap": heatmap}


@router.get("/recommendations/v2/{username}", response_model=RuleRecommendationListOut)
def get_rule_recommendations(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    practice_rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
    practice_dimensions = [
        {"label": item.label, "confidence": item.confidence, "evidence": item.evidence}
        for item in practice_rows
    ]
    competency_levels = build_competency_levels(practice_dimensions)
    weak_first = sorted(competency_levels, key=lambda item: item["score_percent"])
    items = []
    for idx, item in enumerate(weak_first):
        key = item["dimension_key"]
        modules = RULE_MODULES.get(key) or []
        if not modules:
            continue
        start_at = 0
        if len(modules) > 1:
            seed = sum(ord(ch) for ch in f"{user.username}:{key}") + int(idx or 0)
            start_at = seed % len(modules)
        ordered_modules = modules[start_at:] + modules[:start_at]
        for module in ordered_modules:
            items.append(
                {
                    "dimension_key": key,
                    "dimension": item["dimension"],
                    "reason": f"Current level is {item['level']} ({item['score_percent']}%). Prioritize this area.",
                    **module,
                }
            )

    acted_rows = (
        db.query(RecommendationAction)
        .filter(
            RecommendationAction.user_id == user.id,
            RecommendationAction.action.in_(list(ADOPTED_RECOMMENDATION_ACTIONS)),
        )
        .all()
    )
    acted_keys = {
        ((row.module_title or "").strip().lower(), (row.module_url or "").strip().lower())
        for row in acted_rows
    }
    for item in items:
        key = ((item.get("module_title") or "").strip().lower(), (item.get("module_url") or "").strip().lower())
        item["acted"] = key in acted_keys

    for item in items:
        db.add(
            RecommendationAction(
                user_id=user.id,
                dimension_key=item.get("dimension_key"),
                module_title=item.get("module_title") or "Learning Module",
                module_url=item.get("module_url") or "",
                action="shown",
            )
        )
    db.commit()

    peer_recommendations = get_peer_recommendations(db, username)

    return {
        "username": user.username,
        "items": items,
        "peer_recommendations": peer_recommendations,
    }


@router.get("/digest/weekly/{username}", response_model=WeeklyDigestOut)
def get_weekly_digest(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_weekly_digest(db, user)


@router.post("/certificates/submit", response_model=CertificateOut)
def submit_certificate(
    payload: CertificateSubmitIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = CertificateRecord(
        user_id=current_user.id,
        title=payload.title.strip(),
        provider=payload.provider.strip(),
        certificate_url=payload.certificate_url.strip(),
        status="pending",
    )
    db.add(row)
    db.add(ActivityLog(user_id=current_user.id, event="certificate_submit"))
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "user_id": row.user_id,
        "username": current_user.username,
        "title": row.title,
        "provider": row.provider,
        "certificate_url": row.certificate_url,
        "status": row.status,
        "reviewer_note": row.reviewer_note,
        "submitted_at": str(row.submitted_at),
        "verified_at": str(row.verified_at) if row.verified_at else None,
    }


@router.get("/certificates/me", response_model=list[CertificateOut])
def list_my_certificates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CertificateRecord)
        .filter(CertificateRecord.user_id == current_user.id)
        .order_by(CertificateRecord.submitted_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "username": current_user.username,
            "title": row.title,
            "provider": row.provider,
            "certificate_url": row.certificate_url,
            "status": row.status,
            "reviewer_note": row.reviewer_note,
            "submitted_at": str(row.submitted_at),
            "verified_at": str(row.verified_at) if row.verified_at else None,
        }
        for row in rows
    ]


@router.get("/validations/me", response_model=list[ProjectValidationOut])
def list_my_project_validations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(ProjectValidation)
        .filter(ProjectValidation.student_id == current_user.id)
        .order_by(ProjectValidation.created_at.desc())
        .all()
    )
    return [
        ProjectValidationOut(
            id=row.id,
            admin_id=row.admin_id,
            student_id=row.student_id,
            repo_name=row.repo_name,
            status=row.status,
            comment=row.comment,
            created_at=str(row.created_at),
        )
        for row in rows
    ]


@router.get("/learning-accounts/me", response_model=LearningAccountsOut)
def get_learning_accounts(
    current_user: User = Depends(get_current_user),
):
    return {
        "username": current_user.username,
        "freecodecamp_username": current_user.freecodecamp_username,
        "last_cert_sync_at": current_user.last_cert_sync_at.isoformat() if current_user.last_cert_sync_at else None,
    }


@router.put("/learning-accounts/me", response_model=LearningAccountsOut)
def update_learning_accounts(
    payload: LearningAccountsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.freecodecamp_username = (payload.freecodecamp_username or "").strip() or None
    db.add(current_user)
    db.add(ActivityLog(user_id=current_user.id, event="learning_account_update"))
    db.commit()
    db.refresh(current_user)
    return {
        "username": current_user.username,
        "freecodecamp_username": current_user.freecodecamp_username,
        "last_cert_sync_at": current_user.last_cert_sync_at.isoformat() if current_user.last_cert_sync_at else None,
    }


@router.get("/learning-accounts/stats", response_model=LearningAccountStatsOut)
def get_learning_account_stats(
    refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_freecodecamp_stats(db, current_user, refresh_public=refresh)


@router.post("/certificates/auto-sync", response_model=AutoSyncResultOut)
def auto_sync_certificates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = sync_freecodecamp_certificates(db, current_user)
    db.add(ActivityLog(user_id=current_user.id, event="certificate_auto_sync", meta={"provider": "freeCodeCamp"}))
    db.commit()
    return result


@router.post("/recommendations/action")
def track_recommendation_action(
    payload: RecommendationActionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action = ((payload.action_type or payload.action) or "").strip().lower()
    if action not in {"shown", "clicked", "accepted", "completed", "started", "rejected", "rated"}:
        raise HTTPException(status_code=400, detail="Invalid recommendation action")
    if action == "rated" and payload.rating is None:
        raise HTTPException(status_code=400, detail="Rating is required for rated action")
    clean_feedback = (payload.feedback or "").strip() or None
    row = RecommendationAction(
        user_id=current_user.id,
        dimension_key=payload.dimension_key,
        module_title=payload.module_title.strip(),
        module_url=payload.module_url.strip(),
        action=action,
        rating=payload.rating,
        feedback=clean_feedback,
    )
    db.add(row)
    db.commit()
    return {"ok": True}


@router.post("/surveys/sus", response_model=SusSurveyOut)
def submit_sus_survey(
    payload: SusSurveyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = SusSurveyResponse(user_id=current_user.id, score=payload.score, feedback=payload.feedback)
    db.add(row)
    db.add(ActivityLog(user_id=current_user.id, event="sus_submit"))
    db.commit()
    db.refresh(row)
    return {
        "username": current_user.username,
        "score": row.score,
        "feedback": row.feedback,
        "created_at": str(row.created_at),
    }


@router.get("/surveys/sus/me", response_model=list[SusSurveyOut])
def list_my_sus_surveys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(SusSurveyResponse)
        .filter(SusSurveyResponse.user_id == current_user.id)
        .order_by(SusSurveyResponse.created_at.desc())
        .all()
    )
    return [
        {
            "username": current_user.username,
            "score": row.score,
            "feedback": row.feedback,
            "created_at": str(row.created_at),
        }
        for row in rows
    ]


@router.post("/surveys/career-confidence", response_model=CareerConfidenceSurveyOut)
def submit_career_confidence_survey(
    payload: CareerConfidenceSurveyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    phase = (payload.phase or "").strip().lower()
    if phase not in {"pre", "post"}:
        raise HTTPException(status_code=400, detail="phase must be pre or post")
    row = CareerConfidenceSurveyResponse(
        user_id=current_user.id,
        phase=phase,
        score=payload.score,
        clarity_score=payload.clarity_score,
        feedback=(payload.feedback or "").strip() or None,
    )
    db.add(row)
    db.add(ActivityLog(user_id=current_user.id, event="career_confidence_submit", meta={"phase": phase}))
    db.commit()
    db.refresh(row)
    return {
        "username": current_user.username,
        "phase": row.phase,
        "score": row.score,
        "clarity_score": row.clarity_score,
        "feedback": row.feedback,
        "created_at": str(row.created_at),
    }


@router.get("/surveys/career-confidence/me", response_model=list[CareerConfidenceSurveyOut])
def list_my_career_confidence_surveys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CareerConfidenceSurveyResponse)
        .filter(CareerConfidenceSurveyResponse.user_id == current_user.id)
        .order_by(CareerConfidenceSurveyResponse.created_at.desc())
        .all()
    )
    return [
        {
            "username": current_user.username,
            "phase": row.phase,
            "score": row.score,
            "clarity_score": row.clarity_score,
            "feedback": row.feedback,
            "created_at": str(row.created_at),
        }
        for row in rows
    ]


@router.get("/portfolio-completeness/me", response_model=PortfolioCompletenessOut)
def get_my_portfolio_completeness(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _portfolio_completeness_payload(db, current_user)


@router.get("/quests/daily", response_model=QuestListOut)
def get_daily_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = dt.datetime.utcnow()
    day_start = dt.datetime(now.year, now.month, now.day)
    day_end = day_start + dt.timedelta(days=1)
    date_key = day_start.date().isoformat()
    claimed_rows = (
        db.query(DailyQuestClaim)
        .filter(DailyQuestClaim.user_id == current_user.id, DailyQuestClaim.quest_date == date_key)
        .all()
    )
    claimed_map = {row.quest_key: row for row in claimed_rows}
    quests = []
    for quest in DAILY_QUESTS:
        key = quest["key"]
        completed = _daily_quest_completed(db, current_user.id, key, day_start, day_end)
        quests.append(
            {
                "key": key,
                "title": quest["title"],
                "description": quest["description"],
                "reward_xp": quest["reward_xp"],
                "completed": completed,
                "claimed": key in claimed_map,
            }
        )
    return {"username": current_user.username, "date": date_key, "quests": quests}


@router.post("/quests/daily/claim")
def claim_daily_quest(
    payload: QuestClaimIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quest = next((item for item in DAILY_QUESTS if item["key"] == payload.quest_key), None)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    now = dt.datetime.utcnow()
    day_start = dt.datetime(now.year, now.month, now.day)
    day_end = day_start + dt.timedelta(days=1)
    date_key = day_start.date().isoformat()
    claimed = (
        db.query(DailyQuestClaim)
        .filter(
            DailyQuestClaim.user_id == current_user.id,
            DailyQuestClaim.quest_key == payload.quest_key,
            DailyQuestClaim.quest_date == date_key,
        )
        .one_or_none()
    )
    if claimed:
        return {"ok": True, "already_claimed": True}
    if not _daily_quest_completed(db, current_user.id, payload.quest_key, day_start, day_end):
        raise HTTPException(status_code=400, detail="Quest is not completed yet")

    db.add(
        DailyQuestClaim(
            user_id=current_user.id,
            quest_key=payload.quest_key,
            quest_date=date_key,
            reward_xp=quest["reward_xp"],
        )
    )
    _add_bonus_xp(db, current_user, quest["reward_xp"], f"daily_quest:{payload.quest_key}")
    db.commit()
    return {"ok": True, "claimed": True, "reward_xp": quest["reward_xp"]}


@router.get("/challenges/weekly", response_model=ChallengeListOut)
def get_weekly_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    week_start_dt = week_start_for_date(dt.datetime.utcnow())
    week_key = week_start_dt.date().isoformat()
    claimed_rows = (
        db.query(WeeklyChallengeClaim)
        .filter(WeeklyChallengeClaim.user_id == current_user.id, WeeklyChallengeClaim.week_start == week_key)
        .all()
    )
    claimed_map = {row.challenge_key: row for row in claimed_rows}
    challenges = []
    for challenge in WEEKLY_CHALLENGES:
        key = challenge["key"]
        completed = _weekly_challenge_completed(db, current_user.id, key, week_start_dt)
        challenges.append(
            {
                "key": key,
                "title": challenge["title"],
                "description": challenge["description"],
                "reward_xp": challenge["reward_xp"],
                "completed": completed,
                "claimed": key in claimed_map,
            }
        )
    return {"username": current_user.username, "week_start": week_key, "challenges": challenges}


@router.post("/challenges/weekly/claim")
def claim_weekly_challenge(
    payload: ChallengeClaimIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = next((item for item in WEEKLY_CHALLENGES if item["key"] == payload.challenge_key), None)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    week_start_dt = week_start_for_date(dt.datetime.utcnow())
    week_key = week_start_dt.date().isoformat()
    claimed = (
        db.query(WeeklyChallengeClaim)
        .filter(
            WeeklyChallengeClaim.user_id == current_user.id,
            WeeklyChallengeClaim.challenge_key == payload.challenge_key,
            WeeklyChallengeClaim.week_start == week_key,
        )
        .one_or_none()
    )
    if claimed:
        return {"ok": True, "already_claimed": True}
    if not _weekly_challenge_completed(db, current_user.id, payload.challenge_key, week_start_dt):
        raise HTTPException(status_code=400, detail="Challenge is not completed yet")

    db.add(
        WeeklyChallengeClaim(
            user_id=current_user.id,
            challenge_key=payload.challenge_key,
            week_start=week_key,
            reward_xp=challenge["reward_xp"],
        )
    )
    _add_bonus_xp(db, current_user, challenge["reward_xp"], f"weekly_challenge:{payload.challenge_key}")
    db.commit()
    return {"ok": True, "claimed": True, "reward_xp": challenge["reward_xp"]}


@router.get("/learning-path/projects/{username}", response_model=ProjectLearningPathResponse)
def get_project_learning_paths(
    username: str,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.add(ActivityLog(user_id=user.id, event="project_learning_path_view"))
    db.commit()

    portfolio_settings = _get_or_create_portfolio_settings(db, user.id)
    repos = db.query(Repo).filter(Repo.user_id == user.id).all()
    practice_rows = db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).all()
    inference_summaries = _repo_summaries_for_inference(repos)
    summaries = [
        {
            "name": item.get("name"),
            "description": item.get("description"),
            "language": item.get("language"),
            "languages": item.get("languages"),
            "topics": item.get("topics"),
            "code_signals": item.get("code_signals") or {},
            "commit_count": item.get("commit_count"),
        }
        for item in inference_summaries
    ]
    detected_skills = []
    project_keywords = []
    for repo in summaries:
        langs = repo.get("languages") or []
        if isinstance(langs, list):
            detected_skills.extend([str(lang) for lang in langs if lang])
        if repo.get("language"):
            detected_skills.append(str(repo.get("language")))
        project_keywords.extend([str(topic) for topic in (repo.get("topics") or []) if topic])
        code_signals = repo.get("code_signals") or {}
        project_keywords.extend([str(keyword) for keyword in (code_signals.get("keywords") or []) if keyword])
        detected_skills.extend([str(framework) for framework in (code_signals.get("frameworks") or []) if framework])
        project_keywords.extend([str(repo.get("name") or ""), str(repo.get("description") or "")])

    practice_dimensions = [
        {"label": item.label, "confidence": item.confidence, "evidence": item.evidence}
        for item in practice_rows
    ]

    projects = (
        infer_project_learning_paths(
            settings.groq_api_key or "",
            settings.groq_model,
            summaries,
            detected_skills=detected_skills,
            project_keywords=project_keywords,
            practice_dimensions=practice_dimensions,
        )
        if settings.inference_mode == "groq"
        else infer_project_learning_paths(
            "",
            settings.groq_model,
            summaries,
            detected_skills=detected_skills,
            project_keywords=project_keywords,
            practice_dimensions=practice_dimensions,
        )
    )
    projects_with_progress = []

    project_baseline = portfolio_settings.project_learning_path_baseline or {}
    for project in projects:
        repo_name = project.get("repo_name") or "Unnamed repo"
        repo = next((item for item in summaries if item.get("name") == repo_name), None)
        repo_signals = build_signal_set([repo] if repo else [], include_repo_identity=False)
        baseline_signals = set(project_baseline.get(repo_name) or [])
        if not baseline_signals:
            project_baseline[repo_name] = list(repo_signals)
            steps = [{**step, "status": "todo"} for step in (project.get("steps") or [])]
            progress_percent = 0
        else:
            new_signals = repo_signals - baseline_signals
            steps, progress_percent = annotate_steps_with_status(project.get("steps") or [], new_signals)
        projects_with_progress.append(
            {
                "repo_name": repo_name,
                "steps": steps,
                "progress_percent": progress_percent,
            }
        )
    portfolio_settings.project_learning_path_baseline = project_baseline
    db.commit()
    return {"username": user.username, "projects": projects_with_progress}
