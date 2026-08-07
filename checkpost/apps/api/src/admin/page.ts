import type { AdminList, AdminTotals } from '../services/admin-service.js';
import { VERSION } from '../version.js';

/**
 * Every value that reaches this file is user input. List titles come from
 * whoever holds a link, which is anyone, so nothing is interpolated without
 * going through here first.
 */
export function esc(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ago(date: Date): string {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 90) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 90) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 36) return `${Math.round(hours)} h ago`;
  const days = hours / 24;
  if (days < 45) return `${Math.round(days)} d ago`;
  return `${Math.round(days / 30)} mo ago`;
}

export interface PageInput {
  totals: AdminTotals;
  lists: AdminList[];
  orphanLinks: number;
  databaseHost: string;
  webOrigin: string;
  csrf: (listId: string) => string;
  /** Set once, immediately after reissuing, and never stored. */
  revealed?: { listId: string; url: string } | null;
  notice?: string | null;
}

export function renderAdmin(input: PageInput): string {
  const { totals, lists, orphanLinks, databaseHost, csrf, revealed, notice } = input;
  const open = totals.items - totals.done;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Checkpost admin</title>
<style>${css}</style>
</head>
<body>
<header>
  <h1>Checkpost admin</h1>
  <p class="meta">v${esc(VERSION)} · ${esc(databaseHost)}</p>
</header>

${notice ? `<p class="notice">${esc(notice)}</p>` : ''}

${
  revealed
    ? `<section class="revealed">
        <h2>New link for this list</h2>
        <p>Shown once. It is not stored anywhere in a readable form, so this is the only chance to copy it. The previous link stopped working the moment this one was made.</p>
        <code>${esc(revealed.url)}</code>
      </section>`
    : ''
}

<section>
  <h2>Right now</h2>
  <dl class="stats">
    <div><dt>Lists</dt><dd>${totals.lists}</dd></div>
    <div><dt>Items</dt><dd>${totals.items}</dd></div>
    <div><dt>Ticked off</dt><dd>${totals.done}<span class="of"> of ${totals.items}</span></dd></div>
    <div><dt>Still open</dt><dd>${open}</dd></div>
    <div><dt>Live links</dt><dd>${totals.activeLinks}</dd></div>
    <div><dt>Replaced links</dt><dd>${totals.revokedLinks}</dd></div>
    <div><dt>Changes recorded</dt><dd>${totals.events}</dd></div>
    <div><dt>New this week</dt><dd>${totals.listsThisWeek}</dd></div>
    <div><dt>Touched this week</dt><dd>${totals.activeThisWeek}</dd></div>
    <div><dt>Empty lists</dt><dd>${totals.emptyLists}</dd></div>
    <div><dt>Links awaiting the reaper</dt><dd>${orphanLinks}</dd></div>
  </dl>
</section>

<section>
  <h2>Lists <span class="count">${lists.length} shown, most recently touched first</span></h2>

  <p class="why">
    The share URL is not here because it is not stored. Only the SHA-256 of a
    token ever reaches the database, which is what makes a leaked backup
    harmless. Issuing a new link is the only way to get a working URL out of
    this page, and it costs the old one.
  </p>

  ${
    lists.length === 0
      ? '<p class="empty">No lists yet.</p>'
      : `<table>
    <thead>
      <tr><th>List</th><th class="num">Done</th><th class="num">Links</th><th>Last touched</th><th>Made</th><th class="actions">Actions</th></tr>
    </thead>
    <tbody>
      ${lists
        .map(
          (list) => `<tr>
        <td>
          <span class="title">${esc(list.title)}</span>
          <span class="id">${esc(list.id)}</span>
        </td>
        <td class="num">${list.done}<span class="of"> / ${list.items}</span></td>
        <td class="num">${list.activeLinks}${list.revokedLinks ? `<span class="of"> +${list.revokedLinks} dead</span>` : ''}</td>
        <td>${esc(ago(list.lastActiveAt))}</td>
        <td>${esc(ago(list.createdAt))}</td>
        <td class="actions">
          <div class="buttons">
          <form method="post" action="/v1/admin/lists/${esc(list.id)}/reissue">
            <input type="hidden" name="csrf" value="${esc(csrf(list.id))}">
            <button type="submit">Issue new link</button>
          </form>
          <form method="post" action="/v1/admin/lists/${esc(list.id)}/delete"
                onsubmit="return confirm('Delete &quot;${esc(list.title).replaceAll("'", '&#39;')}&quot; for everyone? There is no undo.')">
            <input type="hidden" name="csrf" value="${esc(csrf(list.id))}">
            <button type="submit" class="quiet">Delete</button>
          </form>
          </div>
        </td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>`
  }
</section>

<footer>
  <p>Reading this page counts as activity on nothing. Opening a list from here is not possible without issuing a link, by design.</p>
</footer>
</body>
</html>`;
}

const css = `
:root {
  color-scheme: light dark;
  --bg: #ffffff; --surface: #f9f4f6; --line: #e3dade; --line-strong: #cfc4c8;
  --ink: #1a1417; --ink-muted: #6c6166; --ink-faint: #8d8387;
  --primary: #c62d6a; --primary-quiet: #ffe8ee; --on-primary: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #110e0f; --surface: #1e181b; --line: #342d30; --line-strong: #4e4549;
    --ink: #f2eff0; --ink-muted: #ab9fa4; --ink-faint: #82777b;
    --primary: #f06e98; --primary-quiet: #401e28; --on-primary: #110e0f;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px 20px 64px;
  background: var(--bg); color: var(--ink);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  max-width: 68rem; margin-inline: auto;
}
h1 { font-size: 1.5rem; letter-spacing: -0.02em; margin: 0; }
h2 { font-size: 1.05rem; letter-spacing: -0.01em; margin: 0 0 10px; }
p { margin: 0; }
header { margin-bottom: 28px; }
.meta { color: var(--ink-muted); font-size: 0.85rem; margin-top: 4px; }
section { margin-bottom: 36px; }
.count { font-weight: 400; font-size: 0.82rem; color: var(--ink-muted); }
.why, .empty, footer p {
  color: var(--ink-muted); font-size: 0.87rem; max-width: 62ch; margin-bottom: 14px;
}
footer p { margin-top: 40px; }

/* A status page, not a wall of hero numbers. Dense, quiet, scannable.
   Bordered per cell rather than a 1px-gap grid, because the gap trick leaves a
   filled phantom cell whenever the count does not divide by the column count. */
.stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 8px; margin: 0; }
.stats > div { background: var(--bg); border: 1px solid var(--line);
  border-radius: 10px; padding: 11px 13px; }
dt { font-size: 0.78rem; color: var(--ink-muted); }
dd { margin: 2px 0 0; font-size: 1.25rem; font-weight: 600; letter-spacing: -0.01em; }
.of { font-size: 0.8rem; font-weight: 400; color: var(--ink-muted); }

table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { text-align: left; font-size: 0.75rem; text-transform: none; font-weight: 600;
  color: var(--ink-muted); padding: 0 10px 8px 0; border-bottom: 1px solid var(--line); }
td { padding: 12px 10px 12px 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
.num { text-align: right; padding-right: 18px; white-space: nowrap; }
th.num { text-align: right; }
.title { display: block; font-weight: 500; overflow-wrap: anywhere; }
.id { display: block; margin-top: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem; color: var(--ink-faint); }
/* The buttons are wrapped rather than the cell being made a flex container,
   which would take the cell out of the table row and misalign its border. */
.actions { white-space: nowrap; }
.buttons { display: flex; gap: 8px; flex-wrap: wrap; }
form { margin: 0; }
button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 8px;
  background: var(--primary); color: var(--on-primary);
  font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
button.quiet { background: none; box-shadow: inset 0 0 0 1px var(--line-strong); color: var(--ink); }

.notice { padding: 12px 16px; background: var(--primary-quiet); border-radius: 10px; margin-bottom: 24px; }
.revealed { padding: 18px; background: var(--primary-quiet); border-radius: 12px; }
.revealed h2 { margin-bottom: 6px; }
.revealed p { color: var(--ink-muted); font-size: 0.87rem; max-width: 62ch; }
.revealed code { display: block; margin-top: 12px; padding: 12px 14px; background: var(--bg);
  border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem; overflow-wrap: anywhere; user-select: all; }

@media (max-width: 640px) {
  thead { display: none; }
  tr { display: block; border-bottom: 1px solid var(--line); padding: 12px 0; }
  td { display: block; border: 0; padding: 2px 0; }
  td.num::before { content: attr(data-label); }
  .num { text-align: left; padding-right: 0; }
  td.actions { padding-top: 10px; }
  .stats { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
}
`;
