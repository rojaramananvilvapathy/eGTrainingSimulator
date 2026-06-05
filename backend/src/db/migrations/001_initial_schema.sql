-- ============================================================
--  eG Enterprise Simulation Platform — Initial Schema
--  Migration: 001_initial_schema.sql
-- ============================================================

BEGIN;

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM types ──────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('learner', 'admin', 'superadmin');
CREATE TYPE os_type        AS ENUM ('linux', 'windows', 'both');
CREATE TYPE difficulty     AS ENUM ('easy', 'medium', 'hard', 'expert');
CREATE TYPE room_status    AS ENUM ('draft', 'published', 'archived');
CREATE TYPE task_type      AS ENUM ('terminal', 'gui_wizard', 'mcq', 'flag_submit', 'log_analysis');
CREATE TYPE container_status AS ENUM ('starting', 'running', 'stopped', 'error', 'timeout');

-- ════════════════════════════════════════════════════════════
--  USERS
-- ════════════════════════════════════════════════════════════
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username            VARCHAR(50)  NOT NULL UNIQUE,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       TEXT         NOT NULL,
    role                user_role    NOT NULL DEFAULT 'learner',
    display_name        VARCHAR(100),
    avatar_url          TEXT,
    total_points        INTEGER      NOT NULL DEFAULT 0,
    global_rank         INTEGER,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    email_verified      BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_points   ON users(total_points DESC);

-- ════════════════════════════════════════════════════════════
--  ROOMS  (labs / scenarios)
-- ════════════════════════════════════════════════════════════
CREATE TABLE rooms (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug                VARCHAR(120) NOT NULL UNIQUE,
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    os                  os_type      NOT NULL DEFAULT 'linux',
    difficulty          difficulty   NOT NULL DEFAULT 'easy',
    status              room_status  NOT NULL DEFAULT 'draft',
    phase               INTEGER      NOT NULL,            -- maps to roadmap phase 3-6
    category            VARCHAR(100),                    -- 'prerequisites', 'installation', 'configuration', 'troubleshooting'
    component_type      VARCHAR(100),                    -- 'eG Manager', 'eG Agent', 'Citrix', 'VMware', etc.
    yaml_definition     TEXT,                            -- raw YAML room definition
    points_total        INTEGER      NOT NULL DEFAULT 0,
    estimated_minutes   INTEGER      NOT NULL DEFAULT 30,
    docker_image        VARCHAR(200),
    thumbnail_url       TEXT,
    author_id           UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_slug       ON rooms(slug);
CREATE INDEX idx_rooms_status     ON rooms(status);
CREATE INDEX idx_rooms_phase      ON rooms(phase);
CREATE INDEX idx_rooms_category   ON rooms(category);

-- ════════════════════════════════════════════════════════════
--  TASKS  (steps within a room)
-- ════════════════════════════════════════════════════════════
CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id             UUID         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sequence            INTEGER      NOT NULL,
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    task_type           task_type    NOT NULL DEFAULT 'terminal',
    points              INTEGER      NOT NULL DEFAULT 10,
    flag_required       BOOLEAN      NOT NULL DEFAULT TRUE,
    hint_1              TEXT,
    hint_1_cost         INTEGER      NOT NULL DEFAULT 10,
    hint_2              TEXT,
    hint_2_cost         INTEGER      NOT NULL DEFAULT 20,
    hint_3              TEXT,
    hint_3_cost         INTEGER      NOT NULL DEFAULT 30,
    answer_explanation  TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, sequence)
);

CREATE INDEX idx_tasks_room_id  ON tasks(room_id);

-- ════════════════════════════════════════════════════════════
--  FLAGS
-- ════════════════════════════════════════════════════════════
CREATE TABLE flags (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id             UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          UUID         NOT NULL,
    flag_hash           TEXT         NOT NULL,            -- HMAC(user_id||room_id||task_id||secret)
    flag_value          TEXT         NOT NULL,            -- eGSIM{...} display value
    is_captured         BOOLEAN      NOT NULL DEFAULT FALSE,
    captured_at         TIMESTAMPTZ,
    attempts            INTEGER      NOT NULL DEFAULT 0,
    first_blood         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id, session_id)
);

CREATE INDEX idx_flags_task_user   ON flags(task_id, user_id);
CREATE INDEX idx_flags_captured    ON flags(is_captured, captured_at);

-- ════════════════════════════════════════════════════════════
--  USER PROGRESS  (per room)
-- ════════════════════════════════════════════════════════════
CREATE TABLE user_progress (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id             UUID         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    started_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    points_earned       INTEGER      NOT NULL DEFAULT 0,
    hints_used          INTEGER      NOT NULL DEFAULT 0,
    hints_cost          INTEGER      NOT NULL DEFAULT 0,
    current_task_seq    INTEGER      NOT NULL DEFAULT 1,
    is_completed        BOOLEAN      NOT NULL DEFAULT FALSE,
    time_spent_seconds  INTEGER      NOT NULL DEFAULT 0,
    UNIQUE (user_id, room_id)
);

CREATE INDEX idx_progress_user_id  ON user_progress(user_id);
CREATE INDEX idx_progress_room_id  ON user_progress(room_id);

-- ════════════════════════════════════════════════════════════
--  LEADERBOARD  (materialised per room + global)
-- ════════════════════════════════════════════════════════════
CREATE TABLE leaderboard_entries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id             UUID         REFERENCES rooms(id) ON DELETE CASCADE,  -- NULL = global
    rank                INTEGER      NOT NULL,
    points              INTEGER      NOT NULL DEFAULT 0,
    completion_time_s   INTEGER,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, room_id)
);

CREATE INDEX idx_lb_room_rank  ON leaderboard_entries(room_id, rank);
CREATE INDEX idx_lb_global     ON leaderboard_entries(room_id) WHERE room_id IS NULL;

-- ════════════════════════════════════════════════════════════
--  BADGES
-- ════════════════════════════════════════════════════════════
CREATE TABLE badges (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug                VARCHAR(100) NOT NULL UNIQUE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    icon_url            TEXT,
    condition_type      VARCHAR(50)  NOT NULL,   -- 'first_flag', 'room_complete', 'speed', 'streak', etc.
    condition_value     JSONB,                   -- flexible condition params
    points_bonus        INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE user_badges (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id            UUID         NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, badge_id)
);

-- ════════════════════════════════════════════════════════════
--  LAB CONTAINERS  (Docker session tracking)
-- ════════════════════════════════════════════════════════════
CREATE TABLE lab_containers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id             UUID         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    container_id        VARCHAR(80)  NOT NULL UNIQUE,    -- Docker container ID
    container_name      VARCHAR(120),
    status              container_status NOT NULL DEFAULT 'starting',
    host_port           INTEGER,
    started_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_active_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    terminated_at       TIMESTAMPTZ,
    timeout_at          TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_containers_user   ON lab_containers(user_id, status);
CREATE INDEX idx_containers_timeout ON lab_containers(timeout_at) WHERE status = 'running';

-- ════════════════════════════════════════════════════════════
--  HINT USAGE LOG
-- ════════════════════════════════════════════════════════════
CREATE TABLE hint_usage (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id             UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    hint_tier           INTEGER      NOT NULL CHECK (hint_tier IN (1, 2, 3)),
    points_deducted     INTEGER      NOT NULL,
    used_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, task_id, hint_tier)
);

-- ════════════════════════════════════════════════════════════
--  REFRESH TOKENS
-- ════════════════════════════════════════════════════════════
CREATE TABLE refresh_tokens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash          TEXT         NOT NULL UNIQUE,
    expires_at          TIMESTAMPTZ  NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at          TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user  ON refresh_tokens(user_id);

-- ════════════════════════════════════════════════════════════
--  AUDIT LOG
-- ════════════════════════════════════════════════════════════
CREATE TABLE audit_log (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             UUID         REFERENCES users(id) ON DELETE SET NULL,
    action              VARCHAR(100) NOT NULL,
    entity_type         VARCHAR(100),
    entity_id           UUID,
    metadata            JSONB,
    ip_address          INET,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user    ON audit_log(user_id);
CREATE INDEX idx_audit_action  ON audit_log(action, created_at DESC);

-- ════════════════════════════════════════════════════════════
--  updated_at trigger
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rooms_updated_at    BEFORE UPDATE ON rooms    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════
--  SEED — Default badges
-- ════════════════════════════════════════════════════════════
INSERT INTO badges (slug, name, description, condition_type, condition_value, points_bonus) VALUES
('first-flag',       'First Flag',       'Captured your very first flag',                        'first_flag',      '{}',                     50),
('first-install',    'First Install',    'Completed an eG Manager installation lab',              'room_complete',   '{"category":"installation"}', 100),
('prereq-pro',       'Prereq Pro',       'Passed all prerequisite labs without hints',            'no_hints_room',   '{"category":"prerequisites"}', 150),
('log-whisperer',    'Log Whisperer',    'Solved a log analysis challenge on first attempt',      'first_attempt',   '{"category":"troubleshooting"}', 200),
('speed-demon',      'Speed Demon',      'Completed a room in under half the estimated time',     'speed',           '{"multiplier":0.5}',     250),
('first-blood',      'First Blood',      'First globally to capture a flag in a room',            'first_blood',     '{}',                     300),
('troubleshooter',   'Troubleshooter',   'Completed all troubleshooting labs',                    'all_in_category', '{"category":"troubleshooting"}', 500),
('eG-master',        'eG Master',        'Completed every room in the platform',                  'all_rooms',       '{}',                    1000);

COMMIT;
