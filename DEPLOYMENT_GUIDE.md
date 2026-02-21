# ReportCenter — Deployment Guide (Ubuntu Server)

> **Target OS:** Ubuntu 22.04 LTS / 24.04 LTS  
> **Last Updated:** 2026-02-22

---

## 1. Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js  | 20+ LTS | Runtime |
| npm      | 10+     | Package manager |
| Git      | 2.x     | Clone repository |
| PM2      | 5.x     | Process manager (auto-restart) |
| Nginx    | 1.x     | Reverse proxy + SSL |

---

## 2. Install Node.js 20 LTS

```bash
# NodeSource repository
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
# (follow the output command, e.g. sudo env PATH=... pm2 startup ...)
```

---

## 4. Clone & Setup Project

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/iEel/reportcenter.git
sudo chown -R $USER:$USER /opt/reportcenter
cd /opt/reportcenter

# Install dependencies
npm install
```

---

## 5. Configure Environment

```bash
cp .env.example .env.local   # หรือสร้างใหม่
nano .env.local
```

```env
# === Central ReportCenter Database ===
DB_USER=sa
DB_PASSWORD=your-db-password
DB_SERVER=192.168.110.106
DB_DATABASE=ReportCenterDB
DB_INSTANCE=alpha

# === Company Databases ===
C1_DB_USER=smf
C1_DB_PASSWORD=your-password
C1_DB_SERVER=192.168.110.200
C1_DB_DATABASE=SONIC2021

C2_DB_USER=smf
C2_DB_PASSWORD=your-password
C2_DB_SERVER=192.168.110.200
C2_DB_DATABASE=GLEDB2014

C3_DB_USER=smf
C3_DB_PASSWORD=your-password
C3_DB_SERVER=192.168.110.200
C3_DB_DATABASE=SMF-AUTOLOGIS

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

---

## 6. Build & Start

```bash
# Build production
npm run build

# Start with PM2
pm2 start npm --name "reportcenter" -- start
pm2 save

# Check status
pm2 status
pm2 logs reportcenter
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

## 7. Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt install -y nginx
```

### Configure Site

```bash
sudo nano /etc/nginx/sites-available/reportcenter
```

```nginx
server {
    listen 80;
    server_name reportcenter.yourcompany.com;

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

# Test & reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (auto-configures Nginx)
sudo certbot --nginx -d reportcenter.yourcompany.com

# Auto-renew (certbot adds a systemd timer automatically)
sudo certbot renew --dry-run
```

---

## 9. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

> 🔒 **ไม่ต้อง** เปิดพอร์ต 4000 — Nginx ทำหน้าที่ proxy อยู่แล้ว

---

## 10. Cron Job (Scheduled Reports)

```bash
crontab -e
```

เพิ่มบรรทัด:

```bash
# รันทุก 5 นาที — ตรวจ schedules ที่ครบกำหนด
*/5 * * * * curl -s http://127.0.0.1:4000/api/cron/execute-schedules?secret=your-cron-secret-here >> /var/log/reportcenter-cron.log 2>&1
```

### ตรวจสอบ Cron

```bash
# ดู log
tail -f /var/log/reportcenter-cron.log

# ทดสอบ manual
curl http://127.0.0.1:4000/api/cron/execute-schedules?secret=your-cron-secret-here
```

---

## 11. Update / Deploy New Version

```bash
cd /opt/reportcenter

# Pull latest code
git pull origin master

# Install new dependencies (if any)
npm install

# Rebuild
npm run build

# Restart
pm2 restart reportcenter
```

### One-liner Deploy Script

```bash
cd /opt/reportcenter && git pull && npm install && npm run build && pm2 restart reportcenter
```

สร้างเป็น script ได้:

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

## 12. Monitoring & Logs

```bash
# PM2 logs (real-time)
pm2 logs reportcenter

# PM2 monitoring
pm2 monit

# Nginx access log
tail -f /var/log/nginx/access.log

# Nginx error log
tail -f /var/log/nginx/error.log

# Cron log
tail -f /var/log/reportcenter-cron.log
```

---

## 13. Troubleshooting

### App won't start
```bash
pm2 logs reportcenter --lines 50    # ดู error ล่าสุด
node -v                              # ต้อง 20+
cat .env.local                       # ตรวจ env vars
```

### Database connection failed
```bash
# ตรวจว่า MSSQL server เข้าถึงได้
telnet 192.168.110.106 1433

# ถ้าไม่ได้ — ตรวจ firewall ของ DB server
```

### Email ส่งไม่ได้
```bash
# ตรวจ Azure AD config
pm2 logs reportcenter | grep "Email"

# ต้องมี:
# - AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET ถูกต้อง
# - Azure App มี Mail.Send permission + admin consent
# - SMTP_USER ตรงกับ mailbox จริง
```

### Port conflict
```bash
# ตรวจว่า port 4000 ถูกใช้อยู่หรือไม่
sudo lsof -i :4000
# เปลี่ยน PORT ใน .env.local ถ้าต้องการ
```

---

## 14. Security Checklist

- [ ] เปลี่ยน `JWT_SECRET` เป็นค่าสุ่ม (ใช้ `openssl rand -base64 32`)
- [ ] เปลี่ยน `CRON_SECRET` เป็นค่าสุ่ม
- [ ] ตั้ง SSL (HTTPS) ผ่าน Let's Encrypt
- [ ] ปิดพอร์ตที่ไม่จำเป็น (UFW)
- [ ] ตั้ง `NODE_ENV=production` (Next.js จัดการให้ตอน `npm run build`)
- [ ] ตรวจว่า `.env.local` ไม่ถูก commit (อยู่ใน `.gitignore` แล้ว)
- [ ] ตั้ง Nginx rate limiting ถ้าเปิด public

---

## Quick Reference

```
📁 /opt/reportcenter          — Project root
📄 /opt/reportcenter/.env.local — Environment config
🔧 pm2 restart reportcenter   — Restart app
📋 pm2 logs reportcenter      — View logs
🔄 /opt/reportcenter/deploy.sh — One-click deploy
🌐 https://reportcenter.yourcompany.com — Access URL
```
