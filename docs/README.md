# เอกสาร ReportCenter

ใช้เอกสารประกอบโค้ดจริงทุกครั้งก่อนนำข้อสรุปไปบันทึกวิกิ

| เอกสาร | หน้าที่ |
|---|---|
| [Developer Handoff](../DEVELOPER_HANDOFF.md) | ภาพรวม ระบบ API และวิธีพัฒนา ต้องอ่านพร้อมข้อแตกต่างที่ตรวจพบ |
| [Deployment Guide](../DEPLOYMENT_GUIDE.md) | ขั้นตอนติดตั้ง ไม่ใช่หลักฐานว่า deploy แล้ว |
| [ผลเทียบเอกสารกับโค้ด 2026-09-29](reference-check-2026-09-29.md) | ขอบเขตที่ทวน หลักฐาน ความคลาดเคลื่อน และผล tests |
| [Report selector design](superpowers/specs/2026-08-14-standard-report-selector-design.md) | ข้อกำหนดและเจตนาของฟีเจอร์ |
| [Report selector plan](superpowers/plans/2026-08-14-standard-report-selector.md) | แผนเดิม ไม่ใช้ checkbox ตัดสินสถานะปัจจุบัน |
| [Changelog](99_CHANGELOG.md) | ประวัติการเปลี่ยนแปลง |
| [UI/UX audit 2026-10-01](audits/2026-10-01-ui-ux/README.md) | ตรวจครบ 15 หน้า ภาพจริง 31 ภาพ แบบจำลองระบบและข้อเสนอที่ทวนกับโค้ด ยังไม่แก้ระบบ |
| [Decision log](12_DECISION_LOG.md) | Workflow ที่ผู้ใช้ยืนยันและเหตุผลการตัดสินใจ |
| [Mockup สิทธิ์/ผู้ใช้ 2026-10-01](design/2026-10-01-permissions-mockups/README.md) | ภาพร่าง 3 แนวทาง ข้อมูลสมมติ รอเลือก/ปรับ ยังไม่ implement |
| [Mockup หมวดหมู่ 2026-10-01](design/2026-10-01-category-mockups/README.md) | ภาพร่าง 3 แบบจาก UI/UX Pro Max ทวน source และรักษากติกาหมวดเดิม ยังไม่ implement |
| [ตรวจ design v2 2026-10-02](audits/2026-10-02-design-v2/README.md) | ตรวจ local 5 หน้า ภาพใหม่ 14 ภาพและ snapshot source แยกบั๊ก mock/ข้อเสนอใหม่/ความต่างเวอร์ชัน ยังไม่แก้ระบบ |
| [ข้อเสนอ UI/UX หลังแก้ข้อ 1](design/2026-10-02-next-ui-refinements.md) | เหตุผลของข้อเสนอ 6 ข้อที่ผู้ใช้อนุมัติแล้ว; ปรับเฉพาะ local mock v3 |
| [Mockup v3 2026-10-02](design/2026-10-02-mockups-v3/README.md) | แบบ 5 หน้า ปรับบริบท/จำนวน/สรุปผู้ใช้/ทางลัดและ keyboard; วิธีเปิด ผล regression และ desktop QA พร้อมภาพ 7 ภาพ; ข้อจำกัด F7 ยังอยู่ ไม่ใช่ production |
| [UI implementation จาก v3](design/2026-10-02-ui-implementation.md) | นำแบบมาใช้ใน Next.js app 5 หน้า; สัญญา GET ที่เพิ่มข้อมูล inactive, dialog/draft guard และข้อจำกัด UI/backend พร้อมสถานะตรวจแยกจาก mock/deploy/UAT |
| [QA ของ UI implementation รอบแรก](audits/2026-10-02-ui-implementation/README.md) | ประวัติผลตรวจ/ภาพ 11 ภาพ; ภาพทะเบียนมือถือยังโหลดและภาพผู้ใช้ก่อนแก้ scroll จึงต้องอ่านผลทวนล่าสุดประกอบ |
| [ทวน app เทียบ mock v3 ล่าสุด](audits/2026-10-02-ui-parity-recheck/README.md) | แก้ส่วน UI ที่ตกหล่น ตรวจจริง 5 หน้า ภาพใหม่ 15 ภาพ และระบุส่วนที่ยังไม่ตรงแบบ; 160 tests passed/1 todo, build/lint source ผ่าน ไม่มี live CRUD/deploy/UAT |
| [แก้แนว/ขนาดช่องเงื่อนไข Standard](audits/2026-10-02-standard-field-alignment/README.md) | Follow-up จากผู้ใช้: controls44px/แนวร่วม; DOM measurementsและภาพdesktop/mobile พร้อมผลตรวจรวมก่อน commit/push หลังแก้ CSS: tests160/1todo, build50pages และ lint source28ไฟล์ผ่าน |
| [รีวิว implementation 06ec60a](audits/2026-10-06-implementation-review/README.md) | อ่านโค้ดทั้ง commit 8 ด้านพร้อมหักล้างซ้ำ และเปิดหน้าจริง 5 หน้า: P0 ฝั่ง API 2 ข้อ (ลบ/ปิดรายงานไม่ตรวจสิทธิ์, execute ไม่ตรวจบริษัท), ปัญหาใหม่จาก native dialog และสถานะปัญหาเดิม (a)–(f); ยังไม่แก้โค้ด |

วิกิ: `D:\Obsidian\Eltross\ReportCenter\rc-index.md` · วิธีบันทึก: [AGENTS.md](../AGENTS.md)

หลักฐาน implementation ยึดโค้ด ส่วนการทำงานจริงต้องมี tests/การทดลองที่ตรงขอบเขต และการ deploy ต้องมีหลักฐานแยกต่างหาก
