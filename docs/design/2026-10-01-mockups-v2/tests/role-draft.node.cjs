const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mockup() {
  const location = { hash: '#roles' };
  const context = vm.createContext({
    document: { getElementById: () => ({}), addEventListener() {} },
    window: { addEventListener() {}, scrollTo() {} },
    matchMedia: () => ({ addEventListener() {} }),
    location,
    history: { replaceState: (_, __, hash) => { location.hash = hash; } },
    CSS: { escape: value => value },
    setTimeout: () => 0,
    clearTimeout() {},
  });
  for (const file of ['data.js', 'core.js', 'page-roles.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  // Exercise real page actions and state; the browser owns rendering and focus.
  vm.runInContext("render = () => {}; S.page = 'roles'; PAGES.users = () => '';", context);
  return {
    run: code => vm.runInContext(code, context),
    read: expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
  };
}

function editAccount(app) {
  app.run("A.roEdit(); CHG.roEditPick({ dataset: { id: '31' }, checked: true });");
}

const accountReports = [1028, 1027, 14, 15, 25];

test('adding a role is blocked until the current report draft is saved or cancelled', () => {
  const app = mockup();
  editAccount(app);
  app.run('A.roAdd({});');

  assert.equal(app.read('S.dialog'), null);
  assert.equal(app.read('S.ro.sel'), 2);
  assert.deepEqual(app.read('[...MAP[2]]'), accountReports);
  assert.match(app.read('S.toast.msg'), /บันทึกหรือยกเลิก/);

  app.run('A.roEditSave();');
  assert.deepEqual(app.read('[...MAP[2]]'), [...accountReports, 31]);
});

test('a report draft stays bound to its original role if selection changes elsewhere', () => {
  const app = mockup();
  editAccount(app);
  app.run('S.ro.sel = 5; A.roEditSave();');

  assert.deepEqual(app.read('[...MAP[5]]'), [31]);
  assert.deepEqual(app.read('[...MAP[2]]'), [...accountReports, 31]);
});

test('cancel then create does not allow a discarded draft to populate the new role', () => {
  const app = mockup();
  editAccount(app);
  app.run("A.roEditCancel(); A.roAdd({}); INP.rlName({ value: 'กลุ่มทดสอบใหม่' }); A.rlAddOk(); A.roEditSave();");

  assert.equal(app.read('ROLES.length'), 12);
  assert.deepEqual(app.read('[...MAP[12]]'), []);
  assert.deepEqual(app.read('[...MAP[2]]'), accountReports);
  assert.equal(app.read('S.ro.editing'), false);
  assert.equal(app.read('S.ro.editSel'), null);
});

test('after save, a new role draft starts from its own reports and cannot reuse the completed draft', () => {
  const app = mockup();
  editAccount(app);
  app.run("A.roEditSave(); A.roSel({ dataset: { id: '5' } }); A.roEditSave();");
  assert.deepEqual(app.read('[...MAP[5]]'), [31]);

  app.run('A.roEdit();');
  assert.deepEqual(app.read('[...S.ro.editSel]'), [31]);
  assert.deepEqual(app.read('[...MAP[2]]'), [...accountReports, 31]);
});

test('deleting the current role cannot change context while its report draft is open', () => {
  const app = mockup();
  editAccount(app);
  app.run("A.roDelete({ dataset: { id: '2' } });");

  assert.equal(app.read('S.dialog'), null);
  assert.equal(app.read('S.ro.editing'), true);
  assert.deepEqual(app.read('[...MAP[2]]'), accountReports);
  assert.match(app.read('S.toast.msg'), /บันทึกหรือยกเลิก/);
});

test('page navigation preserves an open role draft until it is saved or cancelled', () => {
  const app = mockup();
  editAccount(app);
  app.run("go('users');");
  assert.equal(app.read('S.page'), 'roles');
  assert.deepEqual(app.read('[...S.ro.editSel]'), [...accountReports, 31]);

  app.run("A.roEditCancel(); go('users');");
  assert.equal(app.read('S.page'), 'users');
  assert.deepEqual(app.read('[...MAP[2]]'), accountReports);
});
