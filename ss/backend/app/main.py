from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.db import Base, engine
from app.routers import auth, users, admin, analytics
from app.routers import login_analytics


Base.metadata.create_all(bind=engine)

# Lightweight SQLite migration for older local DBs.
if engine.url.get_backend_name() == "sqlite":
    with engine.begin() as conn:
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(users)"))]
        if "github_token" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN github_token TEXT"))
        if "freecodecamp_username" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN freecodecamp_username TEXT"))
        if "bonus_xp" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN bonus_xp INTEGER DEFAULT 0"))
        if "last_cert_sync_at" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_cert_sync_at DATETIME"))
        if "role" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'"))
        if "last_seen" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_seen DATETIME"))
        if "is_verified" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
        if "verified_at" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN verified_at DATETIME"))
        if "student_id" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN student_id TEXT"))
        if "program" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN program TEXT"))
        if "year_level" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN year_level TEXT"))
        if "career_interest" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN career_interest TEXT"))
        if "preferred_learning_style" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN preferred_learning_style TEXT"))
        if "target_role" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN target_role TEXT"))
        if "target_certifications" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN target_certifications JSON"))
        repo_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(repos)"))]
        if "language_bytes" not in repo_cols:
            conn.execute(text("ALTER TABLE repos ADD COLUMN language_bytes JSON"))
        if "code_signals" not in repo_cols:
            conn.execute(text("ALTER TABLE repos ADD COLUMN code_signals JSON"))
        settings_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(portfolio_settings)"))]
        if "learning_path_baseline" not in settings_cols:
            conn.execute(text("ALTER TABLE portfolio_settings ADD COLUMN learning_path_baseline JSON"))
        if "project_learning_path_baseline" not in settings_cols:
            conn.execute(text("ALTER TABLE portfolio_settings ADD COLUMN project_learning_path_baseline JSON"))
        admin_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(admin_accounts)"))]
        if not admin_cols:
            conn.execute(text("CREATE TABLE admin_accounts (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
            admin_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(admin_accounts)"))]
        if "role" not in admin_cols:
            conn.execute(text("ALTER TABLE admin_accounts ADD COLUMN role TEXT DEFAULT 'admin'"))
        notes_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(admin_notes)"))]
        if not notes_cols:
            conn.execute(text("CREATE TABLE admin_notes (id INTEGER PRIMARY KEY, admin_id INTEGER NOT NULL, student_id INTEGER NOT NULL, note TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        validations_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(project_validations)"))]
        if not validations_cols:
            conn.execute(text("CREATE TABLE project_validations (id INTEGER PRIMARY KEY, admin_id INTEGER NOT NULL, student_id INTEGER NOT NULL, repo_name TEXT NOT NULL, status TEXT DEFAULT 'pending', comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        activity_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(activity_logs)"))]
        if not activity_cols:
            conn.execute(text("CREATE TABLE activity_logs (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, event TEXT NOT NULL, meta JSON, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        engagement_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(engagement_commits)"))]
        if not engagement_cols:
            conn.execute(text("CREATE TABLE engagement_commits (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, week_start DATETIME NOT NULL, commit_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        learning_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(learning_progress)"))]
        if not learning_cols:
            conn.execute(text("CREATE TABLE learning_progress (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, learning_step TEXT NOT NULL, status TEXT DEFAULT 'todo', completed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        xp_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(xp_history)"))]
        if not xp_cols:
            conn.execute(text("CREATE TABLE xp_history (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, week_start DATETIME NOT NULL, xp_gained INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        login_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(login_activity)"))]
        if not login_cols:
            conn.execute(text("CREATE TABLE login_activity (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, login_timestamp DATETIME NOT NULL, login_date TEXT NOT NULL, login_hour INTEGER NOT NULL, ip_address TEXT, device TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        cert_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(certificate_records)"))]
        if not cert_cols:
            conn.execute(text("CREATE TABLE certificate_records (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, provider TEXT NOT NULL, certificate_url TEXT NOT NULL, status TEXT DEFAULT 'pending', reviewer_id INTEGER, reviewer_note TEXT, submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP, verified_at DATETIME)"))
        plan_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(intervention_plans)"))]
        if not plan_cols:
            conn.execute(text("CREATE TABLE intervention_plans (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, admin_id INTEGER NOT NULL, title TEXT NOT NULL, action_plan TEXT NOT NULL, priority TEXT DEFAULT 'Medium', target_date TEXT, status TEXT DEFAULT 'open', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        review_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(portfolio_reviews)"))]
        if not review_cols:
            conn.execute(text("CREATE TABLE portfolio_reviews (id INTEGER PRIMARY KEY, admin_id INTEGER NOT NULL, student_id INTEGER NOT NULL, status TEXT DEFAULT 'needs_work', summary TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        daily_quest_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(daily_quest_claims)"))]
        if not daily_quest_cols:
            conn.execute(text("CREATE TABLE daily_quest_claims (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, quest_key TEXT NOT NULL, quest_date TEXT NOT NULL, reward_xp INTEGER DEFAULT 0, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        weekly_challenge_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(weekly_challenge_claims)"))]
        if not weekly_challenge_cols:
            conn.execute(text("CREATE TABLE weekly_challenge_claims (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, challenge_key TEXT NOT NULL, week_start TEXT NOT NULL, reward_xp INTEGER DEFAULT 0, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        recommendation_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(recommendation_actions)"))]
        if not recommendation_cols:
            conn.execute(text("CREATE TABLE recommendation_actions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, dimension_key TEXT, module_title TEXT NOT NULL, module_url TEXT NOT NULL, action TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
            recommendation_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(recommendation_actions)"))]
        if "rating" not in recommendation_cols:
            conn.execute(text("ALTER TABLE recommendation_actions ADD COLUMN rating INTEGER"))
        if "feedback" not in recommendation_cols:
            conn.execute(text("ALTER TABLE recommendation_actions ADD COLUMN feedback TEXT"))
        sus_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(sus_survey_responses)"))]
        if not sus_cols:
            conn.execute(text("CREATE TABLE sus_survey_responses (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, score INTEGER NOT NULL, feedback TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"))
        confidence_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(career_confidence_survey_responses)"))]
        if not confidence_cols:
            conn.execute(
                text(
                    "CREATE TABLE career_confidence_survey_responses ("
                    "id INTEGER PRIMARY KEY, "
                    "user_id INTEGER NOT NULL, "
                    "phase TEXT NOT NULL, "
                    "score INTEGER NOT NULL, "
                    "clarity_score INTEGER, "
                    "feedback TEXT, "
                    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
                )
            )

app = FastAPI(title="LSPU AI-Enhanced Gamified Student Portfolio Platform API")

frontend_origins = {
    settings.frontend_url.rstrip("/"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(frontend_origins),
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(analytics.router)
app.include_router(login_analytics.router)


@app.get("/health")
def health():
    backend = engine.url.get_backend_name()
    return {
        "status": "ok",
        "database_backend": backend,
        "production_ready": backend != "sqlite",
    }
