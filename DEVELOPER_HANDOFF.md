# ReportCenter — Developer Handoff

> **Version:** 1.0  
> **Last Updated:** 2026-02-21  
> **Tech Stack:** Next.js 16.1.6 + React 19 + Tailwind CSS 4 + MSSQL (mssql driver)

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
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (HTML/Body only)
│   │   ├── globals.css                   # Global CSS + Print styles
│   │   ├── login/
│   │   │   └── page.tsx                  # Login page (fullscreen, no sidebar)
│   │   ├── (dashboard)/                  # Route Group — wrapped with AppLayout
│   │   │   ├── layout.tsx                # Dashboard layout (Sidebar + Header + ErrorBoundary)
│   │   │   ├── page.tsx                  # Home Dashboard (stats + activity feed)
│   │   │   ├── admin/
│   │   │   │   ├── reports/
│   │   │   │   │   ├── page.tsx          # Manage Reports list
│   │   │   │   │   ├── new/page.tsx      # Create new report
│   │   │   │   │   └── [id]/edit/page.tsx # Edit existing report
│   │   │   │   ├── users/page.tsx        # Manage Users & Roles
│   │   │   │   └── settings/page.tsx     # System Settings
│   │   │   └── reports/
│   │   │       ├── standard/page.tsx     # Standard report viewer
│   │   │       └── templates/page.tsx    # Email template report viewer
│   │   └── api/                          # API Routes (all .js)
│   │       ├── auth/
│   │       │   ├── login/route.js        # POST: login with bcrypt
│   │       │   ├── logout/route.js       # POST: clear cookie
│   │       │   └── me/route.js           # GET: current user from JWT
│   │       ├── dashboard/route.js        # GET: stats + activity logs
│   │       ├── admin/
│   │       │   ├── reports/
│   │       │   │   ├── route.js          # GET: list, POST: create
│   │       │   │   └── [id]/route.js     # GET/PUT/DELETE single report
│   │       │   ├── users/route.js        # GET/POST/PUT users & roles
│   │       │   └── settings/route.js     # GET/PUT system settings
│   │       └── reports/
│   │           ├── available/route.js    # GET: reports user can access
│   │           ├── execute/route.js      # POST: run T-SQL on company DB
│   │           └── parameters/route.js   # GET: report parameters
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx             # Sidebar + Header wrapper + AuthProvider
│   │   │   ├── Sidebar.tsx               # Navigation, role-based menus, logout
│   │   │   └── Header.tsx                # Top header bar
│   │   ├── providers/
│   │   │   └── AuthProvider.tsx          # React Context for user session
│   │   ├── ErrorBoundary.tsx             # Global error boundary
│   │   └── Skeletons.tsx                 # Reusable loading skeletons
│   ├── lib/
│   │   ├── auth.js                       # JWT sign/verify (jose)
│   │   └── db.js                         # MSSQL connection pool manager
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
                    ↓ signToken(jose) → Set cookie "rc_token" (httpOnly, 8h)
                    ↓ redirect to /

Every request → middleware.ts
                    ↓ Read cookie → jwtVerify
                    ↓ Valid? → NextResponse.next()
                    ↓ Invalid/Missing? → redirect /login
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
│  - ActivityLogs  │     │                  │
│  - SystemSettings│     │                  │
└──────────────────┘     └──────────────────┘
```

---

## 4. Database Schema (ReportCenterDB)

| Table              | Purpose                                      |
|--------------------|----------------------------------------------|
| `Roles`            | Role definitions (Admin, Sales, Accountant)  |
| `Users`            | User accounts with PasswordHash, RoleId      |
| `Reports`          | Report definitions with T-SQL query          |
| `ReportParameters` | Dynamic parameters (date, text, number)      |
| `ReportRoleMapping`| Many-to-many: which roles can see which report |
| `ActivityLogs`     | Audit trail: who ran which report, when      |
| `SystemSettings`   | Key-value config (company names, app settings)|

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
ParameterId INT PK, ReportId INT FK, ParameterName NVARCHAR(50),
DisplayLabel NVARCHAR(100), InputType NVARCHAR(20), OrderIndex INT
```

---

## 5. API Reference

### Auth

| Method | Path              | Description       |
|--------|-------------------|--------------------|
| POST   | `/api/auth/login` | Login, returns JWT cookie |
| POST   | `/api/auth/logout`| Clear JWT cookie   |
| GET    | `/api/auth/me`    | Get current user   |

### Reports (User-facing)

| Method | Path                     | Description                       |
|--------|--------------------------|-----------------------------------|
| GET    | `/api/reports/available` | List reports user can access      |
| GET    | `/api/reports/parameters`| Get parameters for a report       |
| POST   | `/api/reports/execute`   | Execute T-SQL on company DB       |

### Admin

| Method | Path                         | Description               |
|--------|------------------------------|---------------------------|
| GET    | `/api/admin/reports`         | List all reports          |
| POST   | `/api/admin/reports`         | Create report + params    |
| GET    | `/api/admin/reports/[id]`    | Get single report + roles |
| PUT    | `/api/admin/reports/[id]`    | Update report + roles     |
| DELETE | `/api/admin/reports/[id]`    | Soft-delete (IsActive=0)  |
| GET    | `/api/admin/users`           | List users + roles        |
| POST   | `/api/admin/users`           | Create user               |
| PUT    | `/api/admin/users`           | Update user               |
| GET    | `/api/admin/settings`        | Get all settings          |
| PUT    | `/api/admin/settings`        | Update settings           |

### Dashboard

| Method | Path              | Description                      |
|--------|-------------------|----------------------------------|
| GET    | `/api/dashboard`  | Stats (totals) + recent activity |

---

## 6. Environment Variables

```env
# Central ReportCenter Database
DB_USER=sa
DB_PASSWORD=Sonic@rama3
DB_SERVER=192.168.110.106
DB_DATABASE=ReportCenterDB

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
JWT_SECRET=rc-super-secret-key-2026
```

> ⚠️ ปัจจุบันค่า default ถูก hardcode อยู่ใน `src/lib/db.js` — สำหรับ production ควรใช้ `.env.local`

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
| `lucide-react` | latest | Icon library                 |
| `@dnd-kit` | latest  | Drag and drop (template builder) |

---

## 8. Important Notes for Developers

### Next.js 16 Breaking Changes
- **`params` is a Promise**: ในทุก API route ที่ใช้ dynamic segment `[id]`, ต้อง `await props.params` ก่อนเข้าถึง `id`
- **Middleware → Proxy**: Next.js 16 แสดง warning ว่า middleware จะเปลี่ยนเป็น "proxy" ในอนาคต

### Route Groups
- หน้า Login อยู่ที่ `src/app/login/` (ไม่มี Sidebar/Header)
- หน้าอื่นๆ ทั้งหมดอยู่ใน `src/app/(dashboard)/` ซึ่งครอบด้วย `AppLayout`

### Security
- JWT cookie: `httpOnly`, `sameSite: lax`, `maxAge: 8 ชั่วโมง`
- Password: bcrypt hash (salt rounds = 10)
- SQL: ใช้ parameterized queries ทุกจุดเพื่อป้องกัน SQL Injection
- Role-based access: Admin เมนูซ่อนจาก non-admin users ใน Sidebar

### Database
- Connection pooling ผ่าน `src/lib/db.js` — สร้าง pool ครั้งเดียว reuse ตลอด
- รองรับ 3 บริษัท (3 company databases) + 1 central DB
- `SystemSettings` table ถูกสร้างอัตโนมัติครั้งแรกที่เข้าหน้า Settings

---

## 9. Scripts Reference

```bash
# Hash a password for DB insertion
node scripts/hash-password.js MyPassword123

# Update admin password in DB
node scripts/update-admin-password.js

# Create ActivityLogs table (if not exists)
node scripts/create-activity-logs.js
```

---

## 10. Feature Roadmap (Future)

- [ ] Mobile responsive sidebar (hamburger menu)
- [ ] Dark mode toggle
- [ ] Report scheduling (auto-generate at intervals)
- [ ] Email notification integration
- [ ] Audit log viewer page for admins
- [ ] User self-service password change
