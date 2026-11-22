const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { projectTimelineWindow, PROJECT_TIMELINE_DAYS } = require('../rules/project-rules.js');

// A small DOM for the real Gantt scripts, not a copy of their handlers. It counts
// allocations so extreme dates are tested without allocating millions of cells.
function screen({ start = '2027-01-01', end = '2027-01-02', role = 'Admin', saved = true, alterSaved,
  lineupProblem = '', eventStart = '2027-03-20', eventEnd = '2027-03-21' } = {}) {
  let allocations = 0;
  const listeners = new Map();
  const storage = new Map();
  const controls = { allowLeave: false, stale: false, failWrites: false, lineupProblem };
  const notices = [];
  const dataName = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  class Text {
    constructor(value) { this.nodeType = 3; this.textContent = String(value); }
    remove() { this.parentNode?.children.splice(this.parentNode.children.indexOf(this), 1); }
  }
  class Element {
    constructor(tag = 'div') {
      if (++allocations > 100000) throw new Error('Unbounded Gantt DOM allocation');
      this.tagName = tag.toUpperCase(); this.nodeType = 1; this.children = []; this.parentNode = null;
      this.dataset = {}; this.attributes = {}; this.classes = new Set(); this.handlers = new Map();
      this.style = { setProperty(key, value) { this[key] = value; } };
      this.scrollLeft = 0; this.scrollTop = 0; this.value = ''; this.hidden = false;
      this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)), contains: name => this.classes.has(name),
        toggle: (name, force) => { const show = force === undefined ? !this.classes.has(name) : force; show ? this.classes.add(name) : this.classes.delete(name); return show; } };
    }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    set id(value) { this.attributes.id = value; } get id() { return this.attributes.id || ''; }
    get childNodes() { return this.children; }
    get firstChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children.filter(child => child.nodeType === 1).at(-1) || null; }
    get rows() { return this.children.filter(child => child.tagName === 'TR'); }
    get cells() { return this.children.filter(child => ['TD', 'TH'].includes(child.tagName)); }
    get cellIndex() { return this.parentNode?.cells.indexOf(this) ?? -1; }
    get textContent() { return this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.replaceChildren(new Text(value)); }
    append(...children) { children.forEach(child => { if (typeof child === 'string') child = new Text(child); child.remove?.(); child.parentNode = this; this.children.push(child); }); }
    prepend(child) { child.remove?.(); child.parentNode = this; this.children.unshift(child); }
    appendChild(child) { this.append(child); return child; }
    add(child) { this.append(child); }
    replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...children); }
    remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'class') this.className = String(value); if (name.startsWith('data-')) this.dataset[dataName(name)] = String(value); }
    getAttribute(name) { if (name.startsWith('data-')) return this.dataset[dataName(name)] ?? null; return this.attributes[name] ?? null; }
    addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(handler); }
    removeEventListener(type, handler) { this.handlers.set(type, (this.handlers.get(type) || []).filter(fn => fn !== handler)); }
    dispatch(type, extra = {}) { const event = { target: this, preventDefault() {}, ...extra }; this['on' + type]?.(event); for (const handler of this.handlers.get(type) || []) handler(event); }
    focus() { document.activeElement = this; } select() {}
    checkValidity() { return !this.validation && (!this.required || Boolean(this.value.trim())); }
    setCustomValidity(value) { this.validation = value; } reportValidity() { return this.checkValidity(); }
    getBoundingClientRect() { return { left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500 }; }
    matches(selector) {
      const nth = selector.match(/:nth-child\((\d+)\)/);
      if (nth && this.parentNode?.children.filter(child => child.nodeType === 1).indexOf(this) !== Number(nth[1]) - 1) return false;
      selector = selector.replace(/:nth-child\(\d+\)/, '');
      const structure = selector.replace(/\[[^\]]+\]/g, '');
      const tag = structure.match(/^[a-z]+/i)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      const id = structure.match(/#([\w-]+)/)?.[1];
      if (id && this.id !== id) return false;
      for (const [, name] of structure.matchAll(/\.([\w-]+)/g)) if (!this.classes.has(name)) return false;
      for (const [, name, value] of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) {
        const actual = this.getAttribute(name);
        if (actual === null || (value !== undefined && actual !== value)) return false;
      }
      return true;
    }
    querySelectorAll(selector) {
      const result = [];
      for (const choice of selector.split(',')) {
        const parts = choice.trim().split(/\s+/);
        function visit(parent) {
          for (const child of parent.children.filter(item => item.nodeType === 1)) {
            if (child.matches(parts.at(-1))) {
              let ancestor = child.parentNode, index = parts.length - 2;
              while (ancestor && index >= 0) { if (ancestor.matches(parts[index])) index--; ancestor = ancestor.parentNode; }
              if (index < 0 && !result.includes(child)) result.push(child);
            }
            visit(child);
          }
        }
        visit(this);
      }
      return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { for (let node = this; node; node = node.parentNode) if (selector.split(',').some(part => node.matches(part.trim()))) return node; return null; }
    set innerHTML(html) {
      this.replaceChildren(); const stack = [this];
      for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
        if (token.startsWith('</')) { stack.pop(); continue; }
        if (token.startsWith('<')) {
          const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
          const child = new Element(tag);
          for (const [, name, value] of token.matchAll(/([\w-]+)="([^"]*)"/g)) child.setAttribute(name, value);
          stack.at(-1).append(child); if (!['input', 'br'].includes(tag)) stack.push(child);
        } else stack.at(-1).append(new Text(token));
      }
    }
  }
  const body = new Element('body');
  const document = { activeElement: body, createElement: tag => new Element(tag), createTextNode: value => new Text(value),
    querySelector: selector => body.querySelector(selector), querySelectorAll: selector => body.querySelectorAll(selector) };
  function add(parent, tag, id, classes = '', text = '') { const element = new Element(tag); if (id) element.id = id; element.className = classes; if (text) element.textContent = text; parent.append(element); return element; }
  const chart = add(body, 'div', 'gantt-view');
  const heading = add(chart, 'div', null, 'gantt-heading'); add(heading, 'span', null, 'gantt-count');
  const toolbar = add(chart, 'div', null, 'gantt-controls');
  for (const group of ['outline', 'timeline']) {
    const wrap = add(toolbar, 'div', null, 'gantt-control-group');
    for (const mode of group === 'outline' ? ['areas', 'tasks', 'subtasks'] : ['weeks', 'days']) add(wrap, 'button', null, '', mode).setAttribute('data-' + group, mode);
    add(wrap, 'span', group + '-state');
  }
  const scroll = add(chart, 'div', null, 'gantt-scroll'), table = add(scroll, 'table'); add(table, 'caption', null, 'gantt-caption');
  const header = add(add(table, 'thead'), 'tr'); add(header, 'th', null, '', 'Task'); add(header, 'th', null, '', 'Owner');
  const tbody = add(table, 'tbody');
  function row(type, number, title) { const tr = add(tbody, 'tr', null, type); tr.setAttribute('style', '--category-accent:#123'); const th = add(tr, 'th'); add(th, 'span', null, type === 'gantt-category' ? 'gantt-category-number' : 'gantt-outline-number', number); th.append(' ' + title); add(tr, 'td'); return tr; }
  const plan = [];
  for (let i = 1; i <= 13; i++) {
    row('gantt-category', i + '.', 'Area ' + i);
    const area = { id: String(i), title: 'Area ' + i, style: '--category-accent:#123', tasks: [] }; plan.push(area);
    if (i === 1) { row('gantt-workstream', '1.1', 'Group'); row('gantt-subtask', '1.1.1', 'Original step'); area.tasks.push({ id: '1.1', title: 'Group', subtasks: [{ id: '1.1.1', title: 'Original step', start, end }] }); }
  }
  add(chart, 'p', null, 'gantt-empty'); add(chart, 'button', 'back-task-board');
  add(body, 'div', 'task-board-view'); add(body, 'button', 'open-gantt'); const preview = add(body, 'div', 'gantt-preview-chart');
  const sidebar = add(body, 'button', null, 'sidebar-item'); sidebar.dataset.section = 'Task board';
  if (alterSaved) alterSaved(plan);
  if (saved) { storage.set('festival-gantt-project-v1', JSON.stringify(plan)); storage.set('festival-gantt-date-anchor', '2027-03-20'); storage.set('festival-gantt-end-date-anchor', '2027-03-21'); }
  const window = { festivalAccess: { role }, scrollTo() {}, confirm: () => controls.allowLeave,
    getLineupDataProblem: () => controls.lineupProblem,
    isFestivalContextCurrent: () => !controls.stale,
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); } };
  const localStorage = { getItem: key => storage.get(key) ?? null,
    setItem(key, value) { if (controls.failWrites) throw new Error('Storage unavailable'); storage.set(key, String(value)); }, removeItem: key => storage.delete(key) };
  const context = vm.createContext({ window, document, localStorage, Date, Intl, Event, console,
    Option: function(text, value) { const option = new Element('option'); option.textContent = text; option.value = value; return option; },
    CSS: { escape: value => String(value) }, crypto: require('node:crypto').webcrypto,
    setInterval() { return 1; }, clearInterval() {}, toast: message => notices.push(message),
    state: { event: { name: 'Test festival', startDate: eventStart, endDate: eventEnd } } });
  const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  for (const file of ['rules/project-rules.js', 'rules/task-rules.js', 'rules/access-rules.js', 'gantt-defaults.js']) load(file);
  const person = { userId: '11111111-1111-4111-8111-111111111111', username: 'Test', role: 'Admin' };
  window.taskAssignments = { read: () => JSON.parse(vm.runInContext('JSON.stringify(parseAssignments(localStorage.getItem(TASK_ASSIGNMENTS_KEY)))', context)),
    people: () => [person], canAssign: () => role === 'Admin', nameOf: () => 'Test' };
  for (const file of ['gantt-editor.js', 'gantt-placeholder.js', 'gantt-schedule.js']) load(file);
  return { window, document, chart, header, sidebar, preview, storage, controls, notices,
    get allocations() { return allocations; }, load,
    run: source => vm.runInContext(source, context) };
}

test('actual timeline rendering stays bounded for saved year 0001 and far-future dates', () => {
  for (const [start, end] of [['0001-01-01', '2027-01-02'], ['9999-01-01', '9999-12-31']]) {
    const ui = screen({ start, end });
    assert.ok(ui.header.children.length <= PROJECT_TIMELINE_DAYS + 2);
    assert.ok(ui.allocations < 20000);
    assert.match(ui.chart.querySelector('.gantt-empty').textContent, /26 weeks/);
    assert.match(ui.chart.querySelector('.gantt-empty').textContent, /Save changes/);
    assert.match(ui.chart.querySelector('.gantt-empty').textContent, /Cancel/);
    assert.equal(ui.preview.children.length, 0, 'hidden legacy preview is not built');
    assert.equal(JSON.parse(ui.storage.get('festival-gantt-project-v1'))[0].tasks[0].subtasks[0].start, start);
    const jump = ui.chart.querySelector('#gantt-window-controls input'); jump.value = start; jump.onchange();
    assert.ok(ui.header.children.length <= PROJECT_TIMELINE_DAYS + 2);
    assert.equal(ui.window.getSavedGanttPlan()[0].tasks[0].subtasks[0].start, start);
  }
});

test('invalid row dates do not create an unbounded grid or silently save a replacement', () => {
  const ui = screen();
  const before = ui.storage.get('festival-gantt-project-v1');
  const row = ui.chart.querySelector('.gantt-subtask'); row.dataset.startDate = 'not-a-date';
  ui.window.initialiseGanttTimeline();
  assert.ok(ui.header.children.length <= PROJECT_TIMELINE_DAYS + 2);
  assert.match(ui.chart.querySelector('.gantt-empty').textContent, /1 task date ranges are invalid/);
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
});

test('malformed saved task dates retain the saved data and block replacing it with template tasks', () => {
  const ui = screen({ start: 'not-a-date' });
  const before = ui.storage.get('festival-gantt-project-v1');
  assert.match(ui.window.getProjectDataProblem(), /kept unchanged/);
  assert.equal(ui.window.getSavedGanttPlan().length, 0);
  assert.equal(ui.document.querySelector('#gantt-edit').hidden, true);
  assert.match(ui.chart.querySelector('.gantt-empty').textContent, /kept unchanged/);
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
  assert.ok(ui.header.children.length <= PROJECT_TIMELINE_DAYS + 2);
});

test('actual outline refresh binds sidebar navigation once', () => {
  const ui = screen();
  for (let i = 0; i < 3; i++) ui.window.initialiseGanttOutline();
  assert.equal(ui.sidebar.handlers.get('click').length, 1);
});

test('project navigation can cancel leaving or discard an unsaved draft before storage changes', () => {
  const ui = screen(), before = ui.storage.get('festival-gantt-project-v1');
  ui.document.querySelector('#gantt-edit').onclick();
  const name = ui.chart.querySelector('.gantt-subtask .gantt-inline-name'); name.value = 'Unsaved edit'; name.oninput();
  assert.equal(ui.window.hasUnsavedProjectChanges(), true);
  assert.equal(ui.window.confirmProjectNavigation(), false);
  assert.equal(ui.window.hasUnsavedProjectChanges(), true);
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
  ui.controls.allowLeave = true;
  assert.equal(ui.window.confirmProjectNavigation(), true);
  assert.equal(ui.window.hasUnsavedProjectChanges(), false);
  assert.equal(ui.window.getSavedGanttPlan()[0].tasks[0].subtasks[0].title, 'Original step');
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
});

test('project save preserves a draft on storage failure and rejects stale contexts before writing', () => {
  const ui = screen(), before = ui.storage.get('festival-gantt-project-v1');
  ui.document.querySelector('#gantt-edit').onclick();
  const name = ui.chart.querySelector('.gantt-subtask .gantt-inline-name'); name.value = 'Keep this draft'; name.oninput();
  ui.controls.failWrites = true; ui.document.querySelector('#inline-save').onclick();
  assert.equal(ui.window.hasUnsavedProjectChanges(), true);
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
  ui.controls.failWrites = false; ui.controls.stale = true; ui.document.querySelector('#inline-save').onclick();
  assert.equal(ui.window.hasUnsavedProjectChanges(), true);
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
  assert.match(ui.document.querySelector('#inline-error').textContent, /different festival/);
  ui.controls.stale = false; ui.document.querySelector('#inline-save').onclick();
  assert.equal(ui.window.hasUnsavedProjectChanges(), false);
  assert.equal(JSON.parse(ui.storage.get('festival-gantt-project-v1'))[0].tasks[0].subtasks[0].title, 'Keep this draft');
});

test('window bounds ignore malformed offsets and keep ordinary schedules unchanged', () => {
  const ordinary = projectTimelineWindow({ openingDate: '2027-03-20', closingDate: '2027-03-21', ranges: [{ start: -100, end: -1 }, { start: NaN, end: Infinity }] });
  assert.equal(ordinary.start, -105); assert.equal(ordinary.end, 13); assert.equal(ordinary.limited, false);
  assert.throws(() => projectTimelineWindow({ openingDate: 'invalid', closingDate: '2027-03-21' }), /valid festival dates/);
  assert.throws(() => projectTimelineWindow({ openingDate: '0000-01-01', closingDate: '0000-01-02' }), /valid festival dates/);
});

test('an invalid navigation date cannot prevent saving valid project task edits', () => {
  const ui = screen({ start: '0001-01-01' });
  ui.document.querySelector('#gantt-edit').onclick();
  const name = ui.chart.querySelector('.gantt-subtask .gantt-inline-name'); name.value = 'Valid task edit'; name.oninput();
  const jump = ui.chart.querySelector('#gantt-window-controls input'); jump.value = ''; jump.onchange();
  assert.equal(jump.checkValidity(), false);
  ui.document.querySelector('#inline-save').onclick();
  assert.equal(ui.window.hasUnsavedProjectChanges(), false);
  assert.equal(JSON.parse(ui.storage.get('festival-gantt-project-v1'))[0].tasks[0].subtasks[0].title, 'Valid task edit');
});

test('an unreadable lineup never rebases saved tasks against placeholder dates and recovery restores editing', () => {
  const ui = screen({ lineupProblem: 'The saved lineup needs recovery.', eventStart: '2030-06-01', eventEnd: '2030-06-02' });
  const before = ui.storage.get('festival-gantt-project-v1');
  assert.equal(ui.window.getSavedGanttPlan().length, 0);
  assert.equal(ui.document.querySelector('#gantt-edit').hidden, true);
  assert.throws(() => ui.window.deleteBoardSubtask('1.1.1'), /lineup needs recovery/);
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
  ui.controls.lineupProblem = '';
  ui.run("state.event.startDate='2027-03-20';state.event.endDate='2027-03-21'");
  ui.window.refreshGanttFestivalDates();
  assert.equal(ui.window.getSavedGanttPlan()[0].tasks[0].subtasks[0].start, '2027-01-01');
  assert.equal(ui.document.querySelector('#gantt-edit').hidden, false);
  assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
});


test('missing, duplicate or selector-unsafe saved task identifiers stay unchanged and cannot be edited', () => {
  const cases = [
    plan => { delete plan[0].id; },
    plan => { plan[1].id = plan[0].id; },
    plan => { delete plan[0].tasks[0].id; },
    plan => { plan[0].tasks.push(JSON.parse(JSON.stringify(plan[0].tasks[0]))); },
    plan => { delete plan[0].tasks[0].subtasks[0].id; },
    plan => { plan[0].tasks[0].subtasks.push({ ...plan[0].tasks[0].subtasks[0] }); },
    plan => { plan[0].tasks[0].id = '" data-audit="unsafe'; },
    plan => { plan[0].tasks[0].subtasks[0].id = '" data-audit="unsafe'; }
  ];
  for (const alterSaved of cases) {
    const ui = screen({ alterSaved }), before = ui.storage.get('festival-gantt-project-v1');
    assert.match(ui.window.getProjectDataProblem(), /kept unchanged/);
    assert.equal(ui.document.querySelector('#gantt-edit').hidden, true);
    assert.equal(ui.window.getSavedGanttPlan().length, 0);
    assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
    assert.throws(() => ui.window.addBoardSubtask({}), /kept unchanged/);
    assert.equal(ui.storage.get('festival-gantt-project-v1'), before);
  }
});
