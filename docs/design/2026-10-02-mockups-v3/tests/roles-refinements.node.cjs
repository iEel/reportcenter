const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mockup() {
  const context = vm.createContext({
    document: { getElementById: () => ({}), addEventListener() {} },
    window: { addEventListener() {} },
    matchMedia: () => ({ addEventListener() {} }),
    setTimeout: () => 0,
    clearTimeout() {},
  });
  for (const file of ['data.js', 'core.js', 'page-roles.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  vm.runInContext("render = () => {}; S.page = 'roles';", context);
  return {
    run: code => vm.runInContext(code, context),
    read: expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
    editor: () => vm.runInContext('roEditList(roleOf(S.ro.sel))', context),
    page: () => vm.runInContext('PAGES.roles()', context),
  };
}

function selectionSummary(html) {
  const match = html.match(/เลือกทั้งหมด\s+(\d+)\s*·\s*อยู่ในผลค้นหา\s+(\d+)/);
  assert.ok(match, 'the editor should expose total and visible selected counts');
  return match.slice(1).map(Number);
}

function reportCheckbox(html, reportId) {
  const input = [...html.matchAll(/<input\b[^>]*>/g)].map(match => match[0])
    .find(tag => tag.includes('data-ch="roEditPick"') && tag.includes(`data-id="${reportId}"`));
  assert.ok(input, 'the report should have a checkbox');
  const id = input.match(/\sid="([^"]+)"/);
  assert.ok(id, 'the checkbox needs a stable DOM id for focus restoration');
  return { id: id[1], checked: /\schecked(?:\s|>)/.test(input) };
}

test('changing a report checkbox keeps its DOM identity and requests focus on the same control', () => {
  const app = mockup();
  app.run('A.roEdit();');
  const before = reportCheckbox(app.editor(), 31);
  assert.equal(before.checked, false);
  app.run(`CHG.roEditPick({ id: ${JSON.stringify(before.id)}, dataset: { id: '31' }, checked: true });`);
  assert.equal(app.read('S.focusId'), before.id);
  assert.deepEqual(reportCheckbox(app.editor(), 31), { id: before.id, checked: true });
  assert.equal(app.read('S.ro.editSel.has(31)'), true);
  assert.equal(app.read('MAP[2].has(31)'), false, 'checking is still only a draft');
});

test('filtered bulk deselection preserves hidden selections and reports both counts', () => {
  const app = mockup();
  app.run("A.roEdit(); CHG.roEditPick({ dataset: { id: '31' }, checked: true }); INP.roEQ({ value: 'Statement' });");
  assert.deepEqual(selectionSummary(app.editor()), [6, 3]);
  app.run("A.roEditShown({ dataset: { id: '0' } });");
  assert.deepEqual(app.read('[...S.ro.editSel]'), [1028, 1027, 31]);
  assert.deepEqual(selectionSummary(app.editor()), [3, 0]);
  assert.deepEqual(app.read('[...MAP[2]]'), [1028, 1027, 14, 15, 25]);
  app.run("INP.roEQ({ value: '' });");
  assert.deepEqual(selectionSummary(app.editor()), [3, 3]);
});

test('category bulk selection affects only search results and retains inactive mappings on save', () => {
  const app = mockup();
  app.run("A.roEdit(); CHG.roEditPick({ dataset: { id: '31' }, checked: true }); INP.roEQ({ value: 'AP Aged' }); A.roEditCat({ dataset: { id: '1' } });");
  assert.deepEqual(app.read('[...S.ro.editSel]'), [14, 15, 25, 31]);
  assert.deepEqual(selectionSummary(app.editor()), [4, 0]);
  app.run("A.roEditCat({ dataset: { id: '1' } });");
  assert.deepEqual(selectionSummary(app.editor()), [6, 2]);
  app.run('A.roEditSave();');
  assert.deepEqual(app.read('[...MAP[2]].sort((a, b) => a - b)'), [14, 15, 25, 31, 1027, 1028]);
  assert.deepEqual(app.read('[...MAP[5]]'), [31]);
  assert.equal(app.read('S.ro.editing'), false);
  assert.equal(app.read('S.ro.editSel'), null);
});

test('active and retained inactive counts follow report status consistently in the role views', () => {
  const app = mockup();
  const countLocations = () => {
    const html = app.page();
    return [
      html.match(/<button\b[^>]*data-a="roSel"[^>]*data-id="2"[\s\S]*?<\/button>/)[0],
      html.match(/<div class="panel-head">[\s\S]*?<div class="actions">/)[0],
      html.match(/<button\b[^>]*data-a="roTab"[^>]*data-id="reports"[\s\S]*?<\/button>/)[0],
      html.match(/<div class="grp-head">[\s\S]*?<\/div>/)[0],
    ];
  };
  for (const html of countLocations()) assert.match(html, /ใช้งาน 4 · ปิดใช้งาน 1/);
  app.run('repOf(25).active = true;');
  for (const html of countLocations()) assert.match(html, /ใช้งาน 5 · ปิดใช้งาน 0/);
  assert.deepEqual(app.read('[...MAP[2]]'), [1028, 1027, 14, 15, 25], 'status changes do not rewrite permissions');
});

test('comparison excludes retained inactive reports and updates when a report becomes active', () => {
  const app = mockup();
  app.run('MAP[3] = new Set([1028, 1027, 14, 15]);');
  assert.deepEqual(app.read('overlap(2, 3).onlyA'), []);
  assert.equal(app.read('overlap(2, 3).both.length'), 4);
  app.run('repOf(25).active = true;');
  assert.deepEqual(app.read('overlap(2, 3).onlyA'), [25]);
  assert.equal(app.read('overlap(2, 3).union'), 5);
});
