/* Page: ผู้ใช้ (users). */
PAGE_META.users = { group: 'ผู้ใช้และสิทธิ์', title: 'ผู้ใช้' };
const PER = 10;

function usFiltered() {
  const f = S.us, q = f.q.trim().toLowerCase();
  return USERS.filter(u =>
    (!q || `${u.name} ${u.user} ${u.emp || ''}`.toLowerCase().includes(q)) &&
    (f.role === 'all' || String(u.role) === f.role) &&
    (f.kind === 'all' || u.kind === f.kind) &&
    (f.status === 'all' || (f.status === 'active' ? u.active : !u.active)));
}
const coChips = ids => `<span class="row" style="gap:4px;flex-wrap:nowrap">${COMPANIES.filter(c => ids.includes(c.id)).map(c => `<span class="co" title="${esc(c.name)}">${c.code}</span>`).join('') || '<span class="tag tag-warn">ไม่มีบริษัท</span>'}</span>`;

function roleOptions(withAll) {
  const opts = [];
  if (withAll) opts.push({ v: 'all', label: 'ทุกกลุ่มสิทธิ์', short: 'ทั้งหมด', meta: `${USERS.length} ผู้ใช้`, icon: 'users' }, { sep: true });
  const admin = ROLES.find(r => r.admin);
  if (admin) opts.push({ group: 'ผู้ดูแลระบบ' }, { v: admin.id, label: admin.name, meta: `${members(admin.id).length} คน · เห็นทุกรายงาน`, lock: true });
  opts.push({ group: 'กลุ่มผู้ใช้รายงาน' });
  ROLES.filter(r => !r.admin).forEach(r => {
    const m = members(r.id).length, n = roleReports(r.id).length;
    opts.push({ v: r.id, label: r.name, meta: `${m} คน · ${n} รายงาน${n ? '' : ' (ยังไม่มีรายงาน)'}`, initials: initials(r.name) });
  });
  return opts;
}

PAGES.users = () => {
  const f = S.us;
  const list = usFiltered();
  const pages = Math.max(1, Math.ceil(list.length / PER));
  if (f.page > pages) f.page = pages;
  const shown = list.slice((f.page - 1) * PER, f.page * PER);
  const count = fn => USERS.filter(fn).length;
  const seg = (key, opts) => `<div class="seg" role="group" aria-label="${key === 'status' ? 'สถานะ' : 'ชนิดบัญชี'}">${opts.map(([v, l, n]) => `<button aria-pressed="${f[key] === v}" data-a="usSeg" data-kind="${key}" data-id="${v}">${l}<span class="n">${n}</span></button>`).join('')}</div>`;

  const head = pageHead('ผู้ใช้', 'บัญชีผู้ใช้ กลุ่มสิทธิ์ และบริษัทที่เข้าถึงได้',
    `<button class="btn" data-a="usSync">${ic('refresh-cw')}ตรวจสอบกับ AD</button><button class="btn btn-primary" data-a="usAdd">${ic('user-plus')}เพิ่มผู้ใช้</button>`);

  const toolbar = `<div class="toolbar">
      <div class="search" style="flex:1 1 240px;max-width:340px">${ic('search')}<input id="us-q" class="input" placeholder="ชื่อ, username หรือรหัสพนักงาน" value="${esc(f.q)}" data-in="usQ" aria-label="ค้นหาผู้ใช้"></div>
      ${dd('us-role', { filter: true, prefix: 'กลุ่มสิทธิ์', value: f.role, options: roleOptions(true), search: true, searchPlaceholder: 'ค้นหากลุ่มสิทธิ์', minWidth: 320, onPick: v => { f.role = String(v); f.page = 1; } })}
      ${seg('kind', [['all', 'ทุกบัญชี', USERS.length], ['ad', 'AD', count(u => u.kind === 'ad')], ['local', 'Local', count(u => u.kind === 'local')]])}
      ${seg('status', [['all', 'ทุกสถานะ', USERS.length], ['active', 'ใช้งาน', count(u => u.active)], ['off', 'ระงับ', count(u => !u.active)]])}
    </div>`;

  const rows = shown.map(u => `<tr class="${u.active ? '' : 'is-off'}">
      <td style="min-width:240px"><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="avatar">${initials(u.name)}</span>
        <div class="stack" style="gap:1px"><span class="row" style="gap:6px"><button class="cell-btn" data-a="usOpen" data-id="${u.id}">${esc(u.name)}</button>${u.me ? '<span class="tag tag-me">คุณ</span>' : ''}</span>
        <span class="sub">@${esc(u.user)}${u.emp ? ` · ${u.emp}` : ''}</span></div></div></td>
      <td>${kindTag(u)}</td>
      <td>${roleOf(u.role).admin ? `<span class="chip"><span>${ic('shield-check')}</span><span>Admin</span></span>` : `<span class="chip"><span>${esc(roleOf(u.role).name)}</span></span>`}</td>
      <td>${coChips(u.cos)}</td>
      <td>${stUser(u)}</td>
      <td class="w-act" style="width:auto"><div class="row-actions">
        <button class="btn btn-sm btn-ghost" data-a="usOpen" data-id="${u.id}" aria-label="แก้ไข ${esc(u.name)}">${ic('pencil')}แก้ไข</button>
        ${u.kind === 'local' ? `<button class="icon-btn warn" data-a="usResetPw" data-id="${u.id}" title="รีเซ็ตรหัสผ่าน" aria-label="รีเซ็ตรหัสผ่านของ ${esc(u.name)}">${ic('key-round')}</button>` : '<span class="icon-ph" title="บัญชี AD เปลี่ยนรหัสผ่านที่ Active Directory"></span>'}
        ${u.me ? '<span class="icon-ph" title="บัญชีของคุณเอง"></span><span class="icon-ph"></span>'
          : `<button class="icon-btn warn" data-a="usToggle" data-id="${u.id}" title="${u.active ? 'ระงับผู้ใช้' : 'เปิดใช้งาน'}" aria-label="${u.active ? 'ระงับ' : 'เปิดใช้งาน'} ${esc(u.name)}">${ic(u.active ? 'user-x' : 'user-check')}</button>
             <button class="icon-btn danger" data-a="usDel" data-id="${u.id}" title="ลบผู้ใช้" aria-label="ลบ ${esc(u.name)}">${ic('trash-2')}</button>`}
      </div></td>
    </tr>`).join('');

  return head + `<section class="card">${toolbar}
    <div class="table-wrap"><table class="t"><thead><tr><th>ผู้ใช้</th><th>บัญชี</th><th>กลุ่มสิทธิ์</th><th>บริษัทที่เข้าถึง</th><th>สถานะ</th><th style="text-align:right">จัดการ</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6"><div class="empty"><h3>ไม่พบผู้ใช้ตามเงื่อนไข</h3><button class="btn btn-sm" data-a="usClear">ล้างตัวกรอง</button></div></td></tr>`}</tbody></table></div>
    <div class="foot"><span>แสดง ${list.length ? (f.page - 1) * PER + 1 : 0}–${Math.min(f.page * PER, list.length)} จาก ${list.length} คน</span>
      <span class="row"><button class="btn btn-sm" data-a="usPage" data-id="-1" ${f.page <= 1 ? 'disabled' : ''} aria-label="หน้าก่อน">${ic('chevron-left')}</button><span class="tnum">หน้า ${f.page} / ${pages}</span><button class="btn btn-sm" data-a="usPage" data-id="1" ${f.page >= pages ? 'disabled' : ''} aria-label="หน้าถัดไป">${ic('chevron-right')}</button></span></div>
  </section>`;
};

INP.usQ = t => { S.us.q = t.value; S.us.page = 1; render(); };
A.usSeg = t => { S.us[t.dataset.kind] = t.dataset.id; S.us.page = 1; render(); };
A.usClear = () => { Object.assign(S.us, { q: '', role: 'all', kind: 'all', status: 'all', page: 1 }); S.focusId = 'us-q'; render(); };
A.usPage = t => { S.us.page += +t.dataset.id; render(); };

A.usResetPw = t => openDialog({ kind: 'resetPw', id: +t.dataset.id, pw: '', shown: false, force: true, err: '' }, t);
A.usToggle = t => openDialog({ kind: 'toggleUser', id: +t.dataset.id }, t);
A.usDel = t => openDialog({ kind: 'delUser', id: +t.dataset.id }, t);

/* ---------- user drawer (view + edit) ---------- */
function usOpenDrawer(u, trigger) {
  openDrawer({ kind: 'user', id: u.id, role: u.role, cos: new Set(u.cos), active: u.active, name: u.name, dirty: false, confirm: false, err: {} }, trigger);
}
A.usOpen = t => usOpenDrawer(userOf(+t.dataset.id), t);
function usDirty(d) {
  const u = userOf(d.id);
  return d.role !== u.role || d.active !== u.active || d.name !== u.name || d.cos.size !== u.cos.length || u.cos.some(c => !d.cos.has(c));
}
function reportsPreview(roleId) {
  if (!roleId) return '<p class="hint" style="margin:0">เลือกกลุ่มสิทธิ์ก่อน แล้วรายการรายงานจะแสดงที่นี่</p>';
  const role = roleOf(+roleId);
  const reps = roleReports(+roleId);
  if (role.admin) return `<div class="note note-info">${ic('shield-check')}<span>ผู้ดูแลระบบเห็นทุกรายงานที่ใช้งานอยู่ (${reps.length} รายงาน) โดยไม่ต้องเลือกทีละรายงาน</span></div>`;
  if (!reps.length) return `<div class="note note-warn">${ic('triangle-alert')}<span>กลุ่ม ${esc(role.name)} ยังไม่มีรายงาน ผู้ใช้จะไม่เห็นรายงานใดเลย</span></div>`;
  return `<div class="card" style="box-shadow:none">${groupByCat(reps).map(g => `<div class="grp-head" style="padding:8px 12px">${catChip(g.id)}<span class="sub">${g.items.length}</span></div>
    ${g.items.map(r => `<div class="r" style="padding:8px 12px"><span class="grow">${esc(r.name)}</span><span class="sub">${typeName(r.type)}</span></div>`).join('')}`).join('')}</div>`;
}
function userAccessSummary(d) {
  const role = d.role ? roleOf(+d.role) : null;
  const companies = COMPANIES.filter(c => d.cos.has(c.id)).map(c => c.code);
  const reports = role ? `${roleReports(role.id).length} รายงาน${role.admin ? ' · ทุกรายงานที่ใช้งาน' : ''}` : 'รอเลือกกลุ่มสิทธิ์';
  return `<section class="user-access-summary" aria-label="สรุปสิทธิ์ก่อนบันทึก" aria-live="polite">
    <h3>สรุปสิทธิ์ก่อนบันทึก</h3><dl>
      <div><dt>กลุ่มสิทธิ์</dt><dd>${role ? esc(role.name) : 'ยังไม่ได้เลือกกลุ่มสิทธิ์'}</dd></div>
      <div><dt>รายงานที่ใช้งาน</dt><dd>${reports}</dd></div>
      <div><dt>บริษัทที่เข้าถึง</dt><dd>${companies.length ? esc(companies.join(', ')) : 'ยังไม่ได้เลือกบริษัท'}</dd></div>
    </dl>
  </section>`;
}
DRAWERS.user = d => {
  const u = userOf(d.id);
  d.dirty = usDirty(d);
  const self = !!u.me;
  const roleChanged = d.role !== u.role;
  const suggested = u.adCo ? COMPANIES.find(c => c.name === u.adCo) : null;
  return `<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drw-title">
    <div class="drawer-head"><span class="avatar" style="width:40px;height:40px">${initials(u.name)}</span>
      <div class="grow stack" style="gap:2px"><h2 id="drw-title">${esc(u.name)}</h2><div class="row" style="gap:6px"><span class="sub">@${esc(u.user)}${u.emp ? ` · รหัสพนักงาน ${u.emp}` : ''}</span>${kindTag(u)}${self ? '<span class="tag tag-me">คุณ</span>' : ''}</div></div>
      <button class="icon-btn" data-a="drwClose" aria-label="ปิด">${ic('x')}</button></div>
    <div class="drawer-body">
      <section class="section"><h3>ข้อมูลบัญชี</h3>
        ${u.kind === 'ad' ? `<dl class="kv"><dt>อีเมล</dt><dd>${esc(u.email)}</dd><dt>แผนก</dt><dd>${esc(u.dept)}</dd><dt>บริษัทต้นสังกัด</dt><dd>${esc(u.adCo)}</dd></dl>
          <span class="hint">${ic('network')} ข้อมูลส่วนนี้มาจาก Active Directory แก้ที่ AD</span>`
        : `<div class="field"><label class="label" for="du-name">ชื่อ-นามสกุล</label><input id="du-name" class="input" value="${esc(d.name)}" data-in="duName"></div>`}
      </section>
      <section class="section"><h3>กลุ่มสิทธิ์</h3>
        <div class="field"><span class="label sr-only" id="du-role-lbl">กลุ่มสิทธิ์</span>
          ${dd('du-role', { labelledby: 'du-role-lbl', value: d.role, options: roleOptions(false), search: true, showMeta: true, disabled: self, describedby: self ? 'du-role-hint' : null, searchPlaceholder: 'ค้นหากลุ่มสิทธิ์', footer: 'ผู้ใช้ 1 คนอยู่ได้ 1 กลุ่ม · รายงานที่เห็นจะเปลี่ยนตามกลุ่ม', onPick: v => { S.drawer.role = +v; } })}
          ${self ? `<span class="hint" id="du-role-hint">${NEW} เปลี่ยนกลุ่มสิทธิ์ของตัวเองไม่ได้ ป้องกันการล็อกตัวเองออกจากระบบ</span>` : roleChanged ? `<span class="hint">${ic('info')} หลังบันทึก ผู้ใช้ต้องเข้าสู่ระบบใหม่</span>` : '<span class="hint">ผู้ใช้ 1 คนอยู่ได้ 1 กลุ่ม</span>'}</div>
      </section>
      <section class="section"><h3>บริษัทที่เข้าถึงได้</h3>
        ${suggested ? `<span class="hint">${NEW} ต้นสังกัดจาก AD: ${esc(suggested.name)} (${suggested.code})</span>` : ''}
        <div class="check-list">${COMPANIES.map(c => `<label class="check"><input type="checkbox" id="du-co-${c.id}" data-ch="duCo" data-id="${c.id}" ${d.cos.has(c.id) ? 'checked' : ''}><span class="stack" style="gap:0"><b style="font-weight:600">${esc(c.name)}</b><span class="sub">${c.code}</span></span></label>`).join('')}</div>
        ${d.cos.size ? '' : `<span class="err">${ic('circle-alert')}เลือกอย่างน้อย 1 บริษัท</span>`}
      </section>
      <section class="section"><h3>รายงานที่ผู้ใช้นี้เห็น ${NEW}</h3>
        <span class="hint">มาจากกลุ่มสิทธิ์ ${esc(roleOf(d.role).name)} — แก้รายงานของกลุ่มได้ที่หน้ากลุ่มสิทธิ์</span>
        ${reportsPreview(d.role)}
      </section>
      <section class="section"><h3>สถานะ</h3>
        <button class="switch" role="switch" aria-checked="${d.active}" data-a="duActive" ${self ? 'aria-disabled="true"' : ''}><span class="switch-track"></span><span class="stack" style="gap:0"><b style="font-weight:600">${d.active ? 'ใช้งาน' : 'ระงับ'}</b><span class="sub">${self ? 'ระงับบัญชีของตัวเองไม่ได้' : d.active ? 'เข้าสู่ระบบได้ตามปกติ' : 'เข้าสู่ระบบไม่ได้ ข้อมูลและสิทธิ์ยังเก็บไว้'}</span></span></button>
      </section>
      ${userAccessSummary(d)}
    </div>
    <div class="drawer-foot">${d.confirm ? `<div class="confirm-bar grow">${ic('triangle-alert')}<span class="grow">ยังไม่ได้บันทึก ทิ้งการแก้ไขไหม?</span><button class="btn btn-sm" data-a="drwKeep" data-autofocus>แก้ไขต่อ</button><button class="btn btn-sm btn-danger" data-a="drwDiscard">ทิ้งการแก้ไข</button></div>`
      : `<span class="sub grow">${d.dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : ''}</span><button class="btn" data-a="drwClose">${d.dirty ? 'ยกเลิก' : 'ปิด'}</button><button class="btn btn-primary" data-a="duSave" ${d.dirty && d.cos.size ? '' : 'disabled'}>บันทึก</button>`}</div>
  </aside>`;
};
INP.duName = t => { S.drawer.name = t.value; const was = S.drawer.dirty; if (usDirty(S.drawer) !== was) render(); };
CHG.duCo = t => { const id = +t.dataset.id; t.checked ? S.drawer.cos.add(id) : S.drawer.cos.delete(id); S.focusId = `du-co-${id}`; render(); };
A.duActive = () => { S.drawer.active = !S.drawer.active; render(); };
A.duSave = () => {
  const d = S.drawer, u = userOf(d.id);
  Object.assign(u, { role: d.role, active: d.active, name: d.name.trim() || u.name, cos: [...d.cos].sort() });
  toast(`บันทึก ${u.name} แล้ว`);
  closeDrawer(true);
};

/* ---------- add user popup ---------- */
A.usAdd = t => openDialog({ kind: 'add', wide: true, mode: 'ad', adQ: '', adOpen: false, adHi: 0, pick: null, user: '', name: '', pw: '', shown: false, force: true, role: '', cos: new Set(), err: {}, showReps: false, dirty: false, confirm: false }, t);
function adResults(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const existing = USERS.filter(u => u.kind === 'ad').map(u => ({ user: u.user, name: u.name, dept: u.dept, adCo: u.adCo, email: u.email, emp: u.emp, has: true }));
  return [...AD_DIR, ...existing].filter(p => `${p.user} ${p.name}`.toLowerCase().includes(q)).slice(0, 6);
}
const pwRules = pw => [[pw.length >= 8, 'อย่างน้อย 8 ตัวอักษร'], [/[A-Z]/.test(pw), 'มีตัวพิมพ์ใหญ่ A–Z'], [/\d/.test(pw), 'มีตัวเลข'], [/[^A-Za-z0-9]/.test(pw), 'มีอักขระพิเศษ']];
function genPw() {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', X = '!@#$%*?';
  const pick = s => s[Math.floor(Math.random() * s.length)];
  const chars = [pick(U), pick(D), pick(X), ...Array.from({ length: 9 }, () => pick(U + L + D))];
  return chars.sort(() => Math.random() - .5).join('');
}
function repSummary(d) {
  if (!d.role) return '<span class="hint">เลือกกลุ่มสิทธิ์แล้วจะเห็นว่าผู้ใช้นี้ใช้รายงานใดได้</span>';
  const role = roleOf(+d.role), reps = roleReports(+d.role);
  return `<div class="summary-line">${ic('file-text')}<span>จะเห็น <b>${role.admin ? 'ทุกรายงานที่ใช้งาน' : reps.length + ' รายงาน'}</b> จากกลุ่ม ${esc(role.name)}</span>
      ${!role.admin && reps.length ? `<button class="link-btn" data-a="addReps" aria-expanded="${d.showReps}">${d.showReps ? 'ซ่อนรายการ' : 'ดูรายการ'}</button>` : ''}</div>
    ${d.showReps ? reportsPreview(d.role) : ''}`;
}
DIALOGS.add = d => {
  d.dirty = !!(d.pick || d.user || d.name || d.pw || d.role || d.cos.size);
  const res = d.mode === 'ad' ? adResults(d.adQ) : [];
  const hiUser = d.adOpen && res[d.adHi] ? res[d.adHi].user : null;
  const e = d.err;
  const errEl = k => e[k] ? `<span class="err" id="err-${k}">${ic('circle-alert')}${esc(e[k])}</span>` : '';
  const ad = `<div class="field combo"><label class="label" for="ad-q">ค้นหาผู้ใช้ใน AD<span class="req" aria-hidden="true">*</span></label>
      <div class="search">${ic('search')}<input id="ad-q" class="input ${e.pick ? 'invalid' : ''}" role="combobox" aria-expanded="${d.adOpen && res.length > 0}" aria-controls="ad-list" aria-autocomplete="list" ${hiUser ? `aria-activedescendant="ad-${hiUser}"` : ''} value="${esc(d.adQ)}" placeholder="พิมพ์ชื่อหรือ username อย่างน้อย 2 ตัว" autocomplete="off" data-in="adQ" data-kd="adQ" data-autofocus></div>
      ${d.adOpen && res.length ? `<div class="combo-list combo-inline" id="ad-list" role="listbox" aria-label="ผลการค้นหา AD">${res.map((p, i) => `<div class="opt ${i === d.adHi ? 'is-hi' : ''}" role="option" id="ad-${p.user}" aria-selected="false" aria-disabled="${!!p.has}" ${p.has ? '' : `data-a="adPick" data-id="${p.user}"`}>
        <span class="opt-name">${esc(p.name)}${p.has ? '<span class="tag">มีบัญชีแล้ว</span>' : ''}</span><span class="opt-desc">@${esc(p.user)} · ${esc(p.dept)} · ${esc(p.adCo)}</span></div>`).join('')}</div>` : ''}
      ${d.adOpen && d.adQ.trim().length >= 2 && !res.length ? '<span class="hint">ไม่พบใน AD ลองชื่ออื่น</span>' : d.pick ? '' : `<span class="hint">${NEW} ใช้ลูกศรขึ้น/ลง แล้วกด Enter เพื่อเลือก</span>`}
      ${errEl('pick')}</div>
    ${d.pick ? `<div class="note" style="align-items:center"><span class="avatar">${initials(d.pick.name)}</span><span class="grow stack" style="gap:0"><b>${esc(d.pick.name)}</b><span class="sub">@${esc(d.pick.user)} · ${esc(d.pick.dept)} · ${esc(d.pick.adCo)} · ${esc(d.pick.email)}</span></span><button class="btn btn-sm btn-ghost" data-a="adClear">เปลี่ยน</button></div>` : ''}`;
  const rules = pwRules(d.pw);
  const local = `<div class="fields" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
      <div class="field"><label class="label" for="ad-user">Username<span class="req" aria-hidden="true">*</span></label><input id="ad-user" class="input ${e.user ? 'invalid' : ''}" value="${esc(d.user)}" placeholder="เช่น somsri.k" data-in="addUser" data-autofocus autocomplete="off">${errEl('user')}</div>
      <div class="field"><label class="label" for="ad-name">ชื่อ-นามสกุล<span class="req" aria-hidden="true">*</span></label><input id="ad-name" class="input ${e.name ? 'invalid' : ''}" value="${esc(d.name)}" data-in="addName">${errEl('name')}</div></div>
    <div class="field"><label class="label" for="ad-pw">รหัสผ่านเริ่มต้น<span class="req" aria-hidden="true">*</span></label>
      <div class="row" style="flex-wrap:nowrap"><input id="ad-pw" class="input ${e.pw ? 'invalid' : ''}" type="${d.shown ? 'text' : 'password'}" value="${esc(d.pw)}" data-in="addPw" autocomplete="new-password" style="font-family:${d.shown ? 'var(--mono)' : 'inherit'}">
        <button class="icon-btn" data-a="addPwShow" aria-label="${d.shown ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}">${ic(d.shown ? 'eye-off' : 'eye')}</button>
        <button class="btn" data-a="addPwGen">${ic('dices')}สร้างรหัสให้</button></div>
      <ul style="margin:2px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px">${rules.map(([ok, t]) => `<li class="sub" style="display:flex;gap:5px;align-items:center;color:${ok ? 'var(--ok)' : 'var(--fg-3)'}">${ic(ok ? 'circle-check' : 'circle')}${t}</li>`).join('')}</ul>
      ${errEl('pw')}
      <label class="row" style="gap:8px;margin-top:4px;cursor:pointer"><input type="checkbox" data-ch="addForce" ${d.force ? 'checked' : ''}><span>ให้เปลี่ยนรหัสผ่านเมื่อเข้าใช้ครั้งแรก</span>${NEW}</label></div>`;
  const sug = d.pick ? COMPANIES.find(c => c.name === d.pick.adCo) : null;
  return `<div class="dialog-head"><div class="dialog-ico">${ic('user-plus')}</div><div class="grow"><h2 id="dlg-title">เพิ่มผู้ใช้</h2><div class="sub">เลือกชนิดบัญชี แล้วกำหนดกลุ่มสิทธิ์และบริษัท</div></div>
      <button class="icon-btn" data-a="dlgClose" aria-label="ปิด">${ic('x')}</button></div>
    <div class="dialog-body" style="gap:18px">
      <div class="seg" role="group" aria-label="ชนิดบัญชี" style="align-self:flex-start"><button aria-pressed="${d.mode === 'ad'}" data-a="addMode" data-id="ad">${ic('network')}บัญชี AD</button><button aria-pressed="${d.mode === 'local'}" data-a="addMode" data-id="local">${ic('key-round')}บัญชี Local</button></div>
      <section class="section">${d.mode === 'ad' ? ad : local}</section>
      <section class="section" style="border-top:1px solid var(--line);padding-top:16px">
        <div class="field"><span class="label" id="add-role-lbl">กลุ่มสิทธิ์<span class="req" aria-hidden="true">*</span></span>${dd('add-role', { labelledby: 'add-role-lbl', value: d.role, placeholder: 'เลือกกลุ่มสิทธิ์', options: roleOptions(false), search: true, showMeta: true, invalid: !!e.role, describedby: e.role ? 'err-role' : null, searchPlaceholder: 'ค้นหากลุ่มสิทธิ์', footer: 'ผู้ใช้ 1 คนอยู่ได้ 1 กลุ่ม', onPick: v => { S.dialog.role = String(v); delete S.dialog.err.role; } })}${errEl('role')}</div>
        ${repSummary(d)}
      </section>
      <section class="section"><span class="label" id="add-co-label">บริษัทที่เข้าถึงได้<span class="req" aria-hidden="true">*</span></span>
        <div class="check-row" role="group" aria-labelledby="add-co-label">${COMPANIES.map(c => `<label class="check"><input type="checkbox" id="add-co-${c.id}" data-ch="addCo" data-id="${c.id}" ${d.cos.has(c.id) ? 'checked' : ''}><span class="stack" style="gap:0"><b style="font-weight:600">${c.code}</b><span class="sub">${esc(c.name)}</span></span></label>`).join('')}</div>
        ${errEl('cos') || (sug ? `<span class="hint">${NEW} ต้นสังกัด AD: ${esc(sug.name)} — ตรวจสอบบริษัทที่เลือกก่อนบันทึก</span>` : '<span class="hint">เลือกเฉพาะบริษัทที่ผู้ใช้ต้องใช้งาน</span>')}
      </section>
      ${userAccessSummary(d)}
    </div>
    <div class="dialog-foot">${d.confirm ? `<div class="confirm-bar grow">${ic('triangle-alert')}<span class="grow">ยังไม่ได้เพิ่มผู้ใช้ ทิ้งข้อมูลที่กรอกไหม?</span><button class="btn btn-sm" data-a="dlgKeep" data-autofocus>กรอกต่อ</button><button class="btn btn-sm btn-danger" data-a="dlgDiscard">ทิ้ง</button></div>`
      : `<button class="btn" data-a="dlgClose">ยกเลิก</button><button class="btn btn-primary" data-a="addSave">${ic('user-plus')}เพิ่มผู้ใช้</button>`}</div>`;
};
A.addMode = t => { const d = S.dialog; d.mode = t.dataset.id; d.err = {}; d.pick = null; d.adQ = ''; d.cos = new Set(); S.focusId = d.mode === 'ad' ? 'ad-q' : 'ad-user'; render(); };
INP.adQ = t => { const d = S.dialog; d.adQ = t.value; d.adOpen = true; d.adHi = 0; render(); };
KD.adQ = e => {
  const d = S.dialog, res = adResults(d.adQ);
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && res.length) { d.adOpen = true; d.adHi = (d.adHi + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length; render(); e.preventDefault(); return true; }
  if (e.key === 'Enter' && d.adOpen && res[d.adHi]) { if (!res[d.adHi].has) adSelect(res[d.adHi].user); e.preventDefault(); return true; }
  if (e.key === 'Escape' && d.adOpen) { d.adOpen = false; render(); e.preventDefault(); return true; }
  return false;
};
function adSelect(user) {
  const d = S.dialog, p = AD_DIR.find(x => x.user === user);
  d.pick = p; d.adOpen = false; d.adQ = p.name; delete d.err.pick;
  const sug = COMPANIES.find(c => c.name === p.adCo);
  if (sug && !d.cos.size) d.cos.add(sug.id);
  S.focusId = 'dd-add-role'; render();
}
A.adPick = t => adSelect(t.dataset.id);
A.adClear = () => { const d = S.dialog; d.pick = null; d.adQ = ''; S.focusId = 'ad-q'; render(); };
INP.addUser = t => { S.dialog.user = t.value; S.dialog.dirty = true; };
INP.addName = t => { S.dialog.name = t.value; S.dialog.dirty = true; };
INP.addPw = t => { S.dialog.pw = t.value; render(); };
A.addPwShow = () => { S.dialog.shown = !S.dialog.shown; render(); };
A.addPwGen = () => { const d = S.dialog; d.pw = genPw(); d.shown = true; delete d.err.pw; toast('สร้างรหัสผ่านแล้ว คัดลอกไปแจ้งผู้ใช้ก่อนปิดหน้าต่างนี้', 'info'); render(); };
A.addReps = () => { S.dialog.showReps = !S.dialog.showReps; render(); };
CHG.addForce = t => { S.dialog.force = t.checked; };
CHG.addCo = t => { const id = +t.dataset.id; t.checked ? S.dialog.cos.add(id) : S.dialog.cos.delete(id); delete S.dialog.err.cos; S.focusId = `add-co-${id}`; render(); };
A.addSave = () => {
  const d = S.dialog, e = {};
  if (d.mode === 'ad') { if (!d.pick) e.pick = 'เลือกผู้ใช้จากผลการค้นหา AD'; }
  else {
    if (!/^[a-z0-9._-]{3,50}$/i.test(d.user.trim())) e.user = 'ใช้ a–z ตัวเลข จุด หรือขีด 3–50 ตัว';
    else if (USERS.some(u => u.user.toLowerCase() === d.user.trim().toLowerCase())) e.user = 'มี username นี้แล้ว';
    if (!d.name.trim()) e.name = 'กรอกชื่อ-นามสกุล';
    if (!pwRules(d.pw).every(r => r[0])) e.pw = 'ตั้งรหัสผ่านให้ครบตามเงื่อนไข หรือกด “สร้างรหัสให้”';
  }
  if (!d.role) e.role = 'เลือกกลุ่มสิทธิ์';
  if (!d.cos.size) e.cos = 'เลือกอย่างน้อย 1 บริษัท';
  d.err = e;
  const first = ['pick', 'user', 'name', 'pw', 'role'].find(k => e[k]);
  if (first || e.cos) { S.focusId = { pick: 'ad-q', user: 'ad-user', name: 'ad-name', pw: 'ad-pw', role: 'dd-add-role' }[first] || null; render(); return; }
  const id = Math.max(...USERS.map(u => u.id)) + 1;
  const base = d.mode === 'ad' ? { name: d.pick.name, user: d.pick.user, kind: 'ad', emp: d.pick.emp, email: d.pick.email, dept: d.pick.dept, adCo: d.pick.adCo } : { name: d.name.trim(), user: d.user.trim(), kind: 'local' };
  USERS.push({ id, ...base, role: +d.role, cos: [...d.cos].sort(), active: true });
  toast(`เพิ่มผู้ใช้ ${base.name} แล้ว`);
  closeDialog(true);
};

/* ---------- dialogs ---------- */
DIALOGS.resetPw = d => {
  const u = userOf(d.id);
  const rules = pwRules(d.pw);
  return `<div class="dialog-head"><div class="dialog-ico">${ic('key-round')}</div><div><h2 id="dlg-title">รีเซ็ตรหัสผ่าน</h2><div class="sub">${esc(u.name)} · @${esc(u.user)} · บัญชี Local</div></div></div>
    <div class="dialog-body">
      <div class="field"><label class="label" for="rp-pw">รหัสผ่านใหม่<span class="req" aria-hidden="true">*</span></label>
        <div class="row" style="flex-wrap:nowrap"><input id="rp-pw" class="input ${d.err ? 'invalid' : ''}" type="${d.shown ? 'text' : 'password'}" value="${esc(d.pw)}" data-in="rpwPw" autocomplete="new-password" data-autofocus style="font-family:${d.shown ? 'var(--mono)' : 'inherit'}">
          <button class="icon-btn" data-a="rpwShow" aria-label="${d.shown ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}">${ic(d.shown ? 'eye-off' : 'eye')}</button><button class="btn" data-a="rpwGen">${ic('dices')}สร้างรหัสให้</button></div>
        <ul style="margin:2px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px">${rules.map(([ok, t]) => `<li class="sub" style="display:flex;gap:5px;align-items:center;color:${ok ? 'var(--ok)' : 'var(--fg-3)'}">${ic(ok ? 'circle-check' : 'circle')}${t}</li>`).join('')}</ul>
        ${d.err ? `<span class="err">${ic('circle-alert')}${esc(d.err)}</span>` : ''}</div>
      <label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" data-ch="rpwForce" ${d.force ? 'checked' : ''}><span>ให้เปลี่ยนรหัสผ่านเมื่อเข้าใช้ครั้งถัดไป</span>${NEW}</label>
      <div class="note">${ic('info')}<span>ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์ทันที</span></div>
    </div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose">ยกเลิก</button><button class="btn btn-primary" data-a="rpwOk">รีเซ็ตรหัสผ่าน</button></div>`;
};
INP.rpwPw = t => { S.dialog.pw = t.value; S.dialog.err = ''; render(); };
A.rpwShow = () => { S.dialog.shown = !S.dialog.shown; render(); };
A.rpwGen = () => { S.dialog.pw = genPw(); S.dialog.shown = true; S.dialog.err = ''; render(); };
CHG.rpwForce = t => { S.dialog.force = t.checked; };
A.rpwOk = () => {
  const d = S.dialog;
  if (!pwRules(d.pw).every(r => r[0])) { d.err = 'ตั้งรหัสผ่านให้ครบตามเงื่อนไข'; S.focusId = 'rp-pw'; render(); return; }
  toast(`รีเซ็ตรหัสผ่านของ ${userOf(d.id).name} แล้ว`); closeDialog();
};
DIALOGS.toggleUser = d => {
  const u = userOf(d.id), on = u.active;
  return `<div class="dialog-head"><div class="dialog-ico ${on ? 'is-bad' : ''}">${ic('power')}</div><div><h2 id="dlg-title">${on ? 'ระงับ' : 'เปิดใช้งาน'} ${esc(u.name)}?</h2></div></div>
    <div class="dialog-body"><p>${on ? 'ผู้ใช้จะออกจากระบบทันทีและเข้าสู่ระบบไม่ได้ กลุ่มสิทธิ์และบริษัทยังเก็บไว้ เปิดใช้งานกลับได้ภายหลัง' : 'ผู้ใช้จะเข้าสู่ระบบได้อีกครั้งด้วยสิทธิ์เดิม'}</p>
      ${on && u.kind === 'ad' ? `<div class="note">${ic('info')}<span>บัญชีที่ผู้ดูแลระงับเอง การตรวจสอบกับ AD จะไม่เปิดกลับให้อัตโนมัติ ${NEW}</span></div>` : ''}</div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ยกเลิก</button><button class="btn ${on ? 'btn-danger' : 'btn-primary'}" data-a="usToggleOk">${on ? 'ระงับผู้ใช้' : 'เปิดใช้งาน'}</button></div>`;
};
A.usToggleOk = () => { const u = userOf(S.dialog.id); u.active = !u.active; toast(`${u.active ? 'เปิดใช้งาน' : 'ระงับ'} ${u.name} แล้ว`); closeDialog(); };
DIALOGS.delUser = d => {
  const u = userOf(d.id);
  return `<div class="dialog-head"><div class="dialog-ico is-bad">${ic('trash-2')}</div><div><h2 id="dlg-title">ลบผู้ใช้ ${esc(u.name)}?</h2></div></div>
    <div class="dialog-body"><p>บัญชี @${esc(u.user)} บริษัทที่อนุญาต และรายการโปรดจะถูกลบ ประวัติการใช้งานยังเก็บไว้ ย้อนกลับไม่ได้</p>
      <div class="note note-warn">${ic('lightbulb')}<span>ถ้าอาจกลับมาใช้งาน ให้ระงับแทน</span></div></div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ยกเลิก</button><button class="btn" data-a="usDelToSuspend">ระงับแทน</button><button class="btn btn-danger" data-a="usDelOk">ลบผู้ใช้</button></div>`;
};
A.usDelOk = () => { const u = userOf(S.dialog.id); USERS = USERS.filter(x => x.id !== u.id); toast(`ลบ ${u.name} แล้ว`); closeDialog(); };
A.usDelToSuspend = () => { const u = userOf(S.dialog.id); u.active = false; toast(`ระงับ ${u.name} แล้ว`); closeDialog(); };
A.usSync = t => openDialog({ kind: 'sync', phase: 'confirm' }, t);
DIALOGS.sync = d => {
  const n = USERS.filter(u => u.kind === 'ad').length;
  if (d.phase === 'running') return `<div class="dialog-head"><div class="dialog-ico">${ic('loader-circle', 'spin')}</div><div><h2 id="dlg-title">กำลังตรวจสอบ ${n} บัญชีกับ AD…</h2></div></div><div class="dialog-body"><p>ใช้เวลาไม่นาน ปิดหน้าต่างนี้ได้ ผลจะแสดงเมื่อเสร็จ</p></div><div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ปิด</button></div>`;
  if (d.phase === 'done') return `<div class="dialog-head"><div class="dialog-ico">${ic('circle-check')}</div><div><h2 id="dlg-title">ตรวจสอบกับ AD เสร็จแล้ว</h2></div></div>
    <div class="dialog-body"><dl class="kv"><dt>พบใน AD</dt><dd><b>${n - 1}</b> บัญชี ไม่เปลี่ยน</dd><dt>ไม่พบใน AD</dt><dd><b>1</b> บัญชี ระงับแล้ว (narong.c)</dd><dt>เปิดกลับ</dt><dd><b>0</b> บัญชี</dd></dl>
    <span class="hint">ข้อมูลผลลัพธ์เป็นตัวอย่างใน mockup</span></div>
    <div class="dialog-foot"><button class="btn btn-primary" data-a="dlgClose" data-autofocus>เสร็จ</button></div>`;
  return `<div class="dialog-head"><div class="dialog-ico">${ic('refresh-cw')}</div><div><h2 id="dlg-title">ตรวจสอบผู้ใช้กับ Active Directory</h2><div class="sub">บัญชี AD ${n} บัญชี · บัญชี Local ไม่เกี่ยว</div></div></div>
    <div class="dialog-body"><p>ระบบจะค้นแต่ละบัญชีใน AD แล้วทำดังนี้</p>
      <dl class="kv"><dt>ไม่พบใน AD</dt><dd>ระงับบัญชี</dd><dt>พบแล้ว และเคยถูกระงับเพราะไม่พบ</dt><dd>เปิดใช้งานกลับ</dd><dt>ผู้ดูแลระงับเอง</dt><dd>ไม่เปลี่ยน ${NEW}</dd></dl>
      <span class="hint">ระบบจริงตอนนี้เปิดบัญชีที่ระงับกลับทุกบัญชีที่พบใน AD โดยไม่แยกเหตุผล ข้อนี้ต้องแก้ฝั่ง API</span></div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ยกเลิก</button><button class="btn btn-primary" data-a="syncGo">เริ่มตรวจสอบ</button></div>`;
};
A.syncGo = () => { S.dialog.phase = 'running'; S.justOpened = true; render(); setTimeout(() => { if (S.dialog && S.dialog.kind === 'sync') { S.dialog.phase = 'done'; S.justOpened = true; render(); } }, 1600); };
