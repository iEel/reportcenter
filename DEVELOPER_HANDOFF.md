# ReportCenter — Developer Handoff

> **Version:** 3.0  
> **Last Updated:** 2026-02-21  
> **Tech Stack:** Next.js 16.1.6 + React 19 + Tailwind CSS 4 + MSSQL (mssql driver) + Nodemailer (SMTP)

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
│   │   │   │   ├── users/page.tsx        # Manage Users (search/filter/stats)
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
│   │       │   ├── users/route.js        # GET/POST/PUT users & roles + company mappings
│   │       │   ├── roles/route.js        # GET/POST/PUT/DELETE roles + ReportRoleMapping
│   │       │   ├── audit-logs/route.js   # GET: paginated audit logs
│   │       │   ├── schedules/route.js    # GET/POST/PUT/DELETE schedules
│   │       │   └── settings/route.js     # GET/PUT system settings
│   │       ├── cron/
│   │       │   └── execute-schedules/route.js # GET: cron endpoint (runs due reports → email)
│   │       └── reports/
│   │           ├── available/route.js    # GET: reports user can access
│   │           ├── execute/route.js      # POST: run T-SQL on company DB
│   │           ├── parameters/route.js   # GET: report parameters
│   │           └── favorites/route.js    # GET/POST: toggle favorite reports
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx             # Sidebar + Header wrapper + AuthProvider
│   │   │   ├── Sidebar.tsx               # Mobile responsive + role menus
│   │   │   └── Header.tsx                # Dark mode toggle + Notification bell + dropdown
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx          # React Context for user session + allowedCompanies
│   │   │   ├── ToastProvider.tsx         # Toast notification system (success/error/info)
│   │   │   └── ConfirmProvider.tsx       # Custom confirm dialog (danger/warning/default)
│   │   ├── ErrorBoundary.tsx             # Global error boundary
│   │   └── Skeletons.tsx                 # Reusable loading skeletons
│   ├── lib/
│   │   ├── auth.js                       # JWT sign/verify (jose)
│   │   ├── db.js                         # MSSQL connection pool manager
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
| `ActivityLogs`       | Audit trail: who ran which report, when      |
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
```

---

## 5. API Reference

### Auth

| Method | Path                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| POST   | `/api/auth/login`           | Login, returns JWT cookie with allowedCompanies |
| POST   | `/api/auth/logout`          | Clear JWT cookie                     |
| GET    | `/api/auth/me`              | Get current user + allowedCompanies  |
| PUT    | `/api/auth/change-password` | Change password (verify current first) |

### Reports (User-facing)

| Method | Path                        | Description                       |
|--------|-----------------------------|-----------------------------------|
| GET    | `/api/reports/available`    | List reports user can access      |
| GET    | `/api/reports/parameters`   | Get parameters for a report       |
| POST   | `/api/reports/execute`      | Execute T-SQL on company DB       |
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
| POST   | `/api/admin/users`           | Create user (bcrypt hash) + company mappings |
| PUT    | `/api/admin/users`           | Update user + company mappings    |
| GET    | `/api/admin/audit-logs`      | Paginated audit logs (?page=&limit=) |
| GET    | `/api/admin/roles`           | List roles + user count + assigned reports |
| POST   | `/api/admin/roles`           | Create role + report mappings    |
| PUT    | `/api/admin/roles`           | Update role name + report mappings |
| DELETE | `/api/admin/roles?roleId=`   | Delete role (blocked if users assigned) |
| GET    | `/api/admin/schedules`       | List all schedules + report/user info |
| POST   | `/api/admin/schedules`       | Create schedule (auto-calculates NextRunAt) |
| PUT    | `/api/admin/schedules`       | Update schedule / toggle active   |
| DELETE | `/api/admin/schedules?scheduleId=` | Delete schedule              |
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
| GET    | `/api/dashboard`  | Stats (totals) + recent activity |

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

# Cron endpoint protection
CRON_SECRET=rc-cron-secret-2026
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
| `nodemailer` | latest | SMTP email sending (Outlook 365) |
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

---

## 9. Important Notes for Developers

### Next.js 16 Breaking Changes
- **`params` is a Promise**: ในทุก API route ที่ใช้ dynamic segment `[id]`, ต้อง `await props.params` ก่อนเข้าถึง `id`
- **Middleware → Proxy**: Next.js 16 แสดง warning ว่า middleware จะเปลี่ยนเป็น "proxy" ในอนาคต

### Route Groups
- หน้า Login อยู่ที่ `src/app/login/` (ไม่มี Sidebar/Header)
- หน้าอื่นๆ ทั้งหมดอยู่ใน `src/app/(dashboard)/` ซึ่งครอบด้วย `AppLayout` + `ToastProvider` + `ConfirmProvider`

### Security
- JWT cookie: `httpOnly`, `sameSite: lax`, `maxAge: 8 ชั่วโมง`
- Password: bcrypt hash (salt rounds = 10) — hash ตอนสร้าง user ใหม่ด้วย
- Password change: ต้องยืนยัน password เดิมก่อนเปลี่ยน (bcrypt compare)
- SQL: ใช้ parameterized queries ทุกจุดเพื่อป้องกัน SQL Injection
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
    ↓ ส่ง Email ผ่าน Outlook 365 SMTP (nodemailer)
    ↓ อัปเดต LastRunAt, LastRunStatus, NextRunAt
```

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

ค่าเหล่านี้ถูก resolve เป็นวันที่จริง (YYYY-MM-DD) ตอน cron รันรายงาน

### Cron Setup (Windows Task Scheduler)
```bash
# ตัวอย่าง: รันทุก 5 นาที
curl http://localhost:3000/api/cron/execute-schedules?secret=rc-cron-secret-2026
```

### Report Favorites
- ★ ปุ่มติดดาว (favorite) ที่หน้า Standard/Template Reports
- รายการ Favorites แสดงเป็น chips ด้านบนหน้ารายงาน
- ข้อมูลเก็บใน `UserFavorites` table (auto-created)

---

## 11. Scripts Reference

```bash
# Hash a password for DB insertion
node scripts/hash-password.js MyPassword123

# Update admin password in DB
node scripts/update-admin-password.js

# Create ActivityLogs table (if not exists)
node scripts/create-activity-logs.js
```

---

## 12. Feature Roadmap (Future)

- [x] Report scheduling (auto-generate at intervals via cron)
- [x] Email notification integration (SMTP via Outlook 365)
- [x] Report Favorites (star/pin reports)
- [ ] Advanced search with filters (date range, type, status) on admin pages
- [ ] Backend-driven server-side pagination for report tables (currently client-side)
- [ ] Password complexity rules enforcement
- [ ] Two-factor authentication (2FA)
