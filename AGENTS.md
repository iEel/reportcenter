# ReportCenter

เว็บรายงานส่วนกลางสำหรับพนักงานและผู้ดูแลระบบ ใช้ Next.js App Router / React / SQL Server ดู `package.json` สำหรับรุ่นและคำสั่งจริง โค้ดและเอกสารใน repo เป็นแหล่งอ้างอิงด้าน implementation

## เริ่มงาน

1. อ่าน `D:\Obsidian\Eltross\ReportCenter\rc-status.md` และ `rc-open-questions.md`
2. ใช้ `D:\Obsidian\Eltross\ReportCenter\rc-index.md` หาเรื่องที่เกี่ยวข้อง
3. อ่าน `DEVELOPER_HANDOFF.md`, `docs/README.md` และเอกสารใน `docs/` ของส่วนที่จะทำงาน รวม `DEPLOYMENT_GUIDE.md` เมื่อเกี่ยวกับ deploy แล้วเทียบกับโค้ดจริง เอกสารและ checkbox ในแผนไม่ใช่หลักฐานว่า implementation หรือ deployment เสร็จแล้ว
4. ก่อนแก้วิกิ อ่าน `D:\Obsidian\Eltross\ReportCenter\_schema\rc-wiki-schema.md`

## ข้อมูลกลาง

- เริ่มที่ `D:\Obsidian\Eltross\Shared\Shared.md` ก่อนเชื่อมระบบหรือใช้ข้อกำหนดกลาง
- AD: อ่าน `Shared\systems\ad-ldap\ad-ldap.md` ใต้ vault ก่อนแก้ login; ทำงานฝั่ง server เท่านั้น ห้ามเปิดค่าลับผ่าน `NEXT_PUBLIC_*`; bind/search เท่านั้น
- SMF: อ่าน `Shared\systems\smf-erp\smf-erp.md` ก่อนเขียน SQL บริษัทที่โค้ดรองรับคือ SONIC / GRANDLINK / AUTOLOGIS; ตอนพัฒนาใช้ DEV และใช้ PROD เฉพาะเมื่อผู้ใช้สั่งชัดเจน
- DB บริษัทอ่านอย่างเดียว คำสั่งที่ไม่ใช่ SELECT ต้องแสดง SQL เต็มและขออนุมัติต่อครั้ง บัญชีอาจมีสิทธิ์ admin จริง
- ห้ามแสดงหรือบันทึกรหัสผ่าน/token ลงเอกสารหรือ log; อย่าคัดลอกตัวอย่าง credential จากเอกสารเดิมเข้าวิกิ
- โปรเจคเดิมใช้ `DB_*`, `C1_DB_*`, `C2_DB_*`, `C3_DB_*` และ `CompanyDatabases`; ยังไม่ได้ย้ายให้ตรงแม่แบบ Shared ทั้งชุด ห้ามถือว่าการเพิ่มวิกิเป็นการยืนยัน environment หรือการย้ายระบบ

## บันทึก wiki + Obsidian ทุกครั้ง

ผู้ใช้กำหนดให้โปรเจคนี้บันทึกงานลงวิกิ `D:\Obsidian\Eltross\ReportCenter` ใช้ prefix `rc-` เพื่อไม่ให้ชื่อหน้าชนทั้ง vault

- หลังแก้ฟีเจอร์ บั๊ก รายงาน กฎธุรกิจ สิทธิ์ โครงสร้างระบบ หรือได้ข้อสรุปที่ใช้ต่อได้ ให้อัปเดตหน้าที่เกี่ยวข้องก่อนจบงาน ไม่ต้องรอผู้ใช้สั่งซ้ำ
- ทุกครั้งที่แก้วิกิ เพิ่ม `rc-log.md`; หน้าใหม่ต้องเพิ่มใน `rc-index.md` และมีลิงก์เข้า อัปเดต `rc-status.md` เมื่อสถานะเปลี่ยน
- บันทึกสิ่งที่เปลี่ยน เหตุผล source ผลตรวจ และสิ่งที่ยังไม่ยืนยัน ไม่เก็บบทสนทนาทั้งก้อนหรือข้อมูลส่วนบุคคลที่ไม่จำเป็น
- แยก implementation ในเครื่อง / deploy / UAT / การรับรองยอดทางบัญชี ห้ามอนุมานสถานะหนึ่งจากอีกสถานะหนึ่ง
- ข้อเท็จจริงทุกหน้าเนื้อหาต้องมี sources ที่มีอยู่จริงใน repo; ใช้ `confidence: unverified` เมื่อยังไม่ได้ทวนกับโค้ดหรือหลักฐานจริง
- การ ingest ต้องอ้างทั้ง Handoff/docs ที่เกี่ยวข้องและไฟล์โค้ดที่ตรวจจริง ระบุผลว่า ตรง / ไม่ตรง / ยังไม่ได้ตรวจ แยกการอ่านโค้ดจากผล tests, runtime และ deployment ถ้าไม่ตรงให้บันทึกข้อแตกต่างในเอกสารตรวจและ rc-open-questions ก่อนสรุป ห้ามยกความน่าเชื่อถือทั้งโมดูลจากการพบชื่อไฟล์อย่างเดียว
- ถ้าเข้า vault ไม่ได้ ให้บอกตรง ๆ และเก็บรายการรอ ingest ใน `docs/wiki-pending.md` ห้ามอ้างว่าบันทึก Obsidian แล้ว เมื่อเข้าถึงได้ให้นำเข้าวิกิและปิดรายการ

## เมื่อมีการตัดสินใจ

| เรื่อง | บันทึกที่ |
|---|---|
| API / schema / implementation | โค้ด + `DEVELOPER_HANDOFF.md` หรือเอกสารเฉพาะเรื่องใน `docs/` |
| เหตุผลการตัดสินใจสำคัญ | `docs/12_DECISION_LOG.md` (สร้างเมื่อมีเรื่องแรก) + สรุปเชื่อมในวิกิ |
| ประวัติการเปลี่ยนโปรเจค | `docs/99_CHANGELOG.md` |
| สถานะ / กฎธุรกิจ / การใช้งาน / ข้อสรุป | หน้าเกี่ยวข้องในวิกิ + `rc-log.md` |
| ข้อขัดแย้ง / เรื่องยังไม่ทราบ | `rc-open-questions.md` |

## คำสั่งสั้นจากผู้ใช้

- `บันทึกด้วย` / `ลง wiki` / `ลง Obsidian`: ingest ผลงานรอบปัจจุบันตาม schema
- `ทวน <หน้า> กับโค้ด`: อ่าน sources จริง แก้ข้อสรุปพร้อม confidence และวันที่
- `lint wiki`: รันคำสั่งด้านล่างที่ราก vault

## ตรวจงาน

```powershell
# รันที่ D:\Obsidian\Eltross
node tools/wiki-lint.mjs ReportCenter --repo D:/Antigravity/reportcenter --prefix rc-
node tools/shared-lint.mjs
```

งานโค้ดเลือกตรวจให้ตรงส่วนที่แก้ด้วย `npm test`, `npm run lint`, `npm run build` ตามความเหมาะสม ผลผ่านต้องเป็นผลรอบนี้ งานเอกสารล้วนตรวจลิงก์ sources และโครงสร้างวิกิ ไม่ต้องต่อฐานข้อมูล
