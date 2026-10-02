const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mockup() {
  const listeners = {};
  let html = '';
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const document = {
    activeElement: null,
    documentElement: { getAttribute: () => 'light' },
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    querySelectorAll() { return []; },
    getElementById(id) {
      if (id === 'app') return app;
      return findElement(attrs => attrs.id === id);
    },
    querySelector(selector) {
      if (selector === '.dialog-panel') return html.includes('class="dialog-panel') ? {
        querySelector() { return findElement(attrs => 'data-autofocus' in attrs); },
      } : null;
      if (selector === '.drawer') return null;
      const expected = [...selector.matchAll(/\[([^=]+)="([^"]*)"\]/g)];
      return expected.length ? findElement(attrs => expected.every(([, key, value]) => attrs[key] === value)) : null;
    },
  };
  function findElement(matches) {
    for (const tag of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
      const attrs = {};
      for (const attr of tag[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = decode(attr[2] || '');
      if (!matches(attrs)) continue;
      return {
        id: attrs.id || '', tagName: tag[1].toUpperCase(),
        dataset: Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5), value])),
        getAttribute(name) { return attrs[name] ?? null; },
        closest(selector) { return selector === '[data-a]' && attrs['data-a'] || selector === '.combo' && attrs.id === 'std-q' ? this : null; },
        // This models only the native synchronous focusin event. The real core
        // renderer and registered event handlers decide whether to reopen UI.
        focus() { document.activeElement = this; dispatch('focusin', this); },
        scrollIntoView() {},
      };
    }
    return null;
  }
  const app = {
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; document.activeElement = null; },
  };
  function dispatch(type, target, extras = {}) {
    const event = { target, preventDefault() {}, ...extras };
    (listeners[type] || []).forEach(handler => handler(event));
  }
  const location = { hash: '#standard' };
  const context = vm.createContext({
    document, location,
    window: { addEventListener() {}, scrollTo() {}, scrollY: 0 },
    history: { replaceState(_, __, hash) { location.hash = hash; } },
    matchMedia: () => ({ addEventListener() {}, matches: false }),
    CSS: { escape: value => value },
    setTimeout: () => 0, clearTimeout() {},
  });
  for (const file of ['data.js', 'core.js', 'page-reports.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return {
    run: code => vm.runInContext(code, context),
    read: expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
    element: selector => document.querySelector(selector),
    input: () => document.getElementById('std-q'),
    click: target => dispatch('click', target),
    key: (key, target = document.activeElement) => dispatch('keydown', target, { key }),
    html: () => html,
    active: () => document.activeElement,
  };
}

test('favorite shortcuts remain available after selection and switch reports in one action', () => {
  const app = mockup();
  app.run('stdSelect(1028);');
  assert.match(app.html(), /class="quick-row"[^>]*>[\s\S]*?รายการโปรด/);
  const favorite = app.element('[data-a="stdPick"][data-id="12"]');
  assert.ok(favorite, 'the other favorite remains an actionable shortcut');
  app.click(favorite);
  assert.equal(app.read('S.std.id'), 12);
  assert.equal(app.read('S.std.company'), '1');
});

test('company is shown only after a report is selected and hidden after clearing', () => {
  const app = mockup();
  app.run('render();');
  assert.doesNotMatch(app.html(), /id="dd-std-co"/);
  app.run('stdSelect(1028);');
  assert.match(app.html(), /id="dd-std-co"/);
  assert.ok(app.html().indexOf('id="std-q"') < app.html().indexOf('id="dd-std-co"'));
  app.run('A.stdClear();');
  assert.doesNotMatch(app.html(), /id="dd-std-co"/);
});

test('Escape closes the report list through focus restoration without changing selection', () => {
  const app = mockup();
  app.run('stdSelect(1028);');
  app.input().focus();
  assert.equal(app.read('S.std.open'), true);
  app.key('Escape');
  assert.equal(app.read('S.std.open'), false);
  assert.equal(app.read('S.std.id'), 1028);
  assert.equal(app.active().id, 'std-q');
  assert.doesNotMatch(app.html(), /id="std-list"/);
});

test('clicking a still-focused report field reopens its list after Escape', () => {
  const app = mockup();
  app.run('stdSelect(1028);');
  app.input().focus();
  app.key('Escape');
  assert.equal(app.read('S.std.open'), false);
  app.click(app.input());
  assert.equal(app.read('S.std.open'), true);
  assert.match(app.html(), /id="std-list"/);
});

test('permission overflow is a named button that opens all mapped groups without changing access', () => {
  const app = mockup();
  app.run("S.page = 'reports'; render();");
  const before = app.read('Object.fromEntries(Object.entries(MAP).map(([id, reports]) => [id, [...reports]]))');
  const trigger = app.element('[data-a="rpAccess"][data-id="27"]');
  assert.ok(trigger, 'the +1 overflow must be an actionable button');
  assert.equal(trigger.tagName, 'BUTTON');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.match(trigger.getAttribute('aria-label'), /Pre AlertEx/);
  app.click(trigger);
  assert.match(app.html(), /role="dialog" aria-modal="true" aria-labelledby="dlg-title"/);
  const content = app.run('DIALOGS[S.dialog.kind](S.dialog)');
  assert.match(content, /id="dlg-title"/);
  assert.match(content, /Pre AlertEx/);
  assert.match(content, /<li>Customer Service<\/li>/);
  assert.match(content, /<li>Customer Service No Business File<\/li>/);
  assert.match(content, /<li>Nominate<\/li>/);
  assert.equal((content.match(/<li>/g) || []).length, 3);
  app.key('Escape');
  assert.equal(app.read('S.dialog'), null);
  assert.equal(app.active().dataset.a, 'rpAccess');
  assert.equal(app.active().dataset.id, '27');
  assert.deepEqual(app.read('Object.fromEntries(Object.entries(MAP).map(([id, reports]) => [id, [...reports]]))'), before);
});

test('reports with two or fewer mapped groups do not show a misleading overflow action', () => {
  const app = mockup();
  assert.doesNotMatch(app.run('accessCell(repOf(1028))'), /data-a="rpAccess"/);
  assert.doesNotMatch(app.run('accessCell(repOf(33))'), /data-a="rpAccess"/);
});
