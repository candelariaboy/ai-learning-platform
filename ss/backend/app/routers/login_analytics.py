from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_current_admin
from app.db import get_db
from app.models import User
from app.schemas import (
    LoginActivityDetailOut,
    LoginActivityTrendsOut,
    LoginStreakOut,
    LoginTrendPoint,
    PeakHourPoint,
    WeeklyActivePoint,
    RecentLoginOut,
    LoginLiveOut,
    LiveLoginPoint,
)
from app.models import LoginActivity
from app.services.login_activity_service import (
    daily_login_counts,
    peak_login_hours,
    user_login_streak,
    weekly_active_users,
    live_login_buckets,
)


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/login-activity", response_model=LoginActivityDetailOut)
def get_login_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    daily = daily_login_counts(db, days=14)
    peak = peak_login_hours(db, days=30)
    weekly = weekly_active_users(db, weeks=8)
    streak = user_login_streak(db, current_user.id)
    recent_rows = (
        db.query(LoginActivity)
        .filter(LoginActivity.user_id == current_user.id)
        .order_by(LoginActivity.login_timestamp.desc())
        .limit(10)
        .all()
    )
    recent = [
        RecentLoginOut(
            login_timestamp=row.login_timestamp.isoformat(),
            device=row.device,
        )
        for row in recent_rows
        if row.login_timestamp
    ]
    return LoginActivityDetailOut(
        daily_counts=[LoginTrendPoint(**item) for item in daily],
        peak_hours=[PeakHourPoint(**item) for item in peak],
        weekly_active=[WeeklyActivePoint(**item) for item in weekly],
        streak=LoginStreakOut(current_streak=streak),
        recent_logins=recent,
    )


@router.get("/login-trends", response_model=LoginActivityTrendsOut)
def get_login_trends(
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    daily = daily_login_counts(db, days=30)
    peak = peak_login_hours(db, days=30)
    weekly = weekly_active_users(db, weeks=104)
    per_user = []
    for user in db.query(User).filter(User.role == "student").all():
        per_user.append(
            LoginStreakOut(
                user_id=user.id,
                username=user.username,
                current_streak=user_login_streak(db, user.id),
            )
        )
    return LoginActivityTrendsOut(
        daily_counts=[LoginTrendPoint(**item) for item in daily],
        peak_hours=[PeakHourPoint(**item) for item in peak],
        weekly_active=[WeeklyActivePoint(**item) for item in weekly],
        streaks=per_user,
    )


@router.get("/login-live", response_model=LoginLiveOut)
def get_login_live(
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    hours = 24
    bucket_minutes = 10
    points = live_login_buckets(db, hours=hours, bucket_minutes=bucket_minutes, anchor_hour=0)
    return LoginLiveOut(
        window_hours=hours,
        bucket_minutes=bucket_minutes,
        points=[LiveLoginPoint(**item) for item in points],
    )
