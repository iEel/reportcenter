const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const context = vm.createContext({
    document: { getElementById: () => ({}), addEventListener() {} },
    window: { addEventListener() {}, scrollTo() {} },
    location: { hash: '#users' },
    CSS: { escape: String },
    matchMedia: () => ({ addEventListener() {} }),
  });
  for (const file of ['data.js', 'core.js', 'page-users.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  // Real render functions and action handlers; substitute only browser painting.
  vm.runInContext(`
    render = () => {};
    ROLES = [{ id: 1, name: 'Admin', admin: true }, { id: 2, name: 'Finance' }];
    REPORTS = [{ id: 101, name: 'Open', active: true, cat: null }, { id: 102, name: 'Closed', active: false, cat: null }, { id: 103, name: 'Other', active: true, cat: null }];
    Object.keys(MAP).forEach(id => delete MAP[id]);
    MAP[2] = new Set([101, 102]);
    USERS = [{ id: 1, name: 'Sample User', user: 'sample', kind: 'local', role: 2, cos: [1], active: true }];
  `, context);
  return code => vm.runInContext(code, context);
}

function summaryValues(html) {
  const section = html.match(/<section class="user-access-summary"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(section, 'the form should expose its live access summary before saving');
  return [...section[1].matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(match => match[1].replace(/<[^>]*>/g, '').trim());
}

test('an incomplete create form distinguishes unselected access from zero reports', () => {
  const run = fixture();
  run('A.usAdd();');
  const values = summaryValues(run('DIALOGS.add(S.dialog)'));
  assert.match(values[0], /ยังไม่ได้เลือก/);
  assert.match(values[1], /เลือกกลุ่มสิทธิ์/);
  assert.match(values[2], /ยังไม่ได้เลือกบริษัท/);
});

test('create summary updates selected companies and excludes inactive mapped reports', () => {
  const run = fixture();
  run(`A.usAdd(); A.addMode({ dataset: { id: 'local' } }); DIALOGS.add(S.dialog);
    DD['add-role'].onPick('2');
    CHG.addCo({ dataset: { id: '1' }, checked: true, id: 'add-co-1' });
    CHG.addCo({ dataset: { id: '3' }, checked: true, id: 'add-co-3' });`);
  assert.deepEqual(summaryValues(run('DIALOGS.add(S.dialog)')), ['Finance', '1 รายงาน', 'SNI, SALOG']);
  run(`CHG.addCo({ dataset: { id: '1' }, checked: false, id: 'add-co-1' });`);
  assert.deepEqual(summaryValues(run('DIALOGS.add(S.dialog)')), ['Finance', '1 รายงาน', 'SALOG']);
});

test('Admin summary counts every active report without requiring explicit mappings', () => {
  const run = fixture();
  run(`A.usAdd(); S.dialog.role = '1'; S.dialog.cos.add(2);`);
  const values = summaryValues(run('DIALOGS.add(S.dialog)'));
  assert.equal(values[0], 'Admin');
  assert.match(values[1], /^2 รายงาน/);
  assert.match(values[1], /ทุกรายงาน/);
  assert.equal(values[2], 'GRL');
});

test('AD affiliation is not presented as an allowed company after deselection', () => {
  const run = fixture();
  run(`A.usAdd(); adSelect('kittipong.s'); S.dialog.role = '2';
    CHG.addCo({ dataset: { id: '1' }, checked: false, id: 'add-co-1' });
    CHG.addCo({ dataset: { id: '2' }, checked: true, id: 'add-co-2' });`);
  assert.equal(summaryValues(run('DIALOGS.add(S.dialog)'))[2], 'GRL');
});

test('edit summary reflects draft access while the saved user remains unchanged', () => {
  const run = fixture();
  run(`A.usOpen({ dataset: { id: '1' } }); DRAWERS.user(S.drawer);
    DD['du-role'].onPick(1);
    CHG.duCo({ dataset: { id: '1' }, checked: false, id: 'du-co-1' });
    CHG.duCo({ dataset: { id: '2' }, checked: true, id: 'du-co-2' });`);
  const values = summaryValues(run('DRAWERS.user(S.drawer)'));
  assert.equal(values[0], 'Admin');
  assert.match(values[1], /^2 รายงาน/);
  assert.equal(values[2], 'GRL');
  assert.equal(run('USERS[0].role'), 2);
  assert.equal(run('USERS[0].cos.join()'), '1');
});

test('company changes retain a focus target that exists in the rerendered form', () => {
  const run = fixture();
  run(`A.usAdd(); CHG.addCo({ dataset: { id: '2' }, checked: true, id: 'add-co-2' });`);
  assert.equal(run('S.focusId'), 'add-co-2');
  assert.match(run('DIALOGS.add(S.dialog)'), /<input[^>]+id="add-co-2"[^>]+data-ch="addCo"/);
  run(`A.usOpen({ dataset: { id: '1' } }); CHG.duCo({ dataset: { id: '2' }, checked: true, id: 'du-co-2' });`);
  assert.equal(run('S.focusId'), 'du-co-2');
  assert.match(run('DRAWERS.user(S.drawer)'), /<input[^>]+id="du-co-2"[^>]+data-ch="duCo"/);
});
