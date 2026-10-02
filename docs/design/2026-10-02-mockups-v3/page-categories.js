/* Page: หมวดรายงาน (categories). */
PAGE_META.categories = { group: 'จัดการรายงาน', title: 'หมวดรายงาน' };

const catReports = id => REPORTS.filter(r => id === 'none' ? (r.cat == null || !catOf(r.cat)) : r.cat === id);

PAGES.categories = () => {
  const c = S.ct;
  if (c.sel !== 'none' && !catOf(c.sel)) c.sel = CATS[0] ? CATS[0].id : 'none';
  const uncats = catReports('none');
  const head = pageHead('หมวดรายงาน', 'จัดรายงานเป็นกลุ่มเพื่อให้ค้นหาง่าย หมวดไม่เกี่ยวกับสิทธิ์การเข้าถึง',
    `<button class="btn btn-primary" data-a="ctAdd">${ic('plus')}เพิ่มหมวด</button>`);

  const listItem = (id, name, dotHex, items) => {
    const act = items.filter(r => r.active).length;
    return `<button class="li" data-a="ctSel" data-id="${id}" ${c.edit?.id !== 'new' && String(c.sel) === String(id) ? 'aria-current="true"' : ''}>
      ${dotHex ? `<span class="dot" style="--dot:${dotHex};width:10px;height:10px"></span>` : ic('inbox')}
      <span class="grow"><span class="li-name" style="display:block">${esc(name)}</span></span>
      <span class="count" title="ใช้งาน ${act} จากทั้งหมด ${items.length}">${act}</span></button>`;
  };
  const list = `<section class="card" aria-label="รายการหมวด">
    <div class="card-head"><h2>หมวด <span class="muted tnum" style="font-weight:500">${CATS.length}</span></h2><span class="sub">จำนวนรายงานที่ใช้งาน</span></div>
    <div class="list">${CATS.map(x => listItem(x.id, x.name, COLORS[x.color].hex, catReports(x.id))).join('')}
      <div class="list-sep"></div>
      ${listItem('none', 'ยังไม่จัดหมวด', null, uncats)}
    </div>
    <div class="foot" style="justify-content:flex-start;flex-wrap:nowrap;align-items:flex-start">${ic('info')}<span>หมวดใช้จัดรายการเพื่อค้นหา การย้ายหมวดไม่เพิ่มหรือถอนสิทธิ์ใคร</span></div>
  </section>`;

  return head + `<div class="split">${list}${ctPanel()}</div>`;
};

function ctEditForm() {
  const e = S.ct.edit;
  const isNew = e.id === 'new';
  return `<form class="card-pad stack" style="gap:14px;${isNew ? '' : 'border-bottom:1px solid var(--line);background:var(--surface-2)'}" onsubmit="return false" aria-label="${isNew ? 'เพิ่มหมวด' : 'แก้ไขหมวด'}">
    ${isNew ? '' : '<h3 style="margin:0;font-size:14px;font-weight:650">แก้ไขชื่อและสี</h3>'}
    <div class="field" style="max-width:420px"><label class="label" for="ct-name">ชื่อหมวด<span class="req" aria-hidden="true">*</span></label>
      <input id="ct-name" class="input ${e.err ? 'invalid' : ''}" value="${esc(e.name)}" maxlength="100" placeholder="เช่น การเงินและบัญชี" data-in="ctName" data-kd="ctName" ${e.err ? 'aria-invalid="true" aria-describedby="ct-err"' : ''} data-autofocus>
      ${e.err ? `<span class="err" id="ct-err">${ic('circle-alert')}${esc(e.err)}</span>` : '<span class="hint">ตั้งตามเนื้อหารายงาน ไม่ใช่ชื่อแผนกหรือกลุ่มผู้ใช้</span>'}</div>
    <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:6px">สี</legend>
      <div class="swatches">${Object.entries(COLORS).map(([k, v]) => `<input type="radio" class="swatch-input" name="ct-color" id="sw-${k}" value="${k}" ${e.color === k ? 'checked' : ''} data-ch="ctColor"><label class="swatch" for="sw-${k}"><span class="dot" style="--dot:${v.hex}"></span>${v.name}${e.color === k ? ic('check') : ''}</label>`).join('')}</div></fieldset>
    <div class="row"><span class="sub">ตัวอย่าง</span><span class="chip"><span class="dot" style="--dot:${COLORS[e.color].hex}"></span><span>${esc(e.name || 'ชื่อหมวด')}</span></span><span class="grow"></span>
      <button type="button" class="btn" data-a="ctCancel">ยกเลิก</button><button type="button" class="btn btn-primary" data-a="ctSave">${isNew ? 'เพิ่มหมวด' : 'บันทึก'}</button></div>
  </form>`;
}

function ctPanel() {
  const c = S.ct;
  if (c.edit?.id === 'new') return `<section class="card" aria-label="สร้างหมวดรายงาน">
    <div class="panel-head"><div class="stack" style="gap:4px"><h2>${ic('folder-plus')}สร้างหมวดรายงาน</h2><span class="sub">ตั้งชื่อและสีของหมวดใหม่ แล้วกำหนดรายงานเข้าหมวดหลังบันทึก</span></div></div>
    ${ctEditForm()}
  </section>`;
  const isNone = c.sel === 'none';
  const cat = isNone ? null : catOf(c.sel);
  const items = catReports(c.sel);
  const act = items.filter(r => r.active).length;
  const off = items.length - act;
  const editingThis = c.edit && c.edit.id === c.sel;
  const title = isNone ? `${ic('inbox')}ยังไม่จัดหมวด` : `<span class="dot" style="--dot:${COLORS[cat.color].hex};width:12px;height:12px"></span>หมวดรายงาน: ${esc(cat.name)}`;
  const meta = `${act} รายงานที่ใช้งาน${off ? ` · ปิดใช้งาน ${off}` : ''}`;
  const actions = isNone
    ? `<button class="btn" data-a="ctOpenReg">${ic('arrow-up-right')}เปิดในทะเบียนรายงาน</button>`
    : `<button class="btn" data-a="ctEdit">${ic('pencil')}แก้ไขชื่อและสี</button>
       <button class="btn btn-primary" data-a="ctOpenReg">${ic('arrow-up-right')}เปิดในทะเบียนรายงาน</button>
       <button class="btn btn-danger-ghost" data-a="ctDel" data-id="${cat.id}">${ic('trash-2')}ลบหมวด</button>`;
  let body;
  if (!items.length) {
    body = `<div class="empty" style="border-top:1px solid var(--line)">${ic('folder-open')}<h3>ยังไม่มีรายงานในหมวดนี้</h3>
      <p>กำหนดหมวดได้ที่หน้าแก้ไขรายงาน โดยเลือกหมวด “${esc(cat ? cat.name : '')}”</p>
      ${catReports('none').length ? `<button class="btn btn-sm" data-a="ctSel" data-id="none">ดูรายงานที่ยังไม่จัดหมวด (${catReports('none').length})</button>` : ''}</div>`;
  } else {
    body = `<div class="rows">${items.map(r => `<div class="r">
      <div class="grow stack" style="gap:2px"><div class="row" style="gap:8px"><span class="cell-name" style="${r.active ? '' : 'color:var(--fg-3)'}">${esc(r.name)}</span>${r.heavy ? heavyTag() : ''}</div>
        <div class="row" style="gap:8px;flex-wrap:nowrap"><span class="rid">${rid(r.id)}</span><span class="sub">${typeName(r.type)}</span>${r.desc ? `<span class="sub clamp hide-sm">${esc(r.desc)}</span>` : ''}</div></div>
      ${stReport(r)}
      <button class="btn btn-sm btn-ghost" data-a="demo" data-msg="หน้าแก้ไขรายงานไม่อยู่ในชุดนี้ — เปลี่ยนหมวดได้ที่ช่อง “หมวดรายงาน”">${isNone ? 'กำหนดหมวด' : 'แก้ไขรายงาน'}</button>
    </div>`).join('')}</div>`;
  }
  return `<section class="card" aria-label="รายงานในหมวด">
    ${editingThis ? ctEditForm() : ''}
    <div class="panel-head"><div class="stack" style="gap:4px"><h2>${title}</h2><span class="sub">${meta}${isNone ? ` · ${NEW} มุมมองนี้ไม่ใช่หมวดจริง แก้ชื่อหรือลบไม่ได้` : ''}</span></div>
      <div class="actions">${actions}${!isNone ? '' : ''}</div></div>
    ${isNone ? `<div style="padding:0 20px 14px"><div class="note note-info">${ic('info')}<span>รายงานเหล่านี้ค้นหาในหน้ารายงานมาตรฐานได้ตามปกติ แต่จะอยู่ท้ายรายการ เลือกหมวดให้ได้ที่หน้าแก้ไขรายงาน</span></div></div>` : ''}
    ${body}
  </section>`;
}

A.noop = () => { };
function ctDraftDirty() {
  const e = S.ct.edit;
  if (!e) return false;
  const original = e.id === 'new' ? { name: '', color: 'blue' } : catOf(e.id);
  return !original || e.name !== original.name || e.color !== original.color;
}
function ctRequestLeave(proceed, trigger) {
  if (!ctDraftDirty()) return true;
  openDialog({ kind: 'ctDiscardDraft', proceed }, trigger);
  return false;
}
function ctAfterDraft(proceed, trigger) {
  if (!ctRequestLeave(proceed, trigger)) return;
  S.ct.edit = null;
  proceed();
}
PAGE_GUARDS.categories = proceed => {
  if (!ctRequestLeave(proceed)) return false;
  S.ct.edit = null;
  return true;
};
DIALOGS.ctDiscardDraft = () => `<div class="dialog-head"><div class="dialog-ico">${ic('triangle-alert')}</div><div><h2 id="dlg-title">ทิ้งการแก้ไขหมวด?</h2></div></div>
  <div class="dialog-body"><p>ชื่อและสีที่แก้ไว้ยังไม่ได้บันทึก เลือกแก้ไขต่อเพื่อเก็บข้อมูลที่กรอกไว้</p></div>
  <div class="dialog-foot"><button class="btn" data-a="ctKeepDraft" data-autofocus>แก้ไขต่อ</button><button class="btn btn-danger" data-a="ctDiscardDraft">ทิ้งการแก้ไข</button></div>`;
A.ctKeepDraft = () => { S.focusId = 'ct-name'; closeDialog(); };
A.ctDiscardDraft = () => {
  const proceed = S.dialog.proceed;
  S.ct.edit = null;
  closeDialog(true);
  proceed();
};
A.ctSel = t => {
  const v = t.dataset.id, id = v === 'none' ? 'none' : +v;
  if (id === S.ct.sel) return;
  ctAfterDraft(() => { S.ct.sel = id; render(); }, t);
};
A.ctAdd = t => {
  if (S.ct.edit?.id === 'new') { S.focusId = 'ct-name'; render(); return; }
  ctAfterDraft(() => { S.ct.edit = { id: 'new', name: '', color: 'blue', err: '' }; S.focusId = 'ct-name'; render(); }, t);
};
A.ctEdit = t => {
  if (S.ct.edit?.id === S.ct.sel) { S.focusId = 'ct-name'; render(); return; }
  ctAfterDraft(() => { const cat = catOf(S.ct.sel); S.ct.edit = { id: cat.id, name: cat.name, color: cat.color, err: '' }; S.focusId = 'ct-name'; render(); }, t);
};
A.ctCancel = t => ctAfterDraft(() => render(), t);
INP.ctName = t => { S.ct.edit.name = t.value; if (S.ct.edit.err) { S.ct.edit.err = ''; render(); } };
KD.ctName = e => { if (e.key === 'Enter') { e.preventDefault(); A.ctSave(); return true; } if (e.key === 'Escape') { A.ctCancel(); return true; } return false; };
CHG.ctColor = t => { S.ct.edit.color = t.value; S.focusId = t.id; render(); };
A.ctSave = () => {
  const e = S.ct.edit;
  if (e.saving) return;
  const name = e.name.trim();
  if (!name) { e.err = 'กรอกชื่อหมวด'; S.focusId = 'ct-name'; render(); return; }
  if (CATS.some(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== e.id)) { e.err = `มีหมวด “${name}” อยู่แล้ว`; S.focusId = 'ct-name'; render(); return; }
  if (e.id === 'new') { const id = Math.max(0, ...CATS.map(x => x.id)) + 1; CATS.push({ id, name, color: e.color }); S.ct.sel = id; toast(`เพิ่มหมวด “${name}” แล้ว`); }
  else { Object.assign(catOf(e.id), { name, color: e.color }); toast('บันทึกหมวดแล้ว'); }
  S.ct.edit = null; render();
};
A.ctOpenReg = t => ctAfterDraft(() => { Object.assign(S.rp, { q: '', type: 'all', status: 'all', cat: S.ct.sel === 'none' ? 'none' : String(S.ct.sel), from: 'categories' }); go('reports'); }, t);
A.ctDel = t => ctAfterDraft(() => openDialog({ kind: 'delCat', id: +t.dataset.id }, t), t);
DIALOGS.delCat = d => {
  const cat = catOf(d.id);
  const items = catReports(d.id);
  const act = items.filter(r => r.active).length;
  return `<div class="dialog-head"><div class="dialog-ico is-bad">${ic('trash-2')}</div><div><h2 id="dlg-title">ลบหมวด “${esc(cat.name)}”?</h2></div></div>
    <div class="dialog-body">
      <p>${items.length ? `รายงาน <b>${items.length} รายการ</b> (ใช้งาน ${act} · ปิดใช้งาน ${items.length - act}) จะย้ายไปอยู่ใน “ยังไม่จัดหมวด”` : 'หมวดนี้ไม่มีรายงาน'}</p>
      <div class="note">${ic('shield-check')}<span>ไม่มีรายงานถูกลบ และสิทธิ์การเข้าถึงของทุกกลุ่มไม่เปลี่ยน</span></div>
    </div>
    <div class="dialog-foot"><button class="btn" data-a="dlgClose" data-autofocus>ยกเลิก</button><button class="btn btn-danger" data-a="ctDelOk">ลบหมวด</button></div>`;
};
A.ctDelOk = () => {
  const id = S.dialog.id, name = catOf(id).name;
  REPORTS.forEach(r => { if (r.cat === id) r.cat = null; });
  CATS = CATS.filter(x => x.id !== id);
  S.ct.sel = 'none'; S.ct.edit = null;
  toast(`ลบหมวด “${name}” แล้ว รายงานย้ายไปยังไม่จัดหมวด`);
  closeDialog();
};
