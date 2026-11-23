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
  for (const id of ['gantt-clear-dialog']) {
    const dialog = add(body, 'dialog', id);
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; };
    const form = add(dialog, 'form');
    add(form, 'p', null, 'hero-copy');
    add(form, 'p').setAttribute('role', 'alert');
    add(form, 'button').setAttribute('data-cancel', '');
  }
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

test('board creation saves a custom area and its first subtask together and reloads larger plans', () => {
  const ui = screen({ role: 'Editor' });
  const details = { newAreaName: '  Comms  ', parentName: 'Signs', title: 'Print signs',
    start: '2027-03-01', end: '2027-03-03' };
  ui.controls.failWrites = true;
  assert.throws(() => ui.window.addBoardSubtask(details), /Could not save/);
  assert.equal(ui.window.getSavedGanttPlan().length, 13);
  ui.controls.failWrites = false;
  const id = ui.window.addBoardSubtask(details);
  const saved = JSON.parse(ui.storage.get('festival-gantt-project-v1'));
  assert.equal(saved.length, 14);
  assert.equal(saved.at(-1).title, 'Comms');
  assert.equal(saved.at(-1).tasks[0].subtasks[0].id, id);
  assert.throws(() => ui.window.addBoardSubtask({ ...details, newAreaName: 'comms' }), /already exists/);
  const reloaded = screen({ alterSaved: plan => plan.push(saved.at(-1)) });
  assert.equal(reloaded.window.getProjectDataProblem(), '');
  assert.match(reloaded.chart.querySelector('.gantt-count').textContent, /^14 areas/);
  assert.throws(() => screen({ role: 'Viewer' }).window.addBoardSubtask(details), /cannot add tasks/);
});

test('editing a board task saves its owner with the other edits and enforces assignment permission', () => {
  const ui = screen();
  const ownerId = ui.window.taskAssignments.people()[0].userId;
  const details = {stepId: '1.1.1', areaId: '1', taskId: '1.1', title: 'Renamed step',
    start: '2027-01-01', end: '2027-01-02', ownerId};
  assert.throws(() => ui.window.updateBoardSubtask({ ...details, ownerId: 'unknown' }), /festival team/);
  assert.throws(() => ui.window.updateBoardSubtask({ ...details, stepId: 'unknown' }), /no longer exists/);
  ui.controls.stale = true;
  assert.throws(() => ui.window.updateBoardSubtask(details), /different festival/);
  ui.controls.stale = false;
  ui.controls.failWrites = true;
  assert.throws(() => ui.window.updateBoardSubtask(details), /previous task is kept/);
  assert.equal(ui.window.getSavedGanttPlan()[0].tasks[0].subtasks[0].title, 'Original step');
  assert.equal(ui.window.taskAssignments.read().steps['1.1.1'], undefined);
  ui.controls.failWrites = false;
  ui.window.updateBoardSubtask(details);
  assert.equal(ui.window.getSavedGanttPlan()[0].tasks[0].subtasks[0].title, 'Renamed step');
  assert.equal(ui.window.taskAssignments.read().steps['1.1.1'], ownerId);
  ui.window.updateBoardSubtask({ ...details, ownerId: '' });
  assert.equal(ui.window.taskAssignments.read().steps['1.1.1'], undefined);

  const editor = screen({ role: 'Editor' });
  assert.throws(() => editor.window.updateBoardSubtask(details), /creator and Admins/);
  editor.window.updateBoardSubtask({ ...details, ownerId: undefined });
  assert.equal(editor.window.getSavedGanttPlan()[0].tasks[0].subtasks[0].title, 'Renamed step');
  assert.throws(() => screen({ role: 'Viewer' }).window.updateBoardSubtask(details), /cannot edit tasks/);
});

test('timeline add-area row requires a dated first subtask and uses the timeline draft', () => {
  const ui = screen({ role: 'Editor' });
  const find = selector => ui.document.querySelector(selector);
  const row = find('.gantt-add-area-row');
  const details = { newAreaName: 'Visitor information', parentName: 'Signage', title: 'Draft the signs',
    start: '2027-03-01', end: '2027-03-03' };
  let opened = 0;
  ui.window.openTimelineAreaDialog = () => { opened++; };
  assert.equal(row.hidden, true);
  assert.throws(() => ui.window.addTimelineWorkArea(details), /edit mode/);
  find('#gantt-edit').onclick();
  assert.equal(row.hidden, false);
  find('#gantt-add-area-row').onclick();
  assert.equal(opened, 1);
  assert.throws(() => ui.window.addTimelineWorkArea({ ...details, parentName: '' }), /task group name/);
  assert.throws(() => ui.window.addTimelineWorkArea({ ...details, title: '' }), /task name/);
  assert.throws(() => ui.window.addTimelineWorkArea({ ...details, end: '2027-02-28' }), /valid dates/);
  assert.equal(ui.window.hasUnsavedProjectChanges(), false);
  ui.window.addTimelineWorkArea(details);
  assert.match(find('.gantt-count').textContent, /^14 areas, 2 tasks, 2 subtasks/);
  assert.equal(ui.window.getSavedGanttPlan().length, 13);
  find('#inline-cancel').onclick();
  assert.equal(row.hidden, true);
  assert.match(find('.gantt-count').textContent, /^13 areas/);
  find('#gantt-edit').onclick();
  ui.window.addTimelineWorkArea(details);
  find('#inline-save').onclick();
  const area = JSON.parse(ui.storage.get('festival-gantt-project-v1')).at(-1);
  assert.equal(area.title, 'Visitor information');
  assert.equal(area.tasks[0].title, 'Signage');
  assert.equal(area.tasks[0].subtasks[0].title, 'Draft the signs');
  assert.equal(area.tasks[0].subtasks[0].end, details.end);
  assert.equal(row.hidden, true);
  assert.throws(() => screen({ role: 'Viewer' }).window.addTimelineWorkArea(details), /edit mode/);
});

test('Admin area management renames, moves and deletes through the shared project save', () => {
  const ui = screen();
  const planKey = 'festival-gantt-project-v1';
  const statusKey = 'festival-work-board-status-v1';
  const ownerKey = 'festival-task-assignments-v1';
  ui.storage.set(statusKey, '{"1.1.1":"done"}');
  const person = ui.window.taskAssignments.people()[0];
  ui.storage.set(ownerKey, JSON.stringify({ groups: {}, steps: { '1.1.1': person.userId } }));
  const old = ui.storage.get(planKey);
  assert.throws(() => ui.window.manageProjectArea('1', { title: '  AREA 2 ' }), /already exists/);
  assert.throws(() => ui.window.manageProjectArea('1', {}), /move or delete/);
  assert.throws(() => ui.window.manageProjectArea('1', { destinationId: '1' }), /another work area/);
  assert.equal(ui.storage.get(planKey), old);
  ui.window.manageProjectArea('1', { title: 'Production' });
  assert.equal(ui.window.getSavedGanttPlan()[0].title, 'Production');
  ui.window.manageProjectArea('1', { destinationId: '2' });
  const moved = ui.window.getSavedGanttPlan()[0];
  assert.equal(moved.id, '2');
  assert.equal(moved.tasks[0].subtasks[0].id, '1.1.1');
  assert.equal(JSON.parse(ui.storage.get(statusKey))['1.1.1'], 'done');
  assert.equal(JSON.parse(ui.storage.get(ownerKey)).steps['1.1.1'], person.userId);
  ui.controls.failWrites = true;
  assert.throws(() => ui.window.manageProjectArea('2', { deleteTasks: true }), /previous project is kept/);
  assert.equal(ui.window.getSavedGanttPlan()[0].id, '2');
  ui.controls.failWrites = false;
  ui.window.manageProjectArea('2', { deleteTasks: true });
  assert.deepEqual(JSON.parse(ui.storage.get(statusKey)), {});
  assert.deepEqual(ui.window.taskAssignments.read(), { groups: {}, steps: {} });
  assert.equal(ui.window.getProjectDeletionSummary().subtasks, 1);
  for (const role of ['Editor', 'Viewer']) {
    assert.throws(() => screen({ role }).window.manageProjectArea('1', { title: 'Production' }), /creator and Admins/);
  }
});

test('area management participates in timeline drafts and allows an empty plan to reload', () => {
  const ui = screen({ alterSaved: plan => plan.splice(1) });
  const find = selector => ui.document.querySelector(selector);
  assert.equal(ui.window.getProjectDataProblem(), '');
  find('#gantt-edit').onclick();
  ui.window.manageProjectArea('1', { deleteTasks: true });
  assert.equal(ui.window.getProjectAreasForManagement().areas.length, 0);
  assert.equal(ui.window.getSavedGanttPlan().length, 1);
  find('#inline-cancel').onclick();
  assert.equal(ui.window.getProjectAreasForManagement().areas.length, 1);
  ui.window.manageProjectArea('1', { deleteTasks: true });
  assert.equal(ui.storage.get('festival-gantt-project-v1'), '[]');
  const reloaded = screen({ alterSaved: plan => { plan.length = 0; } });
  assert.equal(reloaded.window.getProjectDataProblem(), '');
  assert.match(reloaded.chart.querySelector('.gantt-count').textContent, /^0 areas/);
  reloaded.window.addBoardSubtask({ newAreaName: 'New plan', taskId: '', parentName: 'First group', title: 'First step',
    start: '2027-03-20', end: '2027-03-21' });
  assert.equal(reloaded.window.getSavedGanttPlan()[0].title, 'New plan');
});

test('restoring the last saved clear recovers dates, progress and assignment without replacing newer work', () => {
  const ui = screen();
  const find = selector => ui.document.querySelector(selector);
  const projectKey = 'festival-gantt-project-v1';
  const ownerKey = 'festival-task-assignments-v1';
  const statusKey = 'festival-work-board-status-v1';
  const userId = ui.window.taskAssignments.people()[0].userId;
  const giver = '22222222-2222-4222-8222-222222222222';
  ui.storage.set(ownerKey, JSON.stringify({ groups: { '1.1': userId }, steps: {},
    assignedBy: { groups: { '1.1': giver }, steps: {} } }));
  ui.storage.set(statusKey, JSON.stringify({ '1.1.1': { status: 'done', completedAt: 1234, completedBy: userId } }));
  find('#gantt-edit').onclick();
  find('#gantt-clear-dialog form').onsubmit({ preventDefault() {} });
  assert.equal(ui.window.getProjectDeletionSummary(), null);
  find('#inline-save').onclick();
  assert.equal(ui.window.getProjectDeletionSummary().subtasks, 1);
  ui.window.manageProjectArea('1', { title: 'New area title' });
  const newId = ui.window.addBoardSubtask({ areaId: '1', taskId: '', parentName: 'New group', title: 'New step',
    start: '2027-03-20', end: '2027-03-21' });
  ui.storage.set(statusKey, JSON.stringify({ [newId]: 'progress' }));
  const saved = JSON.parse(ui.storage.get(projectKey));
  const reloaded = screen({ alterSaved: plan => plan.splice(0, plan.length, ...saved) });
  reloaded.storage.set(ownerKey, ui.storage.get(ownerKey));
  reloaded.storage.set(statusKey, ui.storage.get(statusKey));
  reloaded.document.querySelector('#gantt-edit').onclick();
  assert.throws(() => reloaded.window.restoreLastProjectDeletion(), /timeline draft/);
  reloaded.document.querySelector('#inline-cancel').onclick();
  reloaded.controls.failWrites = true;
  assert.throws(() => reloaded.window.restoreLastProjectDeletion(), /retry/);
  assert.equal(reloaded.window.getProjectDeletionSummary().subtasks, 1);
  reloaded.controls.failWrites = false;
  reloaded.window.restoreLastProjectDeletion();
  const area = reloaded.window.getSavedGanttPlan()[0];
  assert.equal(area.title, 'New area title');
  assert.deepEqual(Array.from(area.tasks, group => group.subtasks[0].title), ['New step', 'Original step']);
  assert.equal(area.tasks[1].subtasks[0].start, '2027-01-01');
  assert.deepEqual(JSON.parse(reloaded.storage.get(statusKey)), {
    [newId]: 'progress', '1.1.1': { status: 'done', completedAt: 1234, completedBy: userId }
  });
  const owners = reloaded.window.taskAssignments.read();
  assert.equal(owners.steps['1.1.1'], userId);
  assert.equal(owners.assignedBy.steps['1.1.1'], giver);
  assert.equal(reloaded.window.getProjectDeletionSummary(), null);
  assert.throws(() => reloaded.window.restoreLastProjectDeletion(), /no saved deletion/);
});

test('only the most recent saved deletion can be restored, and moved groups stay where they are', () => {
  const ui = screen();
  ui.window.manageProjectArea('13', { deleteTasks: true });
  ui.window.manageProjectArea('1', { destinationId: '2' });
  assert.equal(ui.window.getProjectDeletionSummary().subtasks, 0);
  ui.window.restoreLastProjectDeletion();
  const plan = ui.window.getSavedGanttPlan();
  assert.equal(plan.find(area => area.id === '1').tasks.length, 0);
  assert.equal(plan.find(area => area.id === '2').tasks[0].id, '1.1');
  assert.equal(plan.some(area => area.id === '13'), false);
  for (const role of ['Editor', 'Viewer']) {
    const viewer = screen({ role });
    viewer.storage.set('festival-task-assignments-v1', ui.storage.get('festival-task-assignments-v1'));
    assert.equal(viewer.window.getProjectDeletionSummary(), null);
    assert.throws(() => viewer.window.restoreLastProjectDeletion(), /creator and Admins/);
  }
});

test('timeline clearing is an Admin-only draft operation', () => {
  const ui = screen();
  const find = selector => ui.document.querySelector(selector);
  const submit = id => find(id).querySelector('form').onsubmit({ preventDefault() {} });
  find('#gantt-edit').onclick();
  assert.equal(find('#gantt-add-area'), null);
  find('#gantt-clear-tasks').onclick();
  assert.equal(find('#gantt-clear-dialog').open, true);
  submit('#gantt-clear-dialog');
  assert.equal(ui.window.getSavedGanttPlan()[0].tasks.length, 1);
  find('#inline-cancel').onclick();
  assert.match(find('.gantt-count').textContent, /^13 areas, 1 tasks/);
  ui.storage.set('festival-work-board-status-v1', '{"1.1.1":"done"}');
  ui.storage.set('festival-task-assignments-v1', JSON.stringify({ groups: {},
    steps: { '1.1.1': ui.window.taskAssignments.people()[0].userId } }));
  find('#gantt-edit').onclick();
  find('#gantt-clear-tasks').onclick();
  submit('#gantt-clear-dialog');
  find('#inline-save').onclick();
  assert.equal(ui.window.getSavedGanttPlan().length, 13);
  assert.ok(ui.window.getSavedGanttPlan().every(area => area.tasks.length === 0));
  assert.deepEqual(JSON.parse(ui.storage.get('festival-work-board-status-v1')), {});
  assert.deepEqual(ui.window.taskAssignments.read(), { groups: {}, steps: {} });
  assert.equal(ui.window.getProjectDeletionSummary().subtasks, 1);
  const editor = screen({ role: 'Editor' });
  editor.document.querySelector('#gantt-edit').onclick();
  assert.equal(editor.document.querySelector('#gantt-clear-tasks').hidden, true);
  editor.document.querySelector('#gantt-clear-dialog form').onsubmit({ preventDefault() {} });
  assert.match(editor.document.querySelector('#gantt-clear-dialog [role="alert"]').textContent, /creator and Admins/);
  assert.match(editor.document.querySelector('.gantt-count').textContent, /^13 areas, 1 tasks/);
});
