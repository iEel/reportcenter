# ReportCenter — UI implementation จาก v3

วันที่ 2 ต.ค. 2026 · **ผู้ใช้อนุมัติให้นำแบบ v3 มาใช้ใน Next.js app; บันทึก implementation ในเครื่อง**

เอกสารนี้บันทึกโค้ดจริงหลัง [mockup v3](2026-10-02-mockups-v3/README.md) สำหรับกลุ่มสิทธิ์ หมวดรายงาน ผู้ใช้ ทะเบียนรายงาน และรายงานมาตรฐาน รวม dialog, draft guard และชื่อเมนูร่วมกัน ประวัติ mockup และผลตรวจของ mock ยังคงเป็นหลักฐานคนละชุด ดู [Decision log](../12_DECISION_LOG.md) และ [Developer Handoff](../../DEVELOPER_HANDOFF.md) ประกอบ

> **แก้คำสรุปหลังตรวจซ้ำ:** การมี source เปลี่ยน 5 หน้าไม่ได้แปลว่าตรง mock ครบทุกส่วน Standard และรายละเอียดหน้าอื่นตกหล่นในรอบแรก จึงแก้เพิ่มและเก็บ [ผลเทียบรายหน้า/ภาพ app 15 ภาพ](../audits/2026-10-02-ui-parity-recheck/README.md) พร้อมรายการที่ยังไม่ได้ทำ จากนั้น [แก้แนวและขนาดช่องเงื่อนไข Standard](../audits/2026-10-02-standard-field-alignment/README.md) และรันตรวจรวมก่อน commit/push ใหม่: 160 tests passed/1 todo (15 files), build50pages และ lint source28ไฟล์ผ่าน ยังเป็น local ไม่ใช่ live CRUD/deploy/UAT

รอบทวนเพิ่ม Standard full-width search/highlight/ทางลัด `/`, CompanySelector รหัส+ชื่อ, เงื่อนไขซ่อนทั้งชุดก่อนเลือกและขั้นตอนกระชับ; Users บริษัท3การ์ดและกลุ่มแบบค้นหา/ดูรายงาน; Registry RID search/chips คืน focus; Roles/Categories actions ใน header และหมวดตรวจชื่อซ้ำจากรายการที่โหลด ฟังก์ชัน recent-history, bulk deactivate และบางส่วน members/comparison ของ mock ยังไม่ได้ port รายละเอียดอยู่ในตารางผลทวน

## แบบจำลองที่รักษาไว้

- ผู้ใช้มีหนึ่งกลุ่มสิทธิ์; กลุ่มผูกกับหลายรายงานและรายงานผูกกับหลายกลุ่มผ่าน `ReportRoleMapping`
- บริษัทที่อนุญาตผูกกับผู้ใช้ผ่าน `UserCompanyMapping` แยกจากกลุ่มสิทธิ์และบริษัทต้นสังกัด AD
- รายงานมี `CategoryId` เดียวหรือไม่มีหมวด หมวดใช้จัดและค้นหารายงาน ไม่ได้ให้สิทธิ์ การลบหมวดทำให้รายงานกลับไปยังไม่จัดหมวด โดยไม่ลบรายงานหรือ mapping ของสิทธิ์
- Admin ใช้กติกาของระบบเดิม ไม่ใช้จำนวน mapping เป็นตัวแทนสิทธิ์ทั้งหมด จำนวนในหน้ากลุ่มสิทธิ์และสรุปผู้ใช้แยกรายงานที่ใช้งานออกจากรายงานปิดใช้งาน
- หน้ารายงานมาตรฐานใช้ลำดับ **เลือกรายงาน → บริษัทและเงื่อนไขของรายงาน → ดึงข้อมูล → ส่งออก** ปุ่มดึงข้อมูลเรียกรายงานจริง ไม่มีการเพิ่มแถบเตือนเงื่อนไขเปลี่ยน
- ปุ่มพิมพ์ไม่แสดงใน Standard ตามคำขอเดิมของผู้ใช้และแบบ v3 ที่อนุมัติ เป็นการตัด action ใน UI โดยเจตนา ไม่ได้เปลี่ยน export API หรือรูปแบบไฟล์ส่งออก

## สิ่งที่นำมาใช้ในแต่ละหน้า

| หน้า | Implementation ปัจจุบัน | Source |
|---|---|---|
| กลุ่มสิทธิ์ | รายการด้านซ้าย/รายละเอียดด้านขวา หัวข้อ `กลุ่มสิทธิ์: …` และจำนวนใช้งาน/ปิดใช้งาน; แก้รายงานในพื้นที่เดียว ค้นหาและเลือกเฉพาะผลค้นหา แสดงจำนวนที่เลือกทั้งหมด/ที่มองเห็นและรายการเพิ่ม-ถอน; draft ผูกกับกลุ่มต้นฉบับ ป้องกันเปลี่ยนกลุ่ม/บริบทระหว่างแก้; สร้าง/เปลี่ยนชื่อผ่าน dialog; สมาชิกและการเทียบกลุ่มเป็นแบบอ่านอย่างเดียว โดยการเทียบใช้เฉพาะรายงานที่ใช้งาน | [roles/page.tsx](../../src/app/(dashboard)/admin/roles/page.tsx), [role-access.ts](../../src/lib/role-access.ts) |
| หมวดรายงาน | รายการ/รายละเอียด แยกพื้นที่สร้างหมวดและแสดง `ยังไม่จัดหมวด` เป็นมุมมอง ไม่ใช่หมวดที่แก้ชื่อหรือลบได้; แสดงรายการใช้งาน/ปิดใช้งานและจำนวนทั้งหมดก่อนลบ; ยืนยันก่อนทิ้ง draft; เปิดทะเบียนรายงานพร้อม `categoryId` และไปหน้าแก้รายงานเพื่อกำหนดหมวด | [categories/page.tsx](../../src/app/(dashboard)/admin/categories/page.tsx), [category-view.ts](../../src/lib/category-view.ts) |
| ผู้ใช้ | ตารางค้นหา/กรองกลุ่ม ประเภทบัญชี และสถานะ; สร้างใน dialog/แก้ใน drawer พร้อมสรุปกลุ่มเดียว จำนวนรายงานที่ใช้งาน และบริษัทจาก draft ก่อนบันทึก; แยกต้นสังกัด AD จากบริษัทที่อนุญาต; คง AD lookup/Sync และ Local workflow; แสดงรหัสผ่านเฉพาะ workflow Local และป้องกันแก้กลุ่ม/ระงับ/ลบบัญชีที่กำลังใช้งานใน UI | [users/page.tsx](../../src/app/(dashboard)/admin/users/page.tsx), [user-access.ts](../../src/lib/user-access.ts) |
| ทะเบียนรายงาน | รับตัวกรองหมวดจาก URL และย้อนกลับหมวดได้; กรองชื่อ/คำอธิบาย ประเภท และสถานะ; แสดงสองกลุ่มแรกพร้อม `+N` เปิดรายชื่อครบใน dialog; เก็บ selection เมื่อกรอง แสดงจำนวนที่ซ่อน และการเลือกทั้งหมดมีผลเฉพาะรายการที่เห็น; ยืนยันลบหลายรายการรวมชื่อและจำนวนที่ตัวกรองซ่อน | [reports/page.tsx](../../src/app/(dashboard)/admin/reports/page.tsx), [report-registry.ts](../../src/lib/report-registry.ts) |
| รายงานมาตรฐาน | ใช้ตัวเลือกรายงานและรายการโปรดต่อเนื่องหลังเลือก; บริษัทปรากฏหลังเลือกรายงานและโหลดเงื่อนไข; โหลด metadata ใหม่ต่อ ReportId และยกเลิก/ละทิ้ง response ของรายงานก่อนหน้า; เปลี่ยนรายงานล้างเงื่อนไขและผลเดิม; ป้ายส่งออกระบุ Excel `.xlsb` หรือ CSV ตามเส้นทางจริง | [standard/page.tsx](../../src/app/(dashboard)/reports/standard/page.tsx), [ReportSelector.tsx](../../src/components/ReportSelector.tsx), [report-selector.ts](../../src/lib/report-selector.ts) |

หน้า create/edit Report และหน้า Template ไม่ได้ถูกออกแบบใหม่ในรอบนี้ ลิงก์จากทะเบียนและหมวดใช้หน้าที่มีอยู่ ไม่เพิ่มหน้าจอจัดสมาชิกกลุ่มหรือฟีเจอร์รวมกลุ่มสิทธิ์

## API และการรักษาข้อมูลเดิม

| สัญญา | สิ่งที่เปลี่ยน | สิ่งที่คงไว้/ข้อจำกัด |
|---|---|---|
| `GET /api/admin/roles` | `allReports` และ `assignedReports` รวมรายงานปิดใช้งาน และมี `IsActive` ในข้อมูลรายงาน เพื่อรักษา mapping ที่ซ่อนอยู่เมื่อบันทึกกลุ่ม | ผู้ใช้ข้อมูลนี้ต้องกรอง `IsActive` เมื่อต้องการจำนวนรายงานที่ใช้งาน; หน้า Users ปรับการนับแล้ว รายการแก้สิทธิ์เสนอรายงานใช้งานและรายงานปิดใช้งานที่กลุ่มนั้นผูกอยู่เดิม |
| `POST/PUT/DELETE /api/admin/roles` | ไม่เปลี่ยน payload หรือ workflow ฝั่ง API ในรอบนี้ | PUT เดิมยังอัปเดตชื่อและแทนชุด mapping; ไม่ได้เพิ่ม transaction หรือ server-side lock ของ Admin การห้ามแก้/ลบ Admin ที่เพิ่มเป็น UI guard |
| `GET /api/admin/categories` | สำหรับ Admin เพิ่ม `allReportsByCategory` รวมปิดใช้งาน/ยังไม่จัดหมวด และเพิ่ม `AllReportCount`/`InactiveReportCount` | คง `ReportCount` และ `reportsByCategory` แบบรายงานที่ใช้งานเพื่อผู้เรียกเดิม ผู้ใช้ที่ไม่ใช่ Admin ไม่ได้รับชุดรายงานทั้งหมดเพิ่ม |
| Category/User/Report mutations | หน้าจอเรียก endpoint เดิมตามการกระทำของผู้ใช้ | ไม่มีการรัน live CRUD ในงานตรวจนี้ ไม่มี schema migration ใหม่; Category GET และ Users GET มีการเตรียม schema เดิมอยู่ จึงไม่ถือว่าการเปิด API กับฐานข้อมูลจริงเป็น read-only โดยอัตโนมัติ |

Source: [roles route](../../src/app/api/admin/roles/route.js), [categories route](../../src/app/api/admin/categories/route.js), [users route](../../src/app/api/admin/users/route.js), [single report route](../../src/app/api/admin/reports/[id]/route.js), [bulk report route](../../src/app/api/admin/reports/bulk/route.js)

## Dialog, keyboard และการออกจาก draft

- [AccessibleDialog](../../src/components/ui/AccessibleDialog.tsx) ใช้ native `<dialog>` รองรับ dialog/drawer มีชื่อที่เชื่อมกับ heading, `showModal()`, Escape/backdrop ผ่าน `onClose` และพื้นที่ปุ่มท้ายฟอร์ม; [ConfirmProvider](../../src/components/providers/ConfirmProvider.tsx) ใช้ component เดียวกัน
- [useUnsavedChanges](../../src/hooks/useUnsavedChanges.ts) รวมคำยืนยันการทิ้ง draft ใช้กับการเปลี่ยนบริบท/ปิดฟอร์ม ลิงก์ภายใน origin เดียวกัน และ `beforeunload`; [page-leave-guard](../../src/lib/page-leave-guard.ts) ให้ logout ใน Sidebar ตรวจ draft ก่อน ไม่อ้างว่าครอบคลุม browser Back/Forward หรือทุกคำสั่งนำทางที่อาจเพิ่มภายหลัง
- Checkbox ของสิทธิ์มี ID/React key คงที่ขณะเปลี่ยน selection; ตัวเลือกรายงานเลื่อนตัวเลือกที่ใช้ลูกศรเข้ามาในมุมมอง ปิดรายการเมื่อ Tab/Escape หรือ focus ออก และคง focus หลังเลือก; [TypeaheadInput](../../src/components/TypeaheadInput.tsx) รับ `id` เพื่อเชื่อม label ของเงื่อนไข
- [Sidebar](../../src/components/layout/Sidebar.tsx) ใช้คำ `กลุ่มสิทธิ์`, `หมวดรายงาน`, `ทะเบียนรายงาน` ให้ตรงหน้า; [globals.css](../../src/app/globals.css) กำหนด backdrop/drawer และใช้ `.dark` สำหรับ Tailwind dark variant ให้ตรงกับตัวสลับธีมเดิม

## ทวน Handoff/แบบกับ source

| ประเด็น | ผลทวน | ขอบเขตที่ยืนยัน |
|---|---|---|
| หนึ่งกลุ่มต่อผู้ใช้, many-to-many รายงาน/กลุ่ม, บริษัทแยกต่อผู้ใช้ | ตรงกับ Handoff และโค้ด | อ่าน source ของหน้า/API/helper ที่ลิงก์ในเอกสารนี้ ไม่ใช่ตรวจข้อมูลจริงทุกบัญชี |
| หมวดเดียว/ไม่มีหมวด และลบเฉพาะหมวด | ตรงกับ category API | DELETE เดิมตั้ง `Reports.CategoryId = NULL` ก่อนลบหมวด; ไม่ได้ทดลองลบจริง |
| v3 ที่ใช้ฟอร์มเงื่อนไขตายตัวและข้อความ `.xlsx` | ไม่ใช้ข้อจำลองนี้ใน app | App ยังคง metadata ต่อรายงาน; Standard export ปกติใช้ `.xlsb`, เส้นทางรายงานขนาดใหญ่ใช้ CSV; ไม่เปลี่ยนกฎ validation เป็น regex/required ของ mock |
| inactive mapping ใน F7 | แก้ช่องว่างของการอ่าน/บันทึกสิทธิ์ผ่านหน้า Roles ในเครื่อง | GET ไม่ตัด mapping ปิดใช้งาน; มี regression test ของ API/helper ไม่ใช่หลักฐาน live SQL integration |
| Admin/self guard และการลบกำหนดการใน F7 | ยังไม่ปิดข้อค้าง backend ทั้งชุด | UI ป้องกันการแก้ Admin/บัญชีตนเอง ไม่เพิ่ม enforcement ใน API หรือยืนยัน cascade ของ schedules; ไม่เปลี่ยนข้อสรุปผู้ใช้ว่าอีเมล/ระบบตั้งเวลาใช้งานได้ |

ดูประเด็นเดิม [F7 ใน design v2 audit](../audits/2026-10-02-design-v2/README.md) และ [spec ตัวเลือกรายงาน](../superpowers/specs/2026-08-14-standard-report-selector-design.md) ประวัติผล mock เป็นผลในสภาพแวดล้อมจำลอง ไม่ใช้แทนผล Next.js app รอบนี้

## ผลตรวจรอบ implementation แรก (ประวัติ)

ตัวเลขและภาพด้านล่างเป็นรอบก่อนทวน parity ไม่ใช่ผลล่าสุด และไม่ใช้ tests/build ยืนยันหน้าตาหรือทุก interaction ของ mock

| การตรวจ | ผลรอบ implementation |
|---|---|
| Tests | `npm test -- --exclude '**/.claude/**' --reporter=dot` ผ่าน 15 files / 151 tests; 1 todo เดิม ตัด nested worktree ที่ซ้ำออก จึงไม่ใช้จำนวน default suite เป็นจำนวนกรณีไม่ซ้ำ |
| TypeScript / ESLint เฉพาะไฟล์ที่เปลี่ยน | ผ่าน ไม่มี errors ในไฟล์ source ที่แก้ |
| ESLint ทั้ง repo | `npm run lint -- --ignore-pattern '**/.claude/**' --ignore-pattern 'docs/**'` ยังพบ 58 errors / 56 warnings ในไฟล์ที่ไม่ได้แก้ ไม่ได้อ้างว่า repo lint ผ่านทั้งชุด |
| Build | `npm run build` ผ่าน exit 0 หลังปรับ UI รอบสุดท้าย รวม compile, TypeScript และ 50 static pages; มี warning เดิมเรื่อง middleware ของ Next.js 16.1.6 |
| Browser QA ของ app รอบแรก | ใช้ session Admin เดิมและ GET API จริงที่ localhost:4000 ไม่มี API mock/intercept; [QA README เดิม](../audits/2026-10-02-ui-implementation/README.md) มีภาพ11ภาพ แต่ทะเบียนมือถือภาพ08ยัง loading และภาพผู้ใช้04ก่อนแก้scroll จึงไม่ใช่หลักฐานครบทุกสถานะหลังโหลด ใช้ [ภาพและตารางทวนล่าสุด](../audits/2026-10-02-ui-parity-recheck/README.md) แทนเมื่อตรวจ layout ปัจจุบัน |
| Live CRUD / AD lookup หรือ Sync / execute หรือ export กับข้อมูลจริง | ไม่ได้ทดสอบในรอบนี้; การเปิดหน้าอ่าน GET จริงไม่ใช่การยืนยัน mutation หรือ SQL integration ครบทุกเส้นทาง |
| Deployment / UAT / การรับรองยอดรายงาน | ยังไม่มีหลักฐานใหม่ |

Tests ที่เกี่ยวข้อง: [role helper](../../src/lib/__tests__/role-access.test.ts), [roles GET](../../src/app/api/admin/roles/__tests__/role-access.test.js), [category helper](../../src/lib/__tests__/category-view.test.ts), [categories GET](../../src/app/api/admin/categories/__tests__/route.test.js), [user helper](../../src/lib/__tests__/user-access.test.ts), [registry helper](../../src/lib/__tests__/report-registry.test.ts), [selector](../../src/lib/__tests__/report-selector.test.ts), [page leave guard](../../src/lib/__tests__/page-leave-guard.test.ts)

API tests ใช้ DB/session fixtures เพื่อทวน contract และผลลัพธ์ ไม่ได้ต่อฐานข้อมูลจริง ส่วน browser QA อ่าน GET จริงตามขอบเขตในตาราง แยกหลักฐานสองประเภทนี้ออกจากกัน และไม่บันทึกข้อมูลส่วนบุคคลที่ไม่จำเป็นลงเอกสาร
