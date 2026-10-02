const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime() {
  const listeners = {};
  const elements = {};
  const document = {
    activeElement: null,
    getElementById: id => elements[id] || null,
    querySelectorAll: () => [], querySelector: () => null,
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  elements.app = { innerHTML: '' };
  const runContext = vm.createContext({ document, window: { scrollY: 0, scrollTo() {}, addEventListener() {} }, matchMedia: () => ({ addEventListener() {} }) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8'), runContext);
  return { document, elements, listeners, run: code => vm.runInContext(code, runContext) };
}

test('restoring input focus during render does not reopen a closed report menu', () => {
  const r = runtime();
  const input = { id: 'report-input', dataset: { focus: 'reopen' }, focus() { r.listeners.focusin({ target: input }); } };
  r.elements[input.id] = input;
  r.document.activeElement = input;
  r.run("shell = () => ''; var opens = 0; A.reopen = () => { opens++; }; render();");
  assert.equal(r.run('opens'), 0);
  // Actual user focus must still open it.
  r.listeners.focusin({ target: input });
  assert.equal(r.run('opens'), 1);
});

for (const backwards of [false, true]) {
  test(`Tab ${backwards ? 'backward' : 'forward'} exits dropdown to the adjacent form control`, () => {
    const r = runtime();
    const fields = ['before', 'dd-role', 'after'].map(id => ({ id, offsetParent: {}, closest: () => null }));
    r.document.querySelectorAll = () => fields;
    r.document.querySelector = () => null;
    r.run("render = () => {}; S.dd = { id: 'role', q: '', hi: 0 }; DD.role = { options: [] }; var prevented = false;");
    r.run(`KD.dd({ key: 'Tab', shiftKey: ${backwards}, target: { id: 'dd-q' }, preventDefault() { prevented = true; } });`);
    assert.equal(r.run('S.dd'), null);
    assert.equal(r.run('S.focusId'), backwards ? 'before' : 'after');
    assert.equal(r.run('prevented'), true);
  });
}
