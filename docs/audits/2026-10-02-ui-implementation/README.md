# ReportCenter — ตรวจ UI implementation จาก v3

วันที่ 2 ต.ค. 2026 · Next.js app ในเครื่องที่ `http://localhost:4000` · [รายละเอียด implementation/source](../../design/2026-10-02-ui-implementation.md)

> **ประวัติรอบแรก ไม่ใช่หลักฐาน parity ล่าสุด:** หลังผู้ใช้ทักพบ Standard และบางรายละเอียดอีก4หน้าตกหล่น จึงแก้และตรวจซ้ำใน [รายงานทวนเทียบ mock v3](../2026-10-02-ui-parity-recheck/README.md) ภาพ08ด้านล่างยังอยู่ระหว่างโหลดและภาพ04ก่อนแก้scrollซ้อน ไม่ใช้สองภาพนี้รับรองหน้าปัจจุบัน ใช้ภาพใหม่15ภาพและรายการขอบเขตที่ยังไม่เสร็จจากรายงานล่าสุดแทน

ผลนี้ตรวจ app ที่แก้จริง แยกจาก [mock v3](../../design/2026-10-02-mockups-v3/README.md) ใช้ session Admin ที่มีอยู่และ GET API จริง ไม่มี API mock/intercept ตัวเลขในหน้าจอเป็น snapshot local ไม่ใช่กฎธุรกิจหรือข้อมูลตัวอย่างที่นำไปตั้งต้นระบบ

การตรวจใช้การเปิดหน้า เปลี่ยนตัวกรอง/selection กรอก draft และยกเลิกหรือทิ้ง draft โดยไม่บันทึก ไม่มี live CRUD, AD lookup/Sync, การออกจากระบบจริง, การดึง/ส่งออกรายงาน หรือการส่งอีเมล/รันกำหนดการ การเรียก GET ไม่ใช่การรับรองว่า API ปราศจาก side effect เพราะ category/users API มีขั้นตอนเตรียม schema เดิมอยู่แล้ว

## ผล desktop และ keyboard

| ส่วน | สิ่งที่ทดลองและผล |
|---|---|
| หมวด ↔ ทะเบียน | เปิดยังไม่จัดหมวดและทะเบียนที่กรองตรงกัน จำนวน active/inactive/ทั้งหมดตรงกับข้อมูลที่หน้าได้รับ; ลิงก์กลับและเปิด URL เดิมรักษาบริบทหมวด |
| Draft หมวด | แก้ข้อความแล้ว Cancel/เปลี่ยนหน้ามีคำยืนยัน; ยกเลิก logout ยังอยู่กับ draft และไม่มีการ logout จริง |
| กลุ่มสิทธิ์ | ค้นหารายงานแล้วจำนวนที่เลือกทั้งหมดแยกจากจำนวนในผลค้นหา; Space เปลี่ยน checkbox และเพิ่มจำนวนโดย focus คงที่; Cancel รักษาการยืนยันก่อนทิ้ง draft; เทียบกลุ่มระบุเฉพาะรายงานที่ใช้งาน |
| ผู้ใช้ | Create Local/AD และ Edit แสดงสรุปกลุ่ม จำนวนรายงาน active และบริษัทตาม draft; บริษัทต้นสังกัด AD แยกจากบริษัทที่อนุญาต; บัญชีปัจจุบันแก้กลุ่ม/สถานะไม่ได้; ไม่ทดลองค้นหา AD หรือบันทึก |
| Dialog ซ้อนคำยืนยัน | Cancel และ discard ทำงานตามบริบทและคืน focus; ไม่มีการทดสอบ screen reader ในรอบนี้ |
| รายงานมาตรฐาน | เลือก AP Document แล้วแสดงบริษัทและเงื่อนไขจริงจาก metadata (`CutoffDate` / G/L Date และ Age as of); ล้างรายงานแล้วซ่อนบริษัท; ลำดับยังเป็น report-first ปุ่มพิมพ์ถูกตัดตามแบบที่อนุมัติ ไม่เปลี่ยน export API |
| ธีม | ตรวจ Roles และ Standard ทั้ง light/dark; ปรับข้อความ muted ใน dark เป็น RGB 148/163/184 และตรวจการแสดงผลจริง ตัวอย่างข้อความ Standard RGB 226/232/240 บนพื้น RGB 30/41/59; ไม่ใช้ผลนี้อ้างว่า audit contrast/WCAG ครบทุกองค์ประกอบ |

## ผล viewport 390×844

- Roles, Categories, Users และ Standard ที่เปิดตรวจไม่มี horizontal overflow ของ document; ภาพ Registry รอบนี้ยังอยู่ loading จึงไม่ยืนยันตารางหลังโหลด ให้ใช้ผล viewport และภาพ07ในรายงานทวนล่าสุดแทน
- Dialog ผู้ใช้มีพื้นที่เลื่อนเนื้อหาเพียงส่วนเดียวและปุ่มท้ายฟอร์มยังมองเห็นได้; ตรวจ outer client/scroll height เท่ากัน 810px และ overflow hidden ไม่เกิดแถบเลื่อนชั้นนอกซ้ำ
- เปิดเมนู mobile แล้วกดลิงก์นำทางจริง เมนูปิดหลังเปลี่ยนหน้า
- หลังจบคืน viewport เป็น 1600×709 และธีม light ตามเดิม Console warning/error 0 ใน browser รอบตรวจ

## ภาพหลักฐาน

ภาพเก็บจาก app ในเครื่อง ไม่ใช่ mock ไม่มีการบันทึกข้อมูลส่วนบุคคลที่ไม่จำเป็น ใช้ภาพเพื่ออธิบาย layout/state ที่ตรวจ ไม่ใช้แทนหลักฐานการทำงานของปุ่มทุกปุ่ม

| ภาพ | ขอบเขต |
|---|---|
| [01 — Categories](screenshots/01-categories.png) | หมวด/รายละเอียดและจำนวน |
| [02 — Roles selection](screenshots/02-roles-selection.png) | draft สิทธิ์และขอบเขต selection |
| [03 — Roles dark](screenshots/03-roles-dark.png) | รายละเอียดกลุ่มในธีม dark |
| [04 — User summary](screenshots/04-user-summary.png) | ประวัติสรุปผู้ใช้ก่อนแก้ scroll ซ้อน ไม่ใช่ layout ปัจจุบัน |
| [05 — User mobile](screenshots/05-user-mobile.png) | dialog/footer ใน viewport แคบ |
| [06 — Roles mobile](screenshots/06-roles-mobile.png) | กลุ่มสิทธิ์ใน viewport แคบ |
| [07 — Categories mobile](screenshots/07-categories-mobile.png) | หมวดใน viewport แคบ |
| [08 — Registry mobile](screenshots/08-registry-mobile.png) | สถานะ loading ยังใช้ยืนยันแถว/การเลื่อนตารางหลังโหลดไม่ได้ |
| [09 — Standard mobile](screenshots/09-standard-mobile.png) | report-first และเงื่อนไขต่อรายงาน |
| [10 — Standard mobile dark](screenshots/10-standard-mobile-dark.png) | เงื่อนไขและธีม dark |
| [11 — Roles final](screenshots/11-roles-final.png) | กลุ่มสิทธิ์ใน layout สุดท้าย |

## คำสั่งตรวจ

| คำสั่ง/ขอบเขต | ผล |
|---|---|
| `npm test -- --exclude '**/.claude/**' --reporter=dot` | 15 files passed / 151 tests passed / 1 todo เดิม; ไม่รวม tests ซ้ำจาก nested worktree |
| `npx tsc --noEmit --incremental false` | ผ่าน |
| ESLint ทุกไฟล์ source ที่เปลี่ยน | ผ่าน |
| `npm run lint -- --ignore-pattern '**/.claude/**' --ignore-pattern 'docs/**'` | 58 errors / 56 warnings ในไฟล์ที่ไม่ได้แก้; repo lint ยังไม่ผ่านทั้งชุด |
| `npm run build` | ผ่าน exit 0 หลังปรับ UI รอบสุดท้าย: compile 7.6 วินาที, TypeScript และ 50 static pages; มี warning เดิมเรื่อง middleware ของ Next.js 16.1.6 |
| `git diff --check` | ผ่าน มีเพียงคำเตือนรูปแบบ line ending CRLF จาก Git |

API tests ใช้ DB/session fixtures ส่วน browser ใช้ GET จริงตามขอบเขตข้างต้น ไม่ถือว่าเป็น live SQL mutation/integration test

## ข้อจำกัดที่ยังอยู่

- Draft guard ครอบคลุม local context, dialog close, ลิงก์ภายใน, beforeunload และ logout ที่เชื่อม guard; ยังไม่ครอบคลุม SPA browser Back/Forward ไม่อ้างว่า guard ทุกการนำทางแล้ว
- ยังไม่ทดสอบ screen reader, browser/device ทุกชนิด, live CRUD/AD หรือ run/export กับข้อมูลจริง การตรวจ viewport แคบไม่ใช่ UAT mobile ครบทุก workflow
- Admin/self guard ใหม่อยู่ใน UI ไม่เพิ่ม server-side enforcement; ไม่ยืนยันการลบ schedules แบบ cascade หรือแก้ข้อค้าง backend ใน F7 ทั้งหมด ดู [implementation record](../../design/2026-10-02-ui-implementation.md)
- ไม่มี deployment, UAT หรือการรับรองยอดรายงานใหม่จากผลนี้ ไม่เปลี่ยนคำยืนยันเดิมของผู้ใช้ว่าอีเมลและระบบตั้งเวลาใช้งานได้

Source: [Handoff](../../../DEVELOPER_HANDOFF.md), [decision log](../../12_DECISION_LOG.md), [roles](../../../src/app/(dashboard)/admin/roles/page.tsx), [categories](../../../src/app/(dashboard)/admin/categories/page.tsx), [users](../../../src/app/(dashboard)/admin/users/page.tsx), [registry](../../../src/app/(dashboard)/admin/reports/page.tsx), [standard](../../../src/app/(dashboard)/reports/standard/page.tsx), [dialog](../../../src/components/ui/AccessibleDialog.tsx), [draft hook](../../../src/hooks/useUnsavedChanges.ts), [leave guard](../../../src/lib/page-leave-guard.ts), [Sidebar](../../../src/components/layout/Sidebar.tsx), [CSS](../../../src/app/globals.css)
