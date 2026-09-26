// Printed practice and the parent's answer entry. Paper sets can be printed freely from the parent view, and they are also
// the "paper stops" on the child's map: printed for the stop, solved in pencil, entered here, and only then the map moves on.
import { buildPaperSet, isPaperStop, paperLevel } from './mission.js?v=muic26cd';
import { stemHtml, optionHtml, explainLineHtml } from './render.js?v=muic26cd';

const when = (ts) => new Date(ts).toLocaleDateString('he-IL');
const PART_NAMES = ['1', '2', '3', '4', '5'];

// Compact practice pages: plain pages, no cover, tight layout. What stays as in the real booklet: the parts in the
// official order, the question wording, black and white figures, and options numbered 1 to 4 with a square to blacken.
// (The roomy official layout, one or two questions a page, is kept for the full mock tests of the last phase.)
const SHORT_INTRO = {
  relations: 'בחרו את זוג המילים שהקשר ביניהן הוא הדומה ביותר לקשר שבזוג המודגש.',
  sentences: 'בחרו את התשובה שמשלימה את המשפט בצורה הטובה ביותר.',
  wordproblems: 'קראו כל שאלה בתשומת לב ובחרו את התשובה הנכונה.',
  numshapes: 'המספרים מסודרים לפי כלל. איזה מספר צריך לבוא במקום סימן השאלה?',
  figural: 'הצורות מסודרות לפי כלל. איזו צורה צריכה לבוא במקום סימן השאלה?',
};

function optionRows(q) {
  const box = (k) => `<span class="p-idx">${k + 1}</span><span class="p-box"></span>`;
  if (q.options[0].kind === 'bitmap' || q.options[0].kind === 'glyph') {
    return `<div class="s-figopts" dir="ltr">${q.options.map((o, k) => `<div class="s-figopt"><div class="p-mark">${box(k)}</div>${optionHtml(q, o, { mono: true, size: 50 })}</div>`).join('')}</div>`;
  }
  const numbers = q.options[0].kind === 'number' && !q.options[0].unit;
  return `<div class="s-opts ${numbers ? 'row4' : ''}">${q.options.map((o, k) => `<div class="s-opt">${box(k)}<span>${optionHtml(q, o, { mono: true })}</span></div>`).join('')}</div>`;
}

function questionBlock(q, n, partKey) {
  // The part heading already says what to do, so the repeated instruction line is dropped where it adds nothing.
  const showPrompt = partKey === 'wordproblems' || (partKey === 'figural' && q.subtype !== 'series');
  return `<div class="s-q"><p><b class="s-n">${n}.</b>${showPrompt ? q.prompt : ''}</p>${q.stem.kind === 'none' ? '' : `<div class="s-stem">${stemHtml(q, { mono: true, size: 50 })}</div>`}${optionRows(q)}</div>`;
}

export async function renderPrint(app, store, progress, arg) {
  let set;
  if (arg && arg.startsWith('new-')) {
    const level = arg === 'new-auto' ? paperLevel(progress) : Math.max(1, Math.min(3, +arg.slice(4) || 2));
    set = buildPaperSet(progress, store.config, level);
    await store.log({ kind: 'paper-set', ts: set.createdAt, setId: set.id, difficulty: set.difficulty, parts: set.parts });
    if (arg === 'new-auto') { progress.pendingPaper = set.id; await store.saveProgress(progress); } // printed for a paper stop on the map
    history.replaceState(null, '', '#print/' + set.id);
  } else {
    const rec = store.records.find((r) => r.kind === 'paper-set' && r.setId === arg);
    if (!rec) { app.innerHTML = '<section class="parent"><p>הסט לא נמצא.</p><a href="#parent">חזרה</a></section>'; return; }
    set = { id: rec.setId, createdAt: rec.ts, difficulty: rec.difficulty, parts: rec.parts };
  }
  const parts = set.parts.map((part, pi) => `<section class="s-part"><div class="s-parthead"><h2>חלק ${PART_NAMES[pi]}: ${part.title}</h2><span class="s-intro">${SHORT_INTRO[part.key] || ''}</span></div>
      <div class="s-grid">${part.questions.map((q, i) => questionBlock(q, i + 1, part.key)).join('')}</div></section>`).join('');
  const key = set.parts.map((part, pi) => `חלק ${PART_NAMES[pi]}: ${part.questions.map((q, i) => `${i + 1}=${q.correctIndex + 1}`).join(' ')}`).join(' · ');

  app.innerHTML = `<div class="print-tools"><a href="#">חזרה</a><button class="primary" id="doPrint">הדפסה</button>
      <span>אחרי שפותרים: <a href="#paper/${set.id}">הזנת התשובות</a></span></div>
    <div class="sheet">
      <div class="s-head"><span>דף תרגול (תרגול ביתי, לא מבחן רשמי)</span><span>שם: ________________</span><span>תאריך: __________</span><span dir="ltr">${set.id}</span></div>
      <p class="s-how">בכל שאלה יש תשובה נכונה אחת. משחירים בעיפרון את המשבצת שליד התשובה הנכונה. אם לא יודעים, מנחשים. אין שעון.</p>
      ${parts}
      <div class="s-key">✂ לגזור לפני שנותנים לילד. תשובות (רמה ${set.difficulty}): ${key}</div>
    </div>`;
  app.querySelector('#doPrint').addEventListener('click', () => window.print());
}

export function renderPaperEntry(app, store, progress, setId) {
  const sets = store.records.filter((r) => r.kind === 'paper-set');
  const results = new Set(store.records.filter((r) => r.kind === 'paper-result').map((r) => r.setId));
  if (!setId) {
    app.innerHTML = `<section class="parent"><div class="p-head"><h1>דפי תרגול מודפסים</h1><a href="#parent">חזרה</a></div>
      <p class="p-note">הדפסת סט חדש: <a href="#print/new-1">רמה 1</a> · <a href="#print/new-2">רמה 2</a> · <a href="#print/new-3">רמה 3 (קרובה לדוגמאות הרשמיות)</a></p>
      <table><thead><tr><th>סט</th><th>נוצר</th><th>רמה</th><th>שאלות</th><th>מצב</th><th></th></tr></thead><tbody>
      ${sets.slice().reverse().map((r) => `<tr><td dir="ltr">${r.setId}</td><td>${when(r.ts)}</td><td>${r.difficulty}</td><td>${r.parts.reduce((s, p) => s + p.questions.length, 0)}</td>
        <td>${results.has(r.setId) ? 'תשובות הוזנו' : 'ממתין לתשובות'}</td><td><a href="#print/${r.setId}">הדפסה חוזרת</a> · <a href="#paper/${r.setId}">${results.has(r.setId) ? 'צפייה' : 'הזנת תשובות'}</a></td></tr>`).join('') || '<tr><td colspan="6">עדיין לא הודפס אף סט.</td></tr>'}
      </tbody></table></section>`;
    return;
  }
  const rec = sets.find((r) => r.setId === setId);
  if (!rec) { app.innerHTML = '<section class="parent"><p>הסט לא נמצא.</p><a href="#paper">חזרה</a></section>'; return; }
  if (results.has(setId)) return showReview(app, store, rec);

  const rows = rec.parts.map((part, pi) => `<tr><th colspan="2">חלק ${PART_NAMES[pi]}: ${part.title}</th></tr>` + part.questions.map((q, i) => `<tr><td>שאלה ${i + 1}</td><td class="entry">
      ${[1, 2, 3, 4].map((v) => `<label><input type="radio" name="q-${pi}-${i}" value="${v - 1}"> ${v}</label>`).join('')}
      <label><input type="radio" name="q-${pi}-${i}" value="blank" checked> לא סימן</label></td></tr>`).join('')).join('');
  app.innerHTML = `<section class="parent"><div class="p-head"><h1>הזנת תשובות: סט ${setId}</h1><a href="#paper">חזרה</a></div>
    <p class="p-note">מעתיקים מהחוברת איזו משבצת הוא השחיר בכל שאלה. זמן לכל שאלה לא נרשם בדפים מודפסים, ולא מנחשים אותו.</p>
    <table class="entry-table">${rows}</table>
    <p class="entry-extra"><label>כמה דקות לקח בסך הכול (אם מדדתם): <input type="number" id="mins" min="1" max="120" style="width:70px"></label>
      <label>עזרה בזמן הפתרון: <select id="help"><option value="unknown">לא ידוע</option><option value="none">פתר לבד</option><option value="some">קיבל עזרה</option></select></label></p>
    <button class="primary" id="save">שמירה</button></section>`;
  app.querySelector('#save').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    const now = Date.now();
    let pos = 0;
    for (const [pi, part] of rec.parts.entries()) {
      for (const [i, q] of part.questions.entries()) {
        const raw = app.querySelector(`input[name="q-${pi}-${i}"]:checked`).value;
        const selectedIndex = raw === 'blank' ? null : +raw;
        await store.log({
          kind: 'attempt', ts: now + pos, missionId: setId, position: pos++, mode: 'paper', source: 'paper',
          questionId: q.id, category: q.category, subtype: q.subtype, ruleFamily: q.ruleFamily, difficulty: q.difficulty, variant: q.variant,
          correct: selectedIndex === q.correctIndex, blank: selectedIndex === null, selectedIndex, correctIndex: q.correctIndex,
          possibleMisconception: selectedIndex === null || selectedIndex === q.correctIndex ? null : q.options[selectedIndex].tag,
          hinted: null, responseTimeMs: null, timesSeen: null, gen: q.gen, // unknown on paper, recorded as unknown
        });
      }
    }
    const mins = +app.querySelector('#mins').value;
    await store.log({ kind: 'paper-result', ts: now + pos, setId, totalMinutes: mins > 0 ? mins : null, assistance: app.querySelector('#help').value });
    if (progress.pendingPaper === setId) {
      progress.pendingPaper = null; progress.stars += 3; progress.missionsDone++;
      if (isPaperStop(progress.mapStep)) progress.mapStep++;
      await store.saveProgress(progress);
      await store.log({ kind: 'event', ts: Date.now(), missionId: setId, event: 'paper-stop-completed' });
    }
    showReview(app, store, rec);
  });
}

function showReview(app, store, rec) {
  const attempts = store.records.filter((r) => r.kind === 'attempt' && r.missionId === rec.setId);
  const result = store.records.find((r) => r.kind === 'paper-result' && r.setId === rec.setId);
  let pos = 0;
  const blocks = rec.parts.map((part, pi) => `<h2>חלק ${PART_NAMES[pi]}: ${part.title}</h2>` + part.questions.map((q, i) => {
    const a = attempts.find((x) => x.position === pos); pos++;
    const status = !a ? '' : a.blank ? 'לא סימן' : a.correct ? 'נכון' : `סימן ${a.selectedIndex + 1}, התשובה הנכונה ${q.correctIndex + 1}`;
    return `<div class="review ${a && a.correct ? 'ok' : 'miss'}"><b>שאלה ${i + 1}: ${status}</b>
      <p>${q.prompt}</p>${q.stem.kind === 'none' ? '' : `<div class="review-stem">${stemHtml(q, { reveal: true, size: 70 })}</div>`}
      <p>${q.explanation.text}</p>${(q.explanation.lines || []).map(explainLineHtml).join('')}</div>`;
  }).join('')).join('');
  const right = attempts.filter((a) => a.correct).length;
  app.innerHTML = `<section class="parent"><div class="p-head"><h1>סט ${rec.setId}: ${right} מתוך ${attempts.length}</h1><a href="#">חזרה למסך הבית</a></div>
    ${store.records.some((r) => r.kind === 'event' && r.event === 'paper-stop-completed' && r.missionId === rec.setId) ? '<p class="p-status">תחנת הדף הושלמה: 3 כוכבים, והמפה התקדמה. כל הכבוד!</p>' : ''}
    <p class="p-note">זמן כולל: ${result?.totalMinutes ? result.totalMinutes + ' דקות' : 'לא נמדד'} · עזרה: ${{ unknown: 'לא ידוע', none: 'פתר לבד', some: 'קיבל עזרה' }[result?.assistance || 'unknown']}.
    כדאי לעבור איתו על השאלות שלא הצליח, עם ההסברים שכאן.</p>${blocks}</section>`;
}
