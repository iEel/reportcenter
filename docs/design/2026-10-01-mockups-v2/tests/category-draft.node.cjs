const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'page-categories.js'), 'utf8');

function fixture() {
  // The page's real action handlers run in isolation; only DOM rendering and
  // shared dialog/navigation boundaries are substituted for this state test.
  const c = vm.createContext({});
  vm.runInContext(`
    const PAGES = {}, PAGE_META = {}, A = {}, INP = {}, CHG = {}, KD = {}, DIALOGS = {}, PAGE_GUARDS = {};
    const S = { page: 'categories', ct: { sel: 1, edit: null }, rp: { cat: 'all' }, dialog: null };
    let CATS = [{ id: 1, name: 'Finance', color: 'blue' }, { id: 2, name: 'Sales', color: 'green' }];
    const REPORTS = [];
    const catOf = id => CATS.find(c => c.id === id);
    function render() {}
    function toast() {}
    function openDialog(d) { S.dialog = d; }
    function closeDialog() { S.dialog = null; }
    function go(page) { S.page = page; }
  `, c);
  vm.runInContext(source, c);
  return code => vm.runInContext(code, c);
}

test('selecting another category keeps an edited name until discard is explicit', () => {
  const run = fixture();
  run(`A.ctEdit(); INP.ctName({ value: 'Draft name' }); A.ctSel({ dataset: { id: '2' } });`);
  assert.equal(run('S.ct.sel'), 1);
  assert.equal(run('S.ct.edit.name'), 'Draft name');
  assert.equal(run('catOf(1).name'), 'Finance');
  assert.equal(run('S.dialog.kind'), 'ctDiscardDraft');
  run('A.ctKeepDraft(); A.ctSave();');
  assert.equal(run('S.ct.sel'), 1);
  assert.equal(run('catOf(1).name'), 'Draft name');
  assert.equal(run('S.dialog'), null);
});

test('discard performs the requested category selection without saving the draft', () => {
  const run = fixture();
  run(`A.ctEdit(); INP.ctName({ value: 'Draft name' }); A.ctSel({ dataset: { id: '2' } });`);
  assert.equal(run('S.ct.sel'), 1);
  run('A.ctDiscardDraft();');
  assert.equal(run('S.ct.sel'), 2);
  assert.equal(run('S.ct.edit'), null);
  assert.equal(run('catOf(1).name'), 'Finance');
});

test('unchanged drafts and the current category do not require discarding', () => {
  const run = fixture();
  run(`A.ctEdit(); A.ctSel({ dataset: { id: '2' } });`);
  assert.equal(run('S.ct.sel'), 2);
  assert.equal(run('S.dialog'), null);
  run(`A.ctEdit(); INP.ctName({ value: 'Keep me' }); A.ctSel({ dataset: { id: '2' } }); A.ctEdit();`);
  assert.equal(run('S.ct.edit?.name'), 'Keep me');
  assert.equal(run('S.dialog'), null);
});

test('cancel and Escape ask before throwing away an edited category', () => {
  const run = fixture();
  run(`A.ctEdit(); INP.ctName({ value: 'Keep me' }); A.ctCancel();`);
  assert.equal(run('S.ct.edit?.name'), 'Keep me');
  assert.equal(run('S.dialog.kind'), 'ctDiscardDraft');
  run(`A.ctKeepDraft(); KD.ctName({ key: 'Escape', preventDefault() {} });`);
  assert.equal(run('S.ct.edit.name'), 'Keep me');
  assert.equal(run('S.dialog.kind'), 'ctDiscardDraft');
  run('A.ctDiscardDraft();');
  assert.equal(run('S.ct.edit'), null);
});

test('starting a new category cannot overwrite a dirty existing category', () => {
  const run = fixture();
  run(`A.ctEdit(); INP.ctName({ value: 'Existing draft' }); A.ctAdd();`);
  assert.equal(run('S.ct.edit.id'), 1);
  assert.equal(run('S.ct.edit.name'), 'Existing draft');
  assert.equal(run('S.dialog.kind'), 'ctDiscardDraft');
  run('A.ctDiscardDraft();');
  assert.equal(run('S.ct.edit.id'), 'new');
  assert.equal(run('S.ct.edit.name'), '');
});

test('new category drafts survive reopening Add and prompt before switching category', () => {
  const run = fixture();
  run(`A.ctAdd(); INP.ctName({ value: 'New draft' }); A.ctAdd();`);
  assert.equal(run('S.ct.edit.name'), 'New draft');
  assert.equal(run('S.dialog'), null);
  run(`A.ctSel({ dataset: { id: '2' } });`);
  assert.equal(run('S.ct.sel'), 1);
  assert.equal(run('S.ct.edit.name'), 'New draft');
  assert.equal(run('S.dialog.kind'), 'ctDiscardDraft');
});

test('the navigation guard preserves color-only changes until discard', () => {
  const run = fixture();
  run(`A.ctEdit(); CHG.ctColor({ value: 'green', id: 'sw-green' });`);
  assert.equal(run('typeof PAGE_GUARDS.categories'), 'function');
  assert.equal(run(`PAGE_GUARDS.categories(() => go('users'))`), false);
  assert.equal(run('S.page'), 'categories');
  assert.equal(run('S.ct.edit.color'), 'green');
  run('A.ctDiscardDraft();');
  assert.equal(run('S.page'), 'users');
  assert.equal(run('S.ct.edit'), null);
  assert.equal(run('catOf(1).color'), 'blue');
});

test('opening the report registry defers navigation and filters until discard', () => {
  const run = fixture();
  run(`A.ctEdit(); INP.ctName({ value: 'Draft' }); A.ctOpenReg();`);
  assert.equal(run('S.page'), 'categories');
  assert.equal(run('S.rp.cat'), 'all');
  assert.equal(run('S.ct.edit.name'), 'Draft');
  run('A.ctDiscardDraft();');
  assert.equal(run('S.page'), 'reports');
  assert.equal(run('S.rp.cat'), '1');
  assert.equal(run('S.ct.edit'), null);
});

test('deleting a category asks about its draft before opening the delete confirmation', () => {
  const run = fixture();
  run(`A.ctEdit(); INP.ctName({ value: 'Draft' }); A.ctDel({ dataset: { id: '1' } });`);
  assert.equal(run('S.dialog.kind'), 'ctDiscardDraft');
  assert.equal(run('S.ct.edit.name'), 'Draft');
  run('A.ctDiscardDraft();');
  assert.equal(run('S.dialog.kind'), 'delCat');
  assert.equal(run('S.ct.edit'), null);
  assert.equal(run('CATS.length'), 2);
});
