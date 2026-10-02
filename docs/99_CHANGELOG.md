# ReportCenter changelog

## 2026-10-02

- เตรียม commit/push ตามคำสั่งผู้ใช้: อัปเดต Handoff/docs/wiki ให้รวมการแก้ alignment; รันตรวจรวมหลังแก้ CSS ใหม่ได้ tests15files/160passed/1todo, build50pages และ ESLint source28ไฟล์ผ่าน ดู [คำสั่งและขอบเขตผลตรวจ](audits/2026-10-02-standard-field-alignment/README.md) ไม่ใช่ deployment/UAT
- แก้ Standard conditions หลังผู้ใช้พบแนว/ขนาดต่างกัน: บริษัทเดิม44px/date36px เปลี่ยน controls เป็น44pxเท่ากันและจัดlabel/control/helperด้วยsubgrid ทดสอบ DOM ของ AP/GL/Statement และมือถือ พร้อม [ภาพ/หลักฐาน](audits/2026-10-02-standard-field-alignment/README.md); scoped lint+TypeScriptผ่าน ไม่มี execute/export หรือ deployment
- ทวน app เทียบ v3 หลังผู้ใช้พบ Standard ไม่ครบและตั้งคำถามหน้าอื่น: แก้ layout/selector บริษัท/ขั้นตอน Standard, searchable role picker+preview/บริษัท 3 การ์ด/toolbar Users, RID/filter chips+คืน focus Registry, ตำแหน่ง actions และตรวจชื่อหมวดซ้ำ เก็บ [หลักฐานใหม่ 15 ภาพและข้อค้างรายหน้า](audits/2026-10-02-ui-parity-recheck/README.md) แก้คำสรุปเดิมที่กว้างเกินหลักฐาน Tests ล่าสุด 15 files/160 passed/1 todo; build50pages และ lint source28ไฟล์ผ่าน ยังไม่ใช่ mock parity ทุกฟังก์ชัน, live mutation, deploy หรือ UAT
- ผู้ใช้อนุมัตินำ v3 มาใช้ใน Next.js app: ปรับกลุ่มสิทธิ์ หมวด ผู้ใช้ ทะเบียน และ Standard พร้อม native dialog/draft guard/ชื่อเมนู; ขยาย roles GET เพื่อรักษา inactive mapping และ categories GET เพิ่มรายละเอียดทุกสถานะเฉพาะ Admin โดยคง mutation contract เดิม ตัดปุ่มพิมพ์ Standard ตามแบบที่อนุมัติโดยไม่เปลี่ยน export API บันทึก [implementation/source/ข้อจำกัด](design/2026-10-02-ui-implementation.md) แยกจากประวัติ mock ไม่มี live CRUD, deployment หรือ UAT ใหม่
- ผลตรวจ app รอบแรก: tests 15 files / 151 passed / 1 todo เมื่อ exclude worktree ซ้ำ; TypeScript/build และ ESLint ไฟล์ที่แก้ผ่าน Repo lint มี 58 errors / 56 warnings ในไฟล์นอกขอบเขต; [browser QA เดิม](audits/2026-10-02-ui-implementation/README.md) ใช้ GET จริงใน localhost มีภาพ 11 ภาพ แต่ภาพทะเบียนมือถือยัง loading และภาพผู้ใช้เก็บก่อนแก้ scroll จึงไม่ยืนยันหน้าปัจจุบันครบจากภาพชุดนี้ ใช้ผลทวนและภาพใหม่ด้านบนแทน; ยังไม่ครอบคลุม SPA Back/Forward, screen reader หรือ live mutation
- ผู้ใช้อนุมัติข้อเสนอ 6 ข้อและ keyboard จึงปรับ [local mock v3](design/2026-10-02-mockups-v3/README.md): แยกบริบทสร้างหมวด, ชื่อกลุ่มสิทธิ์/จำนวนใช้งาน-ปิดใช้งาน, ขอบเขต selection ขณะค้นหา, สรุปก่อนบันทึกผู้ใช้, dialog ดู +N กลุ่ม และคงรายการโปรดหลังเลือกรายงาน พร้อมเก็บ focus/Tab/Escape และคง draft guard เดิม; ไม่แก้ production หรือข้อแตกต่าง backend/F7
- ผลตรวจรอบ v3: Node mock regression 42 passed; `npm test` รายงาน 16 files / 228 passed / 2 todo ซึ่งรวม tests ซ้ำจาก `.claude` worktree ที่มีอยู่ ไม่ใช่ 228 กรณีไม่ซ้ำกัน; syntax/whitespace ผ่าน และ desktop browser QA ผ่าน flow ที่ระบุใน README พร้อมภาพ 7 ภาพ, console warning/error 0; แก้ animation dialog/drawer เป็น fade ให้ dropdown ภายในทำงานถูกตำแหน่ง ยังไม่ตรวจ mobile บันทึกวิธีเปิดและข้อจำกัดข้อมูลสมมติ ไม่มีข้อสรุป deployment/UAT ใหม่
- เพิ่มข้อเสนอ UI/UX หลังแก้ mockup ข้อ 1: แยกบริบทสร้างหมวด/ชื่อหมวดกับกลุ่มสิทธิ์, counts และขอบเขต selection, รวมสรุปผู้ใช้, เปิดดู +N กลุ่ม และคงรายการโปรดหลังเลือกรายงาน ทวน source ล่าสุดและบันทึก wiki; ยังไม่แก้ UI เพิ่มหรือทดสอบ runtime รอบใหม่
- ตามคำสั่งเริ่มข้อ 1 แก้ F1–F3 ใน local mock v2: ชั้น dialog, owner/guard ของ draft สิทธิ์, คำยืนยันก่อนทิ้งหมวด และการปิดฟอร์มซ้ำ; Node regression 22/22 ผ่าน, npm test 114 passed/1 todo, browser flow ผ่าน เก็บหลักฐานใน audit/fix-1 และอัปเดต Obsidian ไม่แก้ระบบจริงหรือเผยแพร่ Artifact
- เสนอลำดับงานต่อจาก design v2: แก้ป๊อปอัป/draft ใน mock, แยกชื่อหมวดกับกลุ่มสิทธิ์และจำนวน, ทวน flow/keyboard แล้วสรุปขอบเขตหน้าจอ/API บันทึก audit/wiki ตามคำถามผู้ใช้; ไม่มี implementation หรือผลทดสอบระบบใหม่
- ผู้ใช้ยืนยันให้รายงานมาตรฐานเลือกรายงานก่อน แล้วจึงแสดงบริษัทและเงื่อนไข ทวน source ระบบ/local mock ว่าตรงแล้ว บันทึก decision/wiki และปิด F6 เรื่องลำดับบริษัท แทนข้อเสนอ company-first เดิม; แก้เฉพาะเอกสาร ไม่แก้ระบบหรือสคริปต์ mock
- ตรวจ mockup v2 ใน worktree ที่อ้างจาก Obsidian ครบ 5 หน้า เก็บภาพใหม่และ snapshot source ยืนยันปัญหา scrim/draft ข้ามกลุ่ม/ข้อมูลค้าง/keyboard พร้อมความต่าง local กับ README รอบ 4 บันทึก audit/wiki; ไม่แก้ต้นทาง mockup, src, API หรือข้อมูลจริง

## 2026-10-01

- เสนอคำ “หมวดรายงาน” / “กลุ่มสิทธิ์ผู้ใช้” และการแยกหน้าที่ในเมนู/ฟอร์มตามคำถามผู้ใช้ ทวน Role/ตำแหน่ง/Public กับ source บันทึกต่อใน brief หมวดและ wiki; ยังไม่รับรองกติกา Public หรือเปลี่ยนชื่อข้อมูล/ระบบ
- สร้าง mockup หมวดหมู่ 3 แบบตามคำขอใช้ UI/UX Pro Max อ้างหน้าจอจริง/Handoff/source แยกยังไม่จัดหมวดและเสนอการเปิด Reports พร้อมตัวกรอง บันทึก docs/design และ Obsidian; ยังไม่เลือกแบบหรือแก้ระบบจริง
- สร้างภาพ mockup สิทธิ์/ผู้ใช้ 3 แนวทางตามคำขอ พร้อมข้อมูลสมมติ อ้างภาพระบบเดิมและ source เก็บใน docs/design และเชื่อม Obsidian; ยังไม่เลือกแบบ ไม่สร้าง prototype หรือแก้ระบบจริง
- จัดลำดับข้อเสนอ UX ตามคำถามผู้ใช้: กลุ่มสิทธิ์/ผู้ใช้/สิทธิ์ใน Report → หมวด → Standard/Template → สร้าง/แก้ Report บันทึกใน audit และ wiki; ยังไม่เลือกแบบหรือแก้ระบบ
- รับคำยืนยันผู้ใช้ว่าอีเมลและระบบตั้งเวลาใช้งานได้ อัปเดต audit/wiki/status ให้แยกจากข้อสังเกต source เฉพาะกรณีที่ยังไม่ได้ทดลอง ไม่มีการแก้ระบบหรือทดสอบส่งอีเมล/รันกำหนดการซ้ำ
- ขยาย audit ครบ 15 page routes รวมสร้าง Report/User และหน้าระบบ เก็บภาพรวม 31 ภาพ; แก้ข้อเสนอเดิมตามผู้ใช้เรื่องเรียกรายงาน เงื่อนไขเฉพาะ Report และไม่ใช้ stale banner เพิ่ม decision log, ผลเทียบ Handoff/source และ wiki; ไม่แก้ implementation หรือทดลองคำสั่งบันทึก/ส่งอีเมล/เปลี่ยนสิทธิ์
- ตรวจ UI/UX สิทธิ์ หมวดหมู่ และรายงานมาตรฐาน เก็บภาพจริง 10 ภาพ + รายงาน source-backed และสรุปใน Obsidian; เป็นข้อเสนอ ไม่แก้โค้ดระบบหรือการตั้งค่าสิทธิ์

## 2026-09-29

- ทวน Handoff, Deployment Guide และ spec/plan Report Selector กับโค้ด เพิ่ม docs/README.md และ reference-check-2026-09-29.md พร้อมผล 114 tests passed / 1 todo และข้อแตกต่างที่ยังต้องติดตาม; ขยายกติกา ingest ให้ตรวจเอกสารคู่โค้ดเสมอ
- จัดตั้งวิกิ Obsidian ที่ `D:\Obsidian\Eltross\ReportCenter` ใช้ prefix `rc-` มีสถานะ สารบัญ เรื่องค้าง สถาปัตยกรรม และรายงานมาตรฐาน
- เพิ่ม `AGENTS.md` และ pointer สำหรับ Claude/Gemini กำหนดให้บันทึกการเปลี่ยนแปลงและข้อสรุปสำคัญลงวิกิก่อนจบงาน
- ทวนโครงสร้าง repo และโค้ดบางส่วนเพื่อทำ baseline เอกสาร ไม่ได้ทดสอบ runtime, เชื่อมฐานข้อมูล หรือยืนยัน deployment
