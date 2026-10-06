# ReportCenter — รีวิว implementation ใน commit 06ec60a

วันที่ 6 ต.ค. 2026 · **สถานะ: ผลตรวจ — แก้ P0 ข้อ 1–2 แล้ว (commit บน branch ยังไม่ merge/deploy) ดู [ผลการแก้ P0](#ผลการแก้-p0-6-ตค-2026) ข้ออื่นยังไม่แก้**

ผู้ใช้ขอให้ “ลองดูให้ใหม่” หลังนำแบบ v3 ไปแก้ระบบจริงใน commit `06ec60a` (feat: refine report and access management interfaces) รอบนี้ตรวจสองทาง: อ่านโค้ดทั้ง commit แบบหลายมุมพร้อมให้ผู้ตรวจอีกชุดพยายามหักล้างทุกข้อ และเปิดหน้าจริงที่ localhost:4000 ด้วย session Admin ของผู้ใช้

ภาพรวม: หน้าจอใหม่ส่วนใหญ่ทำงานตามที่ออกแบบ ทั้ง draft ผูกกลุ่มสิทธิ์ การเลือกตามผลค้นหา การเก็บสิทธิ์ของรายงานปิดใช้งาน คำยืนยันลบหมวด selection ข้ามตัวกรอง และการโหลดเงื่อนไขใหม่ต่อ ReportId พร้อมยกเลิกคำขอเก่า แต่ **ยังมีช่องโหว่ฝั่ง API ระดับ P0 สองข้อที่มีมาก่อน commit** และปัญหาใหม่ที่มาจาก native dialog

## วิธีตรวจและขอบเขต

- **อ่านโค้ด:** แบ่ง 8 ด้าน (สิทธิ์/API, ผู้ใช้, กลุ่มสิทธิ์, หมวด, ทะเบียน, รายงานมาตรฐาน, dialog/guard/ธีม, tests) อ่านไฟล์ที่ HEAD เทียบเวอร์ชันก่อน commit แบบ read-only ผู้ตรวจอีกชุดหักล้างทุกข้อ P0–P2 ทีละข้อ ก่อนรวมข้อซ้ำ ผ่านการตรวจซ้ำ 47 ข้อ (รวมข้อที่ผลยังไม่แน่ชัด) ถูกหักล้าง 3 ข้อ และเป็น P3 ที่ไม่ได้ตรวจซ้ำ 32 ข้อ หลังรวมข้อซ้ำเหลือ 61 ข้อในตารางด้านล่าง
- **ผลตรวจอัตโนมัติรอบนี้:** `npm test -- --exclude "**/.claude/**"` ผ่าน 15 ไฟล์ / 160 tests / 1 todo, `npx tsc --noEmit` ไม่มี error และ ESLint ไฟล์ src ที่ commit แก้ 28 ไฟล์ไม่มีคำเตือน ตรงกับตัวเลขในเอกสาร implementation
- **หน้าจริง:** เปิด Standard, Roles, Users, Categories, Registry ที่ 1440×900 และ 390×844 รวมโหมดมืดทั้งแบบ OS และ class `.dark` ของแอป เปิดฟอร์มแล้วยกเลิกทุกครั้ง **ไม่กดบันทึก ลบ เปลี่ยนสิทธิ์ หรือดึง/ส่งออกรายงานจริง**
- **เหตุระหว่างตรวจ:** ผู้ตรวจโค้ดตัวหนึ่งใช้แท็บเบราว์เซอร์เดียวกันทดสอบ `<dialog>` ทำให้ DOM ของหน้าที่เปิดอยู่ถูกแทนด้วยหน้าทดสอบชั่วคราว เป็นการเปลี่ยนเฉพาะในหน้าเว็บ ไม่มีคำขอไปเซิร์ฟเวอร์หรือข้อมูลถูกแก้ โหลดหน้าใหม่แล้วตรวจต่อ
- **ไม่ได้ตรวจ:** screen reader หรือสั่งงานด้วยเสียงจริง, ฐานข้อมูลจริง (FK, unique index), live CRUD, การหมดเวลาใช้งานจริง, หน้าสร้าง/แก้รายงาน, schedules, templates, settings, sql-validator และ SQL แบ่งหน้าใน execute

## ปัญหาเดิมจาก audit ก่อนหน้า

| ข้อ | สถานะ | หลักฐาน |
|---|---|---|
| (a) เปลี่ยนชื่อกลุ่ม Admin แล้วผู้ดูแลเสียสิทธิ์ | กันเฉพาะหน้าเว็บ API ยังเปิด | UI กันแก้/ลบ/ตั้งชื่อ admin (`src/app/(dashboard)/admin/roles/page.tsx`); `PUT /api/admin/roles` ยังเปลี่ยนชื่อได้ (`src/app/api/admin/roles/route.js:115-153`) ตามที่เอกสารระบุว่าเป็น UI guard โดยเจตนา |
| (b) ระงับ/เปลี่ยนกลุ่มบัญชีตัวเอง | กันเฉพาะหน้าเว็บ API ยังเปิด | UI ปิดปุ่มสถานะ/ลบและกลุ่มของตัวเอง; `PUT /api/admin/users` ไม่ตรวจ `UserId === session.userId` (`src/app/api/admin/users/route.js:198-231`) |
| (c) รีเซ็ตรหัสผู้ใช้ AD | กันเฉพาะหน้าเว็บ | ซ่อนปุ่มสำหรับ AD แล้ว; `reset-password/route.js` ยังไม่ตรวจ AuthType |
| (d) รหัสผ่านเริ่มต้นร่วม | แก้บางส่วน | เอาค่าออกจาก placeholder แล้ว แต่ฟอร์มยังบอกให้เว้นว่างได้และ API ยังใช้ค่าตายตัว (`src/app/api/admin/users/route.js:135`) |
| (e) โหมดมืดตัวขาวบนพื้นขาว | แก้แล้ว | `@custom-variant dark` ใน `src/app/globals.css:3`; หน้าจริงเมื่อ OS มืดแต่แอปสว่าง แสดงสว่างทั้งหน้าและอ่านได้ |
| (f) คำยืนยันลบหมวดนับเฉพาะใช้งาน | แก้แล้ว | หน้าจริงแสดง “รายงานทั้งหมด 13 · ใช้งาน 13 · ปิดใช้งาน 0” และย้ำว่ารายงานกับสิทธิ์ยังอยู่ |

## ข้อที่พบจากหน้าจริงเพิ่มเติม

| ระดับ | ปัญหา | หลักฐาน |
|---|---|---|
| P1 | ปุ่มหลักของหน้ากลุ่มสิทธิ์ (“แก้ไขรายงานที่อนุญาต”, “เพิ่มกลุ่ม”, “บันทึก”) เป็นตัวขาวบนพื้นเกือบขาวขณะเอาเมาส์ชี้ | `primary` รวม class ของ `button` ที่มี `hover:bg-slate-50` แล้วชนะ `hover:bg-blue-700` (`src/app/(dashboard)/admin/roles/page.tsx:23-24`); วัด computed style ขณะ hover ได้พื้น slate-50 ตัวอักษรขาว |
| P2 | พิมพ์ค้นรายงานแล้วกด Enter ไม่เลือกอะไร ต้องกดลูกศรลงก่อน ทั้งที่ท้ายรายการเขียน “Enter เปิดรายงาน” | หลังพิมพ์ “aged” ไม่มี `aria-activedescendant` จนกด ↓ (`src/components/ReportSelector.tsx`) |
| P2 | ป้าย “ใช้งาน” ในตารางผู้ใช้ยังเป็นปุ่มระงับ (ตรงกับข้อ 8 ด้านล่าง) | ชื่อที่อ่านคือ “ระงับ …” แต่ข้อความที่เห็นคือ “ใช้งาน” |
| P2 | `?categoryId` ที่ไม่มีอยู่ ป้ายขึ้น “ยังไม่จัดหมวด” แต่ dropdown ขึ้น “ทุกหมวด” และแสดง 0 รายการ (ตรงกับข้อ 22) | เปิด `/admin/reports?categoryId=999` |
| P3 | แถบเลื่อนรายการกลุ่มยังสีอ่อนในโหมดมืด, ชื่อหมวดในทะเบียนตัดสองบรรทัด, “·” ค้างท้าย RID เมื่อไม่มีคำอธิบาย, บนมือถือแตะกลุ่ม/หมวดแล้วรายละเอียดอยู่ล่างจอ | ภาพหน้าจอระหว่างตรวจ |

สิ่งที่ยืนยันจากหน้าจริงว่าดีแล้ว: ช่องบริษัทปรากฏหลังเลือกรายงานตามที่ตัดสินไว้และแสดงรหัสคู่ชื่อ, guard ไม่ให้เปลี่ยนกลุ่มระหว่างแก้, คำยืนยันทิ้ง draft ตั้ง focus ที่ “แก้ไขต่อ”, Esc ปิด dialog/drawer แล้วคืน focus, ปุ่ม “+N” เปิดรายชื่อกลุ่มครบ, selection ที่ถูกซ่อนนับถูก, ไม่มีหน้าใดล้นแนวนอนที่ 390px และไม่มี console error

## ผลจากการอ่านโค้ด (เรียงตามความรุนแรง)

P0 = ข้อมูลรั่ว/สูญหายหรือช่องโหว่สิทธิ์, P1 = ผลผิดหรือทำให้เข้าใจผิด/ไม่ผ่าน WCAG A–AA, P2 = สับสนแต่มีทางเลี่ยง, P3 = เก็บรายละเอียด รายละเอียดสถานการณ์และวิธีแก้ของแต่ละข้ออยู่ในบันทึกรีวิว (วิกิ `rc-implementation-review-20261006`)

| # | ระดับ | ปัญหา | ตำแหน่งหลัก | ผลตรวจซ้ำ |
|---|---|---|---|---|
| 1 | P0 | ผู้ใช้ทุกคนที่ล็อกอินแล้วลบรายงานถาวรหรือเปิด/ปิดรายงานได้ เพราะ DELETE และ PATCH /api/admin/reports/[id] ไม่ตรวจสิทธิ์ | `src/app/api/admin/reports/[id]/route.js:327`<br>`src/app/api/admin/reports/[id]/route.js:365` | ยืนยันแล้ว → **แก้แล้ว** (branch, ยังไม่ merge/deploy) |
| 2 | P0 | รันรายงานกับบริษัทที่ไม่ได้รับสิทธิ์ได้ เพราะ /api/reports/execute และ execute-async ไม่ตรวจ allowedCompanies | `src/app/api/reports/execute/route.js:82`<br>`src/app/api/reports/execute-async/route.js:171` | ยืนยันแล้ว → **แก้แล้ว** (branch, ยังไม่ merge/deploy) |
| 3 | P1 | เว้นรหัสผ่านว่างตอนสร้างผู้ใช้ Local แล้วยังได้รหัสเริ่มต้นตายตัวที่อยู่ในซอร์สโค้ดและเอกสาร (ปัญหาเดิม d แก้แค่บางส่วน) | `src/app/api/admin/users/route.js:135`<br>`src/app/(dashboard)/admin/users/page.tsx:679` | ยืนยันแล้ว |
| 4 | P1 | ลบรายงานทีละรายการโดยไม่มี transaction ทำให้รายงานที่มีตารางส่งอัตโนมัติถูกลบไปแค่ครึ่งเดียว | `src/app/api/admin/reports/[id]/route.js:336`<br>`src/app/api/admin/schedules/route.js:32` | ยืนยันแล้ว → **แก้แล้ว**: ลบใน transaction เดียว ถ้ามีข้อมูลอ้างอิงจะตอบ 409 และไม่ลบอะไร (ยังไม่แก้ bulk) |
| 5 | P1 | ข้อความแจ้งข้อผิดพลาด (toast) ถูก dialog/drawer แบบใหม่บังจนมองไม่เห็น กดบันทึกผู้ใช้ไม่ผ่านแล้วดูเหมือนไม่มีอะไรเกิดขึ้น | `src/components/providers/ToastProvider.tsx:57`<br>`src/components/ui/AccessibleDialog.tsx:27` | ยืนยันแล้ว |
| 6 | P1 | dialog ค้าง: กด Esc ซ้ำแล้วเบราว์เซอร์ปิด dialog เอง แต่ React ยังคิดว่าเปิดอยู่ จึงเปิดฟอร์มแก้ไขอีกไม่ได้จนกว่าจะรีโหลดหน้า | `src/components/ui/AccessibleDialog.tsx:35`<br>`src/components/ui/AccessibleDialog.tsx:23` | ยืนยันแล้ว |
| 7 | P1 | เปลี่ยน “จำนวนแถวต่อหน้า” แล้วคำขอยังใช้ขนาดเดิม บางแถวจึงไม่เคยแสดงหรือแสดงซ้ำ | `src/app/(dashboard)/reports/standard/page.tsx:563`<br>`src/app/(dashboard)/reports/standard/page.tsx:190` | ยืนยันแล้ว |
| 8 | P1 | ปุ่มสถานะในตารางผู้ใช้: ชื่อที่โปรแกรมอ่านหน้าจออ่าน ไม่มีคำที่แสดงบนปุ่ม (WCAG 2.5.3 ระดับ A) | `src/app/(dashboard)/admin/users/page.tsx:629` | ยืนยันแล้ว |
| 9 | P1 | ระหว่างมีร่างค้าง หน้า roles ปฏิเสธการกดปุ่มอื่นแบบเงียบๆ เหตุผลแสดงเป็น toast ที่โปรแกรมอ่านหน้าจอไม่อ่าน (WCAG 4.1.3) | `src/app/(dashboard)/admin/roles/page.tsx:106`<br>`src/components/providers/ToastProvider.tsx:57` | ยืนยันแล้ว |
| 10 | P1 | ปุ่ม “ทิ้งการแก้ไข” ตัวอักษรขาวบนพื้นส้ม (amber-600) คอนทราสต์ราว 3.2:1 ต่ำกว่าเกณฑ์ AA | `src/components/providers/ConfirmProvider.tsx:54`<br>`src/components/providers/ConfirmProvider.tsx:64` | ยืนยันแล้ว |
| 11 | P2 | บันทึกหรือเปลี่ยนชื่อกลุ่มสิทธิ์จะส่งรายการรายงานชุดที่โหลดไว้ตอนเปิดหน้า และ API ลบแล้วใส่ใหม่ทั้งหมดโดยไม่มี transaction สิทธิ์จึงหายหรือถูกล้างไปบางส่วนได้ | `src/app/api/admin/roles/route.js:135`<br>`src/app/(dashboard)/admin/roles/page.tsx:180` | ยืนยันแล้ว |
| 12 | P2 | ถ้ามีฟอร์มที่ยังไม่บันทึก การออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน (idle timeout) จะถูกกล่อง “Leave site?” ขวาง ข้อมูล admin จึงค้างอยู่บนจอ | `src/hooks/useUnsavedChanges.ts:25`<br>`src/components/providers/IdleTimeoutProvider.tsx:75` | ยืนยันแล้ว |
| 13 | P2 | รายการรายงานและช่องค้นหาค่าเงื่อนไขตรวจแค่ลายเซ็น JWT ผู้ใช้ที่ถูกระงับหรือถูกถอนบริษัทจึงยังใช้ได้ต่ออีกถึง 8 ชั่วโมง | `src/app/api/reports/search-param/route.js:13`<br>`src/app/api/reports/available/route.js:17` | ยืนยันแล้ว |
| 14 | P2 | ข้อมูลจาก AD ไม่ได้ผูกกับ username ถ้าแก้ username หลังเลือกคนไปแล้ว ระบบจะบันทึกข้อมูลของคนก่อนหน้าไปด้วย | `src/app/(dashboard)/admin/users/page.tsx:337`<br>`src/app/(dashboard)/admin/users/page.tsx:326` | ยืนยันแล้ว |
| 15 | P2 | คลิกการแจ้งเตือนที่ Header แล้วออกจากหน้าทันที โดยไม่ถามเรื่องการแก้ไขที่ยังไม่บันทึก | `src/components/layout/Header.tsx:81`<br>`src/hooks/useUnsavedChanges.ts:28` | ยืนยันแล้ว |
| 16 | P2 | admin แก้ชื่อหรือบริษัทของบัญชีตัวเองแล้วถูกออกจากระบบทันทีหลังขึ้นว่าสำเร็จ และหน้าจอแสดงข้อผิดพลาดที่ชี้ผิดสาเหตุ | `src/app/api/admin/users/route.js:229`<br>`src/app/(dashboard)/admin/users/page.tsx:418` | ยืนยันแล้ว |
| 17 | P2 | โหลดเงื่อนไขรายงานไม่สำเร็จแต่ยังกด “ดึงข้อมูล” ได้ รายงานจะรันโดยทุกเงื่อนไขเป็นค่าว่าง และข้อความผิดพลาดหายไป | `src/app/(dashboard)/reports/standard/page.tsx:171`<br>`src/app/(dashboard)/reports/standard/page.tsx:134` | ยืนยันแล้ว |
| 18 | P2 | บริษัทเริ่มต้นอาจไม่อยู่ในรายการให้เลือก และปุ่ม “ดึงข้อมูล” ไม่กันกรณีที่ไม่มีบริษัท | `src/app/(dashboard)/reports/standard/page.tsx:60`<br>`src/app/(dashboard)/reports/standard/page.tsx:430` | ยืนยันแล้ว |
| 19 | P2 | polling ผิดพลาดครั้งเดียว แถบงานเบื้องหลังก็ค้างที่ “กำลังทำงาน” และยังไม่รู้จักสถานะยกเลิก | `src/app/(dashboard)/reports/standard/page.tsx:263`<br>`src/app/(dashboard)/reports/standard/page.tsx:326` | ยืนยันแล้ว |
| 20 | P2 | ปุ่ม “ส่งออก CSV” ในแถบผลลัพธ์เริ่มงานเบื้องหลังซ้ำได้ ขณะที่งานแรกยังไม่เสร็จ | `src/app/(dashboard)/reports/standard/page.tsx:297`<br>`src/app/(dashboard)/reports/standard/page.tsx:507` | ยืนยันแล้ว |
| 21 | P2 | ส่งออกแบบปกติแจ้ง “ไม่มีข้อมูลให้ส่งออก” ทั้งที่เซิร์ฟเวอร์ผิดพลาด | `src/app/(dashboard)/reports/standard/page.tsx:352` | ยืนยันแล้ว |
| 22 | P2 | categoryId ใน URL ผิด หรือโหลดหมวดไม่สำเร็จ ทำให้ chip ขึ้น “ยังไม่จัดหมวด” ขัดกับ dropdown และตาราง | `src/app/(dashboard)/admin/reports/page.tsx:77`<br>`src/app/(dashboard)/admin/reports/page.tsx:27` | ยืนยันแล้ว |
| 23 | P2 | ทะเบียนแสดงว่า “เฉพาะผู้ดูแลระบบ” แต่หน้าแก้ไขบอกว่า “ทุกคน (Public)” สำหรับรายงานเดียวกัน | `src/app/(dashboard)/admin/reports/new/page.tsx:254`<br>`src/app/(dashboard)/admin/reports/[id]/edit/page.tsx:373` | ยืนยันแล้ว |
| 24 | P2 | กล่องยืนยัน “ยังไม่ได้กรอกเงื่อนไขบางช่อง” ขึ้นทุกครั้งที่เปลี่ยนหน้าผลลัพธ์ | `src/app/(dashboard)/reports/standard/page.tsx:171`<br>`src/app/(dashboard)/reports/standard/page.tsx:564` | ยืนยันแล้ว |
| 25 | P2 | โฟกัสคีย์บอร์ดหลุดกลับไปต้นหน้าหลังบันทึก ยกเลิก ลบ หรือเปิด/ปิดรายงาน (หน้าหมวด ทะเบียน และกลุ่มสิทธิ์) | `src/app/(dashboard)/admin/categories/page.tsx:177`<br>`src/app/(dashboard)/admin/reports/page.tsx:89` | ยืนยันแล้ว |
| 26 | P2 | ข้อความในกล่องยืนยันไม่ได้ผูกเป็นคำอธิบายของ dialog โปรแกรมอ่านหน้าจอจึงอ่านแค่หัวข้อกับปุ่ม | `src/components/providers/ConfirmProvider.tsx:61`<br>`src/components/ui/AccessibleDialog.tsx:34` | ยืนยันแล้ว |
| 27 | P2 | หน้าต่างกำลังส่งออกประกาศซ้ำทุกวินาที และไม่กันคีย์บอร์ดไปกดปุ่มด้านหลัง | `src/app/(dashboard)/reports/standard/page.tsx:573`<br>`src/app/(dashboard)/reports/standard/page.tsx:454` | ยืนยันแล้ว |
| 28 | P2 | ช่องเงื่อนไขแบบค้นหา (typeahead) ไม่มีความหมายแบบ combobox และปุ่มล้างค่าไม่มีชื่อ | `src/components/TypeaheadInput.tsx:146`<br>`src/components/TypeaheadInput.tsx:132` | ยืนยันแล้ว |
| 29 | P2 | โหมดมืด: รายการคำแนะนำที่ไฮไลต์ด้วยคีย์บอร์ดเป็นตัวอักษรเกือบขาวบนพื้นเกือบขาว อ่านไม่ออก | `src/components/TypeaheadInput.tsx:162`<br>`src/app/globals.css:122` | ยืนยันแล้ว |
| 30 | P2 | บรรทัดจำนวนสมาชิก/รายงานของกลุ่มที่ถูกเลือก คอนทราสต์ต่ำกว่าเกณฑ์ AA เล็กน้อย | `src/app/(dashboard)/admin/roles/page.tsx:226` | ยืนยันแล้ว |
| 31 | P2 | ปุ่ม “+N” ในคอลัมน์กลุ่มสิทธิ์: ชื่อที่โปรแกรมอ่านหน้าจออ่าน ไม่มีข้อความที่แสดงบนปุ่ม | `src/app/(dashboard)/admin/reports/page.tsx:135` | ยืนยันแล้ว |
| 32 | P3 | ชื่อหมวดซ้ำถูกตรวจแค่ในเบราว์เซอร์ จากรายการที่โหลดไว้ตอนเปิดหน้า API รับชื่อซ้ำได้ แต่คอมเมนต์ในโค้ดอ้างว่า API ตรวจให้ | `src/app/api/admin/categories/route.js:97`<br>`src/app/api/admin/categories/route.js:125` | ยืนยันแล้ว |
| 33 | P3 | โหลดทะเบียนครั้งแรกไม่สำเร็จ แต่ตารางยังบอก “ยังไม่มีรายงาน” และ “แสดง 0 จาก 0” | `src/app/(dashboard)/admin/reports/page.tsx:128`<br>`src/app/(dashboard)/admin/reports/page.tsx:141` | ยืนยันแล้ว |
| 34 | P3 | หลังเลือกรายงาน โฟกัสยังอยู่ในช่องค้นหา พิมพ์ค้นใหม่แล้วตัวอักษรไปต่อท้ายชื่อรายงานเดิม | `src/components/ReportSelector.tsx:81`<br>`src/components/ReportSelector.tsx:114` | ยืนยันแล้ว |
| 35 | P3 | การรันรายงานไม่ตรวจว่ารายงานถูกปิดใช้งานแล้ว และตอนนี้หน้า roles เก็บสิทธิ์ของรายงานที่ปิดไว้ จึงยังรันได้ถ้าส่งคำขอเอง | `src/app/api/reports/execute/route.js:64`<br>`src/app/api/reports/execute/route.js:23` | ยืนยันแล้ว |
| 36 | P3 | GET /api/admin/categories เปิดให้ทุกคนที่ล็อกอิน และคืนชื่อกับ ID ของรายงานที่ใช้งานอยู่ทั้งหมด รวมถึงรายงานที่กลุ่มของผู้ใช้ไม่มีสิทธิ์ | `src/app/api/admin/categories/route.js:61`<br>`src/app/api/admin/categories/route.js:33` | ยังไม่ตรวจซ้ำ (P3) |
| 37 | P3 | ตัวกันการแก้บัญชีตัวเองในหน้าผู้ใช้ถูกปลดล็อกเมื่อโหลดข้อมูลผู้ใช้ที่ล็อกอินไม่ได้ | `src/app/(dashboard)/admin/users/page.tsx:182`<br>`src/app/(dashboard)/admin/users/page.tsx:622` | ยังไม่ตรวจซ้ำ (P3) |
| 38 | P3 | ผลค้นหา AD ที่ตอบกลับช้าไม่ถูกยกเลิก และอาจเขียนทับร่างของผู้ใช้คนอื่น | `src/app/(dashboard)/admin/users/page.tsx:306`<br>`src/app/(dashboard)/admin/users/page.tsx:351` | ยังไม่ตรวจซ้ำ (P3) |
| 39 | P3 | dialog สร้างผู้ใช้ติ๊กบริษัท 1–3 ไว้ให้ล่วงหน้า จึงให้สิทธิ์ทุกบริษัทโดยไม่ได้ตั้งใจ | `src/app/(dashboard)/admin/users/page.tsx:258` | ยังไม่ตรวจซ้ำ (P3) |
| 40 | P3 | ตารางผู้ใช้แสดง “ไม่พบผู้ใช้ตามเงื่อนไข” แม้ไม่ได้กรองหรือโหลดไม่สำเร็จ และคอนทราสต์ต่ำในโหมดมืด | `src/app/(dashboard)/admin/users/page.tsx:621` | ยังไม่ตรวจซ้ำ (P3) |
| 41 | P3 | ผลค้นหาผู้ใช้ AD ไม่ถูกประกาศให้โปรแกรมอ่านหน้าจอ | `src/app/(dashboard)/admin/users/page.tsx:660`<br>`src/app/(dashboard)/admin/users/page.tsx:358` | ยังไม่ตรวจซ้ำ (P3) |
| 42 | P3 | dialog เพิ่ม/เปลี่ยนชื่อกลุ่มไม่โฟกัสช่องชื่อ เพราะ autoFocus ทำงานก่อน showModal | `src/app/(dashboard)/admin/roles/page.tsx:246`<br>`src/components/ui/AccessibleDialog.tsx:28` | ยังไม่ตรวจซ้ำ (P3) |
| 43 | P3 | ป้ายในโหมดแก้ไขรายงานของกลุ่มขัดกันเอง หรือเปลี่ยนความหมายไปจากโหมดอ่าน | `src/app/(dashboard)/admin/roles/page.tsx:237`<br>`src/app/(dashboard)/admin/roles/page.tsx:236` | ยังไม่ตรวจซ้ำ (P3) |
| 44 | P3 | session หมดอายุหรือได้คำตอบที่ไม่ใช่ JSON แล้วแสดงข้อความ parse error ดิบแทนข้อความภาษาไทย | `src/app/(dashboard)/admin/roles/page.tsx:160`<br>`src/app/(dashboard)/admin/categories/page.tsx:125` | ยังไม่ตรวจซ้ำ (P3) |
| 45 | P3 | แท็บมุมมองและกลุ่มหมวดในหน้า roles ไม่มี semantics ที่ถูกต้อง | `src/app/(dashboard)/admin/roles/page.tsx:232`<br>`src/app/(dashboard)/admin/roles/page.tsx:236` | ยังไม่ตรวจซ้ำ (P3) |
| 46 | P3 | จำนวนรายงาน “ยังไม่จัดหมวด” แสดงไม่ตรงกันสองที่ และความหมายของตัวเลขมีแค่ใน tooltip | `src/app/(dashboard)/admin/categories/page.tsx:156`<br>`src/app/(dashboard)/admin/categories/page.tsx:187` | ยังไม่ตรวจซ้ำ (P3) |
| 47 | P3 | หมวดที่เลือกไม่ถูกเก็บใน URL กด Back หรือรีเฟรชแล้วกลับไปอยู่ที่หมวดแรก | `src/app/(dashboard)/admin/categories/page.tsx:97` | ยังไม่ตรวจซ้ำ (P3) |
| 48 | P3 | บนจอมือถือ เลือกหมวดแล้วส่วนรายละเอียดเปลี่ยนอยู่นอกจอ โดยไม่มีอะไรบอกผู้ใช้ | `src/app/(dashboard)/admin/categories/page.tsx:179` | ยังไม่ตรวจซ้ำ (P3) |
| 49 | P3 | ลบหมวดใช้สองคำสั่งโดยไม่มี transaction ถ้าล้มกลางทาง รายงานจะหลุดหมวดหมดแต่หมวดยังอยู่ | `src/app/api/admin/categories/route.js:153` | ยังไม่ตรวจซ้ำ (P3) |
| 50 | P3 | toast หลังลบรายงานเป็นภาษาอังกฤษ หรือไม่บอกจำนวน | `src/app/(dashboard)/admin/reports/page.tsx:88` | ยังไม่ตรวจซ้ำ (P3) |
| 51 | P3 | กล่องยืนยันลบบอกว่าจะลบรายการโปรดด้วย แต่ API ไปลบจากตารางที่ชื่อผิด | `src/app/(dashboard)/admin/reports/page.tsx:94`<br>`src/app/api/admin/reports/[id]/route.js:346` | **แก้แล้ว** พร้อม P0: ลบจาก `UserFavorites` |
| 52 | P3 | ปุ่มเปิด/ปิดรายงานสลับตามค่าบนเซิร์ฟเวอร์ ถ้าหน้าจอแสดงข้อมูลเก่า อาจทำตรงข้ามกับที่ยืนยัน | `src/app/(dashboard)/admin/reports/page.tsx:98`<br>`src/app/api/admin/reports/[id]/route.js:377` | ยังไม่ตรวจซ้ำ (P3) |
| 53 | P3 | ทุกครั้งที่โหลดหรือแก้ไขในทะเบียน ระบบดาวน์โหลดรายการรายงานทั้งหมด 3 รอบ | `src/app/(dashboard)/admin/reports/page.tsx:47` | ยังไม่ตรวจซ้ำ (P3) |
| 54 | P3 | ช่องวันที่/ตัวเลขในหน้ารายงานมาตรฐานยังใช้ color-scheme สว่างในโหมดมืด | `src/app/(dashboard)/reports/standard/page.tsx:438`<br>`src/app/globals.css:9` | ยังไม่ตรวจซ้ำ (P3) |
| 55 | P3 | ARIA จุดเล็กๆ ใน ReportSelector: ข้อความไม่พบผลอยู่ใน listbox, aria-label อยู่บน div ที่ไม่มี role และปุ่มดาวเปลี่ยนป้ายกลับไปมา | `src/components/ReportSelector.tsx:121`<br>`src/app/(dashboard)/reports/standard/page.tsx:402` | ยังไม่ตรวจซ้ำ (P3) |
| 56 | P3 | ค้นคำว่า “ยังไม่จัดหมวด” ไม่เจอ ทั้งที่หน้าจอแสดงคำนี้เป็นชื่อหมวด | `src/lib/report-selector.ts:38`<br>`src/lib/report-selector.ts:47` | ยังไม่ตรวจซ้ำ (P3) |
| 57 | P3 | กล่องยืนยันรายงานหนักบอกว่าจะแสดง “50 แถวแรก” แต่จริงๆ แบ่งหน้าดูได้ทุกแถว | `src/app/(dashboard)/reports/standard/page.tsx:156` | ยังไม่ตรวจซ้ำ (P3) |
| 58 | P3 | เมนูมือถือยังเข้าถึงได้ไม่ดี: ปุ่มปิดไม่มีชื่อ เมนูที่เปิดอยู่ไม่เป็น modal และข้อความรองคอนทราสต์ต่ำ | `src/components/layout/Sidebar.tsx:101`<br>`src/components/layout/Sidebar.tsx:165` | ยังไม่ตรวจซ้ำ (P3) |
| 59 | P3 | ลากเลือกข้อความในช่องของ dialog แล้วปล่อยเมาส์บนฉากหลัง ถูกนับเป็นการคลิกฉากหลัง จึงปิด dialog หรือขึ้นกล่องถาม | `src/components/ui/AccessibleDialog.tsx:36` | ยังไม่ตรวจซ้ำ (P3) |
| 60 | P3 | กฎ .dark แบบเก่าชนะคลาส dark: แบบใหม่ สีโหมดมืดของหน้าที่ออกแบบใหม่จึงถูกแทนที่โดยไม่มีใครเห็น | `src/app/globals.css:3`<br>`src/app/globals.css:104` | ยังไม่ตรวจซ้ำ (P3) |
| 61 | P3 | เทส API ตรวจตัวกรอง IsActive โดยจับข้อความ SQL ด้วย regex ถ้าเขียนตัวกรองในรูปอื่น เทสก็ยังผ่าน | `src/app/api/admin/roles/__tests__/role-access.test.js:23`<br>`src/app/api/admin/categories/__tests__/route.test.js:26` | ยังไม่ตรวจซ้ำ (P3) |

ข้อที่ถูกหักล้าง 3 ข้อ (ไม่นับในตาราง): ตั้งชื่อกลุ่มอื่นเป็น “admin” ผ่าน PUT แล้วสมาชิกกลายเป็นผู้ดูแล (ผู้ตรวจซ้ำพบว่าไม่ตรงพฤติกรรมจริงตามที่อ้าง), รายงานปิดใช้งานยังรันได้เพราะเก็บ mapping ไว้ (เป็นการตัดสินใจที่บันทึกไว้แล้ว ส่วนที่เหลือรวมเป็นข้อ 35), และเรื่องชื่อ test ไม่ตรงเนื้อหา

## ลำดับที่แนะนำให้แก้

1. **API ก่อน (P0):** ใส่การตรวจ Admin ให้ `DELETE`/`PATCH /api/admin/reports/[id]` และ `GET /api/admin/reports` แล้วห่อการลบใน transaction; ตรวจ `allowedCompanies` ใน `execute` และ `execute-async` แบบเดียวกับ `search-param`
2. **ช่องโหว่ที่หน้าเว็บกันไว้แต่ API ยังเปิด:** กัน Admin rename, การแก้บัญชีตัวเอง และ reset-password ของ AD ที่ API; บังคับรหัสผ่าน Local หรือให้ระบบสุ่มรหัส
3. **ปัญหาใหม่จาก native dialog:** แสดงข้อผิดพลาดในตัว dialog หรือย้าย toast ขึ้น top layer, ซิงก์ state เมื่อเบราว์เซอร์ปิด dialog เอง, ให้การ logout อัตโนมัติข้าม `beforeunload`, แก้ hover ของปุ่มหลักหน้ากลุ่มสิทธิ์
4. **บั๊กรายงานมาตรฐานที่มีมาก่อน:** จำนวนแถวต่อหน้า, โหลดเงื่อนไขไม่สำเร็จแล้วยังดึงข้อมูลได้, บริษัทเริ่มต้นนอกรายการ, polling/ส่งออกซ้ำ
5. จากนั้นจึงเก็บ a11y และ P3

## ข้อจำกัดของผลตรวจ

ข้อสรุปจากการอ่านโค้ดยังไม่ได้ทดลองกับฐานข้อมูลจริง ความรุนแรงของข้อ 4 (ลบรายงานครึ่งเดียว) และข้อ 32 (ชื่อหมวดซ้ำ) ขึ้นกับ FK/unique index จริง ข้อ P3 ส่วนใหญ่ไม่ได้ผ่านการหักล้างซ้ำ ผลนี้ไม่ใช่การรับรอง deployment หรือ UAT

Sources: commit `06ec60a`, [UI implementation](../../design/2026-10-02-ui-implementation.md), [Decision log](../../12_DECISION_LOG.md), [audit 2026-10-01](../2026-10-01-ui-ux/README.md), [ผลเทียบเอกสาร 2026-09-29](../../reference-check-2026-09-29.md)

## ปรับลำดับตามคำชี้แจงผู้ใช้ (6 ต.ค. 2026)

ผู้ใช้แจ้งว่าระบบไม่มีผู้ใช้ที่ต้องพึ่งโปรแกรมอ่านหน้าจอหรือการสั่งงานด้วยเสียง ([decision log](../../12_DECISION_LOG.md)) จึงปรับลำดับดังนี้

- **ตัดออกจากลำดับงาน:** ข้อ 9 (toast ไม่ถูกอ่านออกเสียง), 26, 28, 31, 41, 45, 55 และส่วนที่เป็นชื่อ accessible ของข้อ 8 และ 58
- **คงไว้เป็น UX ทั่วไป:** ข้อ 8 ในแง่ที่ป้าย “ใช้งาน” กดแล้วระงับผู้ใช้ทั้งที่ดูเป็นป้ายสถานะ (P2), ปุ่มหลักหน้ากลุ่มสิทธิ์ที่หายตอน hover (P1 จากหน้าจริง) และข้อ 29 แถวที่ไฮไลต์ในช่อง lookup เป็นตัวเกือบขาวบนพื้นเกือบขาวในโหมดมืด ซึ่งทุกคนที่ใช้โหมดมืดอ่านไม่ออก (P2)
- **ลดเป็น P3:** ข้อ 10 (contrast ปุ่มส้ม), 25 (focus หลุดหลังบันทึก), 27 (overlay ส่งออก), 30, 42

ลำดับ P0 และข้อ API/ข้อมูลไม่เปลี่ยน

## ผลการแก้ P0 (6 ต.ค. 2026)

ผู้ใช้สั่ง “เริ่มแก้ P0 ทั้ง 2 ข้อเลย” commit บน branch `claude/ui-ux-report-permissions-users-9850aa` **ยังไม่ merge/deploy** ทดสอบด้วย unit test ที่จำลองฐานข้อมูลเท่านั้น ไม่ได้เปิดหน้าเว็บจริง ไม่ได้ต่อฐานข้อมูล และไม่ได้กดบันทึก ลบ หรือรันรายงานในระบบจริง

### สิ่งที่แก้

| ข้อ | ไฟล์ | การเปลี่ยนแปลง |
|---|---|---|
| 1 | `src/app/api/admin/reports/route.js` (GET)<br>`src/app/api/admin/reports/[id]/route.js` (DELETE, PATCH) | ตรวจ `getSession` + role Admin ก่อนแตะฐานข้อมูล ไม่ใช่ Admin หรือไม่ได้ล็อกอินได้ 403 `Forbidden` แบบเดียวกับ POST/PUT/GET ในไฟล์เดียวกัน; GET รายการรายงานถูกเรียกเฉพาะหน้า Admin (`admin/reports`, `admin/schedules`) |
| 1 + ข้อ 4 + ข้อ 51 | `src/app/api/admin/reports/[id]/route.js` (DELETE) | ลบตัวแปร สิทธิ์ รายการโปรด และตัวรายงานใน transaction เดียว ล้มขั้นไหนก็ rollback ทั้งหมด; ตารางที่อาจยังไม่ถูกสร้างใช้ `IF OBJECT_ID(...) IS NOT NULL`; ลบรายการโปรดจาก `UserFavorites` (เดิมอ้าง `UserFavoriteReports` ที่ไม่มีอยู่); ข้อผิดพลาด FK (547) ตอบ 409 ข้อความไทยแนะนำให้ปิดใช้งานแทน |
| 2 | `src/app/api/reports/execute/route.js`<br>`src/app/api/reports/execute-async/route.js` | ตรวจ `companyId` กับ `session.allowedCompanies` ก่อนเชื่อมฐานบริษัท ใช้กับทุก role รวม Admin ตามกติกาเดิมของ `search-param` ไม่มีสิทธิ์ได้ 403 “คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้”; execute-async ตรวจก่อนสร้าง job |
| ผลต่อเนื่องของข้อ 2 | `src/app/(dashboard)/reports/templates/page.tsx` | dropdown บริษัทหน้า Template เดิมแสดงทุกบริษัท หลังแก้ข้อ 2 ตัวเลือกที่ไม่มีสิทธิ์จะได้ 403 เสมอ จึงกรองด้วย `allowedCompanies` แบบเดียวกับหน้ารายงานมาตรฐาน |

### ผลตรวจ

- เขียน test ก่อนแก้และเห็นว่าล้มด้วยเหตุผลที่ถูก (16 ข้อ) แล้วจึงแก้โค้ด: `src/app/api/admin/reports/[id]/__tests__/route.test.js` (ใหม่), `src/app/api/reports/execute-async/__tests__/route.test.js` (ใหม่), เพิ่มใน `src/app/api/admin/reports/__tests__/route.test.js` และ `src/app/api/reports/execute/__tests__/route.test.js` (fixture session เดิมเพิ่ม `allowedCompanies`)
- test ลำดับการลบและกรณี rollback ล้มเพิ่มหลังผู้ตรวจทักว่าไม่มีอะไรล็อกไว้ ยืนยันด้วย mutation check ว่าถ้าสลับลำดับหรือเอา try/catch รอบ rollback ออก test ที่ตรงกันจะล้ม
- `npm test -- --exclude "**/.claude/**"`: 17 files / 184 passed / 1 todo; `npx tsc --noEmit` ผ่าน; ESLint ไฟล์ที่แก้ไม่มีปัญหาใหม่ (หน้า Template มี error `no-explicit-any` 12 ข้อเท่าเดิมก่อนแก้)
- ผู้ตรวจอิสระ 3 มุม (หาทางเลี่ยงสิทธิ์, ความถูกต้องของ transaction, ผลกระทบต่อผู้เรียก) + ผู้หักล้างรายข้อ: มุมเลี่ยงสิทธิ์ไม่พบช่องโหว่; ข้อที่ยืนยันได้แก้แล้ว 3 ข้อ (ข้อความ 409, test ลำดับ/rollback, dropdown หน้า Template) เหลือ 1 ข้อเป็นเรื่องนโยบายซึ่งผู้ใช้ตัดสินแล้วด้านล่าง ผู้ตรวจถูกห้ามใช้ browser และตรวจ transcript แล้วว่าไม่มีการเรียก browser หรือ localhost

### นโยบายลบรายงานที่มีประวัติใช้งาน (ผู้ใช้ตัดสินแล้ว)

`ActivityLogs.ReportId` มี FK ไป `Reports` ตาม `scripts/create_activity_logs.sql:7` และระบบบันทึกแถวที่อ้างรายงานทุกครั้งที่สร้าง แก้ หรือรันรายงาน ถ้าฐานจริงมี FK นี้ รายงานเกือบทุกตัวจะลบถาวรไม่ได้ (ตอนนี้ตอบ 409 และไม่ลบอะไร เดิมตอบ 500 หลังลบตัวแปร/สิทธิ์ไปแล้วบางส่วน) ทางเลือกคือคงไว้ (ให้ปิดใช้งานแทน) หรือตั้ง `ActivityLogs.ReportId = NULL` แบบที่ `src/app/api/admin/users/route.js:308` ทำกับ `UserId` — **ผู้ใช้เลือกคงไว้** บันทึกใน [decision log](../../12_DECISION_LOG.md) ยังไม่ได้ตรวจ FK ในฐานจริง และยังไม่แก้ `DELETE /api/admin/reports/bulk` ให้ตอบ 409 แบบเดียวกัน

### นอกขอบเขต P0 ที่พบระหว่างแก้

- `GET /api/test-db` ต้องการแค่การล็อกอิน (middleware) ไม่ตรวจ Admin และส่ง `err.message` ของการเชื่อมฐานกลับ client
- `GET /api/cron/execute-schedules` รับ secret ทาง query string และ comment ในโค้ด/Handoff มีตัวอย่างค่า secret ควรตรวจว่าค่าจริงใน `.env` ไม่ซ้ำตัวอย่าง (ไม่คัดลอกค่าลงเอกสารนี้)
- `admin/categories` GET ตรวจแค่ session (รายละเอียดทุกสถานะจำกัดเฉพาะ Admin แล้วตาม implementation 2026-10-02)
