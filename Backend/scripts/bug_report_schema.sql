-- =====================================================
-- BUG/ISSUE REPORT SYSTEM - DATABASE SCHEMA
-- =====================================================

-- =====================================================
-- 1. PROJECT FUNCTIONS TABLE
-- =====================================================
-- Stores all functions/modules associated with a project
-- Allows linking bugs to specific areas of the system
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'project_functions')
BEGIN
    CREATE TABLE test_case_manager.dbo.project_functions (
        id INT PRIMARY KEY IDENTITY(1,1),
        project_id INT NOT NULL,
        function_name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        function_category NVARCHAR(100), -- e.g., 'UI', 'Backend', 'API', 'Database', 'Integration'
        created_by INT,
        updated_by INT,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        is_archived BIT DEFAULT 0,
        
        FOREIGN KEY (project_id) REFERENCES test_case_manager.dbo.projects(id),
        FOREIGN KEY (created_by) REFERENCES test_case_manager.dbo.users(id),
        FOREIGN KEY (updated_by) REFERENCES test_case_manager.dbo.users(id),
        
        INDEX idx_project_id (project_id),
        INDEX idx_is_archived (is_archived)
    );
END;

-- =====================================================
-- 2. BUG REPORTS TABLE (Main Table)
-- =====================================================
-- Stores bug/issue reports with comprehensive tracking
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bug_reports')
BEGIN
    CREATE TABLE test_case_manager.dbo.bug_reports (
        id INT PRIMARY KEY IDENTITY(1,1),
        report_id NVARCHAR(50) UNIQUE NOT NULL, -- e.g., BUG-001, for easy reference
        project_id INT NOT NULL,
        project_function_id INT NOT NULL,
        sprint_id INT, -- Current sprint where bug is being tracked
        title NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NOT NULL, -- Bug scenario/reproduction steps
        severity NVARCHAR(20) DEFAULT 'Medium', -- Critical, High, Medium, Low
        status NVARCHAR(20) DEFAULT 'Open', -- Open, In Progress, Reopened, Resolved, Closed
        priority INT DEFAULT 3, -- 1=Highest, 5=Lowest
        
        -- Reporter and Assignment
        reported_by INT NOT NULL,
        assigned_to INT,
        assigned_date DATETIME,
        
        -- Dates
        first_reported_date DATETIME DEFAULT GETDATE(),
        target_resolution_date DATETIME,
        actual_resolution_date DATETIME,
        
        -- Environment Info
        environment NVARCHAR(100), -- Dev, QA, Staging, Production
        affected_version NVARCHAR(50),
        
        -- Status tracking
        current_cycle_status NVARCHAR(20), -- Pass, Fail, Blocked, No Test
        
        -- Metadata
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        created_by INT,
        updated_by INT,
        is_archived BIT DEFAULT 0,
        
        FOREIGN KEY (project_id) REFERENCES test_case_manager.dbo.projects(id),
        FOREIGN KEY (project_function_id) REFERENCES test_case_manager.dbo.project_functions(id),
        FOREIGN KEY (sprint_id) REFERENCES test_case_manager.dbo.sprints(id),
        FOREIGN KEY (reported_by) REFERENCES test_case_manager.dbo.users(id),
        FOREIGN KEY (assigned_to) REFERENCES test_case_manager.dbo.users(id),
        FOREIGN KEY (created_by) REFERENCES test_case_manager.dbo.users(id),
        FOREIGN KEY (updated_by) REFERENCES test_case_manager.dbo.users(id),
        
        INDEX idx_project_id (project_id),
        INDEX idx_sprint_id (sprint_id),
        INDEX idx_status (status),
        INDEX idx_severity (severity),
        INDEX idx_reported_by (reported_by),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_report_id (report_id),
        INDEX idx_is_archived (is_archived)
    );
END;

-- =====================================================
-- 3. BUG HISTORY TABLE (Cycle Iterations)
-- =====================================================
-- Tracks bug status changes across different sprint cycles
-- Allows visualization of: Pass -> Fail -> Pass pattern
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bug_history')
BEGIN
    CREATE TABLE test_case_manager.dbo.bug_history (
        id INT PRIMARY KEY IDENTITY(1,1),
        bug_report_id INT NOT NULL,
        sprint_id INT NOT NULL,
        cycle_number INT NOT NULL, -- 1st cycle, 2nd cycle, etc.
        
        -- Status in this cycle
        status NVARCHAR(20), -- Pass, Fail, Blocked, No Test, Reopened
        status_reason NVARCHAR(MAX), -- Why it failed/passed/blocked
        tested_by INT,
        test_date DATETIME,
        
        -- Comments/Notes for this cycle
        notes NVARCHAR(MAX),
        
        -- Metadata
        created_at DATETIME DEFAULT GETDATE(),
        created_by INT,
        
        FOREIGN KEY (bug_report_id) REFERENCES test_case_manager.dbo.bug_reports(id) ON DELETE CASCADE,
        FOREIGN KEY (sprint_id) REFERENCES test_case_manager.dbo.sprints(id),
        FOREIGN KEY (tested_by) REFERENCES test_case_manager.dbo.users(id),
        FOREIGN KEY (created_by) REFERENCES test_case_manager.dbo.users(id),
        
        INDEX idx_bug_report_id (bug_report_id),
        INDEX idx_sprint_id (sprint_id),
        INDEX idx_status (status)
    );
END;

-- =====================================================
-- 4. BUG SCREENSHOTS TABLE
-- =====================================================
-- Stores multiple screenshots for a single bug report
-- Each bug can have multiple screenshots showing different aspects
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bug_screenshots')
BEGIN
    CREATE TABLE test_case_manager.dbo.bug_screenshots (
        id INT PRIMARY KEY IDENTITY(1,1),
        bug_report_id INT NOT NULL,
        screenshot_path NVARCHAR(500) NOT NULL,
        screenshot_name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX), -- What this screenshot shows
        screenshot_order INT DEFAULT 0, -- Order of display
        created_at DATETIME DEFAULT GETDATE(),
        created_by INT,
        
        FOREIGN KEY (bug_report_id) REFERENCES test_case_manager.dbo.bug_reports(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES test_case_manager.dbo.users(id),
        
        INDEX idx_bug_report_id (bug_report_id)
    );
END;

-- =====================================================
-- 5. BUG COMMENTS TABLE
-- =====================================================
-- Allows team members to add comments/discussions on bugs
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bug_comments')
BEGIN
    CREATE TABLE test_case_manager.dbo.bug_comments (
        id INT PRIMARY KEY IDENTITY(1,1),
        bug_report_id INT NOT NULL,
        comment NVARCHAR(MAX) NOT NULL,
        commented_by INT NOT NULL,
        is_system BIT DEFAULT 0, -- System-generated comments (status changes, etc.)
        created_at DATETIME DEFAULT GETDATE(),
        
        FOREIGN KEY (bug_report_id) REFERENCES test_case_manager.dbo.bug_reports(id) ON DELETE CASCADE,
        FOREIGN KEY (commented_by) REFERENCES test_case_manager.dbo.users(id),
        
        INDEX idx_bug_report_id (bug_report_id),
        INDEX idx_created_at (created_at)
    );
END;

-- =====================================================
-- 6. BUG AUDIT TRAIL TABLE
-- =====================================================
-- Tracks all changes to bug reports for compliance and history
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bug_audit')
BEGIN
    CREATE TABLE test_case_manager.dbo.bug_audit (
        id INT PRIMARY KEY IDENTITY(1,1),
        bug_report_id INT NOT NULL,
        action_type NVARCHAR(50), -- Created, Updated, Status Changed, Assigned, etc.
        field_name NVARCHAR(100),
        old_value NVARCHAR(MAX),
        new_value NVARCHAR(MAX),
        changed_by INT,
        changed_at DATETIME DEFAULT GETDATE(),
        
        FOREIGN KEY (bug_report_id) REFERENCES test_case_manager.dbo.bug_reports(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES test_case_manager.dbo.users(id),
        
        INDEX idx_bug_report_id (bug_report_id),
        INDEX idx_changed_at (changed_at),
        INDEX idx_action_type (action_type)
    );
END;

-- =====================================================
-- SUMMARY TABLE for REPORTING
-- =====================================================
-- Optional: Pre-computed view for faster reporting
-- Shows bug status across all cycles in a single sprint
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bug_report_summary')
BEGIN
    CREATE TABLE test_case_manager.dbo.bug_report_summary (
        id INT PRIMARY KEY IDENTITY(1,1),
        bug_report_id INT NOT NULL,
        sprint_id INT NOT NULL,
        pass_count INT DEFAULT 0,
        fail_count INT DEFAULT 0,
        blocked_count INT DEFAULT 0,
        no_test_count INT DEFAULT 0,
        latest_status NVARCHAR(20),
        latest_status_date DATETIME,
        
        FOREIGN KEY (bug_report_id) REFERENCES test_case_manager.dbo.bug_reports(id),
        FOREIGN KEY (sprint_id) REFERENCES test_case_manager.dbo.sprints(id),
        
        UNIQUE (bug_report_id, sprint_id),
        INDEX idx_sprint_id (sprint_id)
    );
END;

-- Backfill summaries for history rows created before the summary table existed.
MERGE test_case_manager.dbo.bug_report_summary AS target
USING (
    SELECT
        bug_report_id,
        sprint_id,
        SUM(CASE WHEN status = 'Pass' THEN 1 ELSE 0 END) AS pass_count,
        SUM(CASE WHEN status = 'Fail' THEN 1 ELSE 0 END) AS fail_count,
        SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) AS blocked_count,
        SUM(CASE WHEN status = 'No Test' THEN 1 ELSE 0 END) AS no_test_count,
        MAX(CASE WHEN cycle_number = latest_cycle THEN status END) AS latest_status,
        MAX(CASE WHEN cycle_number = latest_cycle THEN created_at END) AS latest_status_date
    FROM (
        SELECT bh.*, MAX(cycle_number) OVER (PARTITION BY bug_report_id, sprint_id) AS latest_cycle
        FROM test_case_manager.dbo.bug_history bh
    ) history
    GROUP BY bug_report_id, sprint_id
) AS source
ON target.bug_report_id = source.bug_report_id AND target.sprint_id = source.sprint_id
WHEN MATCHED THEN UPDATE SET
    pass_count = source.pass_count,
    fail_count = source.fail_count,
    blocked_count = source.blocked_count,
    no_test_count = source.no_test_count,
    latest_status = source.latest_status,
    latest_status_date = source.latest_status_date
WHEN NOT MATCHED THEN INSERT
    (bug_report_id, sprint_id, pass_count, fail_count, blocked_count, no_test_count, latest_status, latest_status_date)
VALUES
    (source.bug_report_id, source.sprint_id, source.pass_count, source.fail_count, source.blocked_count, source.no_test_count, source.latest_status, source.latest_status_date);

PRINT 'Bug Report System Schema Created Successfully!';
