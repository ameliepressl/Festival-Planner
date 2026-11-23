// The bell in the top bar: my new tasks, due-soon and overdue deadlines (feature-plans/notifications.md).
// The rules are in rules/notification-rules.js; this file only shows them and keeps the read state.
// Reads the plan, never changes it. Task titles are user input, so everything is set as text.
(function () {
  const root = document.querySelector('#notifications');
  const bell = document.querySelector('#notifications-button');
  const count = document.querySelector('#notifications-count');
  const panel = document.querySelector('#notifications-panel');
  const list = document.querySelector('#notifications-list');
  const empty = document.querySelector('#notifications-empty');
  const readAll = document.querySelector('#notifications-read-all');
  const SHOWN_MAX = 20;
  const dueDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  let current = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // Everything the rules need, or null when there is nothing to notify about (no account, not on the team).
  function context() {
    const tasks = window.taskAssignments;
    const snapshot = window.getProjectTaskSnapshot?.();
    const myUserId = tasks?.myUserId();
    const key = notificationSeenKey(window.currentFestivalId?.(), myUserId);
    const people = tasks?.people() || [];
    if (!snapshot || !key || !people.some((person) => person.userId === myUserId)) return null;
    return { key, today: snapshot.today, steps: snapshot.steps, assignments: tasks.read(), people, myUserId };
  }

  function readSeen(key) {
    try { return parseSeen(localStorage.getItem(key)); } catch { return emptySeen(); }
  }

  function dueLabel(item) {
    if (!item.end || item.days === null) return '';
    return 'Due ' + dueDate.format(new Date(item.end + 'T12:00:00Z'));
  }

  function renderItem(item) {
    const row = element('li');
    const button = element('button', 'notification-item');
    button.type = 'button';
    button.dataset.kind = item.kind;
    button.dataset.stepId = item.stepId;
    if (item.unread) button.classList.add('unread');
    const text = element('span', 'notification-text', notificationText(item));
    // e.g. "Due Fri 20 Nov · From Amelie"
    const details = [dueLabel(item), notificationSource(item)].filter(Boolean).join(' · ');
    const meta = element('span', 'notification-meta', details);
    if (item.isNew && item.kind !== 'new') meta.prepend(element('b', 'notification-new', 'New'));
    button.append(element('span', 'notification-dot'), text, meta);
    button.setAttribute('aria-label', (item.unread ? 'Unread: ' : '') + text.textContent + (details ? '. ' + details : ''));
    button.addEventListener('click', () => openTask(item.stepId));
    row.append(button);
    return row;
  }

  function render() {
    const data = context();
    root.hidden = !data;
    if (!data) { close(); current = null; return; }
    current = { ...data, ...notificationsFor({ ...data, seen: readSeen(data.key) }) };
    const badge = notificationBadge(current.unread);
    count.textContent = badge;
    count.hidden = !badge;
    bell.classList.toggle('has-unread', Boolean(badge));
    bell.setAttribute('aria-label', current.unread
      ? `Notifications, ${current.unread} unread` : 'Notifications, none unread');
    readAll.disabled = !current.unread;
    const rows = current.items.slice(0, SHOWN_MAX).map(renderItem);
    if (current.items.length > SHOWN_MAX) {
      const more = element('button', 'notification-more', `Show all ${current.items.length} in My tasks`);
      more.type = 'button';
      more.addEventListener('click', () => openTask(null));
      const row = element('li');
      row.append(more);
      rows.push(row);
    }
    list.replaceChildren(...rows);
    empty.hidden = current.items.length > 0;
    empty.textContent = notificationEmptyText(Boolean(window.taskAssignments?.canAssign?.()));
  }

  function open() {
    render();
    if (root.hidden) return;
    // On a phone the list spans the screen (notifications.css); it opens just below the bell.
    if (window.matchMedia?.('(max-width: 650px)').matches) {
      panel.style.top = Math.round(bell.getBoundingClientRect().bottom + 8) + 'px';
    }
    panel.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    (panel.querySelector('.notification-item') || readAll).focus();
  }

  function close(returnFocus = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    panel.style.top = '';
    bell.setAttribute('aria-expanded', 'false');
    if (returnFocus) bell.focus();
  }

  // Project tasks → "My tasks", with the task in view (the same board the Overview opens).
  function openTask(stepId) {
    close();
    window.openTaskBoard?.({ assignee: 'me' });
    if (!stepId) return;
    const card = Array.from(document.querySelectorAll('#work-board-columns .work-board-card'))
      .find((item) => item.dataset.cardId === String(stepId));
    if (!card) return;
    card.classList.add('notification-target');
    card.focus();
    card.scrollIntoView({ block: 'center', inline: 'nearest' });
    setTimeout(() => card.classList.remove('notification-target'), 2400);
  }

  function markRead() {
    const data = context();
    if (!data) return;
    try { localStorage.setItem(data.key, JSON.stringify(markAllRead(data))); }
    catch { window.toast?.('Could not save that you read the notifications in this browser.'); return; }
    render();
    bell.focus();
  }

  bell.addEventListener('click', () => (panel.hidden ? open() : close()));
  readAll.addEventListener('click', markRead);
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(true); });
  document.addEventListener('click', (event) => { if (!root.contains(event.target)) close(); });

  ['task-assignments-changed', 'work-board-updated', 'gantt-project-changed', 'project-task-tracking-changed']
    .forEach((name) => window.addEventListener(name, render));
  // A new day turns "due soon" into "overdue" and brings read deadlines back.
  setInterval(() => { if (current && window.getProjectTaskSnapshot?.().today !== current.today) render(); }, 60000);
  panel.hidden = true;
  // Once the account has loaded the festival (right away when it already has).
  if (typeof window.whenAccountReady === 'function') window.whenAccountReady(render);
  else render();
})();
