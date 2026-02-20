-- ActivityLogs table for tracking report execution history
-- Run this on ReportCenterDB

CREATE TABLE ActivityLogs (
    LogId INT PRIMARY KEY IDENTITY(1,1),
    UserId INT FOREIGN KEY REFERENCES Users(UserId),
    ReportId INT FOREIGN KEY REFERENCES Reports(ReportId),
    CompanyId INT,
    ActionType NVARCHAR(50) NOT NULL, -- 'EXECUTE_REPORT', 'EXPORT_EXCEL', etc.
    Details NVARCHAR(500),
    CreatedAt DATETIME DEFAULT GETDATE()
);

CREATE INDEX IX_ActivityLogs_CreatedAt ON ActivityLogs(CreatedAt DESC);
CREATE INDEX IX_ActivityLogs_UserId ON ActivityLogs(UserId);
