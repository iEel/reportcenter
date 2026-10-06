/* Page: กลุ่มสิทธิ์ (roles) — list + detail with reports, members and compare tabs. */
PAGE_META.roles = { group: 'ผู้ใช้และสิทธิ์', title: 'กลุ่มสิทธิ์' };

const lockIcon = (size, style = '') => LOCK_SVG.replace('<svg', `<svg width="${size}" height="${size}" style="color:var(--fg-3);flex:none;${style}"`);
const repSet = roleId => new Set(roleReports(roleId).map(x => x.id));
function overlap(a, b) {
  const A1 = repSet(a), B1 = repSet(b);
  const both = [...A1].filter(id => B1.has(id));
  return { both, onlyA: [...A1].filter(id => !B1.has(id)), onlyB: [...B1].filter(id => !A1.has(id)), union: new Set([...A1, ...B1]).size };
}
function closestRole(roleId) {
  let best = null;
  ROLES.filter(x => !x.admin && x.id !== roleId).forEach(x => {
    const o = overlap(roleId, x.id);
    const score = o.union ? o.both.length / o.union : 0;
    if (!best || score > best.score) best = { id: x.id, score, both: o.both.length, union: o.union };
  });
  return best;
}

PAGES.roles = () => {
  const r = S.ro;
  if (!roleOf(r.sel)) r.sel = ROLES[0].id;
  const head = pageHead('กลุ่มสิทธิ์', 'กลุ่มกำหนดว่าผู้ใช้เห็นรายงานใด ผู้ใช้ 1 คนอยู่ได้ 1 กลุ่ม ส่วนบริษัทกำหนดที่หน้าผู้ใช้',
    `<button class="btn btn-primary" data-a="roAdd">${ic('plus')}เพิ่มกลุ่ม</button>`);
  const q = r.listQ.trim().toLowerCase();
  const list = ROLES.filter(x => !q || x.name.toLowerCase().includes(q));
  const left = `<section class="card" aria-label="รายการกลุ่มสิทธิ์">
    <div class="card-pad" style="padding:12px"><div class="search">${ic('search')}<input id="ro-lq" class="input" placeholder="ค้นหากลุ่ม" value="${esc(r.listQ)}" data-in="roLQ" aria-label="ค้นหากลุ่มสิทธิ์"></div></div>
    <div class="list" style="padding-top:0">${list.map(x => {
      const m = members(x.id).length, n = roleReports(x.id).length;
      const flags = x.admin ? '' : `${!m ? '<span class="tag tag-warn">ไม่มีสมาชิก</span>' : ''}${!n ? '<span class="tag tag-warn">ไม่มีรายงาน</span>' : ''}`;
      return `<button class="li" data-a="roSel" data-id="${x.id}" ${x.id === r.sel ? 'aria-current="true"' : ''}>
        <span class="grow" style="min-width:0"><span class="li-name" style="display:block">${esc(x.name)}</span>
        <span class="li-meta row" style="gap:6px">${m} คน · ${x.admin ? 'ทุกรายงาน' : n + ' รายงาน'}${flags}</span></span>
        ${x.admin ? lockIcon(14) : ''}</button>`;
    }).join('') || '<div class="empty" style="padding:20px">ไม่พบกลุ่ม</div>'}</div>
    <div class="foot">${ROLES.length} กลุ่ม · ${USERS.length} ผู้ใช้</div>
  </section>`;
  return head + `<div class="split">${left}${roPanel()}</div>`;
};

function roPanel() {
  const r = S.ro, role = roleOf(r.sel);
  const mem = members(role.id);
  const reps = roleReports(role.id, { includeOff: true });
  const activeN = reps.filter(x => x.active).length;
  const tabs = `<div class="tabs" role="tablist">
    <button class="tab" role="tab" aria-selected="${r.tab === 'reports'}" data-a="roTab" data-id="reports">${ic('file-text')}รายงานที่อนุญาต <span class="muted tnum">${role.admin ? 'ทั้งหมด' : activeN}</span></button>
    <button class="tab" role="tab" aria-selected="${r.tab === 'members'}" data-a="roTab" data-id="members">${ic('users')}สมาชิก <span class="muted tnum">${mem.length}</span>${NEW}</button>
    ${role.admin ? '' : `<button class="tab" role="tab" aria-selected="${r.tab === 'compare'}" data-a="roTab" data-id="compare">${ic('git-compare')}เทียบกับกลุ่มอื่น${NEW}</button>`}</div>`;
  let body;
  if (r.tab === 'members') body = roMembers(role, mem);
  else if (r.tab === 'compare' && !role.admin) body = roCompare(role);
  else if (role.admin) body = `<div style="padding:16px 20px"><div class="note note-info">${ic('shield-check')}<span>ผู้ดูแลระบบเห็นทุกรายงานที่ใช้งานอยู่ (${roleReports(role.id).length} รายงาน) โดยอัตโนมัติ ไม่ต้องเลือก และรายงานใหม่จะเห็นทันที ${NEW}</span></div></div>`;
  else if (r.editing) body = roEditList(role);
  else body = reps.length ? groupByCat(reps).map(g => `<div class="grp-head">${catChip(g.id)}<span class="sub">${g.items.length} รายงาน</span></div>
      ${g.items.map(x => `<div class="r"><span class="grow ${x.active ? '' : 'muted'}">${esc(x.name)}</span>${x.active ? `<span class="sub">${typeName(x.type)}</span>` : '<span class="tag">ปิดใช้งาน · สิทธิ์ยังเก็บไว้</span>'}</div>`).join('')}`).join('')
    : `<div class="empty">${ic('file-text')}<h3>กลุ่มนี้ยังไม่มีรายงาน</h3><p>สมาชิก ${mem.length} คนจะไม่เห็นรายงานใดเลย</p><button class="btn btn-sm btn-primary" data-a="roEdit">เลือกรายงาน</button></div>`;
  const primary = !role.admin && r.tab === 'reports' && !r.editing && reps.length ? `<button class="btn btn-primary" data-a="roEdit">${ic('pencil')}แก้ไขรายงานที่อนุญาต</button>`
    : r.tab === 'members' ? `<button class="btn btn-primary" data-a="roAddMem">${ic('user-plus')}เพิ่มสมาชิก</button>` : '';
  return `<section class="card" aria-label="รายละเอียดกลุ่ม">
    <div class="panel-head"><div class="stack" style="gap:4px"><h2>${role.admin ? lockIcon(16) : ''}${esc(role.name)}</h2>
      <span class="sub">${mem.length} คน · ${role.admin ? `กลุ่มผู้ดูแลระบบ ชื่อและรายงานล็อกไว้ ${NEW}` : `${activeN} รายงานที่ใช้งาน`}</span></div>
      <div class="actions">${role.admin ? '' : `<button class="btn" data-a="roRename" data-id="${role.id}">${ic('pencil')}เปลี่ยนชื่อ</button><button class="btn btn-danger-ghost" data-a="roDelete" data-id="${role.id}">${ic('trash-2')}ลบกลุ่ม</button>`}${primary}</div></div>
    ${tabs}${body}</section>`;
}

function roMembers(role, mem) {
  if (!mem.length) return `<div class="empty">${ic('users')}<h3>ยังไม่มีสมาชิก</h3><p>กด “เพิ่มสมาชิก” เพื่อย้ายผู้ใช้มากลุ่มนี้ หรือเลือกกลุ่มให้ผู้ใช้ที่หน้าผู้ใช้</p></div>`;
  return `<div class="table-wrap"><table class="t"><thead><tr><th>ผู้ใช้</th><th>บัญชี</th><th>บริษัท</th><th>สถานะ</th></tr></thead><tbody>${mem.map(u => `<tr>
      <td><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="avatar">${initials(u.name)}</span><div class="stack" style="gap:0"><span class="row" style="gap:6px"><button class="cell-btn" data-a="roOpenUser" data-id="${u.id}">${esc(u.name)}</button>${u.me ? '<span class="tag tag-me">คุณ</span>' : ''}</span><span class="sub">@${esc(u.user)}</span></div></div></td>
      <td>${kindTag(u)}</td><td>${coChips(u.cos)}</td><td>${stUser(u)}</td></tr>`).join('')}</tbody></table></div>
    <div class="foot"><span>ย้ายสมาชิกออกได้จากแผงผู้ใช้ โดยเลือกกลุ่มอื่นให้</span><button class="link-btn" data-a="roToUsers">${ic('arrow-up-right')}เปิดในหน้าผู้ใช้</button></div>`;
}

function roCompare(role) {
  const r = S.ro;
  const others = ROLES.filter(x => !x.admin && x.id !== role.id);
  if (!others.length) return '<div class="empty">ยังไม่มีกลุ่มอื่นให้เทียบ</div>';
  const best = closestRole(role.id);
  if (!r.cmp || !others.some(x => x.id === r.cmp)) r.cmp = best ? best.id : others[0].id;
  const other = roleOf(r.cmp);
  const o = overlap(role.id, other.id);
  const col = (title, ids, tone) => `<div class="card" style="box-shadow:none;min-width:0"><div class="card-head" style="padding:10px 14px"><h2 style="font-size:13.5px">${title}</h2><span class="sub tnum">${ids.length}</span></div>
      <div class="rows">${ids.length ? ids.map(repOf).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'th')).map(x => `<div class="r" style="padding:8px 14px;${tone}"><span class="grow">${esc(x.name)}</span></div>`).join('') : '<div class="r sub" style="padding:10px 14px">ไม่มี</div>'}</div></div>`;
  const pct = o.union ? Math.round(o.both.length / o.union * 100) : 0;
  return `<div class="card-pad stack" style="gap:14px">
      <div class="row" style="gap:10px 14px">
        ${dd('ro-cmp', { filter: true, prefix: 'เทียบกับ', value: other.id, allValue: '__none__', minWidth: 320, search: others.length > 6, searchPlaceholder: 'ค้นหากลุ่ม', onPick: v => { S.ro.cmp = +v; },
          options: others.map(x => { const ov = overlap(role.id, x.id); const p = ov.union ? Math.round(ov.both.length / ov.union * 100) : 0; return { x, ov, p }; }).sort((a, b) => b.p - a.p)
            .map(({ x, ov, p }, i) => ({ v: x.id, label: x.name, initials: initials(x.name), meta: `${i === 0 ? 'ใกล้เคียงที่สุด · ' : ''}ตรงกัน ${ov.both.length} จาก ${ov.union} รายงาน`, count: p + '%' })) })}
        <span class="sub">รายงานตรงกัน <b class="tnum" style="color:var(--fg)">${o.both.length}</b> จาก ${o.union} รายงานรวม (${pct}%) · สมาชิก ${members(role.id).length} กับ ${members(other.id).length} คน</span>
      </div>
      ${pct >= 60 ? `<div class="note note-info">${ic('lightbulb')}<span>สองกลุ่มนี้ใช้รายงานเกือบเหมือนกัน ถ้าเป็นงานเดียวกัน อาจย้ายสมาชิกมารวมกลุ่มเดียวแล้วลบอีกกลุ่ม จะดูแลสิทธิ์ได้ง่ายขึ้น</span></div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        ${col(`เฉพาะ ${esc(role.name)}`, o.onlyA, '')}
        ${col('มีทั้งสองกลุ่ม', o.both, '')}
        ${col(`เฉพาะ ${esc(other.name)}`, o.onlyB, '')}
      </div>
      <span class="hint">ดูอย่างเดียว ไม่เปลี่ยนสิทธิ์ ถ้าจะแก้ ให้กลับไปแท็บรายงานที่อนุญาต</span>
    </div>`;
}

function roEditList(role) {
  const r = S.ro, q = r.editQ.trim().toLowerCase();
  const all = REPORTS.filter(x => x.active || MAP[role.id]?.has(x.id)).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const shown = all.filter(x => !q || x.name.toLowerCase().includes(q));
  const orig = MAP[role.id] || new Set();
  const add = [...r.editSel].filter(id => !orig.has(id)).length;
  const del = [...orig].filter(id => !r.editSel.has(id)).length;
  const shownSel = shown.filter(x => r.editSel.has(x.id)).length;
  return `<div class="toolbar" style="border-radius:0">
      <div class="search" style="flex:1 1 200px;max-width:300px">${ic('search')}<input id="ro-eq" class="input" placeholder="ค้นหารายงาน" value="${esc(r.editQ)}" data-in="roEQ" aria-label="ค้นหารายงานที่จะเลือก"></div>
      <button class="btn btn-sm" data-a="roEditShown" data-id="1" ${shownSel === shown.length ? 'disabled' : ''}>เลือกที่แสดงอยู่ (${shown.length})</button>
      <button class="btn btn-sm btn-ghost" data-a="roEditShown" data-id="0" ${shownSel ? '' : 'disabled'}>ไม่เลือกที่แสดงอยู่</button>
    </div>
    ${groupByCat(shown).map(g => {
      const n = g.items.length, on = g.items.filter(x => r.editSel.has(x.id)).length;
      return `<div class="grp-head">${catChip(g.id)}<button class="btn btn-sm btn-ghost" data-a="roEditCat" data-id="${g.id == null ? 'none' : g.id}">${on === n ? `ไม่เลือกทั้ง ${n} รายงานในหมวดนี้` : `เลือก ${n} รายงานในหมวดนี้`}</button></div>
        ${g.items.map(x => {
          const sel = r.editSel.has(x.id), was = orig.has(x.id);
          return `<label class="edit-row"><input type="checkbox" data-ch="roEditPick" data-id="${x.id}" ${sel ? 'checked' : ''}><span class="${x.active ? '' : 'muted'}">${esc(x.name)}</span>${x.active ? '' : '<span class="tag">ปิดใช้งาน</span>'}
            ${sel !== was ? `<span class="delta ${sel ? 'delta-add' : 'delta-del'}">${sel ? '+ จะเพิ่ม' : '− จะถอน'}</span>` : ''}</label>`;
        }).join('')}`;
    }).join('') || `<div class="empty">ไม่พบรายงาน “${esc(r.editQ)}”</div>`}
    <div class="drawer-foot" style="position:sticky;bottom:0;border-radius:0 0 12px 12px">
      <span class="grow sub">${add + del ? `<span class="delta-add">เพิ่ม ${add}</span> · <span class="delta-del">ถอน ${del}</span> · กระทบสมาชิก ${members(role.id).length} คน` : 'ยังไม่มีการเปลี่ยนแปลง'}</span>
      <button class="btn" data-a="roEditCancel">ยกเลิก</button><button class="btn btn-primary" data-a="roEditSave" ${add + del ? '' : 'disabled'}>บันทึก</button></div>`;
}

function roResetDraft() {
  Object.assign(S.ro, { editing: false, editRoleId: null, editSel: null, editQ: '' });
}
function roDraftBlocksChange() {
  if (!S.ro.editing) return false;
  toast('บันทึกหรือยกเลิกการแก้ไขรายงานก่อนเปลี่ยนกลุ่มหรือออกจากหน้านี้', 'info');
  render();
  return true;
}
PAGE_GUARDS.roles = () => !roDraftBlocksChange();
INP.roLQ = t => { S.ro.listQ = t.value; render(); };
A.roSel = t => {
  if (S.ro.editing) { toast('บันทึกหรือยกเลิกการแก้ไขรายงานก่อนเปลี่ยนกลุ่ม', 'info'); render(); return; }
  S.ro.sel = +t.dataset.id; S.ro.cmp = null;
  if (roleOf(S.ro.sel).admin && S.ro.tab === 'compare') S.ro.tab = 'reports';
  render();
};
A.roTab = t => { if (S.ro.editing) { toast('บันทึกหรือยกเลิกการแก้ไขก่อน', 'info'); render(); return; } S.ro.tab = t.dataset.id; render(); };
A.roRename = t => { const role = roleOf(+t.dataset.id); openDialog({ kind: 'roleName', id: role.id, name: role.name, err: '' }, t); };
A.roDelete = t => { if (roDraftBlocksChange()) return; const id = +t.dataset.id; openDialog(members(id).length ? { kind: 'roleDelBlocked', id } : { kind: 'roleDel', id }, t); };
A.roEdit = () => { const r = S.ro; r.editing = true; r.editRoleId = r.sel; r.editSel = new Set(MAP[r.editRoleId] || []); r.editQ = ''; S.focusId = 'ro-eq'; render(); };
A.roEditCancel = () => { roResetDraft(); render(); };
INP.roEQ = t => { S.ro.editQ = t.value; render(); };
CHG.roEditPick = t => { const id = +t.dataset.id; t.checked ? S.ro.editSel.add(id) : S.ro.editSel.delete(id); S.focusId = null; render(); };
A.roEditCat = t => {
  const k = t.dataset.id, r = S.ro, q = r.editQ.trim().toLowerCase();
  const items = REPORTS.filter(x => (k === 'none' ? x.cat == null : String(x.cat) === k) && (x.active || MAP[r.sel]?.has(x.id)) && (!q || x.name.toLowerCase().includes(q)));
  const allOn = items.every(x => r.editSel.has(x.id));
  items.forEach(x => allOn ? r.editSel.delete(x.id) : r.editSel.add(x.id));
  render();
};
A.roEditShown = t => {
  const r = S.ro, q = r.editQ.trim().toLowerCase();
  REPORTS.filter(x => (x.active || MAP[r.sel]?.has(x.id)) && (!q || x.name.toLowerCase().includes(q))).forEach(x => t.dataset.id === '1' ? r.editSel.add(x.id) : r.editSel.delete(x.id));
  render();
};
A.roEditSave = () => {
  const r = S.ro, role = roleOf(r.editRoleId);
  if (!r.editing || !role || !r.editSel) return;
  MAP[role.id] = new Set(r.editSel);
  roResetDraft();
  toast(`บันทึกรายงานของกลุ่ม ${role.name} แล้ว`); render();
};
A.roOpenUser = t => usOpenDrawer(userOf(+t.dataset.id), t);
A.roToUsers = () => { Object.assign(S.us, { q: '', role: String(S.ro.sel), kind: 'all', status: 'all', page: 1 }); go('users'); };

/* ---------------- dialogs ---------------- */
A.roAddMem = t => openDialog({ kind: 'addMem', wide: true, q: '', sel: new Set() }, t);
DIALOGS.addMem = d => {
  const role = roleOf(S.ro.sel);
  const q = d.q.trim().toLowerCase();
  const cands = USERS.filter(u => u.role !== role.id && (!q || `${u.name} ${u.user}`.toLowerCase().includes(q)));
  d.dirty = d.sel.size > 0;
  return `<div class="dialog-head"><div class="dialog-ico">${ic('user-plus')}</div><div class="grow"><h2 id="dlg-title">เพิ่มสมาชิกในกลุ่ม ${esc(role.name)}</h2><div class="sub">ผู้ใช้ 1 คนอยู่ได้ 1 กลุ่ม คนที่เลือกจะย้ายออกจากกลุ่มเดิม</div></div>
      <button class="icon-btn" data-a="dlgClose" aria-label="ปิด">${ic('x')}</button></div>
    <div class="dialog-body" style="gap:12px">
      <div class="search">${ic('search')}<input id="am-q" class="input" placeholder="ค้นหาชื่อหรือ username" value="${esc(d.q)}" data-in="amQ" aria-label="ค้นหาผู้ใช้" data-autofocus></div>
      <div class="card" style="box-shadow:none;max-height:320px;overflow:auto">${cands.length ? cands.map(u => `<label class="edit-row" style="padding:9px 14px;${u.me ? 'cursor:not-allowed;opacity:.6' : ''}"><input type="checkbox" data-ch="amPick" data-id="${u.id}" ${d.sel.has(u.id) ? 'checked' : ''} ${u.me ? 'disabled' : ''}>
          <span class="avatar" style="width:28px;height:28px;font-size:11.5px">${initials(u.name)}</span><span class="grow stack" style="gap:0"><span>${esc(u.name)}${u.me ? ' <span class="tag tag-me">คุณ</span>' : ''}</span><span class="sub">@${esc(u.user)}${u.me ? ' · ย้ายกลุ่มของตัวเองไม่ได้' : ''}</span></span>
          <span class="sub" style="white-space:nowrap">ตอนนี้: ${esc(roleOf(u.role).name)}</span></label>`).join('') : '<div class="empty" style="padding:20px">ไม่พบผู้ใช้</div>'}</div>
      ${d.sel.size ? `<div class="note">${ic('info')}<span>${d.sel.size} คนจะย้ายมากลุ่ม ${esc(role.name)} และต้องเข้าสู่ระบบใหม่ บริษัทที่เข้าถึงได้ของแต่ละคนไม่เปลี่ยน</span></div>` : ''}
    </div>
    <div class="dialog-foot">${d.confirm ? `<div class="confirm-bar grow">${ic('triangle-alert')}<span class="grow">ยังไม่ได้ย้ายผู้ใช้ ทิ้งรายการที่เลือกไหม?</span><button class="btn btn-sm" data-a="dlgKeep" data-autofocus>เลือกต่อ</button><button class="btn btn-sm btn-danger" data-a="dlgDiscard">ทิ้ง</button></div>`
      : `<button class="btn" data-a="dlgClose">ยกเลิก</button><button class="btn btn-primary" data-a="amOk" ${d.sel.size ? '' : 'disabled'}>ย้าย ${d.sel.size || ''} คนมากลุ่มนี้</button>`}</div>`;
};
INP.amQ = t => { S.dialog.q = t.value; render(); };
CHG.amPick = t => { const id = +t.dataset.id; t.checked ? S.dialog.sel.add(id) : S.dialog.sel.delete(id); S.focusId = null; render(); };
A.amOk = () => { const n = S.dialog.sel.size, role = roleOf(S.ro.sel); S.dialog.sel.forEach(id => { userOf(id).role = role.id; }); toast(`ย้าย ${n} คนมากลุ่ม ${role.name} แล้ว`); closeDialog(true); };

A.roAdd = t => { if (roDraftBlocksChange()) return; openDialog({ kind: 'roleAdd', name: '', copy: '', err: '' }, t); };
DIALOGS.roleAdd = d => `<div class="dialog-head"><div class="dialog-ico">${ic('shield-check')}</div><div><h2 id="dlg-title">เพิ่มกลุ่มสิทธิ์</h2><div class="sub">ตั้งชื่อตามกลุ่มคนที่ใช้รายงานชุดเดียวกัน</div></div></div>
  <div class="dialog-body">
    <div class="field"><label class="label" for="rl-name">ชื่อกลุ่ม<span class="req" aria-hidden="true">*</span></label><input id="rl-name" class="input ${d.err ? 'invalid' : ''}" value="${esc(d.name)}" maxlength="50" placeholder="เช่น ผู้ใช้รายงานบัญชี" data-in="rlName" data-autofocus>${d.err ? `<span class="err">${ic('circle-alert')}${esc(d.err)}</span>` : '<span class="hint">ไม่เกิน 50 ตัวอักษร ห้ามซ้ำกับกลุ่มที่มี</span>'}</div>
    <div class="field"><span class="label" id="rl-copy-lbl">เริ่มจากรายงานของกลุ่ม ${NEW}</span>${dd('rl-copy', { labelledby: 'rl-copy-lbl', value: d.copy, showMeta: true, search: true, searchPlaceholder: 'ค้นหากลุ่ม', onPick: v => { S.dialog.copy = v; },
      options: [{ v: '', label: 'ไม่คัดลอก', meta: 'เริ่มจากกลุ่มว่าง แล้วเลือกรายงานเอง', icon: 'file-plus' }, { sep: true }, { group: 'คัดลอกรายงานจาก' },
        ...ROLES.filter(x => !x.admin).map(x => ({ v: String(x.id), label: x.name, initials: initials(x.name), meta: `${roleReports(x.id).length} รายงาน · ${members(x.id).length} คน` }))] })}</div>
  </div>
  <div class="dialog-foot"><button class="btn" data-a="dlgClose">ยกเลิก</button><button class="btn btn-primary" data-a="rlAddOk">เพิ่มกลุ่ม</button></div>`;
INP.rlName = t => { S.dialog.name = t.value; if (S.dialog.err) { S.dialog.err = ''; render(); } };
function roleNameErr(name, selfId) {
  const n = name.trim();
  if (!n) return 'กรอกชื่อกลุ่ม';
  if (n.toLowerCase() === 'admin' && selfId !== 1) return 'ชื่อ Admin สงวนไว้สำหรับผู้ดูแลระบบ';
  if (ROLES.some(x => x.name.toLowerCase() === n.toLowerCase() && x.id !== selfId)) return `มีกลุ่ม “${n}” อยู่แล้ว`;
  return '';
}
A.rlAddOk = () => {
  const d = S.dialog, err = roleNameErr(d.name);
  if (err) { d.err = err; S.focusId = 'rl-name'; render(); return; }
  const id = Math.max(...ROLES.map(x => x.id)) + 1;
  ROLES.push({ id, name: d.name.trim() });
  MAP[id] = new Set(d.copy ? MAP[+d.copy] : []);
  roResetDraft();
  S.ro.sel = id; S.ro.tab = 'reports';
  toast(`เพิ่มกลุ่ม “${d.name.trim()}” แล้ว`); closeDialog(true);
};
DIALOGS.roleName = d => `<div class="dialog-head"><div class="dialog-ico">${ic('pencil')}</div><div><h2 id="dlg-title">เปลี่ยนชื่อกลุ่ม</h2><div class="sub">สมาชิก ${members(d.id).length} คนจะเห็นชื่อใหม่เมื่อเข้าสู่ระบบครั้งถัดไป</div></div></div>
  <div class="dialog-body"><div class="field"><label class="label" for="rn-name">ชื่อกลุ่ม<span class="req" aria-hidden="true">*</span></label><input id="rn-name" class="input ${d.err ? 'invalid' : ''}" value="${esc(d.name)}" maxlength="50" data-in="rnName" data-autofocus>${d.err ? `<span class="err">${ic('circle-alert')}${esc(d.err)}</span>` : ''}</div></div>
  <div class="dialog-foot"><button class="btn" data-a="dlgClose">ยกเลิก</button><button class="btn btn-primary" data-a="rnOk">บันทึก</button></div>`;
INP.rnName = t => { S.dialog.name = t.value; if (S.dialog.err) { S.dialog.err = ''; render(); } };
A.rnOk = () => {
  const d = S.dialog, err = roleNameErr(d.name, d.id);
  if (err) { d.err = err; S.focusId = 'rn-name'; render(); return; }
  roleOf(d.id).name = d.name.trim(); toast('เปลี่ยนชื่อกลุ่มแล้ว'); closeDialog(true);
};
DIALOGS.roleDelBlocked = d => {
  const role = roleOf(d.id), n = members(d.id).length;
  return `<div class="dialog-head"><div class="dialog-ico">${ic('users')}</div><div><h2 id="dlg-title">ลบกลุ่ม “${esc(role.name)}” ยังไม่ได้</h2></div></div>
    <div class="dialog-body"><p>กลุ่มนี้ยังมีสมาชิก ${n} คน ย้ายสมาชิกไปกลุ่มอื่นก่อน แล้วจึงลบกลุ่มได้</p></div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose">ปิด</button><button class="btn btn-primary" data-a="roGoMembers" data-autofocus>ดูสมาชิก ${n} คน</button></div>`;
};
A.roGoMembers = () => { S.ro.tab = 'members'; roResetDraft(); closeDialog(true); };
DIALOGS.roleDel = d => {
  const role = roleOf(d.id);
  return `<div class="dialog-head"><div class="dialog-ico is-bad">${ic('trash-2')}</div><div><h2 id="dlg-title">ลบกลุ่ม “${esc(role.name)}”?</h2></div></div>
    <div class="dialog-body"><p>กลุ่มนี้ไม่มีสมาชิก สิทธิ์รายงาน ${roleReports(role.id, { includeOff: true }).length} รายการของกลุ่มจะถูกลบ รายงานไม่ถูกลบ</p></div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ยกเลิก</button><button class="btn btn-danger" data-a="rdOk">ลบกลุ่ม</button></div>`;
};
A.rdOk = () => {
  const id = S.dialog.id, name = roleOf(id).name;
  ROLES = ROLES.filter(x => x.id !== id); delete MAP[id];
  if (S.ro.sel === id) S.ro.sel = ROLES[1] ? ROLES[1].id : ROLES[0].id;
  toast(`ลบกลุ่ม “${name}” แล้ว`); closeDialog(true);
};
