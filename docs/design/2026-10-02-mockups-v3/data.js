/* ReportCenter mockup v2 — fake data sized like the live system (2026-10-01).
   Report names follow the live catalogue; people, mappings and figures are invented. */

const COMPANIES = [
  { id: 1, code: 'SNI', name: 'Sonic Interfreight' },
  { id: 2, code: 'GRL', name: 'Grandlink Logistics' },
  { id: 3, code: 'SALOG', name: 'Autologis' },
];

const COLORS = {
  blue: { name: 'น้ำเงิน', hex: '#3b82f6' },
  indigo: { name: 'คราม', hex: '#6366f1' },
  purple: { name: 'ม่วง', hex: '#a855f7' },
  teal: { name: 'เขียวน้ำทะเล', hex: '#14b8a6' },
  emerald: { name: 'เขียว', hex: '#10b981' },
  cyan: { name: 'ฟ้า', hex: '#06b6d4' },
  amber: { name: 'เหลือง', hex: '#f59e0b' },
  orange: { name: 'ส้ม', hex: '#f97316' },
  rose: { name: 'ชมพู', hex: '#f43f5e' },
  slate: { name: 'เทา', hex: '#94a3b8' },
};

let CATS = [
  { id: 1, name: 'Account', color: 'indigo' },
  { id: 2, name: 'Customer Service', color: 'teal' },
  { id: 3, name: 'DC', color: 'amber' },
  { id: 4, name: 'TEST', color: 'rose' },
];

const P = {
  cut: { key: 'cutoff', label: 'Cutoff Date (G/L Date)', kind: 'date', required: true },
  ageAs: { key: 'ageAsOf', label: 'Age as of', kind: 'date', required: true },
  period: { key: 'period', label: 'งวดบัญชี (YYYYMM)', kind: 'text', required: true, placeholder: 'เช่น 202609' },
  from: { key: 'from', label: 'วันที่เริ่มต้น', kind: 'date', required: true },
  to: { key: 'to', label: 'วันที่สิ้นสุด', kind: 'date', required: true },
  acct: { key: 'acct', label: 'เลขบัญชี', kind: 'lookup', required: false, options: ['ทุกบัญชี', '1100-00 เงินสด', '2100-00 เจ้าหนี้การค้า', '4100-00 รายได้ค่าขนส่ง'] },
  cust: { key: 'cust', label: 'ลูกค้า', kind: 'lookup', required: false, options: ['ทุกลูกค้า', 'C-0012 บจก. สยามคาร์โก้', 'C-0458 Global Freight Partners', 'C-0981 บจก. ไทยโลจิสติกส์'] },
  job: { key: 'job', label: 'Job No.', kind: 'text', required: false, placeholder: 'เว้นว่าง = ทุก Job' },
};

let REPORTS = [
  { id: 1028, name: 'AP Aged Balance - Document Detail', desc: 'A/P คงค้างรายเอกสาร (THB): Cutoff ตาม G/L Date จัดอายุจาก Document Date', cat: 1, type: 1, params: [P.cut, P.ageAs] },
  { id: 1027, name: 'AP Aged Balance - Vendor Summary', desc: 'A/P คงค้างสรุปตาม Vendor (THB): Cutoff ตาม G/L Date จัดอายุจาก Document Date', cat: 1, type: 1, params: [P.cut, P.ageAs] },
  { id: 31, name: 'รายงานยอด Insurance', desc: 'ดึงยอด insurance จาก SMF', cat: 1, type: 1, params: [P.period] },
  { id: 26, name: 'Business_File v2', desc: 'แก้ไขกรณีบางรายการไม่แสดง', cat: 1, type: 1, params: [P.from, P.to] },
  { id: 19, name: 'Business_File', desc: 'รุ่นเดิม ใช้ v2 แทน', cat: 1, type: 1, active: false, params: [P.from, P.to] },
  { id: 12, name: 'GL Data', desc: 'ข้อมูลบัญชีแยกประเภททั้งงวด', cat: 1, type: 1, heavy: true, params: [P.period, P.acct] },
  { id: 14, name: 'Statement', desc: 'รายการเคลื่อนไหวรายลูกค้า', cat: 1, type: 1, params: [P.cust, P.to] },
  { id: 15, name: 'Statement Billing', desc: 'ใบแจ้งยอดสำหรับวางบิล', cat: 1, type: 1, params: [P.cust, P.from, P.to] },
  { id: 25, name: 'Statement Billing V2', desc: 'อยู่ระหว่างทดสอบ', cat: 1, type: 1, active: false, params: [P.cust, P.from, P.to] },
  { id: 16, name: 'TB Detail', desc: 'งบทดลองรายบัญชี', cat: 1, type: 1, params: [P.period] },
  { id: 17, name: 'TB Detail BB', desc: 'งบทดลองพร้อมยอดยกมา', cat: 1, type: 1, params: [P.period] },
  { id: 18, name: 'TB Summary', desc: 'งบทดลองสรุป', cat: 1, type: 1, params: [P.period] },
  { id: 21, name: 'WH Sheet', desc: 'ภาษีหัก ณ ที่จ่ายรายเดือน', cat: 1, type: 1, params: [P.period] },
  { id: 22, name: 'WH TAX', desc: 'แบบยื่นภาษีหัก ณ ที่จ่าย', cat: 1, type: 1, params: [P.period] },
  { id: 30, name: 'AR Aging Summary', desc: 'ลูกหนี้คงค้างสรุปตามลูกค้า', cat: 1, type: 1, params: [P.cut] },
  { id: 33, name: 'ข้อความแจ้งยอดค้างชำระ', desc: 'สร้างข้อความแจ้งลูกค้ารายแถวเพื่อคัดลอก', cat: 1, type: 2, params: [P.cust] },
  { id: 28, name: 'INVOICE For SIG', desc: 'Export ข้อมูล Invoice สำหรับ SIG ใช้ได้กับ SONIC และ Grandlink', cat: 2, type: 1, params: [P.from, P.to] },
  { id: 27, name: 'Pre AlertEx', desc: 'แจ้งล่วงหน้าก่อนสินค้าถึง', cat: 2, type: 1, params: [P.job] },
  { id: 32, name: 'ข้อความแจ้งสถานะ Shipment', desc: 'ข้อความแจ้งลูกค้าตามสถานะ Shipment', cat: 2, type: 2, params: [P.job] },
  { id: 29, name: 'Stock Movement รายวัน', desc: 'ความเคลื่อนไหวสินค้าในคลัง', cat: 3, type: 1, params: [P.from] },
  { id: 5, name: 'Cutoff', desc: '', cat: null, type: 1, params: [P.cut] },
  { id: 6, name: 'Price Memo', desc: '', cat: null, type: 1, params: [P.cust] },
  { id: 3, name: 'Sale Order Report', desc: 'Report showing standard sale orders', cat: null, type: 1, params: [P.from, P.to] },
  { id: 24, name: 'test', desc: '', cat: null, type: 1, params: [] },
  { id: 9, name: 'test91', desc: '', cat: null, type: 1, params: [] },
  { id: 10, name: 'Test Q', desc: 'ทดสอบข้อมูลขนาดใหญ่', cat: null, type: 1, heavy: true, params: [P.period] },
];
REPORTS.forEach(r => { if (r.active === undefined) r.active = true; r.heavy = !!r.heavy; });

let ROLES = [
  { id: 1, name: 'Admin', admin: true },
  { id: 2, name: 'Account' },
  { id: 3, name: 'Account Head' },
  { id: 4, name: 'Finance Head' },
  { id: 5, name: 'Finance Insurance' },
  { id: 6, name: 'Customer Service' },
  { id: 7, name: 'Customer Service No Business File' },
  { id: 8, name: 'Sales' },
  { id: 9, name: 'Nominate' },
  { id: 10, name: 'IT' },
  { id: 11, name: 'DC Operation' },
];

const MAP = {};
Object.entries({
  2: [1028, 1027, 14, 15, 25],
  3: [1028, 1027, 14, 15, 18, 16, 22, 12],
  4: [18, 16, 17, 12, 21, 22, 30],
  5: [31],
  6: [28, 27, 32],
  7: [28, 27],
  8: [3, 6],
  9: [27, 5],
  10: [24, 9, 10, 26, 29],
  11: [29],
}).forEach(([k, v]) => { MAP[k] = new Set(v); });

let USERS = [
  { id: 1, name: 'System Admin', user: 'admin', kind: 'local', role: 1, cos: [1, 2, 3], active: true, me: true },
  { id: 2, name: 'Anan Wongsiri', user: 'anan.w', kind: 'ad', emp: '10021', role: 1, cos: [1, 2, 3], active: true, email: 'anan.w@example.co.th', dept: 'IT', adCo: 'Sonic Interfreight' },
  { id: 3, name: 'Busaba Charoenrat', user: 'busaba.c', kind: 'ad', emp: '10034', role: 1, cos: [1, 2], active: true, email: 'busaba.c@example.co.th', dept: 'IT', adCo: 'Sonic Interfreight' },
  { id: 4, name: 'Chatchai Prasertsuk', user: 'chatchai.p', kind: 'ad', emp: '10107', role: 1, cos: [1], active: true, email: 'chatchai.p@example.co.th', dept: 'Finance', adCo: 'Sonic Interfreight' },
  { id: 5, name: 'Darunee Sukjai', user: 'darunee.s', kind: 'ad', emp: '20015', role: 1, cos: [1, 2, 3], active: true, email: 'darunee.s@example.co.th', dept: 'Accounting', adCo: 'Grandlink Logistics' },
  { id: 6, name: 'Ekkachai Thongdee', user: 'ekkachai.t', kind: 'ad', emp: '10233', role: 3, cos: [1, 2, 3], active: true, email: 'ekkachai.t@example.co.th', dept: 'Accounting', adCo: 'Sonic Interfreight' },
  { id: 7, name: 'Fon Kittisak', user: 'fon.k', kind: 'ad', emp: '10245', role: 3, cos: [1], active: true, email: 'fon.k@example.co.th', dept: 'Accounting', adCo: 'Sonic Interfreight' },
  { id: 8, name: 'Kanya Rattanapol', user: 'kanya.r', kind: 'ad', emp: '20041', role: 3, cos: [2], active: true, email: 'kanya.r@example.co.th', dept: 'Accounting', adCo: 'Grandlink Logistics' },
  { id: 9, name: 'Jirawat Somboon', user: 'jirawat.s', kind: 'ad', emp: '10310', role: 4, cos: [1, 2], active: true, email: 'jirawat.s@example.co.th', dept: 'Finance', adCo: 'Sonic Interfreight' },
  { id: 10, name: 'Malee Srisuk', user: 'malee.s', kind: 'local', role: 4, cos: [3], active: true },
  { id: 11, name: 'Narong Chaiyo', user: 'narong.c', kind: 'ad', emp: '10377', role: 2, cos: [1], active: true, email: 'narong.c@example.co.th', dept: 'Accounting', adCo: 'Sonic Interfreight' },
  { id: 12, name: 'Orawan Boonmee', user: 'orawan.b', kind: 'ad', emp: '20088', role: 5, cos: [2], active: true, email: 'orawan.b@example.co.th', dept: 'Finance', adCo: 'Grandlink Logistics' },
  { id: 13, name: 'Pichit Meesuk', user: 'pichit.m', kind: 'ad', emp: '10402', role: 6, cos: [1, 2], active: true, email: 'pichit.m@example.co.th', dept: 'Customer Service', adCo: 'Sonic Interfreight' },
  { id: 14, name: 'Ratana Phongsri', user: 'ratana.p', kind: 'local', role: 7, cos: [1], active: true },
  { id: 15, name: 'Somchai Kaewdee', user: 'somchai.k', kind: 'ad', emp: '10455', role: 8, cos: [1], active: true, email: 'somchai.k@example.co.th', dept: 'Sales', adCo: 'Sonic Interfreight' },
  { id: 16, name: 'Thida Wangsai', user: 'thida.w', kind: 'ad', emp: '20102', role: 9, cos: [1, 2], active: true, email: 'thida.w@example.co.th', dept: 'Customer Service', adCo: 'Grandlink Logistics' },
  { id: 17, name: 'Uthai Nakprasert', user: 'uthai.n', kind: 'local', role: 9, cos: [2], active: true },
  { id: 18, name: 'Wichai Sangthong', user: 'wichai.s', kind: 'local', role: 10, cos: [1, 2, 3], active: true },
  { id: 19, name: 'Yupa Inthasorn', user: 'yupa.i', kind: 'local', role: 11, cos: [3], active: false },
];

/* People found in AD who do not have an account yet (for the add-user search). */
const AD_DIR = [
  { user: 'kittipong.s', name: 'Kittipong Srisawat', emp: '10511', email: 'kittipong.s@example.co.th', dept: 'Finance', adCo: 'Sonic Interfreight' },
  { user: 'kanokporn.m', name: 'Kanokporn Meechai', emp: '20134', email: 'kanokporn.m@example.co.th', dept: 'Customer Service', adCo: 'Grandlink Logistics' },
  { user: 'kriangsak.p', name: 'Kriangsak Phanit', emp: '30022', email: 'kriangsak.p@example.co.th', dept: 'IT', adCo: 'Autologis' },
  { user: 'kamonwan.t', name: 'Kamonwan Thepsuda', emp: '10520', email: 'kamonwan.t@example.co.th', dept: 'Accounting', adCo: 'Sonic Interfreight' },
  { user: 'narin.k', name: 'Narin Kongkaew', emp: '20151', email: 'narin.k@example.co.th', dept: 'Sales', adCo: 'Grandlink Logistics' },
];

const VENDORS = ['บจก. สยามคาร์โก้', 'Global Freight Partners Co., Ltd.', 'บจก. ไทยโลจิสติกส์', 'Eastern Seaboard Trucking', 'บจก. พอร์ตเซอร์วิส', 'Oceanic Lines (Thailand)', 'บจก. แหลมฉบังคอนเทนเนอร์', 'Asia Pacific Air Cargo'];

/* What changed on each page, shown in the mockup's notes sheet. */
const NOTES = {
  standard: [
    ['adj', 'v3: เลือกรายงานก่อนจึงเห็นบริษัทและเงื่อนไข รายการโปรดยังอยู่ให้สลับรายงานได้ และ Esc ปิดรายการค้นหาได้'],
    ['keep', 'ปุ่ม “ดึงข้อมูล” ยังหมายถึงเรียกรายงานจริง และช่องเงื่อนไขมาจากนิยามของแต่ละรายงานเหมือนเดิม'],
    ['adj', 'ข้อความในพื้นที่ผลลัพธ์เปลี่ยนตามขั้น: เลือกรายงาน → กรอกเงื่อนไข → ดึงข้อมูล (เดิมขึ้น “เลือกรายงานเพื่อเริ่มต้น” แม้เลือกแล้ว)'],
    ['adj', 'ทุกช่องมีป้ายชื่อผูกกับช่องกรอก ช่องจำเป็นมี * และแจ้งข้อผิดพลาดใต้ช่อง'],
    ['new', 'ช่องบริษัทแสดงเฉพาะบริษัทที่ผู้ใช้ได้รับอนุญาต (ต้องแก้ฝั่ง API คู่กัน ตาม audit)'],
    ['new', 'แถว “ใช้ล่าสุด” ใต้ช่องค้นหา คู่กับรายการโปรด (ระบบยังไม่มีประวัติการเปิดรายงาน ต้องเก็บเพิ่ม)'],
    ['adj', 'ช่องค้นหารายงานใหญ่ขึ้น ไฮไลต์คำที่ค้นในชื่อและคำอธิบาย มีดาวกำกับรายงานโปรด และบอกปุ่มลัดคีย์บอร์ดท้ายรายการ'],
    ['new', 'กด / ที่ไหนก็ได้ในหน้าเพื่อเริ่มค้นรายงาน และมีปุ่ม × ล้างรายงานที่เลือก'],
    ['adj', 'รายงานขนาดใหญ่มีป้ายและปุ่ม “สร้างไฟล์เบื้องหลัง” พร้อมทางไปประวัติการสร้างรายงาน'],
    ['adj', 'เอาปุ่ม Print / PDF ออก: ระบบจริงสั่งพิมพ์หน้าจอ จึงได้แค่แถวในหน้าที่แสดงอยู่ (25–100 แถว) ใช้ “ส่งออก Excel” ซึ่งได้ข้อมูลครบแทน'],
    ['adj', 'ชนิดไฟล์ .xlsx ในแบบยังเป็นข้อเสนอ ต้องเทียบ XLSB/CSV ที่ระบบจริงรองรับก่อนพัฒนา'],
    ['adj', 'dropdown บริษัทแสดงรหัส SNI / GRL / SALOG คู่ชื่อเต็ม และช่อง Lookup ค้นหาในรายการได้'],
    ['adj', 'รายงานที่ไม่มีหมวดใช้คำ “ยังไม่จัดหมวด” เหมือนหน้าผู้ดูแล (เดิมหน้านี้ใช้ “อื่น ๆ”)'],
    ['fix', 'โหมดมืดใช้ได้ทั้งหน้า เดิมเมื่อ Windows ตั้งโหมดมืด ตัวอักษรในช่องบริษัท/วันที่เป็นสีขาวบนพื้นขาว'],
  ],
  reports: [
    ['adj', 'v3: ปุ่ม +N เปิดรายชื่อกลุ่มสิทธิ์ที่ผูกรายงานครบทั้งหมด กดด้วยคีย์บอร์ดได้'],
    ['adj', 'ชื่อหน้า “ทะเบียนรายงาน” และเมนูอยู่กลุ่ม “จัดการรายงาน” คู่กับหมวดและตั้งเวลา'],
    ['adj', 'คอลัมน์ “กลุ่มสิทธิ์ที่เข้าถึง” แสดงชื่อกลุ่มแทน Role Based; รายงานที่ไม่มีกลุ่มขึ้นว่า “เฉพาะผู้ดูแลระบบ”'],
    ['adj', 'กรองหมวด (รวม “ยังไม่จัดหมวด”) ประเภท และสถานะ พร้อมปุ่มล้างตัวกรอง'],
    ['new', 'เปิดจากหน้าหมวดแล้วตัวกรองหมวดถูกตั้งให้ พร้อมทางกลับ'],
    ['new', 'เลือกหลายรายการแล้วบอกจำนวนที่ถูกตัวกรองซ่อนอยู่ คำยืนยันลบแสดงรายชื่อทั้งหมด'],
    ['adj', 'คำสั่งรายแถวเป็นปุ่มที่เห็นตรง ๆ: แก้ไข / ปิด-เปิดใช้งาน / ลบ ไม่ซ่อนในเมนู ⋯'],
    ['adj', 'ตัวกรองเป็น dropdown ที่บอกจำนวนรายงานในแต่ละตัวเลือก และเปลี่ยนสีเมื่อกำลังกรองอยู่'],
    ['new', 'กดชื่อหมวดในแถวเพื่อเปิดหมวดนั้นในหน้าหมวดรายงาน'],
    ['adj', 'ป้าย “ขนาดใหญ่” สำหรับรายงานที่ตั้ง IsHeavy'],
    ['keep', 'ยังไม่แสดง Public จนกว่าจะตัดสินความหมาย เพราะเส้นทางเรียกรายงานยังตรวจตามกลุ่มสิทธิ์ (audit F3)'],
  ],
  categories: [
    ['adj', 'v3: หัวรายละเอียดระบุ “หมวดรายงาน:” และแยกฟอร์มสร้างหมวดใหม่ออกจากรายละเอียดหมวดเดิม'],
    ['adj', 'รายการหมวดอยู่ซ้าย รายงานของหมวดที่เลือกอยู่ขวา แทนแถวขยายที่กดด้วยคีย์บอร์ดไม่ได้'],
    ['new', '“ยังไม่จัดหมวด” เป็นมุมมองแยก ไม่ใช่หมวดที่แก้ชื่อหรือลบได้'],
    ['new', 'ปุ่ม “เปิดในทะเบียนรายงาน” ส่งตัวกรองหมวดไปให้'],
    ['adj', 'แก้ชื่อ/สีในแผงด้านบนของหมวดนั้นเลย ไม่เปิดฟอร์มไกลจากแถวที่กด'],
    ['adj', 'สีมีชื่อกำกับและเครื่องหมายเลือก ชื่อหมวดยังอ่านได้โดยไม่ต้องพึ่งสี'],
    ['fix', 'คำยืนยันลบบอกผลรวมรายงานที่ปิดใช้งาน และย้ำว่าสิทธิ์ไม่เปลี่ยน; ลบไม่สำเร็จจะแจ้งเสมอ'],
    ['adj', 'ข้อความกำกับ: หมวดใช้จัดรายการ ไม่เกี่ยวกับสิทธิ์การเข้าถึง'],
    ['adj', 'ปุ่มลบหมวดอยู่บนหัวแผง ไม่ซ่อนในเมนู ⋯'],
  ],
  users: [
    ['adj', 'v3: ฟอร์มเพิ่ม/แก้ผู้ใช้สรุปกลุ่มสิทธิ์ จำนวนรายงานที่ใช้งาน และบริษัทที่เลือกก่อนบันทึก โดยแยกจากต้นสังกัด AD'],
    ['adj', 'ป้าย AD / Local ในตาราง และตัวกรองแบบปุ่มพร้อมจำนวน แทนการ์ดตัวเลขใหญ่'],
    ['fix', 'ป้ายสถานะเป็นข้อมูลอย่างเดียว ปุ่มระงับ/ลบแยกออกมาให้เห็นในแถว พร้อมคำยืนยัน'],
    ['adj', 'dropdown กลุ่มสิทธิ์บอกจำนวนคนและรายงานของแต่ละกลุ่ม ค้นหาได้ แยกกลุ่มผู้ดูแลไว้บนสุด'],
    ['fix', 'รีเซ็ตรหัสผ่านมีเฉพาะบัญชี Local; บัญชี AD บอกว่าเปลี่ยนรหัสที่ AD'],
    ['new', 'แถวของตัวเองระงับ/ลบ/เปลี่ยนกลุ่มสิทธิ์ไม่ได้ ป้องกันล็อกตัวเองออก'],
    ['new', 'แผงผู้ใช้สรุป กลุ่มสิทธิ์ บริษัทที่อนุญาต ต้นสังกัด AD และรายงานที่ผู้ใช้เห็นจริง'],
    ['fix', 'ฟอร์ม Local ต้องตั้งรหัสผ่าน หรือกด “สร้างรหัสให้” และเลือกให้เปลี่ยนรหัสเมื่อเข้าใช้ครั้งแรก'],
    ['new', 'ค้นหา AD เลือกด้วยลูกศร/Enter ได้ และแนะนำบริษัทตามต้นสังกัด AD'],
    ['adj', 'เพิ่มผู้ใช้เป็นหน้าต่างป๊อปอัปตามที่ผู้ใช้ขอ ส่วนดู/แก้ผู้ใช้เดิมเป็นแผงด้านข้างเพราะมีรายการรายงานยาว'],
    ['adj', 'ปิดป๊อปอัปหรือแผงที่ยังไม่บันทึกจะถามก่อนทิ้งข้อมูล; กด Esc ปิดได้'],
    ['fix', 'ตรวจสอบกับ AD อธิบายครบทั้งระงับและเปิดกลับ'],
  ],
  roles: [
    ['adj', 'v3: หัวรายละเอียดระบุ “กลุ่มสิทธิ์:” จำนวนแยกรายงานใช้งาน/ปิดใช้งาน และสรุปเลือกทั้งหมดเทียบที่อยู่ในผลค้นหา'],
    ['adj', 'ใช้แบบ B ตามที่ผู้ใช้เลือก: รายการกลุ่มซ้าย รายละเอียดขวา ตัดแบบตารางรวมออก'],
    ['adj', 'ชื่อ “กลุ่มสิทธิ์” ใช้เหมือนกันทุกหน้า (เดิมมีทั้ง Role และ “ตำแหน่ง”)'],
    ['fix', 'กลุ่ม Admin ล็อก: เปลี่ยนชื่อและลบไม่ได้ และแสดงว่าเห็นทุกรายงานที่เปิดใช้งาน แทนจำนวน mapping'],
    ['adj', 'แก้รายงานของกลุ่มในพื้นที่เต็มความสูง ลำดับแถวไม่กระโดดตอนติ๊ก และสรุปเพิ่ม/ถอนก่อนบันทึก'],
    ['adj', 'ปุ่มเลือกเป็นกลุ่มบอกขอบเขตชัด เช่น “เลือก 14 รายงานในหมวดนี้”, “เลือกที่แสดงอยู่ (3)”'],
    ['fix', 'รายงานที่ปิดใช้งานยังแสดงพร้อมสิทธิ์เดิม บันทึกแล้วไม่ถูกล้าง'],
    ['new', 'แท็บสมาชิก พร้อมปุ่ม “เพิ่มสมาชิก” ย้ายผู้ใช้มากลุ่มนี้ได้โดยไม่ต้องเปิดทีละคน'],
    ['new', 'แท็บ “เทียบกับกลุ่มอื่น” เปรียบเทียบเฉพาะรายงานที่ใช้งาน จำนวนใกล้เคียงไม่ใช่ข้อสรุปว่าควรรวมกลุ่ม'],
    ['new', 'รายการกลุ่มมีป้าย “ไม่มีสมาชิก” / “ไม่มีรายงาน” ให้เห็นกลุ่มที่ควรจัดการ'],
    ['adj', 'ปุ่มเปลี่ยนชื่อ/ลบกลุ่มอยู่บนหัวแผง ไม่ซ่อนในเมนู ⋯; ลบกลุ่มที่ยังมีสมาชิกจะบอกเหตุผลและพาไปดูสมาชิก'],
    ['adj', 'dropdown เทียบกลุ่มเรียงตามความใกล้เคียง พร้อม % รายงานที่ตรงกัน'],
  ],
};
