"""Application settings loaded from environment variables via pydantic-settings."""
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_env: str = "development"
    # Bind loopback by default — set APP_HOST=0.0.0.0 explicitly for LAN/demo
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    log_level: str = "INFO"
    log_format: str = ""  # "json" | "text" | "" = auto (json in prod, text otherwise)

    # Database
    database_url: str
    database_pool_min: int = 2
    database_pool_max: int = 10
    database_pool_timeout: int = 30
    # Below Aiven's ~300s idle firewall cutoff so the pool recycles broken sockets
    database_pool_max_inactive_lifetime: float = 240.0
    # Retry connect on startup (seconds between attempts, max attempts)
    database_startup_retry_delay: float = 2.0
    database_startup_retry_max: int = 5

    # Auth
    mfa_enabled: bool = False  # Phase 2 feature — off by default until migration 002 is applied
    bcrypt_rounds: int = 12
    # Ed25519 approval signing — PEM string; empty = auto-generate + persist to backend/keys/
    ed25519_private_key_pem: str = ""
    # Approval signing algorithm: "ed25519" (default) or "ml-dsa-65" (FIPS 204
    # post-quantum, roadmap F-15 — requires the dilithium-py package)
    approval_signing_algorithm: str = "ed25519"

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    approval_token_expire_minutes: int = 5
    override_token_expire_minutes: int = 10

    # AI Scoring
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"   # use flash for higher accuracy if needed
    gemini_max_output_tokens: int = 512            # JSON response is ~200 tokens; 512 is safe headroom
    gemini_temperature: float = 0.1
    demo_mode: bool = False

    # Risk Thresholds
    risk_low_max: int = 30
    risk_medium_max: int = 70

    # Behavioral Drift (Phase 2 F-10)
    drift_min_sessions: int = 20  # TRD §18.1 — baseline needs ≥20 sessions

    # Rate limiting (Phase 3 hardening — login/commands limits further below)
    rate_limit_global_per_minute: int = 120

    # C2 Integration Proxy (MVP feature 11)
    c2_proxy_api_key: str = ""  # empty = proxy disabled
    c2_service_username: str = "c2_gateway"

    # Constellation Correlation (Phase 2 F-11)
    constellation_enabled: bool = True
    constellation_elevation_minutes: int = 30  # TRD §18.2 elevation window
    redis_url: str = ""  # e.g. redis://localhost:6379/0 — empty = in-process simulator
    # Identity of THIS instance (one SCSP per satellite); peers are the rest
    satellite_id: str = "SAT_ALPHA"

    # OBC
    obc_host: str = "127.0.0.1"
    obc_port: int = 9000
    obc_timeout_ms: int = 500
    obc_enabled: bool = True

    # Replay Detection
    replay_nonce_window_size: int = 100
    replay_sequence_window_seconds: int = 60

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Rate Limiting
    rate_limit_login_per_minute: int = 5
    rate_limit_commands_per_minute: int = 60

    # Request limits
    max_request_body_bytes: int = 64 * 1024  # 64 KB hard limit

    # WebSocket
    ws_max_connections_per_ip: int = 5

    @field_validator("jwt_secret_key")
    @classmethod
    def _require_strong_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters — "
                "generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v

    @model_validator(mode="after")
    def _validate_env_consistency(self) -> "Settings":
        if not self.demo_mode and not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY required when DEMO_MODE=false")
        return self

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()  # type: ignore[call-arg]  # pydantic-settings loads required fields from env
