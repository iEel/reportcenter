# ผลเทียบ Handoff/docs กับโค้ด — 2026-09-29

ขอบเขต: ทวนหัวข้อหลักด้านสถาปัตยกรรม รายงาน สิทธิ์ session, jobs, email, deployment configuration และ Report Selector ไม่ใช่การรับรองทุกข้อความใน Handoff หรือการตรวจความปลอดภัยทั้งระบบ ไม่ได้แก้โค้ด runtime หรือเชื่อมระบบบริษัท

## ตารางหลักฐาน

| ข้ออ้างในเอกสาร | ผลเทียบ | หลักฐาน / ขอบเขต |
|---|---|---|
| Handoff: Next.js/React, dev/start พอร์ต 4000 | ตรง | package.json; Deployment Guide ใช้ upstream 4000 ตรงกัน แต่ตัวอย่าง environment เก่าของ Handoff ยังเขียน default 3000 |
| Handoff: ฐานกลาง + dynamic CompanyDatabases และ fallback environment | ตรงในโค้ด | src/lib/db.js; ไม่ได้ยืนยันตารางหรือค่า environment จริง |
| Handoff §3: dropdown กรองบริษัทตาม allowedCompanies | ไม่ตรงสำหรับ Standard Reports | src/app/(dashboard)/reports/standard/page.tsx ใช้ allowedCompanies ตั้งค่าเริ่มต้น แต่ render companies.map; src/app/api/companies/route.js ส่งบริษัท active ทั้งหมด |
| Handoff §10: สิทธิ์ Role สำหรับ execute, execute-async, parameters, search-param | พบ checks ทั้งสี่เส้นทาง | src/app/api/reports/execute/route.js, execute-async/route.js, parameters/route.js, search-param/route.js; สิทธิ์รายงานไม่เท่ากับสิทธิ์บริษัท |
| การบังคับสิทธิ์บริษัทในเส้นทางรายงาน | ไม่สม่ำเสมอ | search-param ตรวจ allowedCompanies; execute/execute-async ไม่พบ check ก่อนเลือกฐานบริษัท ข้อสังเกตจาก source ยังไม่ทดสอบการเรียกข้ามบริษัทจริง |
| Handoff: env-check บังคับ required variables | ถ้อยคำเกินพฤติกรรมจริง | src/lib/env-check.js ใช้ console.error/console.warn แต่ไม่ throw/exit เมื่อค่าขาด; ไม่ใช่ startup gate |
| Handoff: session revocation และ cache 60 วินาที | มีจริงแต่มีข้อจำกัด | src/lib/auth.js ตรวจ IsActive/TokenVersion และ cache 60 วินาที; เมื่อ DB check ผิดพลาด return true; search-param ใช้ verifyToken แทน getSession จึงไม่ผ่าน revocation helper นี้ |
| Handoff: background CSV / streaming / back-pressure / progress ทุก 10,000 แถว | ตรงในโค้ด | src/app/api/reports/execute-async/route.js มี stream, pause/resume, createWriteStream และ RowCount; ข้ออ้าง RAM ~50MB / รองรับ 1M+ แถวไม่ยืนยัน เพราะไม่มี benchmark รอบนี้ |
| Handoff: job files 24 ชม., records 7 วัน, notification 30/90 วัน | พบเงื่อนไขในโค้ด | execute-async/route.js และ src/app/api/cron/execute-schedules/route.js; cleanup ขึ้นกับการเรียกเส้นทาง/cron ไม่ได้ยืนยันว่าเซิร์ฟเวอร์ตั้ง cron แล้ว |
| Handoff: Graph API แล้ว fallback SMTP | ตรงในโค้ด | src/lib/email.js; ไม่ได้ส่งอีเมลหรือทดสอบ credential |
| Deployment Guide: cron ใช้ secret และพอร์ต 4000 | ตรงในเส้นทางที่อ่าน | src/app/api/cron/execute-schedules/route.js และ sync-ad/route.js ตรวจ secret; src/middleware.ts ข้าม cron แล้วให้ handler ตรวจเอง; ไม่ได้ทดสอบ deploy/Cloudflare/PM2 |
| Handoff §10: 114 passing, 1 todo | ตรงกับผลรอบนี้ | npm test -- --reporter=dot: 8 test files, 114 passed, 1 todo; §12 roadmap ยังมีข้อความเก่า 20 tests |

## Report Selector: spec/plan เทียบ implementation

Sources: docs/superpowers/specs/2026-08-14-standard-report-selector-design.md, docs/superpowers/plans/2026-08-14-standard-report-selector.md, src/lib/report-selector.ts, src/lib/__tests__/report-selector.test.ts, src/components/ReportSelector.tsx และ src/app/(dashboard)/reports/standard/page.tsx

- พบ helper, component และ integration แล้ว แม้ checkbox ใน plan ยังไม่ติ๊ก จึงห้ามสรุปว่ายังไม่ implement จากแผนเพียงอย่างเดียว
- ค้นชื่อ/คำอธิบาย/หมวดแบบ case-insensitive; จัดกลุ่ม เรียงชื่อ และนำหมวดอื่น ๆ ไปท้าย; helper tests มี 11 กรณีและอยู่ในชุดที่ผ่านรอบนี้
- component มี combobox/listbox semantics, Arrow Up/Down, Enter, Escape, clear selection; ส่ง onSelect ให้ parent และใช้ favorite flow เดิม การอ่าน source ไม่ใช่การรับรอง accessibility หรือ browser interaction
- ข้อความ placeholder/empty/no-results ใน component ต่างจากถ้อยคำใน spec; บันทึกเป็นความแตกต่างด้าน copy ยังไม่ถือว่าผู้ใช้อนุมัติแก้ spec แล้ว
- plan ตัวอย่าง filterReports คืน array สำเนาเมื่อ query ว่าง แต่โค้ดคืน array เดิม; ไม่มีหลักฐานในรอบนี้ว่าความต่างด้าน reference ทำให้ผิด requirement
- ยังไม่ตรวจ browser ตาม Task 5 ของแผน และไม่ได้รัน build/lint รอบนี้ จึงไม่ติ๊กแผนย้อนหลังหรืออ้าง UAT ผ่าน

## ผลตรวจและข้อจำกัด

คำสั่ง `npm test -- --reporter=dot` ผ่าน 8 ไฟล์: 114 passed / 1 todo (2026-09-29) โดย DB/LDAP ในชุดทดสอบถูก mock; error output ของกรณี DB crash/down เป็นสถานการณ์จำลองที่ test คาดไว้ ไม่ใช่หลักฐานว่า DB จริงล่ม

Tests ยืนยันเฉพาะกรณีที่ครอบคลุม ไม่ยืนยันยอดรายงาน AP Aging, AD จริง, permission ทุกเส้นทาง, โหลดระดับล้านแถว, การส่งอีเมล หรือสถานะ production

รายการที่ควรตามต่อ: สิทธิ์บริษัท, ขอบเขต revocation, enforcement ของ environment และข้อความเก่าใน Handoff ดูวิกิ rc-open-questions; การแก้พฤติกรรมระบบต้องเป็นงานแยกจากการทวนเอกสารนี้
