# ReportCenter — ทวน implementation เทียบ mockup v3

วันที่ 2 ต.ค. 2026 · Next.js app ในเครื่อง `http://localhost:4000` · สถานะ local

> ตรวจเพิ่มตามผู้ใช้: รอบนี้ยังตกหล่นเรื่องช่องบริษัท44px/วันที่36px แก้แนวและขนาดช่องแล้วใน [field alignment follow-up](../2026-10-02-standard-field-alignment/README.md) พร้อมภาพใหม่และ DOM measurements ภาพ Standard ด้านล่างเป็นประวัติก่อนแก้ขนาดช่อง ไม่ใช้ยืนยันความสม่ำเสมอของ controls ปัจจุบัน

การสรุปก่อนหน้าว่าแก้ครบ 5 หน้ากว้างเกินหลักฐาน: มีการแก้ source จริงทุกหน้า แต่ Standard ยังใช้โครงหน้าหลายส่วนจากแบบเดิม และมีรายละเอียดในอีก 4 หน้าตกหล่น Tests/build ยืนยัน visual parity แทนการเปิดเทียบหน้าจอไม่ได้ รายงานนี้แก้ขอบเขตคำสรุปเดิมและบันทึกการตรวจซ้ำหลังเก็บงานเพิ่ม ไม่อ้างว่าตรง mock ทุก interaction หรือทุก pixel

อ้างอิง [mock v3](../../design/2026-10-02-mockups-v3/README.md), [implementation/source](../../design/2026-10-02-ui-implementation.md), [Handoff](../../../DEVELOPER_HANDOFF.md) และ [QA รอบก่อน](../2026-10-02-ui-implementation/README.md)

หน้าที่ `http://127.0.0.1:5195/#roles` เป็น mock v3 จาก static server ตาม README ของแบบ ส่วน app ที่แก้และตรวจในรายงานนี้คือ `http://localhost:4000` ห้ามใช้การเปิด mock เป็นหลักฐานว่า source ของ app เปลี่ยนแล้ว

## ผลเทียบรายหน้า

| หน้า | ส่วนที่ตกหล่นและแก้รอบนี้ | ตรวจบน app จริง | ยังต่างจาก mock / ยังไม่ทำ |
|---|---|---|---|
| รายงานมาตรฐาน | ตัวเลือกรายงานเต็มความกว้าง ป้ายหมวด/คำอธิบายกระชับ ไฮไลต์คำค้น ทางลัด `/`; ซ่อนพื้นที่เงื่อนไขทั้งชุดก่อนเลือก; ตัวเลือกบริษัทแสดงรหัส+ชื่อ; fields และขั้นตอนในผลลัพธ์กระชับ; รายการโปรดแบบแถว; banner งานเบื้องหลังอ้างชื่อรายงานของงานนั้น | เลือก AP Document ด้วยลูกศร/Enter แล้วเห็นบริษัทและ metadata จริง; End/Enter เลือกบริษัท; Escape ปิด; ล้างรายงานแล้วซ่อนเงื่อนไข; light/dark และมือถือ | ไม่มี recent-history storage; ใช้ metadata ต่อรายงานและ `.xlsb`/CSV จริงตามระบบ ไม่คัดลอก required/regex หรือ `.xlsx` จาก mock; favorites และงาน export ที่กำลังรันตรวจ source ไม่ได้ทดลองเปลี่ยนข้อมูล/สร้างงานจริง |
| ผู้ใช้ | บริษัท 3 การ์ดแนวนอนใน create บน desktop; toolbar กระชับ; ค้นกลุ่มสิทธิ์พร้อมจำนวน active reports และดูรายงานของกลุ่มก่อนบันทึก; ป้องกัน preview ค้างข้ามรอบเปิดฟอร์ม | ค้น/เลือกกลุ่ม สรุปจำนวนและบริษัทตรง draft; เปิด nested preview แล้ว Escape คืน focus; มือถือ dropdown อยู่ในจอ/footer เข้าถึงได้; ยกเลิกแล้วทิ้ง draft โดยไม่บันทึก | ค่าเริ่มต้น Local/บริษัทเดิมคงตามระบบ; AD suggestions ยังไม่มี arrow highlight แบบ mock; ไม่เพิ่ม forced-password-change หรือเหตุการณ์ AD จำลอง; ไม่ทดลอง live save จึงไม่อ้างว่า race ระหว่าง save ถูกทดสอบ runtime |
| ทะเบียนรายงาน | ค้น `RID-0026`/`RID-26` เพิ่มจากชื่อและคำอธิบาย; filter chips ล้างแยกตัวและคืน focus ไป control ของตัวกรองนั้น | RID-0026 เหลือ Business_File v2; ล้างคำค้นแล้วสถานะยังคงอยู่; +N เปิดชื่อ 4 กลุ่มด้วย Enter, Escape คืน focus; มือถือเก็บภาพหลังมีแถวข้อมูลแล้ว | ไม่มี bulk deactivate ตาม mock; endpoint bulk เดิมรองรับ DELETE จึงไม่เพิ่มปุ่มที่ไม่มี workflow รองรับ; live mutation ยังไม่ทดลอง |
| หมวดรายงาน | ย้าย actions ไปขวาของหัวรายละเอียดบน desktop และ wrap เมื่อแคบ; ตรวจชื่อซ้ำ trim/ไม่แยกตัวพิมพ์ รวมหมวดที่ไม่มีรายงาน active โดยยกเว้น ID ที่กำลังแก้ | เก็บภาพ Account และสร้างหมวดคนละสถานะให้เทียบ mock ได้; กรอกชื่อ/เลือกสี/ยกเลิกและทิ้ง draft | การตรวจชื่อซ้ำใช้ข้อมูลที่โหลดในหน้าและ helper tests ไม่รับรอง uniqueness กรณี concurrent save ฝั่ง server; ยังไม่ทดลองบันทึก/ลบ |
| กลุ่มสิทธิ์ | ย้ายปุ่มแก้รายงานไปหัวรายละเอียดตามแบบ | Account overview; ค้น Business แล้ว Space เพิ่มรายการ จำนวนทั้งหมด 3/ในผลค้นหา 2, focus คงที่; ยกเลิกและทิ้ง draft | สมาชิกยังอ่านอย่างเดียว ไม่มีเพิ่ม/ย้ายสมาชิกจากหน้านี้ บริษัทของสมาชิก/ลิงก์เปิดผู้ใช้เฉพาะคนและกรองตามกลุ่มยังไม่ครบแบบ; comparison มีผลเทียบ active reports แต่ไม่มีค้นหา/เรียงกลุ่มใกล้เคียง/เปอร์เซ็นต์รายกลุ่มแบบ mock; หัวหมวดในรายการยังเป็นข้อความ |

ทั้ง 5 หน้ามี source และภาพ app จริงยืนยันการเปลี่ยนแปลงตามคอลัมน์ที่ตรวจ แต่รายการในคอลัมน์สุดท้ายยังไม่เสร็จ จึงห้ามตีความว่า port mock v3 ครบทุกฟังก์ชัน หน้าสร้าง/แก้ Report, Template, ประวัติ, Schedules, Settings และหน้าอื่นนอก 5 หน้านี้ยังไม่ได้ redesign จากงานชุดนี้ (มี audit เดิมแยกต่างหาก)

## วิธีตรวจและข้อจำกัด

- Browser ใช้ session Admin เดิม, GET จริง ไม่มี API intercept หรือข้อมูล mock; ตัวเลขในภาพเป็น snapshot ของ local data
- Desktop ใช้ 1600×1000 (ภาพ initial 1600×709), viewport แคบ 390×844; Standard/Users/Registry ที่เปลี่ยนรอบนี้ body width เท่ากับ viewport 390px ตัวเลือกอยู่ในจอ ตารางทะเบียนเลื่อนภายในกรอบ
- ภาพ 08 ของ QA รอบก่อนยังเป็น loading/0 rows จึงไม่ใช่หลักฐานทะเบียนหลังโหลด; ภาพ 04 ของรอบก่อนเก็บก่อนแก้ scroll ซ้อน จึงใช้ภาพรอบใหม่นี้อ้างอิง layout ปัจจุบันแทน เก็บภาพเก่าเป็นประวัติ
- Console warn/error ไม่พบใน flow รอบนี้; ยังไม่ใช่การตรวจทุกหน้า/ทุก account/ทุก browser หรือ screen reader
- ไม่มี live CRUD, AD lookup/Sync, execute/export, favorite mutation, email/schedule run, deployment หรือ UAT ใหม่; GET บางตัวมี schema-preparation เดิม จึงไม่เรียก API เหล่านี้ว่า side-effect-free SQL
- การคง report-first, เงื่อนไขเฉพาะ Report, ปุ่มดึงข้อมูลจริง, ไม่มี stale banner และไม่มี Print ตรงคำตัดสินใจผู้ใช้; ไม่เปลี่ยน export contract
- Admin/self guard ยังเป็น UI guard และ SPA Back/Forward ยังนอก draft guard; ไม่ถือว่า backend enforcement เสร็จ

## หลักฐานภาพหลังโหลดและหลังปรับ

| ภาพ app จริง | จุดที่ใช้ตรวจ / คู่ mock |
|---|---|
| [01 เริ่มรายงาน](screenshots/01-standard-initial.png) | ยังไม่เลือกจึงไม่มีบริษัท/เงื่อนไข |
| [02 รายงานที่เลือก](screenshots/02-standard-selected.png) | AP Document / mock `05-report-conditions.png` |
| [03 บริษัทบนมือถือ](screenshots/03-standard-mobile.png) | เมนูบริษัทไม่ล้นจอ |
| [04 Standard dark](screenshots/04-standard-dark-mobile.png) | input/ข้อความในธีมมืด |
| [05 ทะเบียนและตัวกรอง](screenshots/05-registry-filters.png) | โหลดแล้วและค้น RID เหลือหนึ่งรายงาน |
| [06 รายชื่อกลุ่มสิทธิ์](screenshots/06-registry-role-preview.png) | +N / mock `06-report-access-groups.png` |
| [07 ทะเบียนมือถือหลังโหลด](screenshots/07-registry-loaded-mobile.png) | มีแถวจริง ไม่ใช้ loading เป็นหลักฐาน |
| [08 Toolbar ผู้ใช้](screenshots/08-users-toolbar.png) | ข้อมูลโหลดแล้ว กรองไม่พบเพื่อไม่บันทึกข้อมูลส่วนบุคคล |
| [09 สรุปสิทธิ์ผู้ใช้](screenshots/09-user-access-summary.png) | Account + บริษัท 3 การ์ด / mock `04-user-access-summary.png`; จำนวนตามข้อมูลจริง |
| [10 ดูรายงานของกลุ่ม](screenshots/10-user-role-preview.png) | preview ซ้อนในฟอร์ม ไม่บันทึก |
| [11 ตัวเลือกกลุ่มมือถือ](screenshots/11-user-role-mobile.png) | menu/footer อยู่ในกรอบ |
| [12 หมวด Account](screenshots/12-category-account.png) | mock `02-category-context.png` |
| [13 สร้างหมวด draft](screenshots/13-category-create-draft.png) | mock `03-category-create.png`; ยกเลิกโดยไม่บันทึก |
| [14 กลุ่ม Account](screenshots/14-roles-account.png) | mock `07-roles-overview.png` |
| [15 แก้รายการของกลุ่ม](screenshots/15-role-selection.png) | mock `01-role-selection.png`; จำนวน/selection ตามข้อมูลจริง |

## ผลตรวจโค้ดรอบสุดท้าย

| คำสั่ง | ผลรอบนี้ |
|---|---|
| `npm test -- --exclude '**/.claude/**' --reporter=dot` | 15 files passed; **160 passed, 1 todo, 0 failed** ไม่รวมชุดซ้ำจาก worktree |
| `npm run build` | exit 0; compile + TypeScript + 50 static pages; warning เดิม middleware convention deprecated |
| `npx eslint -- <changed/untracked src files>` | 28 ไฟล์ผ่าน ไม่มี errors/warnings |
| `git diff --check` | exit 0 มีเพียง LF→CRLF notices |

Tests ใหม่ครอบคลุม highlight คำค้นแบบ literal/ภาษาไทย, RID search และชื่อหมวดซ้ำ ก่อน implementation พบ red แล้วผ่านหลังแก้ API tests ใช้ DB/session fixtures ไม่ใช่ live integration Tests/build ไม่ได้พิสูจน์ visual parity หรือ live workflow ทั้งชุด Repo lint ทั้งชุดไม่ได้รันซ้ำรอบนี้; รอบก่อนยังมี 58 errors/56 warnings ในไฟล์นอกงาน จึงไม่อ้างว่าทั้ง repo ผ่าน

## Sources ที่ตรวจจริง

- หน้า: [Standard](../../../src/app/(dashboard)/reports/standard/page.tsx), [Users](../../../src/app/(dashboard)/admin/users/page.tsx), [Registry](../../../src/app/(dashboard)/admin/reports/page.tsx), [Categories](../../../src/app/(dashboard)/admin/categories/page.tsx), [Roles](../../../src/app/(dashboard)/admin/roles/page.tsx)
- Component: [ReportSelector](../../../src/components/ReportSelector.tsx), [CompanySelector](../../../src/components/CompanySelector.tsx), [AccessibleDialog](../../../src/components/ui/AccessibleDialog.tsx)
- Helper/tests: [report-selector](../../../src/lib/report-selector.ts), [registry](../../../src/lib/report-registry.ts), [category](../../../src/lib/category-view.ts), [user-access](../../../src/lib/user-access.ts), [tests](../../../src/lib/__tests__)
- Mock source: [reports](../../design/2026-10-02-mockups-v3/page-reports.js), [users](../../design/2026-10-02-mockups-v3/page-users.js), [categories](../../design/2026-10-02-mockups-v3/page-categories.js), [roles](../../design/2026-10-02-mockups-v3/page-roles.js), [CSS](../../design/2026-10-02-mockups-v3/mock.css)
