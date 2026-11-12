import { fetchIncidents, ack } from './api.js';

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const acked = new Set();
let current = [];
let selected = null;
const panel = document.querySelector('[data-testid="incident-panel"]');
const panelAck = document.querySelector('[data-testid="panel-ack"]');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The viewer's own zone and locale order: dd/mm for EU locales, mm/dd for en-US.
const fmt = new Intl.DateTimeFormat(navigator.language, {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const local = (iso) => fmt.format(new Date(iso));

function rowHtml(i) {
  return `<span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}">${esc(local(i.openedAt))}</time>`;
}

// Rows stay in the DOM between refreshes: new incidents are inserted, existing rows are updated in place.
function render() {
  const sorted = [...current].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
  const keep = new Set(sorted.map((i) => i.id));
  const existing = new Map();
  for (const li of [...list.children]) {
    if (keep.has(li.dataset.id)) existing.set(li.dataset.id, li);
    else li.remove();
  }
  sorted.forEach((i, idx) => {
    let li = existing.get(i.id);
    if (!li) {
      li = document.createElement('li');
      li.dataset.testid = 'incident-row';
      li.dataset.id = i.id;
      li.tabIndex = 0;
      li.innerHTML = rowHtml(i);
    }
    li.className = `row ${i.severity}${i.id === selected ? ' selected' : ''}`;
    const mark = li.querySelector('[data-testid="acked"]');
    if (acked.has(i.id) && !mark) {
      const m = document.createElement('span');
      m.dataset.testid = 'acked';
      m.className = 'acked';
      m.textContent = 'acked';
      li.append(m);
    }
    const t = li.querySelector('time');
    if (t.getAttribute('datetime') !== i.openedAt) {
      t.setAttribute('datetime', i.openedAt);
      t.textContent = local(i.openedAt);
    }
    if (list.children[idx] !== li) list.insertBefore(li, list.children[idx] ?? null);
  });
  empty.hidden = sorted.length > 0;
}

function showPanel() {
  const i = current.find((x) => x.id === selected);
  panel.hidden = !i;
  if (!i) return;
  panel.querySelector('.panel-id').textContent = i.id;
  panel.querySelector('.panel-what').textContent = `${i.severity} · ${i.service} · ${i.region} · ${i.summary}`;
  panel.querySelector('.panel-time').textContent = local(i.openedAt);
  panelAck.disabled = acked.has(i.id);
  panelAck.textContent = acked.has(i.id) ? 'Acked' : 'Ack';
}

function open(row) {
  if (!row) return;
  selected = row.dataset.id;
  render();
  showPanel();
}

list.addEventListener('click', (e) => open(e.target.closest('[data-testid="incident-row"]')));
list.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    open(e.target.closest('[data-testid="incident-row"]'));
  }
});
panel.querySelector('.panel-close').addEventListener('click', () => {
  selected = null;
  render();
  showPanel();
});

panelAck.addEventListener('click', async () => {
  const id = selected;
  if (!id) return;
  panelAck.disabled = true;
  try {
    await ack(id);
    acked.add(id);
    render();
    showPanel();
  } catch (err) {
    console.error(err);
    panelAck.disabled = false;
  }
});

async function refresh() {
  try {
    current = (await fetchIncidents()).incidents;
    loader.hidden = true;
    render();
    showPanel();
  } catch (err) {
    console.error(err);
  }
}

board.setAttribute('aria-busy', 'true');
await refresh();
board.removeAttribute('aria-busy');
setInterval(refresh, 2000);
