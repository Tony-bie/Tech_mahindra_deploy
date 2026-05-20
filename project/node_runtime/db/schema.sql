-- =============================================
-- TechMahindra PMS — Schema Reference
-- Matches Supabase production tables
-- =============================================

-- Users and authentication
CREATE TABLE IF NOT EXISTS users (
    id_user SERIAL PRIMARY KEY,
    email VARCHAR(255),
    username VARCHAR(255),
    password_hash VARCHAR(255),
    full_name TEXT,
    status VARCHAR(50),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role (
    id_role SERIAL PRIMARY KEY,
    id_user INT REFERENCES users(id_user) ON DELETE CASCADE,
    status VARCHAR(50) -- 'admin', 'pm', 'viewer'
);

-- Projects
CREATE TABLE IF NOT EXISTS project (
    id_project SERIAL PRIMARY KEY,
    id_pm INT REFERENCES users(id_user),
    project_name VARCHAR(255),
    description VARCHAR(500),
    deadline TIMESTAMP,
    start_date TIMESTAMP,
    client_name VARCHAR(255),
    estimated_sp INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Project members (viewers linked to projects)
CREATE TABLE IF NOT EXISTS project_member (
    id_member SERIAL PRIMARY KEY,
    id_project INT REFERENCES project(id_project) ON DELETE CASCADE,
    id_user INT REFERENCES users(id_user) ON DELETE CASCADE
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id_audit SERIAL PRIMARY KEY,
    id_user INT REFERENCES users(id_user),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Blockers & Implications (HU-13)
CREATE TABLE IF NOT EXISTS blocker_implication (
    id_blocker SERIAL PRIMARY KEY,
    id_work_item INT NOT NULL REFERENCES work_item(id_work_item) ON DELETE CASCADE,
    id_project INT NOT NULL REFERENCES project(id_project) ON DELETE CASCADE,
    kind VARCHAR(50) NOT NULL CHECK (kind IN ('blocker', 'implication')),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'critical')),
    description TEXT NOT NULL,
    impact TEXT NOT NULL,
    created_by INT NOT NULL REFERENCES users(id_user),
    created_at TIMESTAMP DEFAULT NOW(),
    approved_by INT REFERENCES users(id_user),
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    rejected_reason TEXT,
    decided_at TIMESTAMP,
    deadline TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by INT REFERENCES users(id_user)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_member_user ON project_member(id_user);
CREATE INDEX IF NOT EXISTS idx_project_member_project ON project_member(id_project);
CREATE INDEX IF NOT EXISTS idx_role_user ON role(id_user);
CREATE INDEX IF NOT EXISTS idx_blocker_work_item ON blocker_implication(id_work_item);
CREATE INDEX IF NOT EXISTS idx_blocker_project ON blocker_implication(id_project);
CREATE INDEX IF NOT EXISTS idx_blocker_status ON blocker_implication(approval_status);
CREATE INDEX IF NOT EXISTS idx_blocker_severity ON blocker_implication(severity);
CREATE INDEX IF NOT EXISTS idx_blocker_created_by ON blocker_implication(created_by);
