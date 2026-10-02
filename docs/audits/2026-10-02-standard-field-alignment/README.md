# Standard reports — แนวและขนาดช่องเงื่อนไข

2 ต.ค. 2026 · local app `http://localhost:4000/reports/standard`

ผู้ใช้พบว่าช่องเงื่อนไขไม่เสมอกันหลังรอบ parity recheck ตรวจ DOM แล้วพบ CompanySelector สูง44px แต่ native date input สูง36px ส่วน Typeahead ใช้ความสูงจาก padding ของ component อีกชุด การตรวจภาพรอบก่อนยังไม่ครอบคลุมความสม่ำเสมอนี้

## สิ่งที่แก้

- ช่องบริษัท วันที่ ตัวเลข ข้อความ และช่องค้นหาใน Standard ใช้ความสูง44px/ตัวอักษร14px ความกว้างเท่ากันตามคอลัมน์
- แต่ละ field ใช้ subgrid แชร์แถว label/control/helper เพื่อให้ขอบช่องตรงกันแม้ label ยาว ไม่จัดแนวตามข้อความช่วยใต้บริษัท และไม่ล็อกความสูง label จนตัดข้อความ
- Typeahead รับขนาดผ่าน prop เฉพาะ Standard ไม่เปลี่ยน default ของ Templates; CompanySelector มี consumer เฉพาะ Standard
- ไม่เปลี่ยน metadata/ชื่อเงื่อนไข การเรียกรายงาน หรือ API

## ผลตรวจรอบนี้

| กรณี | ผลจาก DOM / หน้าจอ |
|---|---|
| AP Document ก่อนแก้ desktop1600×709 | ขอบบนตรง396.5px แต่บริษัทสูง44px/วันที่36px ขอบล่างต่าง8px |
| AP Document หลังแก้ desktop1600×1000 | บริษัทและวันที่ทั้ง3ช่องเริ่ม397px สูง44px กว้างประมาณ231.6px เท่ากัน (ต่างต่ำกว่า0.02pxจากการปัดเศษ grid) |
| GL Data desktop | บริษัท1ช่อง+ข้อความ5ช่อง รวม6ช่องสูง44px คอลัมน์กว้างเท่ากัน แถวแรกเริ่ม397px แถวถัดไป495px |
| Statement desktop | บริษัท+วันที่+ตัวเลข FISYEAR ทั้ง4ช่องสูง44px เริ่ม397px เท่ากัน |
| AP Document mobile390×844 | ทั้ง3ช่องสูง44px กว้าง285px ขอบซ้าย45px; body390px ไม่ล้นจอ |
| Scoped ESLint / TypeScript | ESLint Standard+CompanySelector และ `npx tsc --noEmit --incremental false` ผ่านรอบนี้ |

ไม่มี console warn/error ใน flow ที่ตรวจ ไม่รัน report/export/lookup search หรือเขียนข้อมูลจริง Typeahead และ long-label alignment ตรวจ source; ยังไม่ได้ทดลอง lookup interaction หรือทุก report/label จริง ไม่เพิ่ม unit test ที่ตรวจเพียง CSS class; ใช้ DOM measurements และภาพเป็นหลักฐานตรงปัญหา รอบแก้ alignment ตรวจ scoped lint/TypeScript ก่อน แล้วรันชุดตรวจรวมหลังผู้ใช้สั่ง commit/push ตามผลด้านล่าง ยังไม่ deploy/UAT

## ตรวจรวมก่อน commit/push

รันใหม่วันที่ 2 ต.ค. 2026 หลังแก้ alignment และรวม implementation ทั้ง 5 หน้า:

- `npm test -- --exclude '**/.claude/**' --reporter=dot`: exit 0, 15 files passed, 160 tests passed / 1 todo; exclude worktree เพื่อไม่รวม tests ซ้ำ
- `npm run build`: exit 0, TypeScript ผ่าน, static pages 50/50; มี warning เดิมเรื่อง middleware → proxy
- `npx eslint -- <ไฟล์ src ที่แก้หรือเพิ่ม 28 ไฟล์>`: exit 0, ไม่มี lint diagnostics; ไม่ใช่ผล lint ทั้ง repo
- `git diff --check`: exit 0

ผลนี้เป็นการตรวจโค้ดในเครื่อง ไม่ได้เรียก report/export, เขียนข้อมูลจริง หรือยืนยัน deployment/UAT

## ภาพหลังแก้

- [AP desktop](01-ap-desktop.png)
- [GL Data หลายแถว](02-gl-desktop.png)
- [AP mobile](03-ap-mobile.png)

## Sources และผลทวน

[Handoff](../../../DEVELOPER_HANDOFF.md), [implementation](../../design/2026-10-02-ui-implementation.md), [parity recheck](../2026-10-02-ui-parity-recheck/README.md), [Standard page](../../../src/app/(dashboard)/reports/standard/page.tsx), [CompanySelector](../../../src/components/CompanySelector.tsx), [TypeaheadInput](../../../src/components/TypeaheadInput.tsx)

Handoff/implementation เรื่อง report-first และเงื่อนไขเฉพาะรายงาน **ตรงและคงไว้**; ข้อสรุป visual QA รอบก่อน **ไม่ครอบคลุมความสูงที่ต่างกัน** จึงใช้ภาพและการวัดรอบนี้อ้างอิงเงื่อนไขแทน ส่วน live execute/export/deployment **ยังไม่ได้ตรวจในรอบนี้**
