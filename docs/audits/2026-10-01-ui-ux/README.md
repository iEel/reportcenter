# ReportCenter — ตรวจ UI/UX ทุกหน้า 2026-10-01

ตรวจครบ **15 page routes** ที่พบใน src/app รวมหน้าสร้าง Report, เพิ่ม User, ตั้งกำหนดการ และแท็บสำคัญ เทียบหน้าจอจริงกับ Handoff/docs และโค้ด เป็น **audit และข้อเสนอเท่านั้น ยังไม่แก้ระบบ**

ข้อสรุป: โครงสร้างหลักรองรับงานจริงและมีเหตุผล แต่หน้าจออธิบายความสัมพันธ์ระหว่างผู้ใช้ กลุ่มสิทธิ์ บริษัท หมวด และรายงานไม่พอ ใช้คำไม่คงที่ และมีบางคำสั่งที่พฤติกรรมในโค้ดไม่ตรงสิ่งที่ UI สื่อ ควรจัดการเรื่องผลของคำสั่งก่อนปรับความสวยงาม

## สถานะการใช้งานที่ผู้ใช้ยืนยัน

วันที่ 1 ต.ค. 2026 ผู้ใช้ยืนยันว่า **ระบบอีเมลใช้งานได้ และระบบตั้งเวลาใช้งานได้** ให้ใช้เป็นสถานะการใช้งานปัจจุบันตามคำยืนยันผู้ใช้ ผู้ตรวจไม่ได้ส่งอีเมลหรือรันกำหนดการซ้ำในรอบ audit

ข้อ F1/F2 เป็นข้อสังเกตจากโค้ดสำหรับกรณีหยุด/เปิด เปลี่ยนรายงานในกำหนดการ และการแจ้งผลเมื่อคำสั่งล้มเหลว ยังไม่ทดลองกรณีเหล่านั้นในระบบจริง จึงไม่ใช้สรุปว่าระบบตั้งเวลาหรืออีเมลโดยรวมใช้งานไม่ได้ คำยืนยันนี้ไม่ได้ระบุ host/version ที่ deploy หรือรับรองทุกกรณีใน audit

## ปรับข้อสรุปตามคำชี้แจงผู้ใช้

1. ปุ่ม “ดึงข้อมูล” คือ **เรียกรายงานจริง** แล้วส่งออกรายงานนั้น ไม่ใช่ดูตัวอย่าง ถอนข้อเสนอเปลี่ยนปุ่มหลักเป็น “แสดงตัวอย่าง” คำว่า “ตัวอย่าง” ใน Template Editor หมายถึงดูรูปแบบข้อความ ซึ่งเป็นคนละขั้นตอน
2. เงื่อนไขขึ้นกับนิยามแต่ละ Report ผู้สร้างกำหนดชื่อช่อง ชนิด Lookup และลำดับเอง ถอนการเหมารวมว่า CompanyCode ซ้ำกับบริษัท หรือควรเติมค่า/แปลง YYYYMM อัตโนมัติ ต้องอ่านความหมายรายงานนั้นก่อน
3. ผู้ใช้ยืนยันว่าพนักงานเปลี่ยน Report/เงื่อนไขแล้วเรียกรายงานใหม่ จึง **ถอนข้อเสนอแถบเตือนเงื่อนไขเปลี่ยน** ไม่จัดเป็นงาน UX ที่ต้องทำ

การแก้สิทธิ์จากฝั่ง Report และ Role เป็นสองมุมของความสัมพันธ์เดียวกัน มีประโยชน์ทั้งคู่ ไม่เสนอให้ยุบเพียงเพราะพบในสองหน้า และการจัดหมวดจากหน้าสร้าง/แก้ Report มีอยู่แล้ว

## วิธีตรวจและขอบเขตหลักฐาน

- ใช้ Chrome session Admin เดิมที่ localhost:4000 เปิดครบ 15 หน้าที่ตรงกับไฟล์ page.tsx; Login เปิดแท็บแยกแล้วปิด ไม่ logout ผู้ใช้
- ภาพจริงที่บันทึกและเปิดตรวจ 31 ภาพ: รอบสามหน้าเดิม 10 ภาพ, creation-flow 6 ภาพ, all-pages 15 ภาพ; Audit Trail capture เฉพาะหัวหน้า/ตัวกรองเพื่อไม่คัดลอกกิจกรรมบุคคล
- ตรวจหน้ารวมและฟอร์มหลัก ไม่ได้เปิดแก้ผู้ใช้แต่ละคนหรือทดสอบทุกสถานะผิดพลาด
- ฟอร์มสร้าง Report ทดลอง Extract Parameters จากข้อความ SQL จำลองที่มี @Period และ @JobNo ฝั่งหน้าเว็บเท่านั้น **ไม่ได้ execute SQL หรือบันทึก** เปลี่ยนประเภท/รูปแบบสิทธิ์ในฟอร์มเปล่า และสลับ Local/AD ในฟอร์มเพิ่ม User แล้วทิ้งฟอร์ม
- ไม่กดบันทึก ลบ rollback เปลี่ยนสิทธิ์ Sync AD ทดสอบ AD/Email เปลี่ยนรหัส เรียกรายงาน export หรือสร้างงาน background; ไม่แก้ src/config/schema
- เปิดหน้าใช้ API ของแอปตามปกติ ซึ่ง GET บางส่วนมี schema initialization ภายใน จึงไม่อ้างว่าฐานข้อมูลไม่มี side effect ทุกชนิด ไม่ได้สั่ง SQL/API เขียนข้อมูลโดยตรง
- **UI** = เห็นจาก browser; **Source** = ตรวจโค้ด ยังไม่ทดลองผลการเขียน; **ข้อเสนอ** = รอเลือกแนวทาง ไม่ใช่ implementation สำเร็จ
- ผู้ตรวจยังไม่ได้ทดสอบ non-admin/AD session, mobile/dark mode, screen reader, contrast ratio, keyboard journey เต็มชุด, ผลรายงาน/ยอดบัญชี หรือ deployment; อีเมลและการตั้งเวลาใช้งานได้ตามคำยืนยันผู้ใช้ โดยไม่มีการทดสอบซ้ำจากผู้ตรวจรอบนี้

## แบบจำลองระบบที่ตรวจพบ

| ส่วน | ความหมายจริง | Source หลัก |
|---|---|---|
| User | Local หรือ AD; เลือก Role เดียวและบริษัทที่อนุญาตหลายบริษัท | src/app/(dashboard)/admin/users/page.tsx:709,936,953; src/app/api/admin/users/route.js:155,171 |
| Role | กลุ่มเชื่อมหลายรายงาน; รายงานหนึ่งให้หลาย Role ได้ | src/app/api/admin/roles/route.js:136; src/app/api/admin/reports/route.js:88 |
| Company | ขอบเขตบริษัท/ฐานข้อมูลที่เลือก แยกจาก Role และต้นสังกัด AD; enforcement ยังมีข้อค้าง | src/app/(dashboard)/admin/users/page.tsx:225,856,950; docs/reference-check-2026-09-29.md |
| Category | จัดรายการให้ค้นง่าย รายงานมีหนึ่งหมวดหรือไม่ระบุ ไม่ได้ให้สิทธิ์ตามหมวดอัตโนมัติ | src/app/(dashboard)/admin/reports/new/page.tsx:260; src/app/api/admin/reports/route.js:44 |
| Report definition | ชื่อ/ประเภท SQL เงื่อนไข Lookup ลำดับ หมวด Role งานขนาดใหญ่ และ Template ตามประเภท | src/app/(dashboard)/admin/reports/new/page.tsx:55,107,406; src/app/api/admin/reports/route.js:57 |
| Standard / Template | เรียกรายงานตาม definition; Standard แสดงตาราง ส่วน Template สร้างข้อความต่อแถวเพื่อคัดลอก | src/app/(dashboard)/reports/standard/page.tsx:113,487; src/app/(dashboard)/reports/templates/page.tsx:208,254 |
| Schedule | นำ definition เดิมมาผูกบริษัท เงื่อนไข เวลา และผู้รับ เพื่อสร้างไฟล์ส่งอีเมลอัตโนมัติ | src/app/(dashboard)/admin/schedules/page.tsx:46,97,541; src/app/api/admin/schedules/route.js |
| History / Audit | Job History ติดตามไฟล์ background ของตน 24 ชม.; Audit Trail ติดตามกิจกรรมระบบ | src/app/api/reports/job-history/route.js:35; src/app/(dashboard)/admin/audit-logs/page.tsx:49 |

```mermaid
flowchart LR
  U[ผู้ใช้] --> R[กลุ่มสิทธิ์]
  U --> C[บริษัทที่อนุญาต]
  R --> D[นิยามรายงาน]
  G[หมวดหมู่] --> D
  D --> S[เรียกรายงานตาราง]
  D --> T[เรียกรายงานข้อความ]
  D --> A[ตั้งเวลาส่งรายงาน]
  S --> B[งานสร้างไฟล์เบื้องหลัง]
  T --> B
  B --> H[ประวัติการสร้างรายงาน]
  A --> E[อีเมลตามกำหนด]
```

แผนภาพอธิบายหน้าที่ ไม่ใช่การรับรองการบังคับสิทธิ์ทุกเส้นทาง

## ผลรายหน้า — ทุก route

“ชัด/ควรปรับ” ประเมินสิ่งที่ตรวจได้ ไม่ใช่ผ่าน UAT; หมายเลขขั้นใช้อ้างในข้อค้นพบและภาพท้ายรายงาน

| ขั้น | หน้า / route | งานและจุดแข็ง | สภาพ / ข้อเสนอเฉพาะหน้า | ภาพ |
|---|---|---|---|---|
| 1 | Login /login | ทางเข้าเดียว Local/AD มีคำแนะนำติดต่อ admin | ค่อนข้างชัด; ตัวช่วยสีอ่อน คำล็อกควรตรง rate limit | A12 |
| 2 | Home / | ทางเข้า Standard/Template และงาน admin พร้อมสถิติ/กิจกรรม | ชัด; แยกโหลดล้มเหลวจากไม่มีข้อมูล | A01 |
| 3 | Standard /reports/standard | ค้นรวมหมวด/คำอธิบาย เงื่อนไขตาม definition | ปรับ empty state หลังเลือกและคำส่งออก รักษาจังหวะเรียกรายงาน | A13, O07–10 |
| 4 | Template /reports/templates | สร้างข้อความจากผลรายงานต่อแถว | ใช้ตัวเลือกแบบเดียวกับ Standard และทบทวนผลเกิน 100 แถว | A02 |
| 5 | Job History /reports/job-history | บอกอายุไฟล์ 24 ชม. และ refresh | บอกว่าเป็นงาน background พร้อมบริษัท/ทางติดตามงาน | A03 |
| 6 | Reports /admin/reports | ค้น/กรองหมวด เปิดปิด สร้าง/แก้ | ปรับการเลือกข้ามตัวกรอง; คอลัมน์ท้ายพ้นขอบที่ขนาดตรวจ | A04 |
| 7 | Create Report /admin/reports/new | แยกข้อมูล SQL ตัวแปร และ Template | โครงสร้างเหมาะสม; บอกความพร้อม/ชื่อ Role ให้คงที่ | C01–04, C06 |
| 8 | Edit Report /admin/reports/[id]/edit | แก้ definition พร้อมเวอร์ชัน/เปรียบเทียบ | เครื่องมือดี; อธิบายขอบเขต rollback/เปรียบเทียบ SQL | A05–06 |
| 9 | Users /admin/users | ค้น/กรอง/แบ่งหน้า Local/AD และ Role/บริษัท | แยกต้นสังกัด/สิทธิ์บริษัท และอธิบาย Sync ครบ | C05 |
| 10 | Roles /admin/roles | ดูกลุ่มและเลือกชุดรายงานตามหมวด | ควรปรับมาก: Admin/Public, inactive และพื้นที่ฟอร์ม | A15, O01–03 |
| 11 | Categories /admin/categories | ชื่อ/สี/จำนวน สื่อการจัดกลุ่ม | เพิ่มลิงก์ไปจัดรายงาน ไม่จำเป็นต้องย้ายงานทั้งหมดมาหน้านี้ | A14, O04–06 |
| 12 | Schedules /admin/schedules | ตั้งส่ง definition เดิม มีวันที่สัมพัทธ์; ผู้ใช้ยืนยันใช้งานได้ | ข้อสังเกต source เฉพาะ success, เปลี่ยน Report, หยุด/เปิด ยังไม่ทดลอง | A07–08 |
| 13 | Audit Trail /admin/audit-logs | กรองประเภท/ผู้ใช้/วันที่ พร้อมรายละเอียด | บอกขอบเขต export ว่าเฉพาะหน้าปัจจุบัน | A09 |
| 14 | Settings /admin/settings | แบ่งข้อมูลทั่วไป บริษัท ความปลอดภัย AD | ระบุ Test AD ใช้ค่าบันทึกแล้ว และแสดง error ครบ | A10 |
| 15 | Change Password /change-password | ฟอร์มสั้น รหัสเดิม/ใหม่/ยืนยัน | แก้คำขั้นต่ำ 6/8 และอธิบาย Local/AD | A11 |

O = ภาพ 10 ภาพเดิมที่ราก audit; C = creation-flow; A = all-pages

## ข้อค้นพบที่ควรจัดการก่อนปรับหน้าตา

ทุกข้อเป็น **ข้อเสนอ ยังไม่แก้ไข** P1 = ผลคำสั่งอาจผิดจากเจตนาหรือกระทบสิทธิ์/งาน; P2 = สับสนหรือทำงานต่อยาก ไม่ใช่ security audit เต็มระบบ

### F1 — P1: หยุด/เปิดกำหนดการล้างเงื่อนไขเดิม (ขั้น 12)

**Source:** src/app/(dashboard)/admin/schedules/page.tsx:237–242 ส่ง toggle โดยไม่มี parameters; src/app/api/admin/schedules/route.js:184,197,208 แปลงเป็น null แล้ว UPDATE โดยไม่รวมของเดิม เมื่อ PUT สำเร็จเงื่อนไขเดิมจึงถูกล้าง งานที่ต้องใช้ตัวแปรอาจรันไม่ได้ภายหลัง (route.js:308; src/app/api/cron/execute-schedules/route.js:145) **ไม่ได้กดหยุด/เปิดจริง**

**ข้อเสนอ:** เปลี่ยนเฉพาะสถานะและเก็บเงื่อนไขเดิมครบ ทดสอบกับรายงานมีพารามิเตอร์ก่อนนำการแก้ไขไปใช้

### F2 — P1: ตั้งเวลาแจ้งสำเร็จโดยไม่ตรวจคำตอบ / เปลี่ยน Report ไม่ครบ (ขั้น 12)

**Source:** src/app/(dashboard)/admin/schedules/page.tsx:205–215,223–245 รอ fetch แล้วแจ้ง success/ปิด modal โดยไม่ตรวจ status หรือ success; edit เปลี่ยน Report ได้ (:514–518) และส่ง reportId (:190) แต่ PUT ไม่รับหรือ UPDATE ReportId (src/app/api/admin/schedules/route.js:184,204–211)

**ข้อเสนอ:** ยืนยันผลจริงก่อนแจ้งสำเร็จและคงฟอร์มเมื่อผิดพลาด; ให้เปลี่ยนรายงานได้จริงหรือแสดงเป็นข้อมูลแก้ไม่ได้ **ยังไม่ได้ทดลองบันทึกหรือส่งอีเมล**

### F3 — P1: ความหมายสิทธิ์ใน UI ไม่ตรงเส้นทางที่ตรวจ (ขั้น 6–10)

**UI/Source:** New/Edit มี “ทุกคน (Public)” แต่ available/execute ของ non-admin ใช้ mapping และสร้าง Public ไม่สร้าง mapping ส่วน Admin bypass mapping แต่หน้า Role แสดงจำนวน mapping ราวกับจำนวนรายงานที่เข้าถึงได้ (src/app/(dashboard)/admin/reports/new/page.tsx:254; src/app/api/admin/reports/route.js:89; src/app/api/reports/available/route.js:49,60; src/app/api/reports/execute/route.js:59; src/app/(dashboard)/admin/roles/page.tsx:336)

**Source:** Role GET คืน mapping เฉพาะรายงาน active ขณะที่ PUT ลบทั้งชุดแล้วแทน จึงอาจถอนสิทธิ์ inactive เมื่อบันทึก (src/app/api/admin/roles/route.js:24,136)

**ข้อเสนอ:** ทำความหมาย Public/Admin ให้ตรง แสดงสิทธิ์ที่มีผลจริง และเก็บ mapping inactive ให้ตรวจได้ ไม่ได้ทดลองบันทึกหรือใช้ session พนักงาน

### F4 — P1: คำสั่งจัดการจำนวนมากซ่อนผลกระทบ (ขั้น 6, 9)

**Reports source:** selectedIds ค้างเมื่อเปลี่ยนค้นหา/หมวด, bulk delete ส่งทั้งหมดรวมรายการซ่อน, ยืนยันแค่จำนวน; select-all เทียบจำนวนแทนสมาชิก (src/app/(dashboard)/admin/reports/page.tsx:111–145,179,187) **ข้อเสนอ:** แสดงจำนวนซ่อนและรายชื่อที่จะลบ หรือกำหนดขอบเขตตามผลกรองให้ชัด

**Users source:** UI Sync AD บอกเฉพาะระงับผู้ใช้ที่ไม่พบ แต่ API ยังเปิด inactive กลับเมื่อพบ AD โดยไม่แยกเหตุผลที่ถูกระงับ (src/app/(dashboard)/admin/users/page.tsx:402; src/app/api/admin/users/sync-ad/route.js:42–49) **ข้อเสนอ:** อธิบายทั้งเปิด/ระงับและสรุปผลกระทบ ไม่ได้ทดลอง Sync หรือลบ

### F5 — P2: คำและความสัมพันธ์ข้ามหน้าไม่ชัด (ขั้น 6–11)

**UI/Source:** Report เรียก Role ว่า “ตำแหน่ง”, Users เรียก “Role” และมี “แผนก” AD อีกคำ; ผู้ใช้ใหม่เลือกบริษัททั้งหมดตั้งต้น ส่วนเลือก AD ไม่ปรับ allowedCompanies ตามต้นสังกัด (src/app/(dashboard)/admin/users/page.tsx:117,225,858,934,950; src/app/(dashboard)/admin/reports/new/page.tsx:255,280)

**ข้อเสนอ:** ใช้ “กลุ่มสิทธิ์” พร้อม “กลุ่มกำหนดรายงานที่ใช้ได้ บริษัทกำหนดข้อมูลที่เข้าถึงได้”; แยก “บริษัทต้นสังกัดจาก AD” กับ “บริษัทที่อนุญาต” และสรุปก่อนบันทึก ไม่เปลี่ยนกฎเริ่มต้นเอง

Role detail ไม่มีทางดูสมาชิกต่อ; หมวดเป็น chip กดไม่ได้และคำแนะนำไปจัดรายงานเป็นข้อความ (src/app/(dashboard)/admin/categories/page.tsx:265,294) ควรเชื่อมกลุ่ม→สมาชิก/รายงาน และหมวด→ทะเบียนที่กรองแล้ว โดยคงหน้าสร้าง/แก้ Report ไว้ได้

### F6 — P2: ฟอร์มสิทธิ์แคบและรายการเปลี่ยนตำแหน่ง (ขั้น 10)

**UI:** modal ประมาณ 512 px มี scroll ซ้อน; **Source:** selected-first ย้ายแถวเมื่อเลือก และ “เลือกทั้งหมด” ใช้ทั้งชุด แต่ “เลือกทั้งหมวด” ใช้ผลหลังค้นหา (src/app/(dashboard)/admin/roles/page.tsx:106,439,493,532)

**ข้อเสนอ:** พื้นที่กว้าง/เลื่อนหลักเดียว คงลำดับระหว่างติ๊ก ตั้งชื่อการเลือกให้บอกขอบเขต/จำนวน และสรุปเพิ่ม–ถอน/สมาชิกที่กระทบ

### F7 — P2: รายงานสองประเภทเริ่มงานต่างแบบและข้อความไม่ตามขั้น (ขั้น 3–4)

**UI:** Standard ใช้ combobox รวม ส่วน Template ใช้หมวด+ค้นหา+select แยก; ทั้งคู่เลือกแล้วแต่ยังบอก “เลือกรายงานเพื่อเริ่มต้น” **Source:** Template เลือก lookup แล้วรันทันที (src/app/(dashboard)/reports/templates/page.tsx:508–511) แต่ช่องอื่นรอกดปุ่ม

**ข้อเสนอ:** ใช้รูปแบบเลือกรายงานเดียวกัน เปลี่ยน empty state เป็น “กรอกเงื่อนไขแล้วกดดึงข้อมูล” หลังเลือก และทำจังหวะรันสม่ำเสมอหรืออธิบายการรันอัตโนมัติ รักษาเงื่อนไขเฉพาะรายงานและไม่เพิ่ม stale banner

### F8 — P1 เฉพาะงานเกิน 100 แถว: Template เข้าไม่ถึงข้อความส่วนที่เหลือ (ขั้น 4)

**Source:** render reportData.slice(0,100) ไม่มี pagination/load more จึงไม่มี Copy Message ของแถว 101 เป็นต้นไป แม้มีข้อความแจ้งจำนวน (src/app/(dashboard)/reports/templates/page.tsx:590,666)

**ข้อเสนอ:** แบ่งหน้า/ค้นแถวให้เข้าถึงทุกข้อความเมื่อมีงานลักษณะนี้ ยังไม่ได้เรียกรายงานเพื่อยืนยันข้อมูลเกิน 100 แถว

### F9 — P2: คำส่งออกและประวัติต้องบอกผลตรง (ขั้น 3–5, 13)

- Standard/Template ปุ่ม Export Excel ใน heavy path สร้าง CSV; Standard ปกติเป็น XLSB และ Print/PDF ใช้ window.print กับตารางบนหน้า (src/app/(dashboard)/reports/standard/page.tsx:301,369,606,683; src/app/api/reports/execute-async/route.js:201) เสนอเฉพาะชื่อปลายทาง “ส่งออก Excel / สร้างไฟล์ CSV / พิมพ์หน้านี้” **ปุ่มหลักยังหมายถึงเรียกรายงาน**
- Audit Trail export ใช้ logs หน้าปัจจุบัน 30 รายการ (src/app/(dashboard)/admin/audit-logs/page.tsx:33,79–89,217–219) ควรระบุ “ส่งออกหน้านี้” หรือรองรับทุกผลค้นหา แยกจาก export ของหน้ารายงาน
- Job History ได้ CompanyId แต่ไม่แสดงบริษัท (src/app/api/reports/job-history/route.js:39; src/app/(dashboard)/reports/job-history/page.tsx:173–220) ควรแสดงบริษัท/เวลาและเชื่อมจาก banner ไปประวัติ
- ข้อเทคนิคบันทึกไว้เท่านั้น: Standard export query ใหม่ด้วย exportAll (standard/page.tsx:344–354) ส่วน Template ปกติสร้างจาก reportData (templates/page.tsx:304–313) ยังไม่ทดสอบ snapshot consistency และไม่เสนอแถบเตือนเงื่อนไขตามที่ผู้ใช้ปฏิเสธ

### F10 — P2: บอกความพร้อมและขอบเขตเวอร์ชัน Report (ขั้น 7–8)

**Source:** Extract เป็นขั้นกดเอง แต่ save ตรวจหลัก ๆ ชื่อ/SQL (src/app/(dashboard)/admin/reports/new/page.tsx:55,95,330); หัวข้อใช้ “สำหรับลูกน้อง” (:374); compare เปรียบเทียบ SQL แต่ rollback คืนข้อมูล/parameters หลายช่องโดยไม่คืน Role mapping (src/app/(dashboard)/admin/reports/[id]/edit/page.tsx:105; src/app/api/admin/reports/[id]/versions/route.js:167)

**ข้อเสนอ:** สถานะความพร้อมแต่ละแท็บและตรวจความสอดคล้อง โดยไม่บังคับว่าทุกรายงานต้องมีตัวแปร ใช้ “เงื่อนไขที่ผู้ใช้งานต้องกรอก” และระบุว่าเปรียบเทียบ/ย้อนกลับอะไรบ้าง

### F11 — P2: ข้อความการตั้งค่าและรหัสผ่านไม่ตรงพฤติกรรม (ขั้น 1, 14–15)

- **UI/Source:** placeholder บอก 6 แต่ validation/checklist ใช้ 8 (src/app/(dashboard)/change-password/page.tsx:41,151,167,199); API ตรวจ Local PasswordHash แต่เมนูมีให้ทุกบัญชี (src/app/api/auth/change-password/route.js:29–49; src/components/layout/Sidebar.tsx:121) ควรแยกคำแนะนำ Local/AD และใช้กฎเดียวกัน ไม่ได้ป้อนรหัส
- **Source:** Test AD อ่านค่าบันทึกแล้ว ไม่ใช่ค่าค้างในฟอร์ม; helper คืน error แต่ UI อ่าน message (src/app/(dashboard)/admin/settings/page.tsx:103–110,330–344; src/app/api/admin/settings/test-ldap/route.js:16; src/lib/ldap.js:196–207) ควรบอกขอบเขตและแสดงผลครบ ไม่ได้ทดสอบเชื่อมต่อ
- **Source:** ข้อความ “ล็อกบัญชี” ต่างจากตัวจำกัดที่ใช้ IP (src/app/login/page.tsx:111; src/app/api/auth/login/route.js:35–45) ควรสื่อข้อจำกัดการลองเข้าสู่ระบบและเวลารอที่ยืนยันได้

### F12 — P2: รูปแบบ การอ่าน และการกู้คืนข้อผิดพลาด (หลายขั้น)

**UI:** หัวหน้า/เมนู/ปุ่มผสมไทยอังกฤษ, บางปุ่มล้วนไอคอน, metadata เล็กสีอ่อน, modal เลื่อนซ้อน; ตาราง Reports มีคอลัมน์ท้ายพ้นพื้นที่ที่ viewport 1536×770 ภาพ A04

**Source:** load error บางหน้าเก็บ console/catch เฉย ๆ ดูคล้ายไม่มีข้อมูล (src/app/(dashboard)/page.tsx:57–65; src/app/(dashboard)/reports/standard/page.tsx:73–85; src/app/(dashboard)/reports/templates/page.tsx:67–79; src/app/(dashboard)/reports/job-history/page.tsx:43–49)

**Accessibility จาก source:** Role/Category ใช้ div onClick สำหรับแถวขยาย; modal ไม่มี dialog/focus management ในไฟล์; labels บริษัท/parameters ไม่ผูก input (src/app/(dashboard)/admin/roles/page.tsx:283,367; src/app/(dashboard)/admin/categories/page.tsx:211; src/app/(dashboard)/reports/standard/page.tsx:474–520) ไม่รับรอง WCAG จากภาพ

**ข้อเสนอ:** ใช้หัวหน้า ฟอร์ม feedback และ error/ลองใหม่แบบร่วมกัน พร้อมทดสอบคีย์บอร์ด/ขนาดหน้าจอหลังเลือกแนวทาง

## Handoff/docs เทียบโค้ด

| เรื่อง | ผล | หลักฐาน/ข้อจำกัด |
|---|---|---|
| Flow หลัก, definitions, parameter order, Roles/Category, version history | ตรงใน source | Handoff โครงสร้างและ §10 + new/edit/roles/categories APIs; เปิดหน้าไม่ยืนยันบันทึก/rollback |
| Standard selector | ตรงใน source และ UI | Handoff:748–757; docs/superpowers/specs/2026-08-14-standard-report-selector-design.md; plan คู่กันเป็นแผน ไม่ใช่ผล test |
| Template viewer / schedules | ตรงโดยต้องแยกหน้าที่ | Template คัดลอกข้อความต่อแถว; schedule ส่งอีเมลจาก definition; viewer ไม่ได้ส่งอีเมลเอง |
| Job History 24 ชม. / refresh 10 วินาที | ตรงใน source/ข้อความ UI | Handoff:649–654; job-history/page.tsx:40–99; รอบนี้ empty state ไม่ดาวน์โหลด/ยกเลิก |
| กรองบริษัทตาม allowedCompanies | ไม่ตรง | Handoff §3 อ้างกรอง แต่ Standard/Template render companies.map; ข้อค้างเดิมใน docs/reference-check-2026-09-29.md ยังไม่ทดสอบ enforcement |
| Sync AD | อธิบายไม่ครบ | Handoff:57,81 ระบุ soft-disable; API เปิด inactive กลับด้วย ดู F4 |
| admin checks ทุก method ของ single report | ไม่ตรงใน route source | Handoff:678–679 อ้างครบ แต่ src/app/api/admin/reports/[id]/route.js:327,365 ไม่มี getSession ใน DELETE/PATCH handlers; ไม่ได้ทดสอบ request หรือรับรองสิทธิ์โดยรวม |
| password API / shared validation | เอกสารบางตอนขัดกัน | Handoff:631 ระบุ POST แต่จริง PUT (โครงสร้างต้นเอกสารบอก PUT ถูก); :629 ระบุ frontend shared validator แต่หน้าใช้ regex เอง |
| Users bulk toggle | ตรงเฉพาะ API | Handoff:658 มี API src/app/api/admin/users/bulk/route.js; หน้า Users ไม่มี bulk-selection UI จึงไม่อ้างว่าหน้าเว็บรองรับแล้ว |
| อีเมลและการตั้งเวลา | ผู้ใช้ยืนยันใช้งานได้ 2026-10-01 | หลักฐานเป็นคำยืนยันผู้ใช้; ผู้ตรวจไม่ได้ส่งอีเมล/รันกำหนดการซ้ำ และไม่ได้ทดสอบ F1/F2 |
| ผลรายงาน AD รายละเอียดติดตั้ง cron deployment UAT | ผู้ตรวจยังไม่ได้ตรวจ | คำยืนยันอีเมล/ตั้งเวลาไม่ระบุ host/version หรือผลทดสอบทุกกรณี |

## ลำดับปรับปรุงที่เสนอ

ข้อเสนอตอบคำถามผู้ใช้ “แนะนำปรับอะไรก่อน” หลังยืนยันอีเมล/ตั้งเวลาใช้งานได้ เป็นลำดับงาน UX ที่เสนอ ยังไม่ใช่การเลือกแบบหรืออนุมัติ implementation

1. **กลุ่มสิทธิ์ + ผู้ใช้ + ส่วนเลือกสิทธิ์ใน Report ก่อน** — ให้ตอบได้ว่าผู้ใช้คนหนึ่งอยู่กลุ่มใด ใช้รายงานอะไรและบริษัทใด ใช้คำ “กลุ่มสิทธิ์” เหมือนกัน เพิ่มทางดูสมาชิก/รายงานและสรุปก่อนบันทึก ขยายฟอร์ม Role ให้เลื่อนสะดวกและไม่ย้ายแถวขณะเลือก ก่อนปรับหน้าจอต้องทวนความหมาย Public/Admin และการเก็บ inactive mappings ให้สรุปสิทธิ์ได้ตรงจริง (F3, F5, F6)
2. **หมวดหมู่ → รายงานในหมวด** — เพิ่มลิงก์เปิดทะเบียนที่กรองหมวดแล้ว และแสดงรายงานยังไม่จัดหมวด รักษาการเลือกหมวดจากหน้าสร้าง/แก้ Report ที่มีอยู่ ช่วยจบงานต่อจากหมวดโดยไม่ต้องจำเมนู (F5)
3. **รายงานมาตรฐาน/Template ให้ใช้รูปแบบร่วมกัน** — ตัวเลือกรายงาน ข้อความก่อน/หลังเลือก ตำแหน่งปุ่มและผลลัพธ์สม่ำเสมอ คงการเรียกรายงานจริงและเงื่อนไขเฉพาะ Report ไม่เพิ่ม stale banner; ตรวจการเข้าถึงข้อความ Template เกิน 100 แถวเมื่อมีการใช้งานนั้น (F7–F9)
4. **สร้าง/แก้ Report** — แสดงความพร้อมของ SQL เงื่อนไข และกลุ่มสิทธิ์แต่ละแท็บ พร้อมสรุปก่อนบันทึก โดยไม่บังคับว่าทุกรายงานต้องมีตัวแปร (F10)

สำหรับคำสั่งผู้ดูแลที่เกี่ยวข้อง ให้ทวนขอบเขต bulk delete และ Sync AD ก่อนแก้หรือปล่อยงานในส่วนนั้น (F4) ส่วน F1/F2 ของ Schedules เป็นรายการตรวจกรณีเฉพาะแยกจากลำดับ UX ข้างต้น ระบบอีเมลและตั้งเวลาใช้งานได้ตามคำยืนยันผู้ใช้

**ขอบเขตรอบแรกที่แนะนำ:** ทำข้อ 1 ให้ครบทั้งสามจุด โดยให้ผู้ดูแลตรวจสิทธิ์ของผู้ใช้หนึ่งคนและทบทวนสิ่งที่จะเพิ่ม/ถอนก่อนบันทึกได้ ไม่จำเป็นต้องปรับทุกหน้าในรอบเดียว

ยังไม่ได้อนุมัติหรือแก้ implementation งานรอบนี้มีเพียงหลักฐาน audit และเอกสาร/wiki

## ผลตรวจเอกสารรอบนี้

- wiki-lint ReportCenter และ shared-lint ผ่าน ไม่พบปัญหาเชิงโครงสร้าง
- git diff --check ผ่าน และไม่มี diff ใน src, package.json หรือ next.config.ts
- มีภาพครบ 31 ไฟล์ ตรวจลิงก์ภาพและ source paths ของรายงาน ไม่รัน app tests/build เพราะไม่มีการแก้ implementation

## ภาพหลักฐานตามขั้น

### 1–2: Login และ Home
![Login — ฟอร์มเปล่า ไม่ป้อนรหัส](all-pages/12-login.jpg)
![Home — ทางเข้าและสถิติ](all-pages/01-home.jpg)

### 3–5: เรียกรายงานและติดตามไฟล์
![Standard — เงื่อนไขตามรายงาน](all-pages/13-standard-report.jpg)
![Template — นิยามข้อความและเงื่อนไข](all-pages/02-template-report.jpg)
![Job History — empty state งาน background](all-pages/03-job-history.jpg)

### 6–8: ทะเบียน สร้าง และแก้ Report
![ทะเบียนรายงาน — คอลัมน์ท้ายพ้นขอบ](all-pages/04-manage-reports.jpg)
![สร้างรายงาน — ข้อมูลทั่วไป](creation-flow/01-report-general.jpg)
![สร้างรายงาน — SQL editor](creation-flow/02-report-sql.jpg)
![ตัวแปรจากข้อความจำลอง ไม่ execute หรือบันทึก](creation-flow/03-report-parameters.jpg)
![เลือกสิทธิ์จากฝั่ง Report ในฟอร์มไม่บันทึก](creation-flow/04-report-role-selection.jpg)
![สร้าง Template — ผูกฟิลด์กับข้อความ](creation-flow/06-report-template-builder.jpg)
![แก้รายงาน — ข้อมูลและกลุ่มสิทธิ์](all-pages/05-edit-report.jpg)
![ประวัติเวอร์ชัน — ไม่กด rollback](all-pages/06-report-versions.jpg)

### 9–11: ผู้ใช้ สิทธิ์ และหมวดหมู่
![เพิ่ม User — AD, Role, บริษัทแยกกัน ไม่ค้นบุคคลหรือบันทึก](creation-flow/05-user-ad-form.jpg)
![Role — จำนวน mapping ต่างจากสิทธิ์ Admin](all-pages/15-roles.jpg)
![Role detail — ค้นและขยายในรอบแรก](02-role-detail.jpg)
![Role editor — modal และ scroll ซ้อน](03-role-editor.jpg)
![Categories — ชื่อ สี และวิธีจัดหมวด](all-pages/14-categories.jpg)
![Category detail — รายงานเป็น chip](05-category-detail.jpg)
![Category editor — ชื่อและสี](06-category-editor.jpg)

### 12–15: ตั้งเวลา ประวัติ ระบบ และรหัสผ่าน
![กำหนดการใหม่ — รายงาน บริษัท เวลา ผู้รับ](all-pages/07-schedules.jpg)
![กำหนดการ — วันที่สัมพัทธ์จาก Report](all-pages/08-schedule-parameters.jpg)
![Audit Trail — capture เฉพาะหัว/ตัวกรอง ไม่เก็บแถวบุคคล](all-pages/09-audit-trail-filters.jpg)
![Settings — ข้อมูลทั่วไปและกลุ่มการตั้งค่า](all-pages/10-settings.jpg)
![Change Password — placeholder ขั้นต่ำ 6 ตัว](all-pages/11-change-password.jpg)

ภาพเดิมเพิ่มเติม: [Role overview](01-roles-overview.jpg), [Categories overview](04-categories-overview.jpg), [Standard entry](07-standard-entry.jpg), [Report picker](08-report-picker.jpg), [AP parameters](09-report-parameters.jpg), [GL definition และคำสั่ง](10-heavy-report-actions.jpg) ใช้ประกอบ audit ต่อเนื่อง ไม่ใช้ GL ตัดสินว่าทุก Report ต้องมีเงื่อนไขเหมือนกัน
