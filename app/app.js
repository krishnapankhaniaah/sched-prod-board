import { fetchIncidents, ack } from './api.js';

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const acked = new Set();
let current = [];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The viewer's own zone and locale order: dd/mm for EU locales, mm/dd for en-US.
const fmt = new Intl.DateTimeFormat(navigator.language, {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const local = (iso) => fmt.format(new Date(iso));

function rowHtml(i) {
  const done = acked.has(i.id);
  return `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
    <span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}">${esc(local(i.openedAt))}</time>
    ${done ? '<span data-testid="acked" class="acked">acked</span>' : '<button type="button" data-testid="ack">Ack</button>'}
  </li>`;
}

function render() {
  const sorted = [...current].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
  list.innerHTML = sorted.map(rowHtml).join('');
  empty.hidden = sorted.length > 0;
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.closest('[data-testid="incident-row"]').dataset.id;
  btn.disabled = true;
  try {
    await ack(id);
    acked.add(id);
    render();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
  }
});

async function refresh() {
  try {
    current = (await fetchIncidents()).incidents;
    loader.hidden = true;
    render();
  } catch (err) {
    console.error(err);
  }
}

board.setAttribute('aria-busy', 'true');
await refresh();
board.removeAttribute('aria-busy');
setInterval(refresh, 2000);
