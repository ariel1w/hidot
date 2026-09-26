import { loadBoard, loadBoardDetail } from './storage.js?v=muic26cd';

// The progress board: every name on the online site in one table, worked out from their saved answers.
// Tap a row to see the answers per part.
const TRACKS = { figural: 'צורות', numshapes: 'מספרים בצורות', arithmetic: 'חשבון', wordproblems: 'בעיות מילוליות', relations: 'יחסי מילים', sentences: 'השלמת משפטים', verbal: 'מילולי' };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
function ago(ts) {
  if (!ts) return 'עוד לא שיחק';
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(Number(ts)).setHours(0, 0, 0, 0)) / 86400000);
  const time = new Date(Number(ts)).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return days <= 0 ? 'היום ' + time : days === 1 ? 'אתמול ' + time : `לפני ${days} ימים`;
}

export async function renderBoard(app) {
  app.innerHTML = '<section class="parent board"><div class="p-head"><h1>לוח ההתקדמות</h1><a href="#">חזרה</a></div><p class="p-note">טוען...</p></section>';
  let rows;
  try { rows = await loadBoard(); }
  catch { app.querySelector('.p-note').textContent = 'לא הצלחנו לטעון את הלוח. בדקו את האינטרנט ונסו שוב.'; return; }
  const body = rows.map((r) => `<tr class="b-row" data-id="${esc(r.id)}">
      <td><b>${esc(r.name)}</b></td><td>${r.missions}</td><td>⭐ ${r.stars}</td><td>${r.answered}</td><td>${pct(r.correct, r.answered)}</td>
      <td>${r.week ? `${r.week} <small>(${pct(r.week_correct, r.week)})</small>` : '-'}</td><td>${r.days}</td><td>${ago(r.last_played)}</td>
      <td class="lv">${r.levels ? Object.entries(r.levels).map(([k, v]) => `${TRACKS[k] || k} ${v}`).join(' · ') : '-'}</td></tr>
    <tr class="b-detail" hidden><td colspan="9"></td></tr>`).join('');
  app.querySelector('.board').innerHTML = `<div class="p-head"><h1>לוח ההתקדמות</h1><a href="#">חזרה</a></div>
    <p class="p-note">כל השמות באתר. לחיצה על שורה מראה פירוט לפי חלק. "השבוע" = שבעת הימים האחרונים.</p>
    <table><thead><tr><th>שם</th><th>משימות</th><th>כוכבים</th><th>שאלות</th><th>הצלחה</th><th>השבוע</th><th>ימי תרגול</th><th>שיחק לאחרונה</th><th>רמה בכל חלק</th></tr></thead>
    <tbody>${body || '<tr><td colspan="9">עדיין אין שחקנים.</td></tr>'}</tbody></table>`;
  app.querySelectorAll('.b-row').forEach((tr) => tr.addEventListener('click', async () => {
    const detail = tr.nextElementSibling;
    detail.hidden = !detail.hidden;
    if (detail.hidden || detail.dataset.loaded) return;
    const cell = detail.firstElementChild;
    cell.textContent = 'טוען...';
    try {
      const parts = await loadBoardDetail(tr.dataset.id);
      cell.innerHTML = parts.length ? parts.map((p) => `${TRACKS[p.category] || esc(p.category)}: ${p.correct}/${p.answered} (${pct(p.correct, p.answered)})`).join(' · ') : 'עדיין אין תשובות.';
      detail.dataset.loaded = '1';
    } catch { cell.textContent = 'לא הצלחנו לטעון.'; }
  }));
}
