import { openStore, listUsers, createUser } from './storage.js?v=muic26cd';
import { buildMission, newProgress, adjustLevels, TIME_BUDGET_MS, isPaperStop } from './mission.js?v=muic26cd';
import { stemHtml, optionHtml, rotateDemoHtml, explainLineHtml } from './render.js?v=muic26cd';
import { renderParent } from './parent.js?v=muic26cd';
import { renderPrint, renderPaperEntry } from './paper.js?v=muic26cd';
import { renderReview } from './review.js?v=muic26cd';
import { renderBoard } from './board.js?v=muic26cd';

const app = document.getElementById('app');
const LETTERS = ['1', '2', '3', '4']; // numbered like the official booklet
const PRAISE = ['יפה!', 'בדיוק.', 'נכון!', 'פיצחת את החוק.', 'כל הכבוד על החשיבה.'];
const MAP_NODES = 12;

let store, progress;
let users = [], where = {};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let run = null; // the mission in progress

const h = (html) => { app.innerHTML = html; window.scrollTo(0, 0); };
const on = (sel, fn) => app.querySelectorAll(sel).forEach((el) => el.addEventListener('click', fn));

// ---------------- who is playing ----------------
// Profiles are just names: no passwords. With one profile the app opens straight into it.
function alertBox(text) {
  const p = document.createElement('p'); p.className = 'save-warning'; p.textContent = text;
  app.querySelector('section')?.appendChild(p);
}

function showChooser(creating) {
  run = null;
  const form = `<form id="newForm" class="new-user"><input id="newName" maxlength="30" placeholder="איך קוראים לך?" autocomplete="off"><button class="primary" type="submit">יוצאים לדרך</button></form>`;
  h(`<section class="screen chooser">
    <h1>${users.length ? 'מי משחק היום?' : 'ברוכים הבאים!'}</h1>
    <div class="users">${users.map((u) => `<button class="user" data-id="${u.id}">${esc(u.name)}</button>`).join('')}</div>
    ${creating || !users.length ? form : '<button class="ghost" id="newUser">+ שחקן חדש</button>'}
    ${where.cloud ? `<p class="online-note">ההתקדמות נשמרת לפי השם, בכל מכשיר. כותבים את אותו שם וממשיכים מאיפה שעצרו.${where.offline ? ' <b>אין חיבור כרגע: אפשר לשחק, והשמירה תישלח כשהחיבור יחזור.</b>' : ''}</p><a class="parent-link" href="#board">לוח ההתקדמות של כולם</a>`
      : where.server ? '' : '<p class="online-note">ההתקדמות נשמרת בדפדפן הזה, במכשיר הזה בלבד.</p>'}
  </section>`);
  on('.user', (e) => selectUser(e.currentTarget.dataset.id));
  on('#newUser', () => showChooser(true));
  const f = app.querySelector('#newForm');
  if (f) {
    app.querySelector('#newName').focus();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = app.querySelector('#newName').value.trim();
      if (!name) return;
      let user;
      try { user = await createUser(name); } catch { alertBox('לא הצלחנו להתחבר. בדקו את האינטרנט ונסו שוב.'); return; }
      if (!users.some((u) => u.id === user.id)) users.push(user);
      selectUser(user.id);
    });
  }
}

async function selectUser(id, thenRoute) {
  const user = users.find((u) => u.id === id);
  if (!user) return showChooser();
  if (store) store.close();
  try { store = await openStore(user); } catch { store = null; showChooser(); alertBox('לא הצלחנו לטעון את ההתקדמות. בדקו את האינטרנט ונסו שוב.'); return; }
  progress = { ...newProgress(), ...(store.progress || {}) };
  progress.levels = { ...newProgress().levels, ...progress.levels };
  // The log is the truth: any reserved look that was ever answered has been seen, even if that mission was cut short.
  store.records.filter((r) => r.kind === 'attempt' && r.probeId).forEach((r) => { (progress.freshSeen ||= {})[r.probeId] = true; });
  try { sessionStorage.setItem('gp.user', id); } catch { /* private window */ }
  if (thenRoute) route(); else { if (location.hash) history.replaceState(null, '', '#'); showHome(); }
}

// ---------------- home ----------------
function mapHtml() {
  const pos = progress.mapStep % MAP_NODES;
  let dots = '';
  for (let i = 0; i < MAP_NODES; i++) {
    const cls = i < pos ? 'done' : i === pos ? 'here' : '';
    const paper = isPaperStop(progress.mapStep - pos + i);
    dots += `<span class="node ${cls} ${paper ? 'paper' : ''}" ${paper ? 'title="תחנת דף"' : ''}>${paper ? '📄' : i === pos ? '🧭' : ''}</span>`;
  }
  return `<div class="map" aria-label="מפת המסע">${dots}</div>`;
}

function showHome() {
  run = null;
  const name = store.user.name ? `, ${esc(store.user.name)}` : '';
  const week = missionsThisWeek();
  h(`<section class="screen home">
    <div class="topline"><span class="stars">⭐ ${progress.stars}</span><span class="corner-links"><a class="parent-link" href="#users">החלפת שחקן</a><a class="parent-link" href="#parent">להורים</a></span></div>
    ${store.saveFailed ? '<p class="save-warning">השמירה לא עובדת כרגע. כדאי לקרוא לאבא או לאמא.</p>' : ''}
    <h1>שלום${name}!</h1>
    <p class="sub">${progress.missionsDone === 0 ? 'מתחילים מסע של חידות.' : week >= 3 ? `כבר ${week} משימות השבוע. איזה יופי!` : 'המסע ממשיך.'}</p>
    <button class="primary big" id="start">המשימה של היום</button>
    <p class="how-long">${isPaperStop(progress.mapStep) ? `היום: תחנת דף, בערך ${PAPER_MINUTES} דקות` : `בערך ${minutesEstimate(false)} דקות`}</p>
    ${mapHtml()}
    ${isPaperStop(progress.mapStep + 1) && !progress.pendingPaper ? '<p class="parent-note">להורים: התחנה הבאה במפה היא תחנת דף 📄. אפשר <a href="#print/new-auto">להדפיס את הדפים כבר עכשיו</a>, כדי שיחכו מוכנים.</p>' : ''}
    ${progress.pendingPaper && !isPaperStop(progress.mapStep) ? '<p class="parent-note">להורים: הדפים לתחנת הדף הבאה כבר הודפסו. <a href="#print/' + progress.pendingPaper + '">להדפיס שוב</a></p>' : ''}
  </section>`);
  on('#start', () => (isPaperStop(progress.mapStep) ? showPaperStop() : startMission()));
}

// A stop that is solved on printed pages. It never blocks practice: "not today" gives a normal mission and the stop waits.
function showPaperStop() {
  const pending = progress.pendingPaper;
  h(`<section class="screen intro">
    <div class="burst">📄</div>
    <h1>המשימה של היום היא על דף!</h1>
    <p class="sub">${pending ? 'הדפים כבר הודפסו. פותרים בעיפרון, ואחר כך מזינים כאן את התשובות.' : 'קראו לאבא או לאמא כדי להדפיס. פותרים בעיפרון, כמו במבחן האמיתי.'}</p>
    <p class="how-long">זה ייקח בערך ${PAPER_MINUTES} דקות.</p>
    <a class="primary big as-link" href="#print/${pending || 'new-auto'}">${pending ? 'להדפיס שוב' : 'להדפיס את הדפים'}</a>
    ${pending ? `<a class="primary as-link" href="#paper/${pending}">סיימתי, להזין תשובות</a>` : ''}
    <button class="ghost" id="notToday">לא היום, משימה רגילה</button>
  </section>`);
  on('#notToday', startMission);
}

function minutesEstimate(withLesson) {
  const done = store.records.filter((r) => r.kind === 'mission-end' && r.status === 'completed').slice(-5).map((r) => r.durationMs / 60000).sort((a, b) => a - b);
  const usual = done.length >= 3 ? Math.round(done[Math.floor(done.length / 2)]) : 10;
  return Math.max(5, Math.min(20, usual + (withLesson ? 2 : 0)));
}
const PAPER_MINUTES = 20;

// A family joke, by the owner's request: now and then Leo is reminded how pretty his mother is (she may be sitting next to him).
// Only for the profile named Leo, so other families never see it.
const LEO_NAMES = ['ליאו', 'לאו', 'leo'];
const MOM_NOTES = [
  'אגב, ליאו: אמא דליה יפה מאוד היום.',
  'טיפ חשוב: לך תגיד לאמא דליה שהיא הכי יפה בעולם.',
  'ידעת? לדליה יש את החיוך הכי יפה בבית.',
  'חידה אחרונה: מי גם חכמה וגם יפה מאוד? נכון, אמא דליה.',
  'אל תשכח לתת לאמא חיבוק. דליה יפה במיוחד היום.',
];
function momNote() {
  if (!LEO_NAMES.includes(String(store.user.name).trim().toLowerCase())) return '';
  if (progress.missionsDone % 3 !== 1) return ''; // about one mission in three, so it stays a surprise
  return `<p class="mom-note">${MOM_NOTES[Math.floor(progress.missionsDone / 3) % MOM_NOTES.length]}</p>`;
}

function missionsThisWeek() {
  const weekAgo = Date.now() - 7 * 864e5;
  return store.records.filter((r) => r.kind === 'mission-end' && r.ts > weekAgo && r.answered >= 5).length;
}

// ---------------- mission flow ----------------
async function startMission() {
  const mission = buildMission(progress, store.config);
  run = { mission, planned: mission.questions.length, i: 0, attempts: [], pausedMs: 0, pauses: 0, hintedNow: false, fastWrong: 0, trimmed: false };
  await store.log({ kind: 'mission-start', ts: Date.now(), missionId: mission.id, index: mission.index, planned: mission.questions.length, lesson: mission.lesson?.id || null });
  h(`<section class="screen intro">
    <h1>${mission.lesson ? 'היום לומדים טריק חדש' : 'המשימה של היום'}</h1>
    <p class="sub">מחכות לך ${mission.questions.length} חידות. זה ייקח בערך ${minutesEstimate(!!mission.lesson)} דקות.</p>
    <div class="pips">${pipsHtml()}</div>
    <button class="primary big" id="go">יוצאים לדרך</button>
  </section>`);
  on('#go', () => (mission.lesson ? showLesson(0) : showQuestion()));
}

function pipsHtml() {
  return run.mission.questions.map((_, k) => `<span class="pip ${k < run.i ? 'done' : k === run.i ? 'now' : ''}"></span>`).join('');
}

function showLesson(k) {
  const cards = run.mission.lesson.cards, card = cards[k];
  h(`<section class="screen lesson">
    <div class="tag">טריק חדש</div>
    <h1>${card.title}</h1>
    <p class="lesson-text">${card.text}</p>
    ${card.demo ? rotateDemoHtml(card.demo === 'rotate-track') : ''}
    ${card.demoQuestion ? `<div class="stem">${stemHtml(card.demoQuestion, { reveal: true })}</div><p class="lesson-note">${card.demoQuestion.explanation.text}</p>` : ''}
    <div class="nav-row">
      ${k > 0 ? '<button class="ghost back" id="back">→ חזרה</button>' : ''}
      <button class="primary" id="next">${k === cards.length - 1 ? 'בואו ננסה' : 'הבנתי, הלאה'}</button>
    </div>
  </section>`);
  on('#back', () => showLesson(k - 1));
  on('#next', () => (k === cards.length - 1 ? showQuestion() : showLesson(k + 1)));
}

let idleTimer = null;
// resume = coming back from a look at an earlier screen: same question, same clock, same hint state.
function showQuestion(resume) {
  const { mission } = run;
  // Time budget wins over question count: past the budget, jump to the last (solvable) question.
  const elapsed = Date.now() - mission.startedAt - run.pausedMs;
  if (!resume && !run.trimmed && elapsed > TIME_BUDGET_MS && run.i < mission.questions.length - 1) {
    run.trimmed = true;
    mission.questions.splice(run.i, mission.questions.length - 1 - run.i);
  }
  const q = mission.questions[run.i];
  const guided = q.mode === 'guided';
  if (!resume) {
    run.hintedNow = guided;
    run.shownAt = Date.now();
    run.pausedAtStart = run.pausedMs;
  }
  const hintOpen = run.hintedNow;
  const canGoBack = run.i > 0 || !!mission.lesson;
  const textual = q.options[0].kind === 'text';
  h(`<section class="screen question">
    <div class="topline"><div class="pips">${pipsHtml()}</div><div class="top-buttons">${canGoBack ? '<button class="ghost back" id="back">→ חזרה</button>' : ''}<button class="ghost" id="pause">⏸ הפסקה</button></div></div>
    ${guided ? '<div class="tag">פותרים יחד</div>' : ''}
    <p class="prompt ${q.prompt.length > 70 ? 'long' : ''}">${q.prompt}</p>
    ${q.stem.kind === 'none' ? '' : `<div class="stem">${stemHtml(q)}</div>`}
    <div class="options ${textual ? 'textual' : ''}">
      ${q.options.map((o, k) => `<button class="option" data-k="${k}"><span class="letter">${LETTERS[k]}</span>${optionHtml(q, o)}</button>`).join('')}
    </div>
    <div class="below">
      ${q.hint ? `<button class="ghost" id="hint" ${hintOpen ? 'hidden' : ''}>💡 רמז</button><p class="hint" id="hintText" ${hintOpen ? '' : 'hidden'}>${q.hint}</p>` : ''}
    </div>
  </section>`);
  on('.option', (e) => answer(+e.currentTarget.dataset.k));
  on('#back', () => (run.i > 0 ? showLookBack(run.i - 1) : showLesson(mission.lesson.cards.length - 1)));
  on('#pause', () => showPause(false));
  on('#hint', () => { run.hintedNow = true; app.querySelector('#hintText').hidden = false; app.querySelector('#hint').hidden = true; });
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (run && !app.querySelector('.feedback')) showPause(true, 'long-idle'); }, 120000);
}

async function answer(k) {
  clearTimeout(idleTimer);
  const q = run.mission.questions[run.i];
  if (app.querySelector('.feedback')) return;
  const correct = k === q.correctIndex;
  const responseTimeMs = Date.now() - run.shownAt - (run.pausedMs - run.pausedAtStart);
  progress.seen[q.id] = (progress.seen[q.id] || 0) + 1;
  if (q.probeId) { (progress.freshSeen ||= {})[q.probeId] = true; store.saveProgress(progress); } // saved at once, not at mission end
  const rec = {
    kind: 'attempt', ts: Date.now(), missionId: run.mission.id, position: run.i, mode: q.mode, source: 'app',
    questionId: q.id, category: q.category, subtype: q.subtype, ruleFamily: q.ruleFamily, difficulty: q.difficulty, variant: q.variant,
    correct, selectedIndex: k, correctIndex: q.correctIndex, possibleMisconception: correct ? null : q.options[k].tag,
    probeId: q.probeId || null, hinted: run.hintedNow, responseTimeMs, timesSeen: progress.seen[q.id], gen: q.gen,
    shown: { prompt: q.prompt, stem: q.stem, options: q.options },
  };
  run.attempts.push(rec);
  app.querySelector('#back')?.remove(); // the answer is in: from here the way is forward
  run.fastWrong = !correct && responseTimeMs < 3000 ? run.fastWrong + 1 : 0;
  store.log(rec); // saved after every answer, so interrupted sessions are kept

  app.querySelectorAll('.option').forEach((el, idx) => {
    el.disabled = true;
    if (idx === q.correctIndex) el.classList.add('is-correct');
    else if (idx === k) el.classList.add('is-chosen');
  });
  const stem = app.querySelector('.stem');
  if (stem) stem.innerHTML = stemHtml(q, { reveal: true });
  const lines = (q.explanation.lines || []).map(explainLineHtml).join('');
  const last = run.i === run.mission.questions.length - 1;
  app.querySelector('.below').innerHTML = `<div class="feedback ${correct ? 'good' : 'learn'}">
    <h2>${correct ? PRAISE[(run.i + run.mission.index) % PRAISE.length] : 'בואו נראה מה החוק כאן.'}</h2>
    <p>${q.explanation.text}</p>${lines}
    <button class="primary" id="next">${last ? 'סיימנו!' : 'הלאה'}</button>
  </div>`;
  on('#next', (e) => {
    e.currentTarget.disabled = true; // one press only, so a question can never be skipped by a double press
    run.i++;
    if (run.i >= run.mission.questions.length) return finishMission('completed');
    if (run.fastWrong >= 3) { run.fastWrong = 0; return showPause(true, 'fast-wrong-run', showQuestion); }
    showQuestion();
  });
  app.querySelector('.feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// A look back at an answered question, for reading only: the answer is already saved and cannot change.
// Time spent here is not thinking time for the waiting question, so it counts like a pause.
function showLookBack(idx) {
  clearTimeout(idleTimer);
  run.lookBackStart ??= Date.now();
  const q = run.mission.questions[idx];
  const a = run.attempts.find((r) => r.position === idx);
  const textual = q.options[0].kind === 'text';
  h(`<section class="screen question look-back">
    <div class="topline"><div class="tag">מסתכלים אחורה: שאלה ${idx + 1}</div></div>
    <p class="prompt ${q.prompt.length > 70 ? 'long' : ''}">${q.prompt}</p>
    ${q.stem.kind === 'none' ? '' : `<div class="stem">${stemHtml(q, { reveal: true })}</div>`}
    <div class="options ${textual ? 'textual' : ''}">
      ${q.options.map((o, k) => `<button class="option ${k === q.correctIndex ? 'is-correct' : a && k === a.selectedIndex ? 'is-chosen' : ''}" disabled><span class="letter">${LETTERS[k]}</span>${optionHtml(q, o)}</button>`).join('')}
    </div>
    <div class="below"><div class="feedback ${a?.correct ? 'good' : 'learn'}">
      <p>${q.explanation.text}</p>${(q.explanation.lines || []).map(explainLineHtml).join('')}
      <div class="nav-row">
        ${idx > 0 ? '<button class="ghost back" id="back">→ עוד אחורה</button>' : ''}
        <button class="primary" id="return">חזרה לשאלה ${run.i + 1}</button>
      </div>
    </div></div>
  </section>`);
  on('#back', () => showLookBack(idx - 1));
  on('#return', () => {
    run.pausedMs += Date.now() - run.lookBackStart;
    run.lookBackStart = null;
    showQuestion(true);
  });
}

function showPause(offered, reason, after) {
  clearTimeout(idleTimer);
  const started = Date.now();
  run.pauses++;
  store.log({ kind: 'event', ts: started, missionId: run.mission.id, event: offered ? 'break-offered' : 'pause', reason: reason || null, position: run.i });
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="card">
    <h2>${offered ? 'רוצה הפסקה קצרה?' : 'הפסקה'}</h2>
    <p>אפשר לנוח רגע ולחזור, ואפשר גם לסיים להיום.</p>
    <button class="primary" id="resume">ממשיכים</button>
    <button class="ghost" id="stop">מסיימים להיום</button>
  </div>`;
  app.appendChild(overlay);
  overlay.querySelector('#resume').addEventListener('click', () => {
    run.pausedMs += Date.now() - started;
    overlay.remove();
    if (after) after();
  });
  overlay.querySelector('#stop').addEventListener('click', () => { run.pausedMs += Date.now() - started; finishMission('finished-early'); });
}

async function finishMission(status) {
  clearTimeout(idleTimer);
  const { mission, attempts } = run;
  const answered = attempts.length;
  // Stars are for effort: showing up, finishing, learning something new, trying a hard one.
  let stars = status === 'completed' ? 3 : Math.floor(answered / 3);
  if (mission.lesson && answered >= 2) stars += 1;
  if (attempts.some((a) => a.difficulty >= 3)) stars += 1;
  const counts = answered >= 5;
  progress.stars += stars;
  const waitingForPaper = isPaperStop(progress.mapStep); // he chose "not today": stars yes, but the map waits at the paper stop
  if (counts) { progress.missionsDone++; if (!waitingForPaper) progress.mapStep++; }
  if (mission.lesson && answered >= 2) progress.lessons[mission.lesson.id] = true;
  progress.recentVerbal = attempts.filter((a) => a.gen?.id === 'verbal-bank').map((a) => a.questionId).concat(progress.recentVerbal).slice(0, 8);
  adjustLevels(progress, attempts);
  await store.log({ kind: 'mission-end', ts: Date.now(), missionId: mission.id, status, planned: run.planned, trimmedForTime: run.trimmed,
    answered, correct: attempts.filter((a) => a.correct).length, hinted: attempts.filter((a) => a.hinted).length,
    durationMs: Date.now() - mission.startedAt - run.pausedMs, pauses: run.pauses, stars });
  await store.saveProgress(progress);
  const learned = mission.lesson ? `<p class="sub">היום למדת טריק חדש: ${mission.lesson.name}.</p>` : '';
  h(`<section class="screen done">
    <div class="burst">${'⭐'.repeat(Math.max(stars, 1))}</div>
    <h1>${status === 'completed' ? 'המשימה הושלמה!' : 'עצרנו להיום. כל הכבוד שניסית.'}</h1>
    ${learned}
    <p class="sub">${counts ? (waitingForPaper ? 'המפה מחכה לתחנת הדף.' : 'התקדמת צעד במפה.') : 'נמשיך בפעם הבאה.'}</p>
    ${mapHtml()}
    ${momNote()}
    <button class="primary" id="home">חזרה הביתה</button>
  </section>`);
  on('#home', showHome);
}

// Time spent with the window hidden is not thinking time: treat it like a pause.
let hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && run) { if (!run.lookBackStart) run.pausedMs += Date.now() - hiddenAt; hiddenAt = null; } // a look back already counts as paused
});

// ---------------- boot ----------------
function route() {
  if (location.hash === '#review') return renderReview(app);
  if (location.hash === '#board') return renderBoard(app);
  if (location.hash === '#users' || !store) return showChooser();
  if (location.hash === '#parent') return renderParent(app, store, progress);
  if (location.hash.startsWith('#print')) return renderPrint(app, store, progress, location.hash.split('/')[1]);
  if (location.hash.startsWith('#paper')) return renderPaperEntry(app, store, progress, location.hash.split('/')[1]);
  if (!run) showHome();
}

(async function boot() {
  where = await listUsers();
  users = where.users;
  window.addEventListener('hashchange', () => { run = null; route(); });
  let remembered = null;
  try { remembered = sessionStorage.getItem('gp.user'); } catch { /* private window */ }
  // One profile: straight in. Several: ask, unless this browser tab was already playing as someone (a reload).
  // A link can name the profile (?user=<id>), which allows one desktop shortcut per child.
  const asked = new URLSearchParams(location.search).get('user');
  if (users.some((u) => u.id === asked)) return selectUser(asked, true);
  if (location.hash === '#review' || location.hash === '#board') return route();
  if (users.length === 1) return selectUser(users[0].id, true);
  if (users.some((u) => u.id === remembered)) return selectUser(remembered, true);
  showChooser();
})();
