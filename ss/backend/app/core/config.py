from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "local"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    database_url: str
    database_sslmode: str | None = None
    jwt_secret: str
    jwt_issuer: str = "devpath"

    github_client_id: str
    github_client_secret: str
    github_redirect_uri: str

    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-70b-versatile"
    inference_mode: str = "groq"
    admin_usernames: str | None = None
    admin_login_username: str | None = None
    admin_login_password: str | None = None
    faculty_login_username: str | None = None
    faculty_login_password: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
