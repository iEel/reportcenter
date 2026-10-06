const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Exercise the real state transitions; DOM rendering is checked in the browser.
function load() {
  const context = vm.createContext({
    document: { getElementById: () => ({}), addEventListener() {} },
    window: { addEventListener() {}, scrollTo() {} },
    location: { hash: '#standard' },
    history: { replaceState(_state, _title, hash) { context.location.hash = hash; } },
    matchMedia: () => ({ addEventListener() {} }),
  });
  vm.runInContext(readFileSync(join(__dirname, '..', 'core.js'), 'utf8'), context);
  vm.runInContext('render = () => {};', context);
  return code => vm.runInContext(code, context);
}

for (const [slot, close] of [['dialog', 'closeDialog'], ['drawer', 'closeDrawer']]) {
  test(`${slot}: repeated close returns to the dirty form without losing input`, () => {
    const run = load();
    run(`S.${slot} = { dirty: true, name: 'unsaved input' }; ${close}();`);
    assert.equal(run(`S.${slot}.confirm`), true);
    run(`${close}();`);
    assert.equal(run(`S.${slot}?.name`), 'unsaved input');
    assert.equal(run(`S.${slot}?.confirm`), false);
  });
  test(`${slot}: explicit discard closes a dirty form`, () => {
    const run = load();
    run(`S.${slot} = { dirty: true, confirm: true }; ${close}(true);`);
    assert.equal(run(`S.${slot}`), null);
  });
  test(`${slot}: unchanged form closes without a confirmation`, () => {
    const run = load();
    run(`S.${slot} = { dirty: false }; ${close}();`);
    assert.equal(run(`S.${slot}`), null);
  });
}

test('navigation preserves the current page and URL until discard is confirmed', () => {
  const run = load();
  run(`PAGES.standard = () => ''; PAGES.users = () => '';
    var proceed;
    if (typeof PAGE_GUARDS !== 'undefined') PAGE_GUARDS.standard = next => { proceed = next; return false; };
    location.hash = '#users'; go('users');`);
  assert.equal(run('S.page'), 'standard');
  assert.equal(run('location.hash'), '#standard');
  run('proceed();');
  assert.equal(run('S.page'), 'users');
  assert.equal(run('location.hash'), '#users');
});
