PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS web_auth_schema (
    component TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS web_users (
    user_id TEXT PRIMARY KEY,
    email_normalized TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
    created_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS web_memberships (
    membership_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    license_id TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
    claimed_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES web_users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_web_memberships_user
    ON web_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_web_memberships_customer
    ON web_memberships(customer_id, status);

CREATE TABLE IF NOT EXISTS web_login_challenges (
    challenge_id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL CHECK (purpose IN ('claim', 'login')),
    email_normalized TEXT NOT NULL,
    license_id TEXT,
    customer_id TEXT,
    otp_hash TEXT NOT NULL,
    remember_browser INTEGER NOT NULL CHECK (remember_browser IN (0, 1)),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    delivered_at TEXT,
    consumed_at TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    source_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_web_challenges_email_time
    ON web_login_challenges(email_normalized, created_at);

CREATE TABLE IF NOT EXISTS web_browsers (
    browser_id TEXT PRIMARY KEY,
    membership_id TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (membership_id) REFERENCES web_memberships(membership_id)
);
CREATE INDEX IF NOT EXISTS idx_web_browsers_membership
    ON web_browsers(membership_id, status);

CREATE TABLE IF NOT EXISTS web_sessions (
    session_id TEXT PRIMARY KEY,
    browser_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (browser_id) REFERENCES web_browsers(browser_id)
);
CREATE INDEX IF NOT EXISTS idx_web_sessions_browser
    ON web_sessions(browser_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS web_auth_rate_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    bucket TEXT NOT NULL,
    subject_hash TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_web_rate_subject_time
    ON web_auth_rate_events(bucket, subject_hash, occurred_at);

CREATE TABLE IF NOT EXISTS web_auth_audit (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id TEXT,
    license_id TEXT,
    customer_id TEXT,
    browser_id TEXT,
    source_hash TEXT,
    outcome TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS web_auth_audit_no_update
BEFORE UPDATE ON web_auth_audit
BEGIN SELECT RAISE(ABORT, 'web_auth_audit is append-only'); END;

CREATE TRIGGER IF NOT EXISTS web_auth_audit_no_delete
BEFORE DELETE ON web_auth_audit
BEGIN SELECT RAISE(ABORT, 'web_auth_audit is append-only'); END;

CREATE TABLE IF NOT EXISTS web_enrollment_challenges (
    challenge_id TEXT PRIMARY KEY,
    central_claim_id TEXT NOT NULL UNIQUE,
    license_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    remember_browser INTEGER NOT NULL CHECK (remember_browser IN (0, 1)),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    delivered_at TEXT,
    consumed_at TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    source_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_web_enrollment_challenges_email_time
    ON web_enrollment_challenges(email_normalized, created_at);

CREATE TABLE IF NOT EXISTS web_enrollment_sessions (
    enrollment_session_id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    revoked_at TEXT,
    FOREIGN KEY (challenge_id) REFERENCES web_enrollment_challenges(challenge_id)
);

CREATE TABLE IF NOT EXISTS web_enrollment_completions (
    central_completion_id TEXT PRIMARY KEY,
    central_claim_id TEXT NOT NULL UNIQUE,
    license_id TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    user_id TEXT NOT NULL,
    membership_id TEXT NOT NULL,
    browser_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES web_users(user_id),
    FOREIGN KEY (membership_id) REFERENCES web_memberships(membership_id)
);
