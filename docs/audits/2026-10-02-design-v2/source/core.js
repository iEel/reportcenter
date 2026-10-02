/* ReportCenter mockup v2 — state, helpers, shell, overlays and event wiring. */

const PAGES = {};          // page id -> render fn
const PAGE_META = {};      // page id -> { group, title }
const A = {};              // click actions: data-a
const INP = {};            // input handlers: data-in
const CHG = {};            // change handlers: data-ch
const KD = {};             // keydown handlers: data-kd
const DIALOGS = {};        // dialog kind -> render fn
const DRAWERS = {};        // drawer kind -> render fn

const S = {
  page: 'standard', navOpen: false, dd: null, drawer: null, dialog: null, notesOpen: false, toast: null,
  focusId: null, returnSel: null, justOpened: false,
  std: { id: null, q: '', open: false, hi: 0, company: '1', params: {}, errors: {}, phase: 'idle', page: 1, job: null, favs: new Set([1028, 12]), recent: [16, 27, 31, 1027] },
  rp: { q: '', cat: 'all', type: 'all', status: 'all', sel: new Set(), from: null },
  ct: { sel: 1, edit: null },
  us: { q: '', role: 'all', kind: 'all', status: 'all', page: 1 },
  ro: { sel: 2, tab: 'reports', editing: false, editSel: null, editQ: '', listQ: '', cmp: null },
};

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<i data-lucide="${n}" class="${cls}" aria-hidden="true"></i>`;
const NEW = '<span class="pill-new">ใหม่</span>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const catOf = id => CATS.find(c => c.id === id);
const catName = id => id == null ? 'ยังไม่จัดหมวด' : (catOf(id)?.name ?? '');
const roleOf = id => ROLES.find(r => r.id === id);
const userOf = id => USERS.find(u => u.id === id);
const repOf = id => REPORTS.find(r => r.id === id);
const coOf = id => COMPANIES.find(c => c.id === id);
const rid = id => 'RID-' + String(id).padStart(4, '0');
const fmt = n => n.toLocaleString('th-TH');
const money = n => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const initials = name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const typeName = t => t === 1 ? 'มาตรฐาน' : 'Template';
const members = roleId => USERS.filter(u => u.role === roleId);
const reportRoles = repId => ROLES.filter(r => !r.admin && MAP[r.id]?.has(repId));
function roleReports(roleId, { includeOff = false } = {}) {
  const r = roleOf(roleId);
  if (r.admin) return REPORTS.filter(x => x.active);
  const set = MAP[roleId] || new Set();
  return REPORTS.filter(x => set.has(x.id) && (includeOff || x.active));
}
function catChip(id) {
  if (id == null) return '<span class="chip chip-dashed"><span>ยังไม่จัดหมวด</span></span>';
  const c = catOf(id);
  return `<span class="chip"><span class="dot" style="--dot:${COLORS[c.color].hex}"></span><span>${esc(c.name)}</span></span>`;
}
const stReport = r => r.active ? '<span class="st st-ok">ใช้งาน</span>' : '<span class="st st-off">ปิดใช้งาน</span>';
const stUser = u => u.active ? '<span class="st st-ok">ใช้งาน</span>' : '<span class="st st-off">ระงับ</span>';
const kindTag = u => u.kind === 'ad' ? `<span class="tag tag-ad">${ic('network')}AD</span>` : `<span class="tag">${ic('key-round')}Local</span>`;
const heavyTag = () => `<span class="tag tag-warn">${ic('database')}ขนาดใหญ่</span>`;
function groupByCat(list) {
  const groups = CATS.map(c => ({ id: c.id, items: list.filter(r => r.cat === c.id) }));
  groups.push({ id: null, items: list.filter(r => r.cat == null || !catOf(r.cat)) });
  return groups.filter(g => g.items.length);
}
function seeded(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* storage unavailable */ } },
};

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, kind = 'ok') {
  S.toast = { msg, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; render(); }, 2800);
}
function demo(msg) { toast(msg || 'หน้านี้ไม่อยู่ใน mockup ชุดนี้', 'info'); render(); }

/* ---------- navigation ---------- */
function go(page, opts = {}) {
  if (!PAGES[page]) return;
  S.page = page; S.dd = null; S.navOpen = false; S.notesOpen = false;
  if (location.hash.slice(1) !== page) { try { history.replaceState(null, '', '#' + page); } catch (_) { location.hash = page; } }
  if (!opts.keepScroll) window.scrollTo(0, 0);
  S.focusId = 'page-title';
  render();
}

/* ---------- overlays ---------- */
function selectorFor(el) {
  if (!el || !el.dataset) return null;
  let s = '';
  for (const k of ['a', 'id', 'kind']) if (el.dataset[k] != null) s += `[data-${k}="${CSS.escape(el.dataset[k])}"]`;
  return s || (el.id ? '#' + CSS.escape(el.id) : null);
}
function openDialog(d, trigger) { S.returnSel = S.returnSel || selectorFor(trigger); S.dialog = d; S.dd = null; S.justOpened = true; render(); }
function closeDialog(force) {
  const d = S.dialog;
  if (!force && d && d.dirty && !d.confirm) { d.confirm = true; render(); return; }
  S.dialog = null; restoreFocus(); render();
}
function openDrawer(d, trigger) { S.returnSel = selectorFor(trigger); S.drawer = d; S.dd = null; S.justOpened = true; render(); }
function closeDrawer(force) {
  const d = S.drawer;
  if (!force && d && d.dirty && !d.confirm) { d.confirm = true; render(); return; }
  S.drawer = null; restoreFocus(); render();
}
let pendingReturn = null;
function restoreFocus() { pendingReturn = S.returnSel; S.returnSel = null; }
/* ---------- rich dropdown (replaces native <select>) ----------
   dd(id, cfg) renders the trigger; options: { v, label, short, meta, dot, code, icon, lock, count, group, sep, disabled } */
const DD = {};
function ddLead(o) {
  if (o.dot) return `<span class="dot" style="--dot:${o.dot}"></span>`;
  if (o.code) return `<span class="co">${esc(o.code)}</span>`;
  if (o.lock) return `<span class="dd-icon">${LOCK_SVG.replace('<svg', '<svg width="14" height="14"')}</span>`;
  if (o.icon) return `<span class="dd-icon">${ic(o.icon)}</span>`;
  if (o.initials) return `<span class="dd-icon dd-ini">${esc(o.initials)}</span>`;
  return '';
}
function dd(id, cfg) {
  DD[id] = cfg;
  const cur = cfg.options.find(o => !o.sep && !o.group && String(o.v) === String(cfg.value));
  const isAll = cfg.filter && String(cfg.value) === String(cfg.allValue ?? 'all');
  const open = !!(S.dd && S.dd.id === id);
  const val = cur
    ? `${cfg.filter ? '' : ddLead(cur)}<span class="dd-l">${esc(cur.short || cur.label)}</span>${cfg.showMeta && cur.meta ? `<span class="dd-mi">${esc(cur.meta)}</span>` : ''}`
    : `<span class="dd-ph">${esc(cfg.placeholder || 'เลือก')}</span>`;
  const name = cfg.prefix ? `aria-label="${esc(cfg.prefix)}: ${esc(cur ? cur.label : cfg.placeholder || '')}"` : cfg.labelledby ? `aria-labelledby="${cfg.labelledby} dd-${id}"` : '';
  return `<button type="button" class="dd ${cfg.filter ? 'dd-filter' : ''} ${cfg.filter && !isAll ? 'is-active' : ''} ${cfg.invalid ? 'invalid' : ''} ${cfg.showMeta ? 'dd-tall' : ''}" id="dd-${id}" data-a="ddOpen" data-id="${id}" data-kd="ddTrig"
      aria-haspopup="listbox" aria-expanded="${open}" ${name} ${cfg.disabled ? 'aria-disabled="true"' : ''} ${cfg.describedby ? `aria-describedby="${cfg.describedby}"` : ''}>
    ${cfg.prefix ? `<span class="dd-prefix">${esc(cfg.prefix)}</span>` : ''}<span class="dd-value">${val}</span>${ic('chevron-down', 'dd-chev')}</button>`;
}
function ddVisible() {
  const s = S.dd, cfg = DD[s.id], q = s.q.trim().toLowerCase();
  const out = [];
  cfg.options.forEach(o => {
    if (o.sep || o.group) { out.push(o); return; }
    if (!q || `${o.label} ${o.meta || ''} ${o.code || ''}`.toLowerCase().includes(q)) out.push(o);
  });
  return out.filter((o, i) => {
    if (!o.sep && !o.group) return true;
    const rest = out.slice(i + 1);
    const nextItem = rest.findIndex(x => !x.sep && !x.group);
    if (nextItem < 0) return false;
    if (o.group) return rest.slice(0, nextItem).every(x => !x.group);
    return out.slice(0, i).some(x => !x.sep && !x.group) && rest.slice(0, nextItem).every(x => !x.sep);
  });
}
const ddPickable = () => ddVisible().filter(o => !o.sep && !o.group && !o.disabled);
function ddOpen(id, trigger) {
  const cfg = DD[id];
  if (!cfg || cfg.disabled) return;
  const r = trigger.getBoundingClientRect();
  const w = Math.min(Math.max(r.width, cfg.minWidth || 260), window.innerWidth - 16);
  let x = Math.min(r.left, window.innerWidth - w - 8); x = Math.max(8, x);
  const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
  const up = below < 280 && above > below;
  S.dd = { id, x, w, top: up ? null : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : null, maxH: Math.min(400, up ? above : below), q: '', hi: 0 };
  S.dd.hi = Math.max(0, ddPickable().findIndex(o => String(o.v) === String(cfg.value)));
  S.focusId = cfg.search ? 'dd-q' : 'dd-list';
  render();
  const el = document.getElementById('ddo-' + S.dd.hi); if (el) el.scrollIntoView({ block: 'nearest' });
}
function ddClose(returnFocus = true) { const id = S.dd && S.dd.id; S.dd = null; if (returnFocus && id) S.focusId = 'dd-' + id; render(); }
function ddHtml() {
  const s = S.dd, cfg = DD[s.id];
  if (!cfg) return '';
  let n = -1;
  const items = ddVisible().map(o => {
    if (o.sep) return '<div class="dd-sep" role="separator"></div>';
    if (o.group) return `<div class="dd-group" role="presentation">${esc(o.group)}</div>`;
    const body = `${ddLead(o)}<span class="grow" style="min-width:0"><span class="dd-l">${esc(o.label)}</span>${o.meta ? `<span class="dd-m">${esc(o.meta)}</span>` : ''}</span>`;
    if (o.disabled) return `<div class="dd-opt is-disabled" role="option" aria-disabled="true" aria-selected="false">${body}${o.why ? `<span class="dd-n">${esc(o.why)}</span>` : ''}</div>`;
    n++;
    const sel = String(o.v) === String(cfg.value);
    return `<div class="dd-opt ${n === s.hi ? 'is-hi' : ''}" role="option" id="ddo-${n}" aria-selected="${sel}" data-a="ddPick" data-idx="${n}">${body}
      ${o.count != null ? `<span class="dd-n">${esc(o.count)}</span>` : ''}<span class="dd-check">${sel ? ic('check') : ''}</span></div>`;
  }).join('');
  const pos = `left:${s.x}px;width:${s.w}px;${s.top != null ? `top:${s.top}px` : `bottom:${s.bottom}px`};max-height:${s.maxH}px`;
  const act = n >= 0 ? `aria-activedescendant="ddo-${s.hi}"` : '';
  return `<div class="dd-pop" style="${pos}">
    ${cfg.search ? `<div class="search dd-search">${ic('search')}<input id="dd-q" class="input" placeholder="${esc(cfg.searchPlaceholder || 'ค้นหา')}" value="${esc(s.q)}" data-in="ddQ" data-kd="dd" role="combobox" aria-expanded="true" aria-controls="dd-list" ${act} autocomplete="off"></div>` : ''}
    <div id="dd-list" role="listbox" tabindex="-1" data-kd="dd" ${cfg.search ? '' : act} aria-label="${esc(cfg.prefix || cfg.ariaLabel || 'ตัวเลือก')}">${items || '<div class="dd-empty">ไม่พบตัวเลือก</div>'}</div>
    ${cfg.footer ? `<div class="dd-foot">${cfg.footer}</div>` : ''}
  </div>`;
}
A.ddOpen = t => { if (S.dd && S.dd.id === t.dataset.id) ddClose(); else ddOpen(t.dataset.id, t); };
A.ddPick = t => ddChoose(+t.dataset.idx);
function ddChoose(i) {
  const o = ddPickable()[i], cfg = DD[S.dd.id];
  if (!o) return;
  const id = S.dd.id;
  S.dd = null; S.focusId = 'dd-' + id;
  cfg.onPick(o.v);
  render();
}
INP.ddQ = t => { S.dd.q = t.value; S.dd.hi = 0; render(); };
KD.dd = e => {
  if (!S.dd) return false;
  const list = ddPickable();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (list.length) S.dd.hi = (S.dd.hi + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    render(); const el = document.getElementById('ddo-' + S.dd.hi); if (el) el.scrollIntoView({ block: 'nearest' });
    e.preventDefault(); return true;
  }
  if (e.key === 'Home' || e.key === 'End') { S.dd.hi = e.key === 'Home' ? 0 : Math.max(0, list.length - 1); render(); e.preventDefault(); return true; }
  if (e.key === 'Enter' || (e.key === ' ' && e.target.id === 'dd-list')) { ddChoose(S.dd.hi); e.preventDefault(); return true; }
  if (e.key === 'Escape' || e.key === 'Tab') { ddClose(); e.preventDefault(); return true; }
  return false;
};
KD.ddTrig = e => {
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !(S.dd && S.dd.id === e.target.dataset.id)) { ddOpen(e.target.dataset.id, e.target); e.preventDefault(); return true; }
  return false;
};

function dialogHtml() {
  const body = DIALOGS[S.dialog.kind](S.dialog);
  return `<div class="dialog"><div class="scrim" data-a="dlgClose"></div><div class="dialog-panel ${S.dialog.wide ? 'dialog-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlg-title">${body}</div></div>`;
}
A.dlgClose = () => closeDialog();
A.dlgDiscard = () => closeDialog(true);
A.dlgKeep = () => { S.dialog.confirm = false; render(); };
function drawerHtml() {
  const d = S.drawer;
  return `<div class="scrim" data-a="drwClose"></div>${DRAWERS[d.kind](d)}`;
}
A.drwClose = () => closeDrawer();
A.drwDiscard = () => closeDrawer(true);
A.drwKeep = () => { S.drawer.confirm = false; render(); };

function notesHtml() {
  const label = { keep: 'คงเดิม', adj: 'ปรับ', new: 'ใหม่', fix: 'แก้' };
  const cls = { keep: 'kind-keep', adj: '', new: 'kind-new', fix: 'kind-fix' };
  const items = NOTES[S.page];
  return `<div class="scrim" data-a="notes"></div>
  <aside class="drawer drawer-narrow" role="dialog" aria-modal="true" aria-labelledby="notes-title">
    <div class="drawer-head"><div class="grow"><h2 id="notes-title">สิ่งที่เปลี่ยนในหน้า${esc(PAGE_META[S.page].title)}</h2><div class="sub">เทียบกับระบบจริงวันที่ 1 ต.ค. 2026</div></div>
      <button class="icon-btn" data-a="notes" aria-label="ปิด">${ic('x')}</button></div>
    <div class="drawer-body" style="gap:0">${items.map(([k, s]) => `<div class="sheet-item"><span class="kind ${cls[k]}">${label[k]}</span><span>${esc(s)}</span></div>`).join('')}
      <p class="hint" style="margin-top:14px">ป้าย <span class="pill-new">ใหม่</span> ในหน้าจอ = วิธีทำงานที่ยังไม่มีในระบบจริง ต้องพัฒนาฝั่ง API ด้วย</p></div>
  </aside>`;
}
A.notes = t => { S.notesOpen = !S.notesOpen; if (S.notesOpen) { S.returnSel = selectorFor(t); S.justOpened = true; } else restoreFocus(); render(); };

/* ---------- shell ---------- */
const NAV = [
  { items: [{ label: 'หน้าหลัก', icon: 'house' }] },
  { group: 'รายงาน', items: [{ id: 'standard', label: 'รายงานมาตรฐาน', icon: 'file-text' }, { label: 'รายงาน Template', icon: 'layout-template' }, { label: 'ประวัติการสร้างรายงาน', icon: 'history' }] },
  { group: 'จัดการรายงาน', items: [{ id: 'reports', label: 'ทะเบียนรายงาน', icon: 'database' }, { id: 'categories', label: 'หมวดรายงาน', icon: 'tags' }, { label: 'ตั้งเวลารายงาน', icon: 'calendar-clock' }] },
  { group: 'ผู้ใช้และสิทธิ์', items: [{ id: 'users', label: 'ผู้ใช้', icon: 'users' }, { id: 'roles', label: 'กลุ่มสิทธิ์', icon: 'shield-check' }] },
  { group: 'ระบบ', items: [{ label: 'ประวัติการใช้งาน', icon: 'scroll-text' }, { label: 'ตั้งค่าระบบ', icon: 'settings' }] },
];
function sidebar() {
  return `<nav class="side" aria-label="เมนูหลัก">
    <div class="brand"><div class="brand-mark">RC</div><div><div class="brand-name">ReportCenter</div><div class="brand-sub">Sonic Group</div></div></div>
    <div class="nav">${NAV.map(g => `<div class="nav-group">${g.group ? `<div class="nav-label">${g.group}</div>` : ''}${g.items.map(it => it.id
      ? `<button class="nav-item" data-a="nav" data-id="${it.id}" ${S.page === it.id ? 'aria-current="page"' : ''}>${ic(it.icon)}<span>${it.label}</span></button>`
      : `<button class="nav-item" aria-disabled="true" title="ไม่อยู่ใน mockup ชุดนี้">${ic(it.icon)}<span>${it.label}</span></button>`).join('')}</div>`).join('')}</div>
    <div class="side-foot">
      <button class="nav-item" aria-disabled="true" title="ไม่อยู่ใน mockup ชุดนี้">${ic('lock-keyhole')}<span>เปลี่ยนรหัสผ่าน</span></button>
      <div class="me"><div class="avatar">SA</div><div class="grow"><div class="me-name">System Admin</div><div class="me-role">ผู้ดูแลระบบ · Local</div></div>${ic('log-out')}</div>
    </div>
  </nav>`;
}
A.nav = t => go(t.dataset.id);
function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function topbar() {
  const m = PAGE_META[S.page];
  const dark = isDark();
  return `<header class="top">
    <button class="icon-btn menu-toggle" data-a="navToggle" aria-label="เปิดเมนู" aria-expanded="${S.navOpen}">${ic('menu')}</button>
    <div class="crumb grow"><span class="hide-sm">${m.group}</span><span class="hide-sm">${ic('chevron-right')}</span><b>${m.title}</b></div>
    <button class="icon-btn" data-a="theme" aria-label="${dark ? 'ใช้โหมดสว่าง' : 'ใช้โหมดมืด'}" title="${dark ? 'ใช้โหมดสว่าง' : 'ใช้โหมดมืด'}">${ic(dark ? 'sun' : 'moon')}</button>
    <button class="icon-btn" aria-label="การแจ้งเตือน" data-a="demo">${ic('bell')}</button>
  </header>`;
}
A.navToggle = () => { S.navOpen = !S.navOpen; render(); };
A.theme = () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  store.set('rc-mock-theme', next);
  render();
};
A.demo = t => demo(t.dataset.msg);

function shell() {
  return `<div class="strip" role="note">${ic('pencil-ruler')}<b>Mockup v2</b><span class="grow">แบบร่าง · ข้อมูลสมมติ ไม่เชื่อมระบบจริง · ป้าย <span class="pill-new">ใหม่</span> = วิธีทำงานที่ยังไม่มีในระบบ</span>
      <button class="strip-btn" data-a="notes">${ic('list-checks')}สิ่งที่เปลี่ยนในหน้านี้ (${NOTES[S.page].length})</button></div>
    <div class="shell ${S.navOpen ? 'nav-open' : ''}">
      ${sidebar()}<div class="nav-scrim" data-a="navToggle"></div>
      <div class="content">${topbar()}<main class="main" id="main">${PAGES[S.page]()}</main></div>
    </div>
    ${S.drawer ? drawerHtml() : ''}${S.notesOpen ? notesHtml() : ''}${S.dialog ? dialogHtml() : ''}${S.dd ? ddHtml() : ''}
    ${S.toast ? `<div class="toast ${S.toast.kind === 'info' ? 'is-info' : ''}" role="status">${ic(S.toast.kind === 'info' ? 'info' : 'circle-check')}<span>${esc(S.toast.msg)}</span></div>` : ''}`;
}
function pageHead(title, desc, actions = '') {
  return `<div class="page-head"><div><h1 id="page-title" tabindex="-1">${title}</h1><p>${desc}</p></div><div class="actions">${actions}</div></div>`;
}

/* ---------- render ---------- */
const app = document.getElementById('app');
function render() {
  const ae = document.activeElement;
  const fid = ae && ae.id;
  let ss = null, se = null;
  try { ss = ae.selectionStart; se = ae.selectionEnd; } catch (_) { /* not a text field */ }
  const scrolls = {};
  document.querySelectorAll('[data-keep]').forEach(el => { scrolls[el.dataset.keep] = [el.scrollTop, el.scrollLeft]; });
  const wy = window.scrollY;
  app.innerHTML = shell();
  if (window.lucide) lucide.createIcons();
  document.querySelectorAll('[data-keep]').forEach(el => { const s = scrolls[el.dataset.keep]; if (s) { el.scrollTop = s[0]; el.scrollLeft = s[1]; } });
  window.scrollTo(0, wy);
  document.querySelectorAll('[data-indet="1"]').forEach(el => { el.indeterminate = true; });
  let target = null;
  if (S.justOpened) {
    S.justOpened = false;
    const panel = topPanel();
    if (panel) target = panel.querySelector('[data-autofocus]') || panel.querySelector(FOCUSABLE);
  } else if (S.focusId) {
    target = document.getElementById(S.focusId);
  } else if (pendingReturn) {
    target = document.querySelector(pendingReturn);
  } else if (fid) {
    target = document.getElementById(fid);
  }
  S.focusId = null; pendingReturn = null;
  if (target) {
    target.focus({ preventScroll: true });
    if (fid && target.id === fid && ss != null) { try { target.setSelectionRange(ss, se); } catch (_) { /* not a text field */ } }
  }
}
const FOCUSABLE = 'button:not([disabled]):not([aria-disabled="true"]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
function topPanel() {
  return document.querySelector('.dialog-panel') || document.querySelector('.drawer');
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  if (S.dd && !e.target.closest('.dd-pop')) {
    const sameTrigger = t && t.dataset.a === 'ddOpen' && t.dataset.id === S.dd.id;
    if (!sameTrigger) { S.dd = null; if (!t) { render(); return; } }
  }
  if (S.std.open && !e.target.closest('.combo')) { S.std.open = false; if (!t) { render(); return; } }
  if (S.dialog && S.dialog.adOpen && !e.target.closest('.combo')) { S.dialog.adOpen = false; if (!t) { render(); return; } }
  if (!t || t.getAttribute('aria-disabled') === 'true') return;
  const fn = A[t.dataset.a];
  if (fn) { e.preventDefault(); fn(t, e); }
});
document.addEventListener('input', e => { const k = e.target.dataset.in; if (k && INP[k]) INP[k](e.target, e); });
document.addEventListener('change', e => { const k = e.target.dataset.ch; if (k && CHG[k]) CHG[k](e.target, e); });
document.addEventListener('focusin', e => { const k = e.target.dataset.focus; if (k && A[k]) A[k](e.target, e); });
document.addEventListener('keydown', e => {
  const k = e.target.dataset && e.target.dataset.kd;
  if (k && KD[k] && KD[k](e)) return;
  if (e.key === 'Escape') {
    if (S.dd) { ddClose(); return; }
    if (S.dialog) { closeDialog(); return; }
    if (S.notesOpen) { A.notes(); return; }
    if (S.drawer) { closeDrawer(); return; }
    if (S.navOpen) { S.navOpen = false; render(); return; }
  }
  if (e.key === 'Tab' && (S.dialog || S.drawer || S.notesOpen)) {
    const panel = document.querySelector('.dialog-panel') || document.querySelector('.drawer');
    if (!panel) return;
    const f = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!f.length) return;
    if (!panel.contains(document.activeElement)) { f[0].focus(); e.preventDefault(); return; }
    if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
  }
});
window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (PAGES[p] && p !== S.page) go(p); });
window.addEventListener('resize', () => { if (S.dd) { S.dd = null; render(); } });
document.addEventListener('scroll', e => { if (S.dd && !(e.target.closest && e.target.closest('.dd-pop'))) { S.dd = null; render(); } }, true);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());

function boot() {
  const saved = store.get('rc-mock-theme');
  if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
  const p = location.hash.slice(1);
  if (PAGES[p]) S.page = p;
  render();
}
