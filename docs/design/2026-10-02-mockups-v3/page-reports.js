/* Pages: รายงานมาตรฐาน (standard) and ทะเบียนรายงาน (reports). */

/* ====================== รายงานมาตรฐาน ====================== */
PAGE_META.standard = { group: 'รายงาน', title: 'รายงานมาตรฐาน' };
const ME = USERS.find(u => u.me);

function stdList() {
  const q = S.std.q.trim().toLowerCase();
  const list = REPORTS.filter(r => r.active && r.type === 1);
  if (!q) return list;
  return list.filter(r => `${r.name} ${r.desc} ${catName(r.cat)}`.toLowerCase().includes(q));
}
function stdFlat() { return groupByCat(stdList()).flatMap(g => g.items); }

function hl(text, q) {
  if (!q) return esc(text);
  const low = text.toLowerCase(), needle = q.toLowerCase();
  let out = '', i = 0, j;
  while ((j = low.indexOf(needle, i)) >= 0) { out += esc(text.slice(i, j)) + '<mark>' + esc(text.slice(j, j + needle.length)) + '</mark>'; i = j + needle.length; }
  return out + esc(text.slice(i));
}

PAGES.standard = () => {
  const s = S.std;
  const rep = s.id ? repOf(s.id) : null;
  const q = s.q.trim();
  const favs = [...s.favs].map(repOf).filter(r => r && r.active && r.type === 1);
  const recent = s.recent.map(repOf).filter(r => r && r.active && r.type === 1 && !s.favs.has(r.id)).slice(0, 4);
  const groups = groupByCat(stdList());
  const flat = groups.flatMap(g => g.items);
  const hiId = s.open && flat[s.hi] ? flat[s.hi].id : null;
  const inputVal = s.open ? s.q : (rep ? rep.name : '');

  const list = s.open ? `<div class="combo-list combo-list-lg" id="std-list" role="listbox" aria-label="รายงาน">
      ${groups.length ? groups.map(g => `<div role="group" aria-label="${esc(catName(g.id))}">
        <div class="combo-group">${catChip(g.id)}<span>${g.items.length} รายงาน</span></div>
        ${g.items.map(r => `<div class="opt ${r.id === hiId ? 'is-hi' : ''} ${r.id === s.id ? 'is-cur' : ''}" role="option" id="opt-${r.id}" aria-selected="${r.id === s.id}" data-a="stdPick" data-id="${r.id}">
          <span class="opt-name">${ic('file-text', 'opt-ic')}<span>${hl(r.name, q)}</span>${s.favs.has(r.id) ? ic('star', 'opt-fav') : ''}${r.heavy ? heavyTag() : ''}</span>${r.desc ? `<span class="opt-desc">${hl(r.desc, q)}</span>` : ''}</div>`).join('')}
      </div>`).join('') : `<div class="empty" style="padding:24px">ไม่พบรายงานที่ตรงกับ “${esc(s.q)}”<span class="hint">ลองค้นด้วยชื่อหมวด เช่น Account หรือคำในคำอธิบาย</span></div>`}
      <div class="combo-foot"><span><kbd>↑</kbd><kbd>↓</kbd> เลือก</span><span><kbd>Enter</kbd> เปิดรายงาน</span><span><kbd>Esc</kbd> ปิด</span><span class="grow"></span><span>${flat.length} รายงาน</span></div>
    </div>` : '';

  const quick = (favs.length || recent.length) ? `<div class="quick">
      ${favs.length ? `<div class="quick-row"><span class="quick-label">${ic('star')}รายการโปรด</span>${favs.map(r => `<button class="chip chip-btn ${r.id === s.id ? 'is-cur' : ''}" data-a="stdPick" data-id="${r.id}"><span>${esc(r.name)}</span></button>`).join('')}</div>` : ''}
      ${recent.length ? `<div class="quick-row"><span class="quick-label">${ic('history')}ใช้ล่าสุด ${NEW}</span>${recent.map(r => `<button class="chip chip-btn ${r.id === s.id ? 'is-cur' : ''}" data-a="stdPick" data-id="${r.id}"><span>${esc(r.name)}</span></button>`).join('')}</div>` : ''}
    </div>` : '';

  const selector = `<div class="card card-pad stack" style="gap:18px">
    <div class="combo">
      <label class="label" for="std-q" style="margin-bottom:6px">รายงาน</label>
      <div class="combo-row">
        <div class="search grow combo-lg">${ic('search')}
          <input id="std-q" class="input" role="combobox" aria-expanded="${s.open}" aria-controls="std-list" aria-autocomplete="list" ${hiId ? `aria-activedescendant="opt-${hiId}"` : ''}
            placeholder="${rep && s.open ? esc(rep.name) : 'ค้นหาหรือเลือกรายงาน…'}" value="${esc(inputVal)}" autocomplete="off" data-in="stdQ" data-kd="stdQ" data-focus="stdOpen" data-a="stdOpen">
          ${!s.open && !rep ? '<kbd class="combo-kbd" title="กด / เพื่อค้นหา">/</kbd>' : ''}
          ${rep && !s.open ? `<button class="combo-clear" data-a="stdClear" aria-label="ล้างรายงานที่เลือก">${ic('x')}</button>` : ''}
        </div>
        ${rep ? `<button class="icon-btn" data-a="stdFav" aria-pressed="${s.favs.has(rep.id)}" aria-label="${s.favs.has(rep.id) ? 'เอาออกจากรายการโปรด' : 'ปักหมุดเป็นรายการโปรด'}" title="รายการโปรด">${ic('star')}</button>` : ''}
      </div>
      ${list}
    </div>
    ${rep ? `<div class="row" style="gap:8px 12px;margin-top:-8px">${catChip(rep.cat)}${rep.heavy ? heavyTag() : ''}<span class="sub grow" style="min-width:220px">${esc(rep.desc || 'ไม่มีคำอธิบาย')}</span></div>` : ''}
    ${quick}
    ${rep ? `<div style="border-top:1px solid var(--line);padding-top:16px" class="stack">
      <h2 style="font-size:14px;margin:0 0 8px;font-weight:650">เงื่อนไขของรายงาน</h2>
      ${stdFields(rep)}
    </div>` : ''}
  </div>`;

  const job = s.job ? (s.job.status === 'running'
    ? `<div class="banner banner-run" role="status">${ic('loader-circle', 'spin')}<span class="grow">กำลังสร้างไฟล์ <b>${esc(s.job.name)}</b> เบื้องหลัง ใช้หน้าอื่นต่อได้ระหว่างรอ</span></div>`
    : `<div class="banner banner-done" role="status">${ic('circle-check')}<span class="grow">ไฟล์ <b>${esc(s.job.name)}</b> พร้อมแล้ว เก็บไว้ 24 ชั่วโมงในประวัติการสร้างรายงาน</span>
       <button class="btn btn-sm btn-primary" data-a="demo" data-msg="ดาวน์โหลดไฟล์ (mockup)">${ic('download')}ดาวน์โหลด</button>
       <button class="btn btn-sm" data-a="demo" data-msg="หน้าประวัติการสร้างรายงานไม่อยู่ในชุดนี้">ดูประวัติ</button>
       <button class="icon-btn" data-a="stdJobClose" aria-label="ปิดแถบนี้">${ic('x')}</button></div>`) : '';

  return pageHead('รายงานมาตรฐาน', 'เลือกรายงาน กรอกเงื่อนไขของรายงานนั้น แล้วกดดึงข้อมูล') + selector + job + stdResult(rep);
};
A.stdClear = () => { Object.assign(S.std, { id: null, q: '', params: {}, errors: {}, phase: 'idle', page: 1 }); S.focusId = 'std-q'; render(); };
document.addEventListener('keydown', e => {
  if (e.key !== '/' || S.page !== 'standard' || S.dialog || S.drawer || S.notesOpen) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  e.preventDefault(); S.std.open = true; S.std.q = ''; S.std.hi = 0; S.focusId = 'std-q'; render();
});

function stdFields(rep) {
  const s = S.std;
  const allowed = COMPANIES.filter(c => ME.cos.includes(c.id));
  const err = k => s.errors[k] ? `<span class="err" id="err-${k}">${ic('circle-alert')}${esc(s.errors[k])}</span>` : '';
  const fields = rep.params.map(p => {
    const v = s.params[p.key] ?? '';
    const id = `p-${p.key}`;
    const inv = s.errors[p.key] ? 'invalid' : '';
    const desc = s.errors[p.key] ? `aria-describedby="err-${p.key}" aria-invalid="true"` : '';
    let control;
    if (p.kind === 'lookup') control = dd('std-' + p.key, { labelledby: 'lbl-' + p.key, value: v, options: p.options.map((o, i) => {
        const m = o.match(/^([A-Z]-?\d[\d-]*)\s+(.*)$/);
        return i === 0 ? { v: o, label: o, icon: 'list' } : m ? { v: o, label: m[2], short: o, meta: m[1] } : { v: o, label: o };
      }), search: p.options.length > 3, searchPlaceholder: 'ค้นหา' + p.label, onPick: val => { S.std.params[p.key] = val; } });
    else control = `<input id="${id}" class="input ${inv}" type="${p.kind === 'date' ? 'date' : 'text'}" value="${esc(v)}" ${p.placeholder ? `placeholder="${esc(p.placeholder)}"` : ''} data-in="stdParam" data-key="${p.key}" ${p.required ? 'aria-required="true"' : ''} ${desc}>`;
    const lbl = p.kind === 'lookup' ? `<span class="label" id="lbl-${p.key}">` : `<label class="label" for="${id}">`;
    return `<div class="field">${lbl}${esc(p.label)}${p.required ? '<span class="req" aria-hidden="true">*</span>' : ''}${p.kind === 'lookup' ? '</span>' : '</label>'}${control}${err(p.key)}</div>`;
  }).join('');
  return `<div class="fields">
      <div class="field"><span class="label" id="lbl-company">บริษัท<span class="req" aria-hidden="true">*</span></span>
        ${dd('std-co', { labelledby: 'lbl-company', value: s.company, minWidth: 280, options: allowed.map(c => ({ v: String(c.id), code: c.code, label: c.name, meta: `บริษัทที่ ${c.id} · ฐานข้อมูล ${c.code}` })), onPick: v => { S.std.company = v; } })}
        <span class="hint">${NEW} แสดงเฉพาะบริษัทที่คุณได้รับสิทธิ์</span></div>
      ${fields || '<div class="field"><span class="label">เงื่อนไขเพิ่มเติม</span><span class="hint" style="padding-top:8px">รายงานนี้ไม่มีเงื่อนไขอื่น</span></div>'}
    </div>
    <div class="row" style="margin-top:6px">
      <button class="btn btn-primary" id="std-run" data-a="stdRun" ${s.phase === 'loading' ? 'disabled' : ''}>${ic(s.phase === 'loading' ? 'loader-circle' : 'search', s.phase === 'loading' ? 'spin' : '')}${s.phase === 'loading' ? 'กำลังดึงข้อมูล…' : 'ดึงข้อมูล'}</button>
      ${rep.heavy ? `<button class="btn" data-a="stdJob" ${s.job && s.job.status === 'running' ? 'disabled' : ''}>${ic('file-spreadsheet')}สร้างไฟล์เบื้องหลัง</button>
      <span class="hint">รายงานนี้ข้อมูลมาก แนะนำให้สร้างไฟล์แล้วดาวน์โหลดจากประวัติ</span>` : ''}
    </div>`;
}

function stdResult(rep) {
  const s = S.std;
  const stepIdx = !rep ? 0 : s.phase === 'done' ? 3 : 1;
  const steps = ['เลือกรายงาน', 'กรอกเงื่อนไข', 'ดึงข้อมูล'];
  const total = rep ? (rep.name.startsWith('AP') ? 1284 : 120 + (rep.id * 37) % 900) : 0;
  const pages = Math.max(1, Math.ceil(total / 12));
  const status = s.phase === 'done' ? `พบ <b class="tnum">${fmt(total)}</b> รายการ · หน้า ${s.page} จาก ${fmt(pages)}`
    : s.phase === 'loading' ? 'กำลังดึงข้อมูล…' : !rep ? 'ยังไม่ได้เลือกรายงาน' : 'ยังไม่ได้ดึงข้อมูล';
  const done = s.phase === 'done';
  let body;
  if (s.phase === 'loading') body = `<div class="stack" style="padding:20px;gap:12px" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<div class="skel" style="width:${92 - i * 7}%"></div>`).join('')}</div>`;
  else if (done) body = stdTable(rep, total, pages);
  else body = `<div class="empty">
      <div class="steps" aria-label="ขั้นตอน">${steps.map((t, i) => `${i ? '<span class="step-sep"></span>' : ''}<span class="step ${i < stepIdx ? 'is-done' : i === stepIdx ? 'is-now' : ''}"><span class="step-n">${i < stepIdx ? CHECK_SVG.replace('stroke-width="3"', 'stroke-width="3" width="12" height="12"') : i + 1}</span>${t}</span>`).join('')}</div>
      <h3>${!rep ? 'เลือกรายงานที่ต้องการ' : 'กรอกเงื่อนไข แล้วกดดึงข้อมูล'}</h3>
      <p>${!rep ? 'ค้นหาจากชื่อ คำอธิบาย หรือหมวด หรือกดรายการโปรดด้านบน' : `ผลของ <b>${esc(rep.name)}</b> จะแสดงที่นี่ และส่งออกเป็น Excel ได้หลังดึงข้อมูล`}</p>
    </div>`;
  return `<section class="card" aria-label="ผลลัพธ์">
    <div class="toolbar"><span class="grow" style="font-size:13.5px;color:var(--fg-2)">${status}</span>
      <button class="btn btn-sm" data-a="demo" data-msg="ส่งออกไฟล์ .xlsx ตามเงื่อนไขที่ดึงล่าสุด (mockup)" ${done ? '' : 'disabled'}>${ic('download')}ส่งออก Excel (.xlsx)</button>
    </div>${body}</section>`;
}

function stdTable(rep, total, pages) {
  const rnd = seeded(rep.id * 100 + S.std.page);
  const isAP = rep.name.startsWith('AP');
  const rows = Array.from({ length: 12 }, (_, i) => {
    const amt = Math.round(rnd() * 480000 + 1200) + rnd();
    if (isAP) {
      const b = [0, 0, 0, 0]; b[Math.floor(rnd() * 4)] = amt;
      const d = 1 + Math.floor(rnd() * 27);
      return `<tr><td>${esc(VENDORS[Math.floor(rnd() * VENDORS.length)])}</td><td class="rid">AP26-${String(4100 + (S.std.page - 1) * 12 + i).padStart(5, '0')}</td>
        <td class="tnum">${String(d).padStart(2, '0')}/08/2026</td><td class="tnum">${String(d).padStart(2, '0')}/09/2026</td><td class="num"><b>${money(amt)}</b></td>${b.map(x => `<td class="num">${x ? money(x) : '–'}</td>`).join('')}</tr>`;
    }
    return `<tr><td class="rid">${String(10000 + (S.std.page - 1) * 12 + i)}</td><td>${esc(VENDORS[Math.floor(rnd() * VENDORS.length)])}</td><td class="tnum">${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}/09/2026</td><td class="num">${Math.floor(rnd() * 90) + 1}</td><td class="num">${money(amt)}</td></tr>`;
  }).join('');
  const head = isAP ? ['ผู้ขาย', 'เลขที่เอกสาร', 'วันที่เอกสาร', 'ครบกำหนด', 'ยอดคงค้าง (THB)', '0–30 วัน', '31–60 วัน', '61–90 วัน', 'เกิน 90 วัน']
    : ['เลขที่', 'รายการ', 'วันที่', 'จำนวน', 'ยอดเงิน (THB)'];
  const numFrom = isAP ? 4 : 3;
  return `<div class="table-wrap"><table class="t"><thead><tr>${head.map((h, i) => `<th class="${i >= numFrom ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="foot"><span>แสดง ${fmt((S.std.page - 1) * 12 + 1)}–${fmt(Math.min(S.std.page * 12, total))} จาก ${fmt(total)} รายการ</span>
      <span class="row"><button class="btn btn-sm" data-a="stdPage" data-id="-1" ${S.std.page <= 1 ? 'disabled' : ''} aria-label="หน้าก่อน">${ic('chevron-left')}</button>
      <span class="tnum">หน้า ${S.std.page} / ${fmt(pages)}</span>
      <button class="btn btn-sm" data-a="stdPage" data-id="1" ${S.std.page >= pages ? 'disabled' : ''} aria-label="หน้าถัดไป">${ic('chevron-right')}</button></span></div>`;
}

A.stdOpen = () => { if (!S.std.open) { S.std.open = true; S.std.q = ''; S.std.hi = 0; render(); } };
INP.stdQ = t => { S.std.q = t.value; S.std.open = true; S.std.hi = 0; render(); };
KD.stdQ = e => {
  const s = S.std, flat = stdFlat();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!s.open) { s.open = true; s.hi = 0; } else s.hi = (s.hi + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % Math.max(flat.length, 1);
    render(); const el = document.getElementById('opt-' + (flat[s.hi] || {}).id); if (el) el.scrollIntoView({ block: 'nearest' });
    e.preventDefault(); return true;
  }
  if (e.key === 'Enter' && s.open && flat[s.hi]) { stdSelect(flat[s.hi].id); e.preventDefault(); return true; }
  if (e.key === 'Escape' && s.open) { s.open = false; render(); e.preventDefault(); return true; }
  return false;
};
function stdSelect(id) {
  const s = S.std;
  if (s.id !== id) { s.params = {}; s.errors = {}; s.phase = 'idle'; s.page = 1; }
  s.id = id; s.open = false; s.q = '';
  const rep = repOf(id);
  rep.params.forEach(p => { if (p.kind === 'lookup' && !s.params[p.key]) s.params[p.key] = p.options[0]; });
  const p0 = rep.params[0];
  S.focusId = !p0 ? 'dd-std-co' : p0.kind === 'lookup' ? 'dd-std-' + p0.key : 'p-' + p0.key;
  render();
}
A.stdPick = t => stdSelect(+t.dataset.id);
A.stdFav = () => { const s = S.std; s.favs.has(s.id) ? s.favs.delete(s.id) : s.favs.add(s.id); toast(s.favs.has(s.id) ? 'ปักหมุดเป็นรายการโปรดแล้ว' : 'เอาออกจากรายการโปรดแล้ว'); render(); };
INP.stdParam = t => { S.std.params[t.dataset.key] = t.value; if (S.std.errors[t.dataset.key]) { delete S.std.errors[t.dataset.key]; render(); } };
function stdValidate() {
  const s = S.std, rep = repOf(s.id);
  s.errors = {};
  rep.params.forEach(p => {
    const v = (s.params[p.key] || '').trim();
    if (p.required && !v) s.errors[p.key] = `กรอก ${p.label} ก่อนดึงข้อมูล`;
    else if (p.key === 'period' && v && !/^20\d{2}(0[1-9]|1[0-2])$/.test(v)) s.errors[p.key] = 'ใช้รูปแบบปีและเดือน เช่น 202609';
  });
  const first = rep.params.find(p => s.errors[p.key]);
  if (first) { S.focusId = 'p-' + first.key; render(); return false; }
  return true;
}
A.stdRun = () => {
  if (!stdValidate()) return;
  S.std.recent = [S.std.id, ...S.std.recent.filter(x => x !== S.std.id)].slice(0, 6);
  S.std.phase = 'loading'; render();
  setTimeout(() => { S.std.phase = 'done'; S.std.page = 1; render(); }, 650);
};
A.stdJob = () => {
  if (!stdValidate()) return;
  const name = repOf(S.std.id).name;
  S.std.job = { status: 'running', name }; render();
  setTimeout(() => { if (S.std.job) { S.std.job.status = 'done'; render(); } }, 2200);
};
A.stdJobClose = () => { S.std.job = null; render(); };
A.stdPage = t => { S.std.page += +t.dataset.id; render(); };

/* ====================== ทะเบียนรายงาน ====================== */
PAGE_META.reports = { group: 'จัดการรายงาน', title: 'ทะเบียนรายงาน' };

function rpFiltered() {
  const f = S.rp, q = f.q.trim().toLowerCase();
  return REPORTS.filter(r =>
    (!q || `${r.name} ${r.desc} ${rid(r.id)}`.toLowerCase().includes(q)) &&
    (f.cat === 'all' || (f.cat === 'none' ? r.cat == null : String(r.cat) === f.cat)) &&
    (f.type === 'all' || String(r.type) === f.type) &&
    (f.status === 'all' || (f.status === 'active' ? r.active : !r.active)));
}
function accessCell(r) {
  const roles = reportRoles(r.id);
  if (!roles.length) return `<span class="tag tag-warn" title="ไม่มีกลุ่มสิทธิ์ใดเข้าถึง ผู้ใช้ทั่วไปจะไม่เห็นรายงานนี้">${ic('triangle-alert')}เฉพาะผู้ดูแลระบบ</span>`;
  const shown = roles.slice(0, 2).map(x => `<span class="chip"><span>${esc(x.name)}</span></span>`).join('');
  const more = roles.length > 2 ? `<button type="button" class="chip chip-btn more" data-a="rpAccess" data-id="${r.id}" aria-haspopup="dialog" aria-label="ดูกลุ่มสิทธิ์ทั้งหมด ${roles.length} กลุ่มของ ${esc(r.name)}">+${roles.length - 2}</button>` : '';
  return `<span class="row" style="gap:6px;flex-wrap:nowrap">${shown}${more}</span>`;
}

PAGES.reports = () => {
  const f = S.rp;
  const list = rpFiltered();
  const visibleIds = new Set(list.map(r => r.id));
  const selVisible = list.filter(r => f.sel.has(r.id)).length;
  const hidden = [...f.sel].filter(id => !visibleIds.has(id)).length;
  const allChecked = list.length > 0 && selVisible === list.length;
  const some = selVisible > 0 && !allChecked;
  const chips = [];
  if (f.cat !== 'all') chips.push(['cat', 'หมวด: ' + (f.cat === 'none' ? 'ยังไม่จัดหมวด' : catName(+f.cat))]);
  if (f.type !== 'all') chips.push(['type', 'ประเภท: ' + typeName(+f.type)]);
  if (f.status !== 'all') chips.push(['status', 'สถานะ: ' + (f.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน')]);
  if (f.q) chips.push(['q', `ค้นหา: “${f.q}”`]);

  const head = pageHead('ทะเบียนรายงาน', 'นิยาม SQL เงื่อนไข หมวด และกลุ่มสิทธิ์ของรายงานทั้งหมด',
    `<button class="btn btn-primary" data-a="demo" data-msg="หน้าสร้างรายงานไม่อยู่ในชุดนี้">${ic('plus')}สร้างรายงาน</button>`);
  const back = f.from === 'categories' ? `<div class="row"><button class="link-btn" data-a="rpBack">${ic('arrow-left')}กลับไปหมวดรายงาน</button>${NEW}</div>` : '';

  const toolbar = `<div class="toolbar">
      <div class="search" style="flex:1 1 240px;max-width:360px">${ic('search')}<input id="rp-q" class="input" placeholder="ค้นหาชื่อ คำอธิบาย หรือ RID" value="${esc(f.q)}" data-in="rpQ" aria-label="ค้นหารายงาน"></div>
      ${dd('rp-cat', { filter: true, prefix: 'หมวด', value: f.cat, minWidth: 260, onPick: v => { f.cat = String(v); if (v === 'all') f.from = null; }, options: [
        { v: 'all', label: 'ทุกหมวด', short: 'ทั้งหมด', icon: 'layers', count: REPORTS.length }, { sep: true },
        ...CATS.map(x => ({ v: String(x.id), label: x.name, dot: COLORS[x.color].hex, count: REPORTS.filter(r => r.cat === x.id).length })),
        { sep: true }, { v: 'none', label: 'ยังไม่จัดหมวด', icon: 'inbox', count: REPORTS.filter(r => r.cat == null).length }] })}
      ${dd('rp-type', { filter: true, prefix: 'ประเภท', value: f.type, minWidth: 320, onPick: v => { f.type = String(v); }, options: [
        { v: 'all', label: 'ทุกประเภท', short: 'ทั้งหมด', icon: 'layers', count: REPORTS.length }, { sep: true },
        { v: '1', label: 'มาตรฐาน', meta: 'แสดงผลเป็นตาราง ส่งออก Excel', icon: 'table-2', count: REPORTS.filter(r => r.type === 1).length },
        { v: '2', label: 'Template', meta: 'สร้างข้อความรายแถวเพื่อคัดลอก', icon: 'layout-template', count: REPORTS.filter(r => r.type === 2).length }] })}
      ${dd('rp-status', { filter: true, prefix: 'สถานะ', value: f.status, minWidth: 320, onPick: v => { f.status = String(v); }, options: [
        { v: 'all', label: 'ทุกสถานะ', short: 'ทั้งหมด', icon: 'layers', count: REPORTS.length }, { sep: true },
        { v: 'active', label: 'ใช้งาน', meta: 'ผู้ใช้ในกลุ่มที่ได้รับสิทธิ์เห็น', dot: '#10b981', count: REPORTS.filter(r => r.active).length },
        { v: 'off', label: 'ปิดใช้งาน', meta: 'ซ่อนจากผู้ใช้ สิทธิ์เดิมยังเก็บไว้', dot: '#94a3b8', count: REPORTS.filter(r => !r.active).length }] })}
    </div>
    ${chips.length ? `<div class="row" style="padding:10px 16px;border-bottom:1px solid var(--line)"><span class="sub">แสดง ${list.length} จาก ${REPORTS.length} รายงาน</span>${chips.map(([k, l]) => `<button class="chip chip-btn" data-a="rpClear" data-id="${k}" aria-label="ล้างตัวกรอง ${esc(l)}"><span>${esc(l)}</span>${ic('x')}</button>`).join('')}<button class="link-btn" data-a="rpClearAll">ล้างทั้งหมด</button></div>` : ''}`;

  const bulk = f.sel.size ? `<div class="bulk" role="region" aria-label="รายการที่เลือก"><b>เลือก ${f.sel.size} รายงาน</b>
      ${hidden ? `<span class="tag tag-warn">${ic('eye-off')}${hidden} รายการไม่อยู่ในตัวกรองนี้</span>${NEW}` : ''}
      <span class="grow"></span>
      <button class="btn btn-sm" data-a="rpBulkOff">${ic('power')}ปิดใช้งาน</button>
      <button class="btn btn-sm btn-danger" data-a="rpBulkDel">${ic('trash-2')}ลบ…</button>
      <button class="btn btn-sm btn-ghost" data-a="rpSelNone">ยกเลิกการเลือก</button></div>` : '';

  const rows = list.map(r => `<tr class="${f.sel.has(r.id) ? 'is-sel' : ''} ${r.active ? '' : 'is-off'}">
      <td class="w-check"><input type="checkbox" data-ch="rpSel" data-id="${r.id}" ${f.sel.has(r.id) ? 'checked' : ''} aria-label="เลือก ${esc(r.name)}"></td>
      <td style="min-width:260px"><div class="row" style="gap:8px"><span class="cell-name">${esc(r.name)}</span>${r.heavy ? heavyTag() : ''}</div>
        <div class="row" style="gap:8px;flex-wrap:nowrap"><span class="rid">${rid(r.id)}</span>${r.desc ? `<span class="sub clamp">${esc(r.desc)}</span>` : ''}</div></td>
      <td><button class="chip-link" data-a="rpToCat" data-id="${r.cat == null ? 'none' : r.cat}" title="เปิดหมวดนี้">${catChip(r.cat)}</button></td>
      <td class="sub" style="color:var(--fg-2)">${typeName(r.type)}</td>
      <td>${accessCell(r)}</td>
      <td>${stReport(r)}</td>
      <td class="w-act" style="width:auto"><div class="row-actions">
        <button class="btn btn-sm btn-ghost" data-a="demo" data-msg="หน้าแก้ไขรายงานไม่อยู่ในชุดนี้" aria-label="แก้ไข ${esc(r.name)}">${ic('pencil')}แก้ไข</button>
        <button class="icon-btn warn" data-a="rpToggle" data-id="${r.id}" title="${r.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}" aria-label="${r.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} ${esc(r.name)}">${ic(r.active ? 'eye-off' : 'eye')}</button>
        <button class="icon-btn danger" data-a="rpDel" data-id="${r.id}" title="ลบถาวร" aria-label="ลบ ${esc(r.name)} ถาวร">${ic('trash-2')}</button>
      </div></td>
    </tr>`).join('');

  const table = `<section class="card">${toolbar}${bulk}
    <div class="table-wrap"><table class="t">
      <thead><tr><th class="w-check"><input type="checkbox" data-ch="rpSelAll" ${allChecked ? 'checked' : ''} ${some ? 'data-indet="1"' : ''} aria-label="เลือกทุกรายงานที่แสดง (${list.length})"></th>
        <th>รายงาน</th><th>หมวด</th><th>ประเภท</th><th>กลุ่มสิทธิ์ที่เข้าถึง</th><th>สถานะ</th><th style="text-align:right">จัดการ</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7"><div class="empty"><h3>ไม่พบรายงานตามตัวกรองนี้</h3><button class="btn btn-sm" data-a="rpClearAll">ล้างตัวกรอง</button></div></td></tr>`}</tbody>
    </table></div>
    <div class="foot"><span>รายงานทั้งหมด ${REPORTS.length} · ใช้งาน ${REPORTS.filter(r => r.active).length} · ปิดใช้งาน ${REPORTS.filter(r => !r.active).length}</span><span>ผู้ดูแลระบบเข้าถึงทุกรายงานที่ใช้งานโดยไม่ต้องอยู่ในกลุ่ม</span></div>
  </section>`;
  return head + back + table;
};

INP.rpQ = t => { S.rp.q = t.value; render(); };
A.rpClear = t => { const k = t.dataset.id; if (k === 'q') S.rp.q = ''; else S.rp[k] = 'all'; if (k === 'cat') S.rp.from = null; S.focusId = 'rp-q'; render(); };
A.rpClearAll = () => { Object.assign(S.rp, { q: '', cat: 'all', type: 'all', status: 'all', from: null }); S.focusId = 'rp-q'; render(); };
A.rpBack = () => go('categories');
CHG.rpSel = t => { const id = +t.dataset.id; t.checked ? S.rp.sel.add(id) : S.rp.sel.delete(id); render(); };
CHG.rpSelAll = t => { const ids = rpFiltered().map(r => r.id); ids.forEach(id => t.checked ? S.rp.sel.add(id) : S.rp.sel.delete(id)); render(); };
A.rpSelNone = () => { S.rp.sel.clear(); render(); };
A.rpBulkOff = () => { const n = S.rp.sel.size; S.rp.sel.forEach(id => { repOf(id).active = false; }); S.rp.sel.clear(); toast(`ปิดใช้งาน ${n} รายงานแล้ว สิทธิ์เดิมยังเก็บไว้`); render(); };
A.rpBulkDel = t => openDialog({ kind: 'delReports', ids: [...S.rp.sel] }, t);
A.rpToggle = t => openDialog({ kind: 'toggleReport', id: +t.dataset.id }, t);
A.rpDel = t => openDialog({ kind: 'delReports', ids: [+t.dataset.id] }, t);
A.rpToCat = t => { const v = t.dataset.id; S.ct.sel = v === 'none' ? 'none' : +v; S.ct.edit = null; go('categories'); };
A.rpAccess = t => openDialog({ kind: 'reportAccess', id: +t.dataset.id }, t);
DIALOGS.reportAccess = d => {
  const r = repOf(d.id), roles = reportRoles(d.id);
  return `<div class="dialog-head"><div class="dialog-ico">${ic('shield')}</div><div><h2 id="dlg-title">กลุ่มสิทธิ์ที่เข้าถึงรายงาน</h2><p class="sub">${esc(r.name)} · ${roles.length} กลุ่ม</p></div></div>
    <div class="dialog-body"><ul class="name-list">${roles.map(role => `<li>${esc(role.name)}</li>`).join('')}</ul></div>
    <div class="dialog-foot"><button class="btn btn-primary" data-a="dlgClose" data-autofocus>ปิด</button></div>`;
};
DIALOGS.toggleReport = d => {
  const r = repOf(d.id);
  const on = r.active;
  return `<div class="dialog-head"><div class="dialog-ico">${ic('power')}</div><div><h2 id="dlg-title">${on ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} “${esc(r.name)}”?</h2></div></div>
    <div class="dialog-body"><p>${on ? `ผู้ใช้ในกลุ่มสิทธิ์ ${reportRoles(r.id).length} กลุ่มจะไม่เห็นรายงานนี้ สิทธิ์เดิมยังเก็บไว้ และกลับมาเมื่อเปิดใช้งานอีกครั้ง` : 'ผู้ใช้ในกลุ่มสิทธิ์ที่เคยได้รับจะเห็นรายงานนี้อีกครั้ง'}</p></div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ยกเลิก</button><button class="btn btn-primary" data-a="rpToggleOk">${on ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button></div>`;
};
A.rpToggleOk = () => { const r = repOf(S.dialog.id); r.active = !r.active; toast(`${r.active ? 'เปิด' : 'ปิด'}ใช้งาน “${r.name}” แล้ว`); closeDialog(); };
DIALOGS.delReports = d => {
  const reps = d.ids.map(repOf).filter(Boolean);
  const vis = new Set(rpFiltered().map(r => r.id));
  const hidden = reps.filter(r => !vis.has(r.id)).length;
  return `<div class="dialog-head"><div class="dialog-ico is-bad">${ic('trash-2')}</div><div><h2 id="dlg-title">ลบ ${reps.length} รายงานถาวร?</h2></div></div>
    <div class="dialog-body">
      <ol class="name-list">${reps.map(r => `<li>${esc(r.name)} <span class="rid">${rid(r.id)}</span></li>`).join('')}</ol>
      ${hidden ? `<div class="note note-warn">${ic('eye-off')}<span>${hidden} รายการในนี้ไม่แสดงในตัวกรองปัจจุบัน ตรวจรายชื่อก่อนลบ</span></div>` : ''}
      <p>ตัวแปร สิทธิ์ของกลุ่ม รายการโปรด และกำหนดการที่ใช้รายงานเหล่านี้จะถูกลบด้วย ย้อนกลับไม่ได้ ถ้ายังอาจใช้อีก ให้ปิดใช้งานแทน</p>
    </div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ยกเลิก</button><button class="btn btn-danger" data-a="rpDelOk">ลบ ${reps.length} รายงานถาวร</button></div>`;
};
A.rpDelOk = () => {
  const ids = new Set(S.dialog.ids);
  REPORTS = REPORTS.filter(r => !ids.has(r.id));
  Object.values(MAP).forEach(s => ids.forEach(id => s.delete(id)));
  ids.forEach(id => S.rp.sel.delete(id));
  toast(`ลบ ${ids.size} รายงานแล้ว`);
  closeDialog();
};
