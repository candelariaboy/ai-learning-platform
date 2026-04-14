from fastapi import APIRouter, Depends, HTTPException, Query, Response, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
import datetime as dt
import csv
import io
import math

from app.core.dependencies import get_current_admin
from app.db import get_db
from app.models import (
    User,
    Repo,
    Badge,
    AdminNote,
    ProjectValidation,
    PortfolioReview,
    AdminAccount,
    ActivityLog,
    CertificateRecord,
    InterventionPlan,
    RecommendationAction,
    SusSurveyResponse,
    CareerConfidenceSurveyResponse,
    PracticeDimension,
    CareerSuggestion,
    PortfolioSettings,
    EngagementCommit,
    LearningProgress,
    DailyQuestClaim,
    WeeklyChallengeClaim,
    XpHistory,
    LoginActivity,
)
from app.services.portfolio_metrics import compute_portfolio_completeness
from app.services.groq import strip_bscs_prefix
from app.schemas import (
    AdminStudentSummary,
    AdminNoteIn,
    AdminNoteOut,
    ProjectValidationIn,
    ProjectValidationOut,
    PortfolioReviewIn,
    PortfolioReviewOut,
    StudentVerifyIn,
    StudentVerifyOut,
    AdminAnalyticsOut,
    AdminDeepAnalyticsOut,
    AdminAnalyticsDay,
    AdminAnalyticsLabel,
    CertificateOut,
    CertificateReviewIn,
    InterventionPlanIn,
    InterventionPlanOut,
    AdminEvaluationMetricsOut,
    ValidationBulkIn,
    CertificateReviewBulkIn,
    InterventionAlertOut,
    CohortComparisonOut,
    CohortComparisonRowOut,
    ResearchAnalyticsOut,
    AdminStudentDetailOut,
    AdminStudentDetailProfileOut,
    AdminStudentDetailOverviewOut,
    AdminStudentRecommendationActionOut,
    AdminStudentActivityItemOut,
)


router = APIRouter(prefix="/admin", tags=["admin"])

ADOPTED_RECOMMENDATION_ACTIONS = {"clicked", "accepted", "completed", "started"}


def _student_users_query(db: Session):
    # Backward-compatible student filter:
    # include legacy rows where role can be null/empty, and explicit "student" rows.
    return db.query(User).filter(
        or_(
            User.role.is_(None),
            User.role == "",
            func.lower(User.role) == "student",
        )
    )


def _portfolio_completeness_score(db: Session, user: User, repos: list[Repo] | None = None) -> int:
    repos = repos if repos is not None else db.query(Repo).filter(Repo.user_id == user.id).all()
    settings_row = db.query(PortfolioSettings).filter(PortfolioSettings.user_id == user.id).one_or_none()
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
    return int(result.get("score", 0))


def _career_confidence_significance(rows: list[CareerConfidenceSurveyResponse]) -> dict:
    pre_latest: dict[int, int] = {}
    post_latest: dict[int, int] = {}
    ordered = sorted(rows, key=lambda row: row.created_at or dt.datetime.min)
    for row in ordered:
        phase = (row.phase or "").strip().lower()
        if phase == "pre":
            pre_latest[row.user_id] = int(row.score or 0)
        elif phase == "post":
            post_latest[row.user_id] = int(row.score or 0)

    paired_diffs: list[float] = []
    for user_id, pre_score in pre_latest.items():
        if user_id in post_latest:
            paired_diffs.append(float(post_latest[user_id] - pre_score))

    pair_count = len(paired_diffs)
    if pair_count < 2:
        return {"pairs": pair_count, "p_value": 1.0, "significant": False}

    mean_diff = sum(paired_diffs) / pair_count
    variance = sum((diff - mean_diff) ** 2 for diff in paired_diffs) / max(1, pair_count - 1)
    std_dev = math.sqrt(max(variance, 0.0))
    if std_dev == 0.0:
        p_value = 0.0 if mean_diff != 0.0 else 1.0
    else:
        t_stat = mean_diff / (std_dev / math.sqrt(pair_count))
        # Normal approximation for two-tailed p-value (lightweight, no scipy dependency).
        cdf = 0.5 * (1.0 + math.erf(abs(t_stat) / math.sqrt(2.0)))
        p_value = max(0.0, min(1.0, 2.0 * (1.0 - cdf)))
    return {"pairs": pair_count, "p_value": p_value, "significant": p_value < 0.05}


@router.delete("/students")
def delete_all_students(
    confirm: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    """Dangerous: delete all student users and related data.

    Requires JSON body: { "confirm": "DELETE_ALL_STUDENTS" }
    """
    if confirm != "DELETE_ALL_STUDENTS":
        raise HTTPException(status_code=400, detail="Missing or invalid confirmation token")

    students = _student_users_query(db).all()
    if not students:
        return {"deleted": 0}

    deleted_count = 0
    for user in students:
        # Remove admin notes, validations, reviews, certificates, interventions, activity logs, recommendations, surveys
        db.query(AdminNote).filter(AdminNote.student_id == user.id).delete()
        db.query(ProjectValidation).filter(ProjectValidation.student_id == user.id).delete()
        db.query(PortfolioReview).filter(PortfolioReview.student_id == user.id).delete()
        db.query(CertificateRecord).filter(CertificateRecord.user_id == user.id).delete()
        db.query(InterventionPlan).filter(InterventionPlan.student_id == user.id).delete()
        db.query(ActivityLog).filter(ActivityLog.user_id == user.id).delete()
        db.query(RecommendationAction).filter(RecommendationAction.user_id == user.id).delete()
        db.query(SusSurveyResponse).filter(SusSurveyResponse.user_id == user.id).delete()
        db.query(CareerConfidenceSurveyResponse).filter(CareerConfidenceSurveyResponse.user_id == user.id).delete()

        # Engagement + learning history
        db.query(EngagementCommit).filter(EngagementCommit.user_id == user.id).delete()
        db.query(LearningProgress).filter(LearningProgress.user_id == user.id).delete()
        db.query(DailyQuestClaim).filter(DailyQuestClaim.user_id == user.id).delete()
        db.query(WeeklyChallengeClaim).filter(WeeklyChallengeClaim.user_id == user.id).delete()
        db.query(XpHistory).filter(XpHistory.user_id == user.id).delete()
        db.query(LoginActivity).filter(LoginActivity.user_id == user.id).delete()

        # Repos, badges, practice dimensions, career suggestions, portfolio settings
        db.query(Repo).filter(Repo.user_id == user.id).delete()
        db.query(Badge).filter(Badge.user_id == user.id).delete()
        db.query(PracticeDimension).filter(PracticeDimension.user_id == user.id).delete()
        db.query(CareerSuggestion).filter(CareerSuggestion.user_id == user.id).delete()
        db.query(PortfolioSettings).filter(PortfolioSettings.user_id == user.id).delete()

        # Finally remove the user
        db.query(User).filter(User.id == user.id).delete()
        deleted_count += 1

    db.commit()
    return {"deleted": deleted_count}


@router.get("/students", response_model=list[AdminStudentSummary])
def list_students(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    users = _student_users_query(db).all()
    summaries: list[AdminStudentSummary] = []
    now = dt.datetime.utcnow()
    for user in users:
        repo_count = db.query(Repo).filter(Repo.user_id == user.id).count()
        badges_claimed = db.query(Badge).filter(
            Badge.user_id == user.id, Badge.claimed.is_(True)
        ).count()
        total_xp = 0
        for repo in db.query(Repo).filter(Repo.user_id == user.id).all():
            total_xp += int(repo.commit_count or 0) * 2
            total_xp += 50
            total_xp += int(repo.stars or 0)
        total_xp += int(user.bonus_xp or 0)
        level = max(1, total_xp // 500 + 1)
        last_seen = user.last_seen
        online = False
        if last_seen:
            try:
                online = (now - last_seen) <= dt.timedelta(minutes=10)
            except TypeError:
                online = False
        summaries.append(
            AdminStudentSummary(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                avatar_url=user.avatar_url,
                level=level,
                xp=total_xp,
                repo_count=repo_count,
                badges_claimed=badges_claimed,
                online=online,
                last_seen=str(last_seen) if last_seen else None,
                program=user.program,
                year_level=user.year_level,
                is_verified=bool(user.is_verified),
                verified_at=str(user.verified_at) if user.verified_at else None,
            )
        )
    return summaries


@router.get("/students/{student_id}/details", response_model=AdminStudentDetailOut)
def get_student_details(
    student_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    student = _student_users_query(db).filter(User.id == student_id).one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    repos = db.query(Repo).filter(Repo.user_id == student.id).all()
    badges_claimed = db.query(Badge).filter(Badge.user_id == student.id, Badge.claimed.is_(True)).count()
    total_commits = sum(int(repo.commit_count or 0) for repo in repos)
    total_stars = sum(int(repo.stars or 0) for repo in repos)
    xp = int(student.bonus_xp or 0)
    for repo in repos:
        xp += int(repo.commit_count or 0) * 2
        xp += 50
        xp += int(repo.stars or 0)
    level = max(1, xp // 500 + 1)

    certificates = (
        db.query(CertificateRecord)
        .filter(CertificateRecord.user_id == student.id)
        .order_by(CertificateRecord.submitted_at.desc())
        .limit(100)
        .all()
    )
    certificates_verified = sum(1 for row in certificates if row.status == "verified")

    recommendation_rows = (
        db.query(RecommendationAction)
        .filter(RecommendationAction.user_id == student.id)
        .order_by(RecommendationAction.created_at.desc())
        .limit(100)
        .all()
    )
    accepted_actions = sum(1 for row in recommendation_rows if row.action in {"accepted", "completed", "started"})
    rated_rows = [row for row in recommendation_rows if row.rating is not None]
    relevant_rows = [row for row in rated_rows if int(row.rating or 0) >= 4]

    sus_rows = (
        db.query(SusSurveyResponse)
        .filter(SusSurveyResponse.user_id == student.id)
        .order_by(SusSurveyResponse.created_at.desc())
        .all()
    )
    sus_latest = sus_rows[0].score if sus_rows else None
    sus_average = int(round(sum(row.score for row in sus_rows) / len(sus_rows))) if sus_rows else None

    portfolio_completeness = _portfolio_completeness_score(db, student, repos=repos)

    now = dt.datetime.utcnow()
    days_since_last_seen = None
    if student.last_seen:
        try:
            days_since_last_seen = max(0, (now - student.last_seen).days)
        except TypeError:
            days_since_last_seen = None

    top_repos = sorted(repos, key=lambda row: (int(row.commit_count or 0), int(row.stars or 0)), reverse=True)[:6]
    validations = (
        db.query(ProjectValidation)
        .filter(ProjectValidation.student_id == student.id)
        .order_by(ProjectValidation.created_at.desc())
        .limit(50)
        .all()
    )
    interventions = (
        db.query(InterventionPlan)
        .filter(InterventionPlan.student_id == student.id)
        .order_by(InterventionPlan.created_at.desc())
        .limit(50)
        .all()
    )
    notes = (
        db.query(AdminNote)
        .filter(AdminNote.student_id == student.id)
        .order_by(AdminNote.created_at.desc())
        .limit(50)
        .all()
    )
    reviews = (
        db.query(PortfolioReview)
        .filter(PortfolioReview.student_id == student.id)
        .order_by(PortfolioReview.created_at.desc())
        .limit(50)
        .all()
    )
    activity_rows = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == student.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(30)
        .all()
    )

    student_summary = AdminStudentSummary(
        id=student.id,
        username=student.username,
        display_name=student.display_name,
        avatar_url=student.avatar_url,
        level=level,
        xp=xp,
        repo_count=len(repos),
        badges_claimed=badges_claimed,
        online=bool(student.last_seen and (now - student.last_seen) <= dt.timedelta(minutes=10)),
        last_seen=str(student.last_seen) if student.last_seen else None,
        program=student.program,
        year_level=student.year_level,
        is_verified=bool(student.is_verified),
        verified_at=str(student.verified_at) if student.verified_at else None,
    )

    return AdminStudentDetailOut(
        student=student_summary,
        profile=AdminStudentDetailProfileOut(
            bio=student.bio,
            student_id=student.student_id,
            career_interest=student.career_interest,
            preferred_learning_style=student.preferred_learning_style,
            target_role=student.target_role,
            target_certifications=[str(item) for item in (student.target_certifications or [])],
            created_at=str(student.created_at) if student.created_at else None,
        ),
        overview=AdminStudentDetailOverviewOut(
            total_commits=total_commits,
            total_stars=total_stars,
            repo_count=len(repos),
            badges_claimed=badges_claimed,
            certificates_total=len(certificates),
            certificates_verified=certificates_verified,
            recommendation_actions_total=len(recommendation_rows),
            recommendation_acceptance_rate=int(round((accepted_actions / len(recommendation_rows)) * 100))
            if recommendation_rows
            else 0,
            recommendation_relevance_rate=int(round((len(relevant_rows) / len(rated_rows)) * 100)) if rated_rows else 0,
            portfolio_completeness=portfolio_completeness,
            sus_latest=sus_latest,
            sus_average=sus_average,
            days_since_last_seen=days_since_last_seen,
        ),
        top_repos=[
            {
                "name": repo.name,
                "description": repo.description,
                "language": repo.language,
                "languages": repo.languages or [],
                "language_bytes": repo.language_bytes or {},
                "code_signals": repo.code_signals or {},
                "stars": int(repo.stars or 0),
                "last_push": repo.last_push,
                "commit_count": int(repo.commit_count or 0),
            }
            for repo in top_repos
        ],
        practice_dimensions=[
            {
                "label": row.label,
                "confidence": int(row.confidence or 0),
                "evidence": [str(item) for item in (row.evidence or [])],
            }
            for row in db.query(PracticeDimension).filter(PracticeDimension.user_id == student.id).all()
        ],
        career_suggestions=[
            {
                "title": strip_bscs_prefix(row.title),
                "confidence": int(row.confidence or 0),
                "reasoning": row.reasoning,
            }
            for row in db.query(CareerSuggestion).filter(CareerSuggestion.user_id == student.id).all()
        ],
        recent_recommendations=[
            AdminStudentRecommendationActionOut(
                id=row.id,
                dimension_key=row.dimension_key,
                module_title=row.module_title,
                module_url=row.module_url,
                action=row.action,
                rating=row.rating,
                feedback=row.feedback,
                created_at=str(row.created_at),
            )
            for row in recommendation_rows[:20]
        ],
        recent_activity=[
            AdminStudentActivityItemOut(
                id=row.id,
                event=row.event,
                meta=row.meta or {},
                created_at=str(row.created_at),
            )
            for row in activity_rows
        ],
        certificates=[
            {
                "id": row.id,
                "user_id": row.user_id,
                "username": student.username,
                "title": row.title,
                "provider": row.provider,
                "certificate_url": row.certificate_url,
                "status": row.status,
                "reviewer_note": row.reviewer_note,
                "submitted_at": str(row.submitted_at),
                "verified_at": str(row.verified_at) if row.verified_at else None,
            }
            for row in certificates
        ],
        validations=[
            {
                "id": row.id,
                "admin_id": row.admin_id,
                "student_id": row.student_id,
                "repo_name": row.repo_name,
                "status": row.status,
                "comment": row.comment,
                "created_at": str(row.created_at),
            }
            for row in validations
        ],
        interventions=[
            {
                "id": row.id,
                "student_id": row.student_id,
                "admin_id": row.admin_id,
                "title": row.title,
                "action_plan": row.action_plan,
                "priority": row.priority,
                "target_date": row.target_date,
                "status": row.status,
                "created_at": str(row.created_at),
                "updated_at": str(row.updated_at) if row.updated_at else None,
            }
            for row in interventions
        ],
        notes=[
            {
                "id": row.id,
                "admin_id": row.admin_id,
                "student_id": row.student_id,
                "note": row.note,
                "created_at": str(row.created_at),
            }
            for row in notes
        ],
        reviews=[
            {
                "id": row.id,
                "admin_id": row.admin_id,
                "student_id": row.student_id,
                "status": row.status,
                "summary": row.summary,
                "created_at": str(row.created_at),
            }
            for row in reviews
        ],
    )


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    """Delete a single student and related data.

    Only student-role users (or legacy null/empty role) may be deleted via this endpoint.
    """
    target = _student_users_query(db).filter(User.id == student_id).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Student not found or cannot be deleted")

    # Remove admin notes, validations, reviews, certificates, interventions, activity logs, recommendations, surveys
    db.query(AdminNote).filter(AdminNote.student_id == target.id).delete()
    db.query(ProjectValidation).filter(ProjectValidation.student_id == target.id).delete()
    db.query(PortfolioReview).filter(PortfolioReview.student_id == target.id).delete()
    db.query(CertificateRecord).filter(CertificateRecord.user_id == target.id).delete()
    db.query(InterventionPlan).filter(InterventionPlan.student_id == target.id).delete()
    db.query(ActivityLog).filter(ActivityLog.user_id == target.id).delete()
    db.query(RecommendationAction).filter(RecommendationAction.user_id == target.id).delete()
    db.query(SusSurveyResponse).filter(SusSurveyResponse.user_id == target.id).delete()
    db.query(CareerConfidenceSurveyResponse).filter(CareerConfidenceSurveyResponse.user_id == target.id).delete()

    # Engagement + learning history
    db.query(EngagementCommit).filter(EngagementCommit.user_id == target.id).delete()
    db.query(LearningProgress).filter(LearningProgress.user_id == target.id).delete()
    db.query(DailyQuestClaim).filter(DailyQuestClaim.user_id == target.id).delete()
    db.query(WeeklyChallengeClaim).filter(WeeklyChallengeClaim.user_id == target.id).delete()
    db.query(XpHistory).filter(XpHistory.user_id == target.id).delete()
    db.query(LoginActivity).filter(LoginActivity.user_id == target.id).delete()

    # Repos, badges, practice dimensions, career suggestions, portfolio settings
    db.query(Repo).filter(Repo.user_id == target.id).delete()
    db.query(Badge).filter(Badge.user_id == target.id).delete()
    db.query(PracticeDimension).filter(PracticeDimension.user_id == target.id).delete()
    db.query(CareerSuggestion).filter(CareerSuggestion.user_id == target.id).delete()
    db.query(PortfolioSettings).filter(PortfolioSettings.user_id == target.id).delete()

    # Finally remove the user
    db.query(User).filter(User.id == target.id).delete()
    db.commit()
    return {"deleted": student_id}


@router.post("/students/verify", response_model=StudentVerifyOut)
def verify_student(
    payload: StudentVerifyIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    student = _student_users_query(db).filter(User.id == payload.student_id).one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_verified = bool(payload.is_verified)
    student.verified_at = dt.datetime.utcnow() if payload.is_verified else None
    db.add(student)
    db.commit()
    return StudentVerifyOut(
        student_id=student.id,
        is_verified=bool(student.is_verified),
        verified_at=str(student.verified_at) if student.verified_at else None,
    )


@router.get("/analytics", response_model=AdminAnalyticsOut)
def get_analytics(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    total_students = _student_users_query(db).count()
    total_repos = db.query(Repo).count()
    avg_xp = 0
    avg_level = 1
    if total_students:
        xp_sum = 0
        for user in _student_users_query(db).all():
            user_xp = 0
            for repo in db.query(Repo).filter(Repo.user_id == user.id).all():
                user_xp += int(repo.commit_count or 0) * 2
                user_xp += 50
                user_xp += int(repo.stars or 0)
            user_xp += int(user.bonus_xp or 0)
            xp_sum += user_xp
        avg_xp = int(xp_sum / total_students)
        avg_level = max(1, avg_xp // 500 + 1)

    pending_validations = db.query(ProjectValidation).filter(
        ProjectValidation.status == "pending"
    ).count()

    adoption_total_users = total_students
    adoption_users = 0
    if adoption_total_users:
        student_ids = [user.id for user in _student_users_query(db).all()]
        if student_ids:
            adoption_users = len(
                {
                    row.user_id
                    for row in db.query(RecommendationAction)
                    .filter(
                        RecommendationAction.user_id.in_(student_ids),
                        RecommendationAction.action.in_(list(ADOPTED_RECOMMENDATION_ACTIONS)),
                    )
                    .all()
                }
            )
    adoption_rate = int(round((adoption_users / adoption_total_users) * 100)) if adoption_total_users else 0

    return AdminAnalyticsOut(
        total_students=total_students,
        total_repos=total_repos,
        avg_xp=avg_xp,
        avg_level=avg_level,
        pending_validations=pending_validations,
        adoption_users=adoption_users,
        adoption_total_users=adoption_total_users,
        adoption_rate=adoption_rate,
    )


@router.get("/analytics/deep", response_model=AdminDeepAnalyticsOut)
def get_deep_analytics(
    range_param: str = Query("7d", alias="range", pattern="^(1h|1d|7d|30d)$"),
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    now = dt.datetime.utcnow()
    if range_param == "1h":
        bucket_seconds = 60
        bucket_count = 60
    elif range_param == "1d":
        bucket_seconds = 60 * 60
        bucket_count = 24
    elif range_param == "30d":
        bucket_seconds = 24 * 60 * 60
        bucket_count = 30
    else:
        bucket_seconds = 24 * 60 * 60
        bucket_count = 7

    start_dt = now - dt.timedelta(seconds=bucket_seconds * (bucket_count - 1))
    buckets: list[dt.datetime] = [
        start_dt + dt.timedelta(seconds=bucket_seconds * idx) for idx in range(bucket_count)
    ]
    day_map: dict[str, dict[str, int]] = {}
    login_sets: dict[str, set[int]] = {}
    for bucket in buckets:
        if bucket_seconds >= 24 * 60 * 60:
            label = bucket.date().isoformat()
        else:
            label = bucket.strftime("%H:%M")
        day_map[label] = {
            "logins": 0,
            "profile_updates": 0,
            "recomputes": 0,
            "learning_path_views": 0,
        }
        login_sets[label] = set()

    logs = db.query(ActivityLog).filter(ActivityLog.created_at >= start_dt).all()
    total_events = len(logs)
    for log in logs:
        created_at = log.created_at
        if not created_at:
            continue
        offset = int((created_at - start_dt).total_seconds() // bucket_seconds)
        if offset < 0 or offset >= bucket_count:
            continue
        bucket_dt = start_dt + dt.timedelta(seconds=bucket_seconds * offset)
        label = bucket_dt.date().isoformat() if bucket_seconds >= 24 * 60 * 60 else bucket_dt.strftime("%H:%M")
        if label not in day_map:
            continue
        if log.event in {"login", "heartbeat"}:
            login_sets[label].add(log.user_id)
        elif log.event == "profile_update":
            day_map[label]["profile_updates"] += 1
        elif log.event == "recompute":
            day_map[label]["recomputes"] += 1
        elif log.event in {"learning_path_view", "project_learning_path_view"}:
            day_map[label]["learning_path_views"] += 1

    for label, users in login_sets.items():
        day_map[label]["logins"] = len(users)

    day_rows = [
        AdminAnalyticsDay(
            date=label,
            logins=values["logins"],
            profile_updates=values["profile_updates"],
            recomputes=values["recomputes"],
            learning_path_views=values["learning_path_views"],
        )
        for label, values in day_map.items()
    ]

    language_counts: dict[str, int] = {}
    for repo in db.query(Repo).all():
        if repo.language:
            key = repo.language.strip()
            if key:
                language_counts[key] = language_counts.get(key, 0) + 1
        if isinstance(repo.languages, list):
            for lang in repo.languages:
                if not lang:
                    continue
                key = str(lang).strip()
                if not key:
                    continue
                language_counts[key] = language_counts.get(key, 0) + 1

    top_languages = sorted(
        [AdminAnalyticsLabel(label=label, count=count) for label, count in language_counts.items()],
        key=lambda item: item.count,
        reverse=True,
    )[:8]

    return AdminDeepAnalyticsOut(
        days=day_rows,
        top_languages=top_languages,
        total_events=total_events,
    )


@router.post("/analytics/reset")
def reset_analytics(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    db.query(ActivityLog).delete()
    db.commit()
    return {"ok": True}


@router.get("/evaluation/metrics", response_model=AdminEvaluationMetricsOut)
def get_evaluation_metrics(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    students = _student_users_query(db).all()
    total_students = len(students)
    student_ids = [user.id for user in students]

    sus_rows = (
        db.query(SusSurveyResponse)
        .filter(SusSurveyResponse.user_id.in_(student_ids))
        .all()
        if student_ids
        else []
    )
    sus_user_ids = {row.user_id for row in sus_rows}
    avg_sus = int(round(sum(row.score for row in sus_rows) / len(sus_rows))) if sus_rows else 0

    action_rows = (
        db.query(RecommendationAction)
        .filter(RecommendationAction.user_id.in_(student_ids))
        .all()
        if student_ids
        else []
    )
    action_total = len(action_rows)
    accepted_actions = sum(1 for row in action_rows if row.action in {"accepted", "completed"})
    acceptance_rate = int(round((accepted_actions / action_total) * 100)) if action_total else 0
    rating_rows = [row for row in action_rows if row.rating is not None]
    relevant_rows = [row for row in rating_rows if int(row.rating or 0) >= 4]
    relevance_rate = int(round((len(relevant_rows) / len(rating_rows)) * 100)) if rating_rows else 0

    completeness_scores: list[int] = []
    for user in students:
        repos = db.query(Repo).filter(Repo.user_id == user.id).all()
        completeness_scores.append(_portfolio_completeness_score(db, user, repos=repos))
    completeness_rate = int(round(sum(completeness_scores) / len(completeness_scores))) if completeness_scores else 0

    confidence_rows = (
        db.query(CareerConfidenceSurveyResponse)
        .filter(CareerConfidenceSurveyResponse.user_id.in_(student_ids))
        .all()
        if student_ids
        else []
    )
    pre_rows = [row for row in confidence_rows if (row.phase or "").lower() == "pre"]
    post_rows = [row for row in confidence_rows if (row.phase or "").lower() == "post"]
    pre_avg = int(round(sum(int(row.score or 0) for row in pre_rows) / len(pre_rows))) if pre_rows else 0
    post_avg = int(round(sum(int(row.score or 0) for row in post_rows) / len(post_rows))) if post_rows else 0
    confidence_delta = post_avg - pre_avg if pre_rows and post_rows else 0
    confidence_stats = _career_confidence_significance(confidence_rows)

    return {
        "total_students": total_students,
        "students_with_sus": len(sus_user_ids),
        "avg_sus": avg_sus,
        "recommendation_actions_total": action_total,
        "recommendation_acceptance_rate": acceptance_rate,
        "recommendation_ratings_total": len(rating_rows),
        "recommendation_relevance_rate": relevance_rate,
        "portfolio_completeness_rate": completeness_rate,
        "career_confidence_responses": len(confidence_rows),
        "career_confidence_pre_avg": pre_avg,
        "career_confidence_post_avg": post_avg,
        "career_confidence_delta": confidence_delta,
        "career_confidence_pairs": int(confidence_stats["pairs"]),
        "career_confidence_p_value": float(confidence_stats["p_value"]),
        "career_confidence_significant": bool(confidence_stats["significant"]),
    }


@router.post("/notes", response_model=AdminNoteOut)
def create_note(
    payload: AdminNoteIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    student = db.query(User).filter(User.id == payload.student_id).one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    note = AdminNote(admin_id=current_admin.id, student_id=student.id, note=payload.note)
    db.add(note)
    db.commit()
    db.refresh(note)
    return AdminNoteOut(
        id=note.id,
        admin_id=note.admin_id,
        student_id=note.student_id,
        note=note.note,
        created_at=str(note.created_at),
    )


@router.get("/notes/{student_id}", response_model=list[AdminNoteOut])
def list_notes(
    student_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    notes = db.query(AdminNote).filter(AdminNote.student_id == student_id).order_by(
        AdminNote.created_at.desc()
    )
    return [
        AdminNoteOut(
            id=note.id,
            admin_id=note.admin_id,
            student_id=note.student_id,
            note=note.note,
            created_at=str(note.created_at),
        )
        for note in notes
    ]


@router.post("/validations", response_model=ProjectValidationOut)
def create_validation(
    payload: ProjectValidationIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    student = db.query(User).filter(User.id == payload.student_id).one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    validation = ProjectValidation(
        admin_id=current_admin.id,
        student_id=student.id,
        repo_name=payload.repo_name,
        status=payload.status,
        comment=payload.comment,
    )
    db.add(validation)
    db.commit()
    db.refresh(validation)
    return ProjectValidationOut(
        id=validation.id,
        admin_id=validation.admin_id,
        student_id=validation.student_id,
        repo_name=validation.repo_name,
        status=validation.status,
        comment=validation.comment,
        created_at=str(validation.created_at),
    )


@router.get("/validations", response_model=list[ProjectValidationOut])
def list_all_validations(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    query = db.query(ProjectValidation)
    if status:
        query = query.filter(ProjectValidation.status == status)
    rows = query.order_by(ProjectValidation.created_at.desc()).limit(500).all()
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


@router.get("/validations/{student_id}", response_model=list[ProjectValidationOut])
def list_validations(
    student_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    rows = db.query(ProjectValidation).filter(ProjectValidation.student_id == student_id).order_by(
        ProjectValidation.created_at.desc()
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


@router.post("/portfolio-reviews", response_model=PortfolioReviewOut)
def create_portfolio_review(
    payload: PortfolioReviewIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    student = _student_users_query(db).filter(User.id == payload.student_id).one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    row = PortfolioReview(
        admin_id=current_admin.id,
        student_id=payload.student_id,
        status=(payload.status or "needs_work").strip() or "needs_work",
        summary=payload.summary.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return PortfolioReviewOut(
        id=row.id,
        admin_id=row.admin_id,
        student_id=row.student_id,
        status=row.status,
        summary=row.summary,
        created_at=str(row.created_at),
    )


@router.get("/portfolio-reviews/{student_id}", response_model=list[PortfolioReviewOut])
def list_portfolio_reviews(
    student_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    rows = (
        db.query(PortfolioReview)
        .filter(PortfolioReview.student_id == student_id)
        .order_by(PortfolioReview.created_at.desc())
        .all()
    )
    return [
        PortfolioReviewOut(
            id=row.id,
            admin_id=row.admin_id,
            student_id=row.student_id,
            status=row.status,
            summary=row.summary,
            created_at=str(row.created_at),
        )
        for row in rows
    ]


@router.get("/certificates/pending", response_model=list[CertificateOut])
def list_pending_certificates(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    rows = (
        db.query(CertificateRecord, User)
        .join(User, User.id == CertificateRecord.user_id)
        .filter(CertificateRecord.status == "pending")
        .order_by(CertificateRecord.submitted_at.desc())
        .all()
    )
    return [
        {
            "id": row.CertificateRecord.id,
            "user_id": row.CertificateRecord.user_id,
            "username": row.User.username,
            "title": row.CertificateRecord.title,
            "provider": row.CertificateRecord.provider,
            "certificate_url": row.CertificateRecord.certificate_url,
            "status": row.CertificateRecord.status,
            "reviewer_note": row.CertificateRecord.reviewer_note,
            "submitted_at": str(row.CertificateRecord.submitted_at),
            "verified_at": str(row.CertificateRecord.verified_at) if row.CertificateRecord.verified_at else None,
        }
        for row in rows
    ]


@router.post("/certificates/review", response_model=CertificateOut)
def review_certificate(
    payload: CertificateReviewIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    row = db.query(CertificateRecord).filter(CertificateRecord.id == payload.certificate_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Certificate not found")
    if payload.status not in {"verified", "rejected", "pending"}:
        raise HTTPException(status_code=400, detail="Invalid certificate status")

    row.status = payload.status
    row.reviewer_note = payload.reviewer_note
    row.reviewer_id = current_admin.id
    row.verified_at = dt.datetime.utcnow() if payload.status == "verified" else None
    db.add(row)
    db.commit()
    db.refresh(row)

    student = db.query(User).filter(User.id == row.user_id).one_or_none()
    return {
        "id": row.id,
        "user_id": row.user_id,
        "username": student.username if student else None,
        "title": row.title,
        "provider": row.provider,
        "certificate_url": row.certificate_url,
        "status": row.status,
        "reviewer_note": row.reviewer_note,
        "submitted_at": str(row.submitted_at),
        "verified_at": str(row.verified_at) if row.verified_at else None,
    }


@router.post("/interventions", response_model=InterventionPlanOut)
def create_intervention(
    payload: InterventionPlanIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    student = _student_users_query(db).filter(User.id == payload.student_id).one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    row = InterventionPlan(
        student_id=payload.student_id,
        admin_id=current_admin.id,
        title=payload.title,
        action_plan=payload.action_plan,
        priority=payload.priority,
        target_date=payload.target_date,
        status=payload.status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "student_id": row.student_id,
        "admin_id": row.admin_id,
        "title": row.title,
        "action_plan": row.action_plan,
        "priority": row.priority,
        "target_date": row.target_date,
        "status": row.status,
        "created_at": str(row.created_at),
        "updated_at": str(row.updated_at) if row.updated_at else None,
    }


@router.get("/interventions", response_model=list[InterventionPlanOut])
def list_all_interventions(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    query = db.query(InterventionPlan)
    if status:
        query = query.filter(InterventionPlan.status == status)
    rows = query.order_by(InterventionPlan.created_at.desc()).limit(500).all()
    return [
        InterventionPlanOut(
            id=row.id,
            student_id=row.student_id,
            admin_id=row.admin_id,
            title=row.title,
            action_plan=row.action_plan,
            priority=row.priority,
            target_date=row.target_date,
            status=row.status,
            created_at=str(row.created_at),
            updated_at=str(row.updated_at) if row.updated_at else None,
        )
        for row in rows
    ]


@router.get("/interventions/{student_id}", response_model=list[InterventionPlanOut])
def list_interventions(
    student_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    rows = (
        db.query(InterventionPlan)
        .filter(InterventionPlan.student_id == student_id)
        .order_by(InterventionPlan.created_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "student_id": row.student_id,
            "admin_id": row.admin_id,
            "title": row.title,
            "action_plan": row.action_plan,
            "priority": row.priority,
            "target_date": row.target_date,
            "status": row.status,
            "created_at": str(row.created_at),
            "updated_at": str(row.updated_at) if row.updated_at else None,
        }
        for row in rows
    ]


@router.post("/validations/bulk", response_model=list[ProjectValidationOut])
def create_bulk_validations(
    payload: ValidationBulkIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    student = _student_users_query(db).filter(User.id == payload.student_id).one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not payload.items:
        raise HTTPException(status_code=400, detail="No validation items provided")

    created: list[ProjectValidation] = []
    for item in payload.items:
        status = (item.status or "pending").lower()
        if status not in {"approved", "pending", "rejected"}:
            continue
        repo_name = (item.repo_name or "").strip()
        if not repo_name:
            continue
        row = ProjectValidation(
            admin_id=current_admin.id,
            student_id=student.id,
            repo_name=repo_name,
            status=status,
            comment=item.comment,
        )
        db.add(row)
        created.append(row)

    if not created:
        raise HTTPException(status_code=400, detail="No valid validation items provided")

    db.commit()
    for row in created:
        db.refresh(row)
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
        for row in created
    ]


@router.post("/certificates/review/bulk", response_model=list[CertificateOut])
def review_certificates_bulk(
    payload: CertificateReviewBulkIn,
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="No certificate items provided")

    reviewed: list[CertificateOut] = []
    for item in payload.items:
        row = db.query(CertificateRecord).filter(CertificateRecord.id == item.certificate_id).one_or_none()
        if not row:
            continue
        status = (item.status or "pending").lower()
        if status not in {"verified", "rejected", "pending"}:
            continue
        row.status = status
        row.reviewer_note = item.reviewer_note
        row.reviewer_id = current_admin.id
        row.verified_at = dt.datetime.utcnow() if status == "verified" else None
        db.add(row)

    db.commit()

    for item in payload.items:
        row = db.query(CertificateRecord).filter(CertificateRecord.id == item.certificate_id).one_or_none()
        if not row:
            continue
        student = db.query(User).filter(User.id == row.user_id).one_or_none()
        reviewed.append(
            CertificateOut(
                id=row.id,
                user_id=row.user_id,
                username=student.username if student else None,
                title=row.title,
                provider=row.provider,
                certificate_url=row.certificate_url,
                status=row.status,
                reviewer_note=row.reviewer_note,
                submitted_at=str(row.submitted_at),
                verified_at=str(row.verified_at) if row.verified_at else None,
            )
        )
    return reviewed


@router.get("/intervention-alerts", response_model=list[InterventionAlertOut])
def get_intervention_alerts(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    now = dt.datetime.utcnow()
    alerts: list[InterventionAlertOut] = []
    students = _student_users_query(db).all()
    for student in students:
        reasons: list[str] = []
        risk = 0

        last_seen = student.last_seen
        if not last_seen or (now - last_seen) >= dt.timedelta(days=14):
            reasons.append("No login activity in the last 14 days")
            risk += 40

        repos = db.query(Repo).filter(Repo.user_id == student.id).all()
        total_commits = sum(int(repo.commit_count or 0) for repo in repos)
        if total_commits == 0:
            reasons.append("No commit evidence yet")
            risk += 35

        has_learning_views = db.query(ActivityLog).filter(
            ActivityLog.user_id == student.id,
            ActivityLog.event.in_(["learning_path_view", "project_learning_path_view"]),
        ).count() > 0
        if not has_learning_views:
            reasons.append("No learning path interaction yet")
            risk += 25

        if risk >= 40:
            alerts.append(
                InterventionAlertOut(
                    student_id=student.id,
                    username=student.username,
                    risk_score=min(100, risk),
                    reasons=reasons,
                    suggested_action="Schedule a check-in, set one achievable weekly goal, and monitor next 7 days.",
                )
            )

    alerts.sort(key=lambda item: item.risk_score, reverse=True)
    return alerts


@router.get("/cohort-comparison", response_model=CohortComparisonOut)
def get_cohort_comparison(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    students = _student_users_query(db).all()
    by_program: dict[str, list[User]] = {}
    by_year: dict[str, list[User]] = {}

    for student in students:
        program = (student.program or "Unknown").strip() or "Unknown"
        year = (student.year_level or "Unknown").strip() or "Unknown"
        by_program.setdefault(program, []).append(student)
        by_year.setdefault(year, []).append(student)

    def summarize(label: str, members: list[User]) -> CohortComparisonRowOut:
        if not members:
            return CohortComparisonRowOut(
                cohort=label,
                student_count=0,
                avg_xp=0,
                avg_level=1,
                avg_repo_count=0,
            )
        xp_total = 0
        repo_total = 0
        for student in members:
            repos = db.query(Repo).filter(Repo.user_id == student.id).all()
            repo_total += len(repos)
            user_xp = 0
            for repo in repos:
                user_xp += int(repo.commit_count or 0) * 2
                user_xp += 50
                user_xp += int(repo.stars or 0)
            user_xp += int(student.bonus_xp or 0)
            xp_total += user_xp
        count = len(members)
        avg_xp = int(xp_total / count)
        return CohortComparisonRowOut(
            cohort=label,
            student_count=count,
            avg_xp=avg_xp,
            avg_level=max(1, avg_xp // 500 + 1),
            avg_repo_count=int(repo_total / count),
        )

    return CohortComparisonOut(
        by_program=[summarize(label, members) for label, members in sorted(by_program.items())],
        by_year_level=[summarize(label, members) for label, members in sorted(by_year.items())],
    )


@router.get("/export/students.csv")
def export_students_csv(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "username",
        "display_name",
        "program",
        "year_level",
        "xp",
        "level",
        "repo_count",
        "last_seen",
    ])

    for student in _student_users_query(db).all():
        repos = db.query(Repo).filter(Repo.user_id == student.id).all()
        xp = int(student.bonus_xp or 0)
        for repo in repos:
            xp += int(repo.commit_count or 0) * 2
            xp += 50
            xp += int(repo.stars or 0)
        level = max(1, xp // 500 + 1)
        writer.writerow([
            student.id,
            student.username,
            student.display_name or "",
            student.program or "",
            student.year_level or "",
            xp,
            level,
            len(repos),
            str(student.last_seen) if student.last_seen else "",
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_report.csv"},
    )


@router.get("/research/analytics", response_model=ResearchAnalyticsOut)
def get_research_analytics(
    db: Session = Depends(get_db),
    current_admin: AdminAccount = Depends(get_current_admin),
):
    students = _student_users_query(db).all()
    student_ids = [student.id for student in students]
    now = dt.datetime.utcnow()
    since = now - dt.timedelta(days=7)

    sus_rows = (
        db.query(SusSurveyResponse).filter(SusSurveyResponse.user_id.in_(student_ids)).all()
        if student_ids
        else []
    )
    sus_average = int(round(sum(row.score for row in sus_rows) / len(sus_rows))) if sus_rows else 0

    actions = (
        db.query(RecommendationAction).filter(RecommendationAction.user_id.in_(student_ids)).all()
        if student_ids
        else []
    )
    accepted = sum(1 for row in actions if row.action in {"accepted", "completed"})
    acceptance_rate = int(round((accepted / len(actions)) * 100)) if actions else 0
    rating_rows = [row for row in actions if row.rating is not None]
    relevant_rows = [row for row in rating_rows if int(row.rating or 0) >= 4]
    relevance_rate = int(round((len(relevant_rows) / len(rating_rows)) * 100)) if rating_rows else 0

    weekly_login_events = db.query(ActivityLog).filter(
        ActivityLog.user_id.in_(student_ids) if student_ids else False,
        ActivityLog.event.in_(["login", "heartbeat"]),
        ActivityLog.created_at >= since,
    ).count()
    weekly_profile_updates = db.query(ActivityLog).filter(
        ActivityLog.user_id.in_(student_ids) if student_ids else False,
        ActivityLog.event == "profile_update",
        ActivityLog.created_at >= since,
    ).count()

    active_students_14d = sum(
        1
        for student in students
        if student.last_seen and (now - student.last_seen) <= dt.timedelta(days=14)
    )

    confidence_rows = (
        db.query(CareerConfidenceSurveyResponse).filter(CareerConfidenceSurveyResponse.user_id.in_(student_ids)).all()
        if student_ids
        else []
    )
    pre_rows = [row for row in confidence_rows if (row.phase or "").lower() == "pre"]
    post_rows = [row for row in confidence_rows if (row.phase or "").lower() == "post"]
    pre_avg = int(round(sum(int(row.score or 0) for row in pre_rows) / len(pre_rows))) if pre_rows else 0
    post_avg = int(round(sum(int(row.score or 0) for row in post_rows) / len(post_rows))) if post_rows else 0
    confidence_stats = _career_confidence_significance(confidence_rows)

    student_count = max(1, len(students))
    return ResearchAnalyticsOut(
        sus_average=sus_average,
        recommendation_acceptance_rate=acceptance_rate,
        recommendation_ratings_total=len(rating_rows),
        recommendation_relevance_rate=relevance_rate,
        weekly_login_frequency=round(weekly_login_events / student_count, 2),
        weekly_portfolio_update_frequency=round(weekly_profile_updates / student_count, 2),
        active_students_14d=active_students_14d,
        career_confidence_pre_avg=pre_avg,
        career_confidence_post_avg=post_avg,
        career_confidence_delta=(post_avg - pre_avg if pre_rows and post_rows else 0),
        career_confidence_pairs=int(confidence_stats["pairs"]),
        career_confidence_p_value=float(confidence_stats["p_value"]),
        career_confidence_significant=bool(confidence_stats["significant"]),
    )
