# ReportCenter — Developer Handoff

> **Version:** 6.0  
> **Last Updated:** 2026-02-24  
> **Tech Stack:** Next.js 16.1.6 + React 19 + Tailwind CSS 4 + MSSQL (mssql driver) + Microsoft Graph API (OAuth2) / Nodemailer (SMTP fallback) + @azure/msal-node

---

## 1. Quick Start

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build && npm start
```

### Default Login Credentials

| Username | Password    | Role  |
|----------|-------------|-------|
| `admin`  | `admin1234` | Admin |

> ⚠️ Password ต้องเป็น **bcrypt hash** ใน DB — ใช้ `node scripts/hash-password.js <password>` เพื่อสร้าง hash

---

## 2. Project Structure

```
reportcenter/
├── .env.local                           # Environment variables (DB creds, JWT secret)
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (HTML/Body only)
│   │   ├── globals.css                   # Global CSS + Dark mode + Print styles
│   │   ├── login/
│   │   │   └── page.tsx                  # Login page (fullscreen, no sidebar)
│   │   ├── (dashboard)/                  # Route Group — wrapped with AppLayout
│   │   │   ├── layout.tsx                # Dashboard layout (Sidebar + Header + Toast + Confirm + ErrorBoundary)
│   │   │   ├── page.tsx                  # Home Dashboard (stats + activity feed)
│   │   │   ├── change-password/page.tsx  # Change password page (all users)
│   │   │   ├── admin/
│   │   │   │   ├── reports/
│   │   │   │   │   ├── page.tsx          # Manage Reports list (search/filter)
│   │   │   │   │   ├── new/page.tsx      # Create new report
│   │   │   │   │   └── [id]/edit/page.tsx # Edit existing report
│   │   │   │   ├── users/page.tsx        # Manage Users (search/filter/stats/pagination/delete/reset-pw)
│   │   │   │   ├── roles/page.tsx        # Manage Roles + Report access assignment
│   │   │   │   ├── audit-logs/page.tsx   # Audit Log Viewer (paginated)
│   │   │   │   ├── schedules/page.tsx    # Scheduled Reports (create/edit/toggle/delete)
│   │   │   │   └── settings/page.tsx     # System Settings
│   │   │   └── reports/
│   │   │       ├── standard/page.tsx     # Standard report viewer (★ favorites)
│   │   │       └── templates/page.tsx    # Email template report viewer (★ favorites)
│   │   └── api/                          # API Routes (all .js)
│   │       ├── auth/
│   │       │   ├── login/route.js        # POST: login with bcrypt + allowedCompanies
│   │       │   ├── logout/route.js       # POST: clear cookie
│   │       │   ├── me/route.js           # GET: current user from JWT
│   │       │   └── change-password/route.js # PUT: change password (bcrypt verify + update)
│   │       ├── dashboard/route.js        # GET: stats + activity logs
│   │       ├── notifications/route.js    # GET: user notifications, PUT: mark read
│   │       ├── admin/
│   │       │   ├── reports/
│   │       │   │   ├── route.js          # GET: list, POST: create
│   │       │   │   └── [id]/route.js     # GET/PUT/DELETE single report
│   │       │   ├── users/route.js        # GET/POST/PUT/DELETE users & roles + company mappings
│   │       │   ├── users/reset-password/route.js # POST: admin reset user password
│   │       │   ├── roles/route.js        # GET/POST/PUT/DELETE roles + ReportRoleMapping
│   │       │   ├── audit-logs/route.js   # GET: paginated audit logs
│   │       │   ├── schedules/route.js    # GET/POST/PUT/DELETE schedules
│   │       │   └── settings/route.js     # GET/PUT system settings
│   │       ├── cron/
│   │       │   └── execute-schedules/route.js # GET: cron endpoint (runs due reports → email)
│   │       ├── settings/
│   │       │   └── idle-timeout/route.js    # GET: idle timeout setting (any logged-in user)
│   │       └── reports/
│   │           ├── available/route.js    # GET: reports user can access
│   │           ├── execute/route.js      # POST: run T-SQL on company DB (supports pagination + exportAll)
│   │           ├── parameters/route.js   # GET: report parameters (auto-migrate LookupQuery column)
│   │           ├── search-param/route.js # GET: typeahead search for parameters with LookupQuery
│   │           └── favorites/route.js    # GET/POST: toggle favorite reports
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx             # Sidebar + Header wrapper + AuthProvider
│   │   │   ├── Sidebar.tsx               # Mobile responsive + role menus + conditional report menus
│   │   │   └── Header.tsx                # Dark mode toggle + Notification bell + dropdown
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx          # React Context for user session + allowedCompanies + availableReportTypes
│   │   │   ├── ToastProvider.tsx         # Toast notification system (success/error/info)
│   │   │   ├── ConfirmProvider.tsx       # Custom confirm dialog (danger/warning/default)
│   │   │   └── IdleTimeoutProvider.tsx   # Session idle timeout detection + warning modal
│   │   ├── ErrorBoundary.tsx             # Global error boundary
│   │   ├── Skeletons.tsx                 # Reusable loading skeletons
│   │   ├── TypeaheadInput.tsx            # Debounced server-side search input (for parameters with LookupQuery)
│   │   └── TemplateEditor.tsx            # Click-to-Insert email template editor
│   ├── lib/
│   │   ├── auth.js                       # JWT sign/verify (jose) + getSession()
│   │   ├── db.js                         # MSSQL connection pool manager
│   │   ├── email.js                      # Email sender (Microsoft Graph API primary + SMTP password fallback)
│   │   ├── sql-validator.js              # SQL query security validator (blocklist DML/DDL/metadata/procs)
│   │   └── dateUtils.ts                  # Date/time utilities (Asia/Bangkok, 24h)
│   └── middleware.ts                     # Route protection (JWT check)
├── scripts/
│   ├── init_database.sql                 # Initial DB schema
│   ├── create_activity_logs.sql          # ActivityLogs table DDL
│   ├── create-activity-logs.js           # Run creation via Node
│   ├── hash-password.js                  # Utility: hash password
│   ├── update-admin-password.js          # Utility: update admin pw in DB
│   └── fix-reports.js                    # Legacy fix script
└── package.json
```

---

## 3. Architecture

### Authentication Flow

```
User → /login → POST /api/auth/login
                    ↓ bcrypt compare
                    ↓ signToken(jose) → payload: { userId, username, roleId, roleName, allowedCompanies }
                    ↓ Set cookie "rc_token" (httpOnly, 8h)
                    ↓ redirect to /

Every request → middleware.ts
                    ↓ Read cookie → jwtVerify
                    ↓ Valid? → NextResponse.next()
                    ↓ Invalid/Missing? → redirect /login
```

### Multi-Company Access Control

```
UserCompanyMapping (UserId, CompanyId)
    ↓ Login → JWT payload includes allowedCompanies: [1, 2, 3]
    ↓ /api/auth/me → returns allowedCompanies
    ↓ Report pages → company dropdown filtered by allowedCompanies
    ↓ Admin users page → checkboxes to assign companies per user
```

### Database Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  ReportCenterDB  │     │  Company DBs     │
│  (Central)       │     │                  │
│                  │     │  1. SONIC2021     │
│  - Users         │     │  2. GLEDB2014    │
│  - Roles         │     │  3. SMF-AUTO..   │
│  - Reports       │     │                  │
│  - ReportParams  │     │  (T-SQL executed │
│  - ReportRoleMap │     │   dynamically)   │
│  - UserCompanyMap│     │                  │
│  - ActivityLogs  │     │                  │
│  - UserFavorites │     │                  │
│  - Notifications │     │                  │
│  - SystemSettings│     │                  │
│  - ReportSchedules│    │                  │
└──────────────────┘     └──────────────────┘
```

---

## 4. Database Schema (ReportCenterDB)

| Table                | Purpose                                      |
|----------------------|----------------------------------------------|
| `Roles`              | Role definitions (Admin, Sales, Accountant)  |
| `Users`              | User accounts with PasswordHash, RoleId      |
| `Reports`            | Report definitions with T-SQL query          |
| `ReportParameters`   | Dynamic parameters (date, text, number)      |
| `ReportRoleMapping`  | Many-to-many: which roles can see which report |
| `UserCompanyMapping` | Many-to-many: which users can access which company DBs |
| `ActivityLogs`       | Audit trail: all system actions + change diff (ChangeData JSON) |
| `UserFavorites`      | User's pinned/favorite reports (auto-created) |
| `Notifications`      | In-app notification messages (auto-created)  |
| `SystemSettings`     | Key-value config (company names, app settings)|
| `ReportSchedules`    | Scheduled report runs + email config (auto-created) |

### Key Columns

```sql
-- Users
UserId INT PK, Username NVARCHAR(50) UNIQUE, PasswordHash NVARCHAR(255),
FullName NVARCHAR(150), CompanyId INT, RoleId INT FK, IsActive BIT

-- Reports
ReportId INT PK, ReportName NVARCHAR(200), Description NVARCHAR(500),
ReportType INT (1=Standard, 2=Template), TSqlQuery NVARCHAR(MAX),
EmailTemplateContent NVARCHAR(MAX), IsPublic BIT, IsActive BIT

-- ReportParameters
ParameterId INT PK IDENTITY, ReportId INT FK, ParameterName NVARCHAR(50),
DisplayLabel NVARCHAR(100), InputType NVARCHAR(20), DropdownQuery NVARCHAR(MAX) NULL,
LookupQuery NVARCHAR(MAX) NULL (auto-migrated), OrderIndex INT

-- UserCompanyMapping
UserId INT, CompanyId INT, PRIMARY KEY (UserId, CompanyId)

-- UserFavorites (auto-created on first API call)
UserId INT, ReportId INT, CreatedAt DATETIME, PRIMARY KEY (UserId, ReportId)

-- Notifications (auto-created on first API call)
NotificationId INT PK IDENTITY, UserId INT NULL (NULL = broadcast),
Title NVARCHAR(200), Message NVARCHAR(500), Type NVARCHAR(20), IsRead BIT

-- ReportSchedules (auto-created on first API call)
ScheduleId INT PK IDENTITY, ReportId INT FK, ScheduleName NVARCHAR(200),
Frequency NVARCHAR(20), DayOfWeek INT NULL, DayOfMonth INT NULL,
RunTime NVARCHAR(5), CompanyId INT, Parameters NVARCHAR(MAX) NULL,
EmailTo NVARCHAR(500), EmailCc NVARCHAR(500) NULL, EmailSubject NVARCHAR(300) NULL,
IsActive BIT, LastRunAt DATETIME NULL, LastRunStatus NVARCHAR(20) NULL,
NextRunAt DATETIME NULL, CreatedBy INT, CreatedAt/UpdatedAt DATETIME

-- ActivityLogs
LogId INT PK IDENTITY, UserId INT NULL, ReportId INT NULL, CompanyId INT NULL,
ActionType NVARCHAR(50), Details NVARCHAR(MAX), ChangeData NVARCHAR(MAX) NULL (JSON: old/new values),
CreatedAt DATETIME DEFAULT GETDATE()
```

---

## 5. API Reference

### Auth

| Method | Path                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| POST   | `/api/auth/login`           | Login, returns JWT cookie + logs LOGIN/LOGIN_FAIL activity |
| POST   | `/api/auth/logout`          | Clear JWT cookie + logs LOGOUT activity          |
| GET    | `/api/auth/me`              | Get current user + allowedCompanies  |
| PUT    | `/api/auth/change-password` | Change password (verify current first) + logs CHANGE_PASSWORD |

### Reports (User-facing)

| Method | Path                        | Description                       |
|--------|-----------------------------|-----------------------------------|
| GET    | `/api/reports/available`    | List reports user can access      |
| GET    | `/api/reports/parameters`   | Get parameters for a report (incl. `LookupQuery`)       |
| POST   | `/api/reports/execute`      | Execute T-SQL on company DB (handles ORDER BY in pagination) |
| GET    | `/api/reports/search-param` | Typeahead search for parameter values (`?reportId=&paramName=&q=&companyId=`) |
| GET    | `/api/reports/favorites`    | Get user's favorite reports       |
| POST   | `/api/reports/favorites`    | Toggle favorite (add/remove)      |

### Admin

| Method | Path                         | Description                       |
|--------|------------------------------|-----------------------------------|
| GET    | `/api/admin/reports`         | List all reports                  |
| POST   | `/api/admin/reports`         | Create report + params            |
| GET    | `/api/admin/reports/[id]`    | Get single report + roles         |
| PUT    | `/api/admin/reports/[id]`    | Update report + roles             |
| DELETE | `/api/admin/reports/[id]`    | Soft-delete (IsActive=0)          |
| GET    | `/api/admin/users`           | List users + roles + allowedCompanies |
| POST   | `/api/admin/users`           | Create user (bcrypt hash) + company mappings + logs CREATE_USER |
| PUT    | `/api/admin/users`           | Update user + company mappings + logs UPDATE_USER |
| DELETE | `/api/admin/users`           | Delete user + cleanup mappings/favorites + logs DELETE_USER |
| POST   | `/api/admin/users/reset-password` | Admin reset user password (no old pw required) + logs RESET_PASSWORD |
| GET    | `/api/admin/audit-logs`      | Paginated audit logs + ChangeData JSON (?page=&limit=) |
| GET    | `/api/admin/roles`           | List roles + user count + assigned reports |
| POST   | `/api/admin/roles`           | Create role + report mappings    |
| PUT    | `/api/admin/roles`           | Update role name + report mappings |
| DELETE | `/api/admin/roles?roleId=`   | Delete role (blocked if users assigned) |
| GET    | `/api/admin/schedules`       | List all schedules + report/user info |
| POST   | `/api/admin/schedules`       | Create schedule + logs CREATE_SCHEDULE |
| PUT    | `/api/admin/schedules`       | Update schedule + logs UPDATE_SCHEDULE |
| DELETE | `/api/admin/schedules?scheduleId=` | Delete schedule + logs DELETE_SCHEDULE |
| PATCH  | `/api/admin/schedules`       | Manual trigger: run schedule immediately → email |
| GET    | `/api/admin/settings`        | Get all settings                  |
| PUT    | `/api/admin/settings`        | Update settings                   |

### Notifications

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | `/api/notifications`  | Get user notifications + unread count    |
| PUT    | `/api/notifications`  | Mark as read (single or all)             |

### Dashboard

| Method | Path              | Description                      |
|--------|-------------------|----------------------------------|
| GET    | `/api/dashboard`  | Stats (totals) + recent activity + scheduleStats (admin) |

### Cron (External Trigger)

| Method | Path                            | Description                      |
|--------|---------------------------------|----------------------------------|
| GET    | `/api/cron/execute-schedules`   | Run due schedules → Excel → Email |

> ต้องส่ง `?secret=<CRON_SECRET>` เพื่อ authenticate — เรียกผ่าน Windows Task Scheduler หรือ external cron

---

## 6. Environment Variables

ไฟล์ `.env.local` ถูกสร้างไว้แล้วในโปรเจค:

```env
# Central ReportCenter Database
DB_USER=sa
DB_PASSWORD=Sonic@rama3
DB_SERVER=192.168.110.106
DB_DATABASE=ReportCenterDB
DB_INSTANCE=alpha

# Company 1 (Sonic Interfreight)
C1_DB_USER=smf
C1_DB_PASSWORD=smf@3564
C1_DB_SERVER=192.168.110.200
C1_DB_DATABASE=SONIC2021

# Company 2 (Grandlink Logistics)
C2_DB_USER=smf
C2_DB_PASSWORD=smf@3564
C2_DB_SERVER=192.168.110.200
C2_DB_DATABASE=GLEDB2014

# Company 3 (Sonic Autologis)
C3_DB_USER=smf
C3_DB_PASSWORD=smf@3564
C3_DB_SERVER=192.168.110.200
C3_DB_DATABASE=SMF-AUTOLOGIS

# JWT Secret (change in production!)
JWT_SECRET=rc-super-secret-key-2026-change-me

# SMTP (Outlook 365) — for scheduled reports email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-app-password
SMTP_FROM=ReportCenter <your-email@company.com>

# Server Port (default 3000)
PORT=4000

# Cron endpoint protection
CRON_SECRET=rc-cron-secret-2026

# Azure AD OAuth2 (for Microsoft Graph API email — optional, fallback to SMTP_PASS)
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

> ⚠️ ไฟล์ `.env.local` ถูก `.gitignore` อยู่แล้ว — ค่า default ยังมี fallback ใน `db.js` สำหรับ dev environment

---

## 7. Key Dependencies

| Package    | Version | Purpose                          |
|------------|---------|----------------------------------|
| `next`     | 16.1.6  | App framework (App Router)       |
| `react`    | 19.2.3  | UI library                       |
| `mssql`    | 12.2.0  | MSSQL database driver            |
| `bcryptjs` | latest  | Password hashing                 |
| `jose`     | latest  | JWT token sign/verify            |
| `xlsx`     | 0.18.5  | Excel export                     |
| `nodemailer` | latest | SMTP email sending (OAuth2 XOAUTH2 / password) |
| `@azure/msal-node` | latest | Azure AD OAuth2 token acquisition |
| `lucide-react` | latest | Icon library                 |
| `@dnd-kit` | latest  | Drag and drop (template builder) |

---

## 8. UX Components & Providers

### ToastProvider (`src/components/providers/ToastProvider.tsx`)
- ใช้แทน `alert()` ทุกจุดในระบบ
- รองรับ 3 ประเภท: `success`, `error`, `info`
- Auto-dismiss หลัง 3.5 วินาที พร้อม slide-in animation
- ใช้งาน: `const { toast } = useToast(); toast('message', 'success');`

### ConfirmProvider (`src/components/providers/ConfirmProvider.tsx`)
- ใช้แทน `window.confirm()` — Promise-based return `true`/`false`
- รองรับ variant: `danger`, `warning`, `default`
- ใช้งาน: `const { confirm } = useConfirm(); const ok = await confirm({ title, message, variant: 'danger' });`

### Notification Center (Header bell)
- กระดิ่งแจ้งเตือนบน Header พร้อม badge แสดงจำนวนยังไม่อ่าน
- Dropdown panel แสดงรายการ notification
- Auto-poll ทุก 30 วินาที
- รองรับ mark as read (ทีละรายการ หรือทั้งหมด)

### Sidebar (Mobile)
- **Mobile**: Hamburger menu button + slide-in sidebar + overlay backdrop
- Auto-close sidebar เมื่อเปลี่ยน route

### Header (Dark Mode + Notifications)
- **Dark Mode**: Moon/Sun icon button ข้างกระดิ่ง + จำค่าใน `localStorage`
- **Notification bell**: Badge แสดง unread count + dropdown panel + auto-poll 30 วินาที

### Date/Time Utilities (`src/lib/dateUtils.ts`)
- **Timezone**: Asia/Bangkok (UTC+7), **Format**: 24 ชั่วโมง
- `formatDateTime()` → `21/02/2569 14:30`
- `formatDate()` → `21/02/2569`
- `formatTime()` → `14:30`
- `timeAgo()` → `5 นาทีที่แล้ว` / fallback เป็น formatDateTime
- **MSSQL Fix**: strip trailing `Z` จาก DATETIME เพื่อป้องกัน double +7h offset

### TemplateEditor (`src/components/TemplateEditor.tsx`)
- **Split-panel**: ซ้าย = Available Fields (parse จาก SQL), ขวา = Textarea editor
- **Click-to-Insert**: กดชื่อ field → แทรก `{{FieldName}}` ที่ตำแหน่ง cursor
- **Used indicator**: field ที่ใช้แล้วจะเป็นสีเขียว + ✓ พร้อม counter (เช่น 3/5 ฟิลด์ถูกใช้)
- **Preview mode**: แท็บ แก้ไข/ตัวอย่าง สลับดูผลลัพธ์ที่จัดสไตล์แล้ว
- **SQL Parser**: อ่านชื่อ column จาก `SELECT ... FROM` อัตโนมัติ (รองรับ alias, bracket, table prefix)
- ใช้งานทั้งหน้า สร้างรายงานใหม่ (`new/page.tsx`) และ แก้ไขรายงาน (`[id]/edit/page.tsx`)

---

## 9. Important Notes for Developers

### Next.js 16 Breaking Changes
- **`params` is a Promise**: ในทุก API route ที่ใช้ dynamic segment `[id]`, ต้อง `await props.params` ก่อนเข้าถึง `id`
- **Middleware → Proxy**: Next.js 16 แสดง warning ว่า middleware จะเปลี่ยนเป็น "proxy" ในอนาคต

### Route Groups
- หน้า Login อยู่ที่ `src/app/login/` (ไม่มี Sidebar/Header)
- หน้าอื่นๆ ทั้งหมดอยู่ใน `src/app/(dashboard)/` ซึ่งครอบด้วย `AppLayout` + `ToastProvider` + `ConfirmProvider` + `IdleTimeoutProvider`

### Security
- JWT cookie: `httpOnly`, `sameSite: lax`, `maxAge: 8 ชั่วโมง`
- Password: bcrypt hash (salt rounds = 10) — hash ตอนสร้าง user ใหม่ด้วย
- Password change: ต้องยืนยัน password เดิมก่อนเปลี่ยน (bcrypt compare)
- Admin password reset: admin รีเซ็ตรหัสผ่านให้ user ได้โดยไม่ต้องรู้รหัสเดิม + force re-login (TokenVersion++)
- SQL: ใช้ parameterized queries ทุกจุดเพื่อป้องกัน SQL Injection
- **SQL Query Validator** (`src/lib/sql-validator.js`): ตรวจ T-SQL ก่อน execute — block DML/DDL/metadata/procs/remote sources
- **Session Idle Timeout**: ไม่ใช้งานตามเวลากำหนด → แสดง modal เตือน 60 วิ → auto-logout (ตั้งค่าได้ที่ Admin Settings)
- Role-based access: Admin เมนูซ่อนจาก non-admin users ใน Sidebar
- Multi-company: user เห็นเฉพาะ company ที่ถูก assign ใน `UserCompanyMapping`

### Database
- Connection pooling ผ่าน `src/lib/db.js` — สร้าง pool ครั้งเดียว reuse ตลอด
- รองรับ 3 บริษัท (3 company databases) + 1 central DB
- `SystemSettings`, `UserFavorites`, `Notifications` ถูกสร้างอัตโนมัติครั้งแรกที่เข้าถึง API

### Auto-Created Tables
ตารางเหล่านี้จะถูกสร้างอัตโนมัติเมื่อเข้าถึง API ครั้งแรก:
- `UserFavorites` — เมื่อเรียก `/api/reports/favorites`
- `Notifications` — เมื่อเรียก `/api/notifications`
- `SystemSettings` — เมื่อเรียก `/api/admin/settings`
- `ReportSchedules` — เมื่อเรียก `/api/admin/schedules` (รวม auto-migrate เพิ่ม column ใหม่)

---

## 10. Scheduled Reports & Email

### Overview
ระบบส่งรายงานอัตโนมัติทาง Email (Excel attachment) ตาม schedule ที่ admin กำหนด

### Flow
```
Admin สร้าง Schedule (เลือก Report + บริษัท + ความถี่ + ผู้รับ Email)
    ↓ บันทึกลง ReportSchedules + คำนวณ NextRunAt
    ↓
Cron Job เรียก GET /api/cron/execute-schedules?secret=<CRON_SECRET>
    ↓ ดึง schedules ที่ NextRunAt <= now
    ↓ Execute SQL บน Company DB
    ↓ สร้าง Excel buffer (xlsx)
    ↓ ส่ง Email ผ่าน Microsoft Graph API (Azure AD) หรือ fallback SMTP password
    ↓ อัปเดต LastRunAt, LastRunStatus, NextRunAt
```

### Manual Trigger (⚡ Zap Button)
- Admin กดปุ่ม ⚡ ที่ schedule card → `PATCH /api/admin/schedules` → รัน SQL + สร้าง Excel + ส่ง Email ทันที
- แสดง loading spinner ขณะรัน + toast notification
- Subject มี `(Manual)` ต่อท้าย + บันทึก `RUN_SCHEDULE` ใน ActivityLogs

### Email Content
Email ที่ส่งจากระบบ (ทั้ง cron + manual) จะมีข้อมูลดังนี้:

| ส่วน | ตัวอย่าง |
|------|----------|
| **Subject** | `[ReportCenter] Cutoff - Grandlink Logistics (GRL) - 22/02/2569` |
| **บริษัท** | Grandlink Logistics (GRL) |
| **ตัวแปร** | begin: 2026-01-01, end: 2026-01-31 |
| **จำนวนข้อมูล** | 150 แถว |
| **ชื่อไฟล์แนบ** | `Cutoff_GRL_22-02-2569.xlsx` |

> Company names ถูก map จาก CompanyId: `{ 1: 'Sonic Interfreight (SNI)', 2: 'Grandlink Logistics (GRL)', 3: 'Sonic Autologis (SALOG)' }`

### Parameters & Relative Dates
Report ที่มี parameters → admin เลือก **relative date preset** ใน modal:

| Preset | คำนวณเป็น |
|--------|----------|
| `TODAY` | วันที่ปัจจุบัน |
| `YESTERDAY` | เมื่อวาน |
| `MONTH_START` | วันที่ 1 ของเดือนนี้ |
| `MONTH_END` | วันสุดท้ายของเดือน |
| `PREV_MONTH_START` | วันที่ 1 เดือนก่อน |
| `PREV_MONTH_END` | วันสุดท้ายเดือนก่อน |
| `YEAR_START` | 1 มกราคมปีนี้ |

ค่าเหล่านี้ถูก resolve เป็นวันที่จริง (YYYY-MM-DD) ตอน cron รันรายงาน **และ** manual trigger (PATCH)

### Cron Setup (Windows Task Scheduler)
```bash
# ตัวอย่าง: รันทุก 5 นาที
curl http://localhost:4000/api/cron/execute-schedules?secret=rc-cron-secret-2026
```

### Test Email
- ปุ่ม **"ทดสอบ Email"** ที่ header ของหน้าตั้งเวลารายงาน
- เรียก `POST /api/admin/test-email` → ส่ง email ทดสอบไป SMTP_USER
- ใช้ตรวจว่า email config (Graph API / SMTP) ทำงานถูกต้อง

### Background Job System (Heavy Reports)
- Admin ติ๊ก **"รายงานขนาดใหญ่ (Background Job)"** ที่หน้าเพิ่ม/แก้ไขรายงาน → เซ็ต `IsHeavy = 1`
- Report ปกติ → export client-side เหมือนเดิม
- Report IsHeavy → `POST /api/reports/execute-async` → สร้าง Job record → รัน query ใน background (timeout 15 นาที) → สร้าง xlsb → disk
- Frontend poll `GET /api/reports/jobs/{id}` ทุก 3 วินาที → แสดง banner: running/done/failed
- `GET /api/reports/jobs/{id}/download` → stream ไฟล์ให้ user, กดซ้ำได้
- **Auto-cleanup:** ไฟล์ลบหลัง 24 ชม., DB records ลบหลัง 7 วัน (ทำตอน cron รัน)
- Schema: `Reports.IsHeavy BIT` (auto-add), `ReportJobs` table (auto-create)
- ไฟล์ job เก็บที่ `tmp/jobs/` (อยู่ใน `.gitignore`)

### Report Favorites
- ★ ปุ่มติดดาว (favorite) ที่หน้า Standard/Template Reports
- รายการ Favorites แสดงเป็น chips ด้านบนหน้ารายงาน
- ข้อมูลเก็บใน `UserFavorites` table (auto-created)

### Clipboard Copy Fallback (Template Reports)
- ปุ่ม **Copy Message** ที่หน้า Template Reports ใช้ `navigator.clipboard.writeText()` ซึ่งต้องการ **Secure Context (HTTPS)**
- บน HTTP (เช่น dev server หรือ deploy บน intranet ไม่มี SSL) → `navigator.clipboard` จะเป็น `undefined`
- **Fallback:** สร้าง `<textarea>` ชั่วคราว + `document.execCommand('copy')` → ทำงานได้ทั้ง HTTP และ HTTPS
- Error handling: ถ้า copy ล้มเหลว → แสดง toast error แทนที่จะ crash

### Rate Limiting (Login)
- **5 ครั้ง / 15 นาที** (default) — ตั้งค่าได้จากหน้า Admin Settings
- ค่า config อ่านจาก `SystemSettings` table (`rate_limit_max_attempts`, `rate_limit_window_minutes`)
- Implementation: `src/lib/rate-limit.js` → in-memory Map, cleanup ทุก 30 นาที
- Login route (`/api/auth/login`) โหลด config จาก DB ทุกครั้ง → เรียก `configure()` → `checkRateLimit(ip)`
- **หน้า Login UI:** เมื่อโดน rate limit (HTTP 429) → แสดง lockout banner + countdown timer + disabled inputs
- **หน้า Admin Settings:** section "ความปลอดภัย (Security)" → ตั้งค่า Max Attempts + Window Minutes

### Password Complexity
- เปลี่ยนรหัสผ่านต้องมี: ≥8 ตัว, uppercase ≥1, ตัวเลข ≥1, special char ≥1
- Shared validation: `src/lib/password-rules.js` (ใช้ทั้ง API + frontend)
- หน้าเปลี่ยนรหัสผ่าน: แสดง checklist realtime (✓/✗ ทุกกฎ)
- API `POST /api/auth/change-password` บังคับตรวจก่อนบันทึก
- API `POST /api/admin/users` บังคับตรวจเมื่อสร้าง user ใหม่ (ค่าเริ่มต้น: `P@ssw0rd123`)
- หน้าเพิ่มผู้ใช้: แสดง hint "ขั้นต่ำ 8 ตัว, ต้องมี A-Z, ตัวเลข, อักขระพิเศษ"

### Dark Mode (ครบทุกหน้า)
- Toggle อยู่ที่ **Header** (🌙/☀️ ข้างระฆัง)
- ใช้ `ThemeProvider` (`src/components/providers/ThemeProvider.tsx`)
- เก็บ state ใน `localStorage` key `rc-theme` → toggle `.dark` class บน `<html>`
- **ครอบคลุมทุกหน้าผ่าน `globals.css` overrides** (bg, text, border, inputs, tables, modals, hover, shadows)

### Dashboard Charts
- `GET /api/dashboard/charts` → 4 datasets:
  - **usagePerDay** (14 วัน) → CSS bar chart
  - **topReports** (30 วัน) → horizontal progress bars
  - **actionBreakdown** (30 วัน)
  - **activeUsersToday** → live indicator
- Charts render client-side ด้วย pure CSS (ไม่มี external chart library)

### Job History Page
- เมนู Sidebar: **"ประวัติการสร้างรายงาน"** (🕐) — ทุก user เห็น
- Path: `/reports/job-history` → `GET /api/reports/job-history`
- แสดง jobs ภายใน 24 ชม. — status (running/done/failed), re-download button
- Running jobs banner แยกด้านบน
- **Auto-refresh ทุก 10 วินาที**

### Bulk Actions (Admin)
- **หน้าจัดการรายงาน:** checkbox select-all + bulk delete → `DELETE /api/admin/reports/bulk` (transaction-safe)
- **API จัดการผู้ใช้:** bulk toggle active/inactive → `PUT /api/admin/users/bulk`

### Schedule Failure Notifications
- เมื่อ cron schedule ล้มเหลว → auto-insert `Notification` ให้ทุก Admin user
- Type: `error`, แสดงชื่อ schedule + error message
- Admin เห็นผ่านระฆัง 🔔 ที่ Header

### Report Authorization (Role-Based Access)
- **ทุก API ที่รับ `reportId`** เช็คสิทธิ์ `ReportRoleMapping` ก่อนดำเนินการ
- Admin → bypass (เข้าถึงทุก report)
- User ปกติ → ต้องมี `ReportRoleMapping` record ที่ match `ReportId` + `RoleId` → ถ้าไม่มี return **403**
- APIs ที่บังคับ:
  - `POST /api/reports/execute`
  - `POST /api/reports/execute-async`
  - `GET /api/reports/parameters`
  - `GET /api/reports/search-param`
- ป้องกัน user แก้ URL เดา reportId เพื่อเรียกใช้รายงานที่ไม่มีสิทธิ์

### Security Hardening
- **ลบ hardcoded credentials** — `db.js` ไม่มี default password/server แล้ว → บังคับ `.env`
- **Admin role checks ครบทุก admin route** — GET/POST/PUT/DELETE ทุก function เช็ค `roleName === 'admin'`
  - `admin/reports`, `admin/reports/[id]`, `admin/settings`, `admin/users`, `admin/roles`
- **JWT Secret** — ไม่มี default fallback → บังคับตั้งใน `.env`
- **CRON_SECRET** — ไม่มี default → บังคับตั้งใน `.env`
- **Error messages** — ไม่ส่ง `error.message` กลับ client → ส่งแค่ generic error, log ไว้ server-side
- **Input validation** — เช็คความยาว Username ≤50, FullName ≤150, RoleName ≤50
- **`env-check.js`** — บังคับครบทุก env var (central DB + company DB + CRON_SECRET + JWT)
- **`.env.example`** — template สำหรับ dev ใหม่

### SQL Query Validator (`src/lib/sql-validator.js`)
ตรวจสอบ T-SQL ที่ admin กรอก ก่อน execute บน company DB — ป้องกันการเปลี่ยนแปลง/ดูข้อมูลที่ไม่ควรเข้าถึง

| ประเภท | คำสั่งที่ block |
|--------|----------------|
| **DML** | INSERT, UPDATE, DELETE, MERGE, TRUNCATE |
| **DDL** | CREATE, ALTER, DROP |
| **Metadata** | INFORMATION_SCHEMA.*, sys.*, sysobjects, syscolumns, master/tempdb/msdb |
| **Procs** | EXEC/EXECUTE, xp_*, sp_executesql, sp_help*, sp_configure |
| **Remote** | OPENROWSET, OPENDATASOURCE, OPENQUERY |
| **Other** | BACKUP, RESTORE, DBCC, WAITFOR DELAY, SELECT INTO, PasswordHash |

**Bypass protection:** Strip SQL comments (`/* */`, `--`) และ string literals ก่อนตรวจสอบ

**Enforcement points (3 จุด):**
1. `POST /api/reports/execute` — รันรายงานปกติ
2. `POST /api/reports/execute-async` — รันรายงานหนัก (background)
3. `GET /api/cron/execute-schedules` — cron job ส่งรายงานอัตโนมัติ

**Audit:** Query ที่ถูก block → บันทึก `BLOCKED_QUERY` ใน ActivityLogs พร้อมชื่อ report + เหตุผล

### Dynamic Company Database (`CompanyDatabases` table)
- ตารางใน Central DB: `CompanyId`, `CompanyName`, `CompanyLabel`, `DbUser`, `DbPassword`, `DbServer`, `DbName`, `DbInstance`, `IsActive`
- `db.js` → `loadCompanyConfigs()` โหลดจาก table + cache ใน memory
- **Auto-create** — ถ้า table ยังไม่มี → สร้างอัตโนมัติ + seed จาก `.env`
- **เพิ่มบริษัทใหม่:** INSERT เข้า table → restart → ใช้ได้ทันที (ไม่ต้องแก้ code)

### Session Revocation (Token Version)
- `Users` table มี `TokenVersion INT DEFAULT 0` (auto-create)
- Login → JWT payload มี `tokenVersion`
- `getSession()` ตรวจ `TokenVersion` + `IsActive` จาก DB ทุก request (cache 60 วิ)
- Admin แก้ไข/disable user → `TokenVersion += 1` + `invalidateSessionCache()` → user ถูก logout ทันที

### Query Timeout & Pool Config
- `requestTimeout: 30s`, `connectionTimeout: 10s` — ป้องกัน server hang จาก slow query
- `pool: { min: 2, max: 20, idleTimeoutMillis: 30000 }` — รองรับ concurrent users
- ทุกค่าตั้งผ่าน `.env`: `DB_REQUEST_TIMEOUT`, `DB_CONNECTION_TIMEOUT`, `DB_POOL_MIN`, `DB_POOL_MAX`
- Pool health check: ถ้า DB restart → auto-reconnect

### Loading Skeletons
- `LoadingSkeleton.tsx` — 5 variants: `card` (dashboard), `table`, `form`, `text`, `chart`
- `loading.tsx` × 4 หน้า: dashboard, standard reports, admin/reports, admin/users
- Pulse animation + dark mode support

### Automated Tests (Vitest)
- `npm run test` → `vitest run` (20 tests)
- `npm run test:watch` → watch mode
- Test files: `src/lib/__tests__/auth.test.js` (5), `password-rules.test.js` (10), `db.test.js` (5)

---

## 11. Scripts Reference

```bash
# Hash a password for DB insertion
node scripts/hash-password.js MyPassword123

# Update admin password in DB
node scripts/update-admin-password.js

# Create CompanyDatabases table and seed from .env
node scripts/create-company-databases.js

# Create ActivityLogs table (if not exists)
node scripts/create-activity-logs.js

# Run automated tests
npm run test

# Run tests in watch mode
npm run test:watch
```

---

## 12. Feature Roadmap (Future)

- [x] Report scheduling (auto-generate at intervals via cron)
- [x] Email notification integration (Microsoft Graph API + SMTP fallback)
- [x] Report Favorites (star/pin reports)
- [x] Export Excel on Standard + Template report pages
- [x] Search/Filter for report dropdown (by name + description)
- [x] Server-side pagination (OFFSET/FETCH + totalRows count + ORDER BY handling)
- [x] Email via Azure AD MSAL → Microsoft Graph API (`src/lib/email.js`)
- [x] Dashboard schedule status card (active/failed/nextRun)
- [x] Manual trigger for schedules (⚡ Zap button)
- [x] Comprehensive audit logging (16 ActionTypes including change diff tracking)
- [x] Conditional sidebar menus based on user's available report types
- [x] TemplateEditor component (click-to-insert, preview mode)
- [x] Parameter Typeahead search (LookupQuery + TypeaheadInput + auto-execute on select)
- [x] Excel Binary Workbook (.xlsb) — ไฟล์เล็กกว่า .xlsx 50-70%
- [x] Session timeout auto-logout (JWT 8h + frontend 401 redirect + 5min recheck)
- [x] SQL Injection guard for LookupQuery (SELECT-only whitelist)
- [x] Environment validation on startup (`src/lib/env-check.js`)
- [x] Test Email button on schedule page (`POST /api/admin/test-email`)
- [x] Background Job system for heavy reports (IsHeavy toggle + async APIs + polling UI)
- [x] Password complexity rules enforcement (min 8, uppercase, number, special char)
- [x] Rate limiting on login (5 attempts / 15 min, admin-configurable)
- [x] Session idle timeout — แสดง warning modal + countdown 60 วิ + auto-logout + admin ตั้งค่าได้ (default 30 นาที, 0=ปิด)
- [x] Dark mode toggle (ThemeProvider + localStorage + Tailwind dark:)
- [x] Dashboard charts (usage per day + top reports + active users)
- [x] Job History page (re-download within 24h, auto-refresh)
- [x] Bulk actions for admin (reports bulk delete + users bulk toggle)
- [x] Schedule failure notifications (auto-notify admin users)
- [x] Report authorization — ReportRoleMapping enforced on all execute/parameter APIs
- [x] Security hardening — admin checks, no hardcoded secrets, error hiding, input validation
- [x] Dark mode — ครบทุกหน้าผ่าน `globals.css` comprehensive overrides
- [x] Dynamic company database — `CompanyDatabases` table + auto-create + `.env` fallback
- [x] Session revocation — `TokenVersion` + DB check + 60s cache
- [x] Query timeout (30s) + Pool config (min:2/max:20) via `.env`
- [x] Automated tests — Vitest, 20 tests (auth, password-rules, db)
- [x] Loading skeletons — `LoadingSkeleton` component + 4 `loading.tsx` pages
- [x] Admin delete user — ลบ user + cleanup mappings/favorites + session invalidation + audit log
- [x] Admin reset password — รีเซ็ตรหัสผ่านให้ user + force re-login + audit log
- [x] User management pagination — client-side 10/page + page numbers + filter reset
- [x] SQL Query Validator — blocklist DML/DDL/metadata/procs + audit log BLOCKED_QUERY
- [x] Report execution parameter logging — audit trail includes parameter values + ChangeData JSON
- [x] Roles page UI polish — neutral delete button (red on hover only)
- [x] Fix: report edit no longer wipes role assignments
- [ ] Two-factor authentication (2FA)
- [ ] PDF export support

---

## 13. Activity Logging

### Logged Actions (19 ActionTypes)

| ActionType | Endpoint | Notes |
|------------|----------|-------|
| `LOGIN` | `/api/auth/login` | On successful login |
| `LOGIN_FAIL` | `/api/auth/login` | Failed login (includes IP + username for brute force detection) |
| `LOGOUT` | `/api/auth/logout` | Before clearing cookie |
| `CHANGE_PASSWORD` | `/api/auth/change-password` | After successful password change |
| `EXECUTE_REPORT` | `/api/reports/execute` | Includes parameter values in details + ChangeData JSON |
| `EXPORT_EXCEL` | `/api/reports/execute` | When `exportAll=true`, includes parameter values |
| `CREATE_REPORT` | `/api/admin/reports` POST | After transaction commit |
| `UPDATE_REPORT` | `/api/admin/reports/[id]` PUT | With `ChangeData` JSON (old→new diff) |
| `RUN_SCHEDULE` | `/api/admin/schedules` PATCH | Manual trigger |
| `CREATE_SCHEDULE` | `/api/admin/schedules` POST | New schedule created |
| `UPDATE_SCHEDULE` | `/api/admin/schedules` PUT | Schedule modified |
| `DELETE_SCHEDULE` | `/api/admin/schedules` DELETE | Schedule removed |
| `CRON_SUCCESS` | `/api/cron/execute-schedules` | Cron job completed successfully |
| `CRON_FAIL` | `/api/cron/execute-schedules` | Cron job failed (includes error message) |
| `CREATE_USER` | `/api/admin/users` POST | New user created |
| `UPDATE_USER` | `/api/admin/users` PUT | User modified |
| `DELETE_USER` | `/api/admin/users` DELETE | User deleted + cleanup data |
| `RESET_PASSWORD` | `/api/admin/users/reset-password` POST | Admin reset user password + force re-login |
| `BLOCKED_QUERY` | `/api/reports/execute*` | Dangerous SQL blocked by validator (includes reason) |

All logging is **non-blocking** (wrapped in try/catch) — logging failure never breaks the main operation.

### Change Diff Tracking (ChangeData)
- `UPDATE_REPORT` logs store a `ChangeData` JSON column with full old→new values for every changed field
- Fields tracked: ชื่อรายงาน, คำอธิบาย, ประเภท, คำสั่ง SQL, Email Template, สาธารณะ, สถานะ, รายงานหนัก
- `EXECUTE_REPORT` / `EXPORT_EXCEL` logs store parameter values in `ChangeData` JSON: `{ parameters: { @StartDate: '2026-01-01', ... } }`
- UI: Audit Trail page (👁️ icon) → modal with **line-level diff** (LCS algorithm)
  - Short values: ~~old~~ → new (inline)
  - Long values (SQL): line-by-line diff with red (−removed) / green (+added) highlighting
- `ChangeData` column is `NVARCHAR(MAX)`, auto-created if missing

---

## 14. Email System (`src/lib/email.js`)

### Microsoft Graph API (Primary)
```
Server → Azure AD (acquireTokenByClientCredential)
       ← Access Token (scope: graph.microsoft.com/.default)
Server → POST https://graph.microsoft.com/v1.0/users/{SMTP_USER}/sendMail
       → Send email with Base64 attachments (Excel)
```

> ⚠️ **SMTP XOAUTH2 ไม่รองรับ** client_credentials flow — ต้องใช้ Graph API โดยตรง

### Fallback
If `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` are not set, falls back to Nodemailer SMTP password auth:
```
Server → SMTP Office365 (user + pass via Nodemailer)
```

### API Function: `sendMail(options)`
```javascript
import { sendMail } from '@/lib/email';

await sendMail({
    to: 'user@example.com',
    cc: 'cc@example.com',
    subject: 'Report',
    text: 'body text',
    html: '<p>HTML body</p>',
    attachments: [{ filename: 'report.xlsx', content: buffer }],
});
```

### Required Azure AD Setup
1. Register app in **Microsoft Entra ID** → App registrations
2. Add **API permission**: Microsoft Graph → Application → `Mail.Send` → Grant admin consent
3. Create **Client secret** → copy value to `AZURE_CLIENT_SECRET`
4. Set `SMTP_USER` to the email address that will send (must have a mailbox in the tenant)

---

## 15. Parameter Typeahead Search

### Overview
Template Reports ที่มี parameter เยอะ (200K+ rows) ใช้ **Typeahead search** แทน text input ธรรมดา

### How It Works
```
Admin → แก้ไขรายงาน → ตั้ง LookupQuery สำหรับ parameter ที่ต้องการ
    เช่น: SELECT TOP 20 JOBNO AS value, JOBNO + ' - ' + EXPORTERNAME AS label
          FROM SFJOB WHERE JOBNO LIKE '%' + @q + '%' ORDER BY JOBNO DESC

User → เลือกบริษัท → เลือกรายงาน → พิมพ์ในช่อง parameter
     → debounce 300ms → API ค้นหาบน Company DB ที่เลือก
     → แสดง dropdown suggestions (max 30 รายการ)
     → เลือก suggestion → report auto-execute ทันที!
```

### Key Components
| Component | File | Purpose |
|-----------|------|---------|
| `TypeaheadInput` | `src/components/TypeaheadInput.tsx` | Debounced input + keyboard nav + clear button |
| Search API | `src/app/api/reports/search-param/route.js` | Runs `LookupQuery` on company DB with `@q` param |
| LookupQuery | `ReportParameters.LookupQuery` column | SQL that returns `value` + `label` columns |

### LookupQuery Rules
- SQL ต้อง return คอลัมน์ **`value`** (ค่าจริงที่ใส่ใน parameter) และ **`label`** (แสดงให้ user เห็น)
- ใช้ **`@q`** เป็น placeholder สำหรับค่าที่ user พิมพ์
- ใช้ **`TOP 20-30`** เพื่อจำกัดผลลัพธ์
- `LIKE @q + '%'` ใช้ index ได้ (เร็ว), `LIKE '%' + @q + '%'` full scan (ช้ากว่าแต่ค้นตรงกลางได้)
