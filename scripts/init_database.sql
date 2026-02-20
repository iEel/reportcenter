-- db-init.sql - ReportCenter Database Schema

-- 1. Roles (กลุ่มสิทธิ์การใช้งาน)
CREATE TABLE Roles (
    RoleId INT PRIMARY KEY IDENTITY(1,1),
    RoleName NVARCHAR(100) NOT NULL -- e.g. 'Admin', 'Sales', 'Accountant', 'Manager'
);

-- 2. Users (ผู้ใช้งานระบบ)
CREATE TABLE Users (
    UserId INT PRIMARY KEY IDENTITY(1,1),
    Username NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(150),
    CompanyId INT, -- e.g. 1, 2, or 3
    RoleId INT FOREIGN KEY REFERENCES Roles(RoleId), 
    IsActive BIT DEFAULT 1
);

-- 3. Reports (ข้อมูลรายงานและ T-SQL)
CREATE TABLE Reports (
    ReportId INT PRIMARY KEY IDENTITY(1,1),
    ReportName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    ReportType INT DEFAULT 1, -- 1 = Normal Report, 2 = Template (Drag&Drop)
    TSqlQuery NVARCHAR(MAX) NOT NULL,
    EmailTemplateContent NVARCHAR(MAX) NULL, 
    IsPublic BIT DEFAULT 0, -- 0 = Role based, 1 = Public
    IsActive BIT DEFAULT 1
);

-- 4. ReportRoleMapping (ตารางตรงกลางสำหรับจับคู่ Report ไปหา Role)
CREATE TABLE ReportRoleMapping (
    ReportId INT FOREIGN KEY REFERENCES Reports(ReportId),
    RoleId INT FOREIGN KEY REFERENCES Roles(RoleId),
    PRIMARY KEY (ReportId, RoleId)
);

-- 5. ReportParameters (ช่องกรอกเงื่อนไขก่อนรัน T-SQL)
CREATE TABLE ReportParameters (
    ParameterId INT PRIMARY KEY IDENTITY(1,1),
    ReportId INT FOREIGN KEY REFERENCES Reports(ReportId),
    ParameterName NVARCHAR(50) NOT NULL, -- e.g. '@StartDate', '@Category'
    DisplayLabel NVARCHAR(100) NOT NULL, -- e.g. 'วันที่เริ่มต้น', 'หมวดหมู่'
    InputType NVARCHAR(20) NOT NULL, -- e.g. 'date', 'text', 'dropdown'
    DropdownQuery NVARCHAR(MAX) NULL, 
    OrderIndex INT DEFAULT 0
);

-- Insert Sample Data
INSERT INTO Roles (RoleName) VALUES ('Admin'), ('Sales'), ('Accountant');
INSERT INTO Users (Username, PasswordHash, FullName, CompanyId, RoleId, IsActive) 
VALUES ('admin', 'hashed_pwd', 'System Admin', 1, 1, 1);

INSERT INTO Reports (ReportName, Description, ReportType, TSqlQuery, IsPublic, IsActive)
VALUES 
('Sale Order Report', 'Report showing standard sale orders', 1, 'SELECT DocNo, DocDate, TotalAmount FROM SaleOrders WHERE DocDate >= @StartDate AND DocDate <= @EndDate', 0, 1),
('Customer Tracking Alert', 'Advanced report to alert customers via email', 2, 'SELECT CustomerName, Phone, NextFollowUpDate FROM Customers WHERE NextFollowUpDate = @TargetDate', 0, 1);

INSERT INTO ReportRoleMapping (ReportId, RoleId) VALUES (1, 2), (2, 2);

INSERT INTO ReportParameters (ReportId, ParameterName, DisplayLabel, InputType, OrderIndex)
VALUES 
(1, '@StartDate', 'วันที่เริ่มต้น', 'date', 1),
(1, '@EndDate', 'วันที่สิ้นสุด', 'date', 2),
(2, '@TargetDate', 'วันที่นัดหมาย', 'date', 1);
