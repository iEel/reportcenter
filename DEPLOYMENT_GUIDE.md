# ReportCenter — Deployment Guide (Ubuntu Server + Cloudflare Zero Trust)

> **Target OS:** Ubuntu 22.04 LTS / 24.04 LTS  
> **Last Updated:** 2026-02-22

---

## Architecture Overview

```
User → Cloudflare Zero Trust (HTTPS + Auth)
         ↓ Cloudflare Tunnel (cloudflared)
     Nginx (localhost:80) ← reverse proxy
         ↓
     Next.js (localhost:4000) ← PM2
         ↓
     MSSQL Databases
```

> 🔒 **ไม่ต้องเปิดพอร์ตใดๆ สู่ภายนอก** — Cloudflare Tunnel สร้าง outbound connection จาก server  
> ✅ **Nginx** ทำหน้าที่ reverse proxy, proxy headers, timeouts, และจัดการ static files ถ้าต้องการ

---

## 1. Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js  | 20+ LTS | Runtime |
| npm      | 10+     | Package manager |
| Git      | 2.x     | Clone repository |
| PM2      | 5.x     | Process manager (auto-restart) |
| Nginx    | 1.x     | Reverse proxy (local buffer) |
| cloudflared | latest | Cloudflare Tunnel agent |

---

## 2. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # v20.x
npm -v    # 10.x
```

---

## 3. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Auto-start on reboot
pm2 startup systemd
# (follow the output command)
```

---

## 4. Clone & Setup Project

```bash
cd /opt
sudo git clone https://github.com/iEel/reportcenter.git
sudo chown -R $USER:$USER /opt/reportcenter
cd /opt/reportcenter

npm install
```

---

## 5. Configure Environment

```bash
nano /opt/reportcenter/.env.local
```

```env
# === Central ReportCenter Database ===
DB_USER=sa
DB_PASSWORD=your-db-password
DB_SERVER=192.168.110.106
DB_DATABASE=ReportCenterDB
DB_INSTANCE=alpha
DB_REQUEST_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_POOL_MIN=2
DB_POOL_MAX=20

# === Company Databases ===
C1_DB_USER=smf
C1_DB_PASSWORD=your-password
C1_DB_SERVER=192.168.110.200
C1_DB_DATABASE=SONIC2021
C1_DB_INSTANCE=SONIC

C2_DB_USER=smf
C2_DB_PASSWORD=your-password
C2_DB_SERVER=192.168.110.200
C2_DB_DATABASE=GLEDB2014
C2_DB_INSTANCE=GLINK

C3_DB_USER=smf
C3_DB_PASSWORD=your-password
C3_DB_SERVER=192.168.110.200
C3_DB_DATABASE=SMF-AUTOLOGIS
C3_DB_INSTANCE=AUTOLOGIS

# === JWT Secret (เปลี่ยนใน production!) ===
JWT_SECRET=your-strong-random-secret-here

# === SMTP (for email fallback) ===
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=report@yourcompany.com
SMTP_PASS=your-app-password
SMTP_FROM=ReportCenter <report@yourcompany.com>

# === Server Port ===
PORT=4000

# === Cron Secret ===
CRON_SECRET=your-cron-secret-here

# === Azure AD OAuth2 (for Microsoft Graph API email) ===
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

> ⚠️ **สำคัญ**: เปลี่ยน `JWT_SECRET` และ `CRON_SECRET` เป็นค่าสุ่มที่ปลอดภัย  
> ใช้ `openssl rand -base64 32` สร้างค่าสุ่ม

---

## 6. Build & Start

```bash
cd /opt/reportcenter

# Run tests first
npm run test

# Build production
npm run build

# Start with PM2
pm2 start npm --name "reportcenter" -- start
pm2 save

# Verify
pm2 status
curl http://localhost:4000   # ต้องเห็น HTML response
```

### PM2 Commands Reference

```bash
pm2 restart reportcenter     # รีสตาร์ท
pm2 stop reportcenter        # หยุด
pm2 delete reportcenter      # ลบ
pm2 logs reportcenter        # ดู logs
pm2 monit                    # monitor real-time
```

---

## 7. Nginx Reverse Proxy (Local)

ติดตั้ง Nginx เพื่อคั่นกลางระหว่าง Cloudflare Tunnel กับ Next.js:

```bash
sudo apt install -y nginx
```

```bash
sudo nano /etc/nginx/sites-available/reportcenter
```

```nginx
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for large reports
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/reportcenter /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test & reload
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx

# Verify
curl http://localhost   # ต้องเห็น Next.js response
```

---

## 8. Install Cloudflare Tunnel (`cloudflared`)

```bash
# Add Cloudflare GPG key & repository
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install
sudo apt update
sudo apt install -y cloudflared

# Verify
cloudflared --version
```

---

## 9. Cloudflare Zero Trust Setup

### 9.1 สร้าง Tunnel ผ่าน Dashboard

1. เข้า [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. ไปที่ **Networks** → **Tunnels**
3. กด **Create a tunnel**
4. ตั้งชื่อ tunnel: `reportcenter`
5. เลือก **Cloudflared** → Copy install command

### 9.2 ติดตั้ง Connector บน Server

รัน command ที่ copy มาจาก Dashboard:

```bash
# ตัวอย่าง (token จะแตกต่างกัน)
sudo cloudflared service install eyJhIjoixxxxxxxxxx...
```

ตรวจสอบ:
```bash
sudo systemctl status cloudflared
# ● cloudflared.service - cloudflared
#    Active: active (running)
```

### 9.3 ตั้งค่า Public Hostname

กลับไปที่ Cloudflare Dashboard → Tunnel → **Configure** → **Public Hostname**:

| Field | Value |
|-------|-------|
| **Subdomain** | `reportcenter` |
| **Domain** | `yourcompany.com` |
| **Type** | `HTTP` |
| **URL** | `localhost:80` |

> 💡 **Tunnel → Nginx (port 80) → Next.js (port 4000)**  
> Nginx จัดการ proxy headers, buffering, logging ให้  
> ไม่ต้องใช้ HTTPS เพราะ `cloudflared` สร้าง encryption อุโมงค์ไป Cloudflare แล้ว

กด **Save** → ตอนนี้ `https://reportcenter.yourcompany.com` พร้อมใช้งานแล้ว!

### 9.4 ตั้ง Access Policy (จำกัดสิทธิ์เข้าถึง)

เพื่อให้เฉพาะพนักงานในบริษัทเข้าถึงได้:

1. ไปที่ **Access** → **Applications** → **Add an application**
2. เลือก **Self-hosted**
3. ตั้งค่า:

| Field | Value |
|-------|-------|
| **Application name** | ReportCenter |
| **Session Duration** | 24 hours |
| **Application domain** | `reportcenter.yourcompany.com` |

4. สร้าง **Policy**:

| Field | Value |
|-------|-------|
| **Policy name** | Allow Company |
| **Action** | Allow |
| **Include** | Emails ending in `@yourcompany.com` |

5. **Authentication** → เลือกวิธี login:
   - **One-time PIN** (ส่ง OTP ทาง email) — ง่ายที่สุด
   - **Google Workspace** / **Microsoft Azure AD** — SSO

### 9.5 Bypass API สำหรับ Cron

Cron job รันจาก server เอง (localhost) → ไม่ผ่าน Cloudflare → ไม่มีปัญหา

```bash
# Cron เรียก localhost โดยตรง — วิ่งเข้า Next.js ตรงๆ ได้เลย ไม่ผ่าน authentication
curl http://localhost:4000/api/cron/execute-schedules?secret=your-cron-secret
```

ถ้าต้องการเรียกจากภายนอกผ่าน Cloudflare → สร้าง **Service Token** ใน Access เพื่อ bypass auth (ดูเพิ่มเติมในเอกสาร Cloudflare)

---

## 10. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

> 🔒 **แค่เปิด SSH เท่านั้น!** ไม่ต้องเปิดพอร์ต 80, 443, หรือ 4000 เพราะ `cloudflared` สร้าง outbound tunnel โทรกลับไปตั้งต้นที่ Cloudflare เอง

---

## 11. Cron Job (Scheduled Reports)

```bash
crontab -e
```

```bash
# รันทุก 5 นาที — เรียกเข้า Next.js โดยตรง
*/5 * * * * curl -s http://localhost:4000/api/cron/execute-schedules?secret=your-cron-secret-here >> /var/log/reportcenter-cron.log 2>&1
```

---

## 12. Update / Deploy New Version

```bash
cd /opt/reportcenter && git pull && npm install && npm run build && pm2 restart reportcenter
```

### Deploy Script

```bash
nano /opt/reportcenter/deploy.sh
```

```bash
#!/bin/bash
set -e
cd /opt/reportcenter
echo "🔄 Pulling latest code..."
git pull origin master
echo "📦 Installing dependencies..."
npm install
echo "🔨 Building..."
npm run build
echo "🚀 Restarting..."
pm2 restart reportcenter
echo "✅ Deploy complete!"
```

```bash
chmod +x /opt/reportcenter/deploy.sh
```

---

## 13. Monitoring & Logs

```bash
# PM2 logs
pm2 logs reportcenter

# PM2 monitor
pm2 monit

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Cloudflare Tunnel status
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f

# Cron log
tail -f /var/log/reportcenter-cron.log
```

---

## 14. Troubleshooting

### App won't start
```bash
pm2 logs reportcenter --lines 50
node -v                              # ต้อง 20+
cat .env.local                       # ตรวจ env vars
```

### Tunnel disconnected
```bash
sudo systemctl status cloudflared    # ตรวจ status
sudo systemctl restart cloudflared   # รีสตาร์ท
sudo journalctl -u cloudflared -n 50 # ดู error logs
```

### 502 Bad Gateway (Cloudflare)
```bash
# 1. ตรวจ Next.js
pm2 status
curl http://localhost:4000

# 2. ตรวจ Nginx
sudo systemctl status nginx
curl http://localhost

# 3. ตรวจ Tunnel
sudo systemctl status cloudflared
```

### Database connection failed
```bash
telnet 192.168.110.106 1433          # ตรวจ MSSQL
```

### Email ส่งไม่ได้
```bash
pm2 logs reportcenter | grep "Email"
```

---

## 15. Security Checklist

- [ ] เปลี่ยน `JWT_SECRET` เป็นค่าสุ่ม (`openssl rand -base64 32`)
- [ ] เปลี่ยน `CRON_SECRET` เป็นค่าสุ่ม
- [ ] ตั้ง Cloudflare Access Policy (จำกัด email/SSO)
- [ ] UFW เปิดแค่ SSH เท่านั้น
- [ ] Nginx ผูกไว้แค่ localhost (listen 80)
- [ ] `.env.local` ไม่ถูก commit (อยู่ใน `.gitignore`)
- [ ] Cloudflare Tunnel ตั้ง auto-start (`systemctl enable cloudflared`)

---

## Quick Reference

```
📁 /opt/reportcenter              — Project root
📄 /opt/reportcenter/.env.local   — Environment config
🚀 pm2 restart reportcenter       — Restart Next.js app
🔄 sudo systemctl restart nginx   — Restart Nginx
📋 pm2 logs reportcenter          — View logs
🔄 /opt/reportcenter/deploy.sh    — One-click deploy
🔒 sudo systemctl status cloudflared — Tunnel status
🌐 https://reportcenter.yourcompany.com — Access URL
☁️  https://one.dash.cloudflare.com     — Zero Trust Dashboard
```
