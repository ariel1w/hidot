// Builds one mission as a designed sequence, not random picks.
// Precedence when rules collide (PLAN.md section 4): time budget, lesson needs, scheduled review, variety.
import { makeRng, placeOptions } from './rng.js?v=muic26cd';
import { generateFigural } from './generators/figural.js?v=muic26cd';
import { generateGlyph } from './generators/glyph.js?v=muic26cd';
import { generateNumShapes } from './generators/numshapes.js?v=muic26cd';
import { generateArithmetic } from './generators/arithmetic.js?v=muic26cd';
import { generateWordProblem } from './generators/wordproblems.js?v=muic26cd';
import { VERBAL_BANK } from './content/verbal.js?v=muic26cd';

export const TIME_BUDGET_MS = 10.5 * 60 * 1000;
// Every sixth stop on the map is solved on printed pages. At three or four missions a week that is about one paper set every two weeks.
export const PAPER_EVERY = 6;
export const isPaperStop = (step) => step % PAPER_EVERY === PAPER_EVERY - 1;
export const paperLevel = (progress) => { const l = progress.levels || {}; return Math.max(1, Math.min(3, Math.round(((l.figural || 1) + (l.wordproblems || 1) + (l.numshapes || 1)) / 3))); };
const MAX_LEVEL = { figural: 3, numshapes: 2, arithmetic: 3, wordproblems: 3 };
const WINDOW = 6; // level changes look at the last few independent answers per track, never at one mission alone

export function newProgress() {
  return { missionsDone: 0, stars: 0, mapStep: 0, lessons: {}, levels: { figural: 1, numshapes: 1, arithmetic: 1, wordproblems: 1 }, recent: {}, seen: {}, recentVerbal: [] };
}

// Mission shapes. 'e' easy, 'm' at his level, 'h' one above. Difficulty moves in waves,
// no track appears twice in a row, and every shape ends on a question he can solve.
const SHAPES = [
  ['figural:e', 'wordproblems:m', 'relations', 'numshapes:m', 'figural:h', 'arithmetic:e', 'sentences', 'wordproblems:e', 'figural:e'],
  ['arithmetic:e', 'figural:m', 'sentences', 'wordproblems:m', 'numshapes:m', 'figural:m', 'relations', 'figural:e'],
  ['numshapes:e', 'wordproblems:m', 'figural:m', 'relations', 'arithmetic:m', 'figural:h', 'wordproblems:e', 'sentences', 'numshapes:e'],
  ['figural:e', 'numshapes:m', 'wordproblems:m', 'relations', 'figural:m', 'arithmetic:e'],
];

// One lesson per mission until all are taught. Each: cards, then a guided question, then one more practice later in the mission.
const LESSON_ORDER = ['rotate', 'story', 'matrix', 'circles'];
const LESSONS = {
  rotate: {
    id: 'rotate', name: 'צורות שמסתובבות',
    cards: [
      { title: 'טריק חדש: צורות שמסתובבות', text: 'לפעמים הצורה נשארת בדיוק אותה צורה, והיא רק מסתובבת. כמו מחוג של שעון.', demo: 'rotate' },
      { title: 'איך בודקים?', text: 'בוחרים חלק אחד בולט בצורה, ועוקבים רק אחריו. לאן הוא פונה בכל שלב? למעלה, ימינה, למטה, שמאלה...', demo: 'rotate-track' },
    ],
    guided: { track: 'figural', grid: true, opts: { difficulty: 2, family: 'rotate', format: 'series', variant: 'grid' } },
    practice: { track: 'figural', grid: true, opts: { difficulty: 2, family: 'rotate', format: 'series' } },
  },
  story: {
    id: 'story', name: 'סיפורים עם מספרים',
    cards: [
      { title: 'טריק חדש: סיפורים עם מספרים', text: 'בשאלת סיפור, החישוב הוא החלק הקל. החלק החשוב באמת הוא להבין מה הסיפור מבקש.' },
      { title: 'שלוש שאלות לפני שמחשבים', text: 'אחת: מה בדיוק שואלים? שתיים: מה אני כבר יודע? שלוש: מה צריך לגלות קודם, כדי שאוכל לענות?' },
    ],
    guided: { track: 'wordproblems', opts: { difficulty: 2, template: 'divideThenMultiply' } },
    practice: { track: 'wordproblems', opts: { difficulty: 2, template: 'proportion' } },
  },
  matrix: {
    id: 'matrix', name: 'צורות בשלוש שורות',
    cards: [
      { title: 'טריק חדש: צורות בשלוש שורות', text: 'בכל שורה מסתתר אותו כלל. הכלל מתחיל מחדש בכל שורה. הנה דוגמה פתורה:', demoQ: { gen: 'glyph', opts: { difficulty: 1, family: 'dots', format: 'matrix' } } },
      { title: 'איך בודקים?', text: 'מגלים את הכלל בשורה הראשונה, משמאל לימין. בודקים שהוא עובד גם בשורה השנייה. רק אז ממשיכים את השורה השלישית.' },
    ],
    guided: { track: 'figural', glyph: true, opts: { difficulty: 1, family: 'arrow', format: 'matrix' } },
    practice: { track: 'figural', glyph: true, opts: { difficulty: 2, family: 'dots', format: 'matrix' } },
  },
  circles: {
    id: 'circles', name: 'מספרים בעיגולים',
    cards: [
      { title: 'טריק חדש: מספרים בעיגולים', text: 'בכל עיגול מסתתר אותו חוק: שני מספרים נותנים את השלישי. הנה דוגמה פתורה:', demoQ: { gen: 'numshapes', opts: { difficulty: 1, format: 'circles' } } },
      { title: 'איך בודקים?', text: 'מנסים חוק על העיגול הראשון, למשל חיבור או כפל. אם אותו חוק עובד גם בעיגול השני, מצאנו אותו. אם לא, מנסים חוק אחר.' },
    ],
    guided: { track: 'numshapes', opts: { difficulty: 1, format: 'circles' } },
    practice: { track: 'numshapes', opts: { difficulty: 2, format: 'circles' } },
  },
};
// Looks reserved for fresh probes. Daily practice never uses them.
const FRESH_PROBES = [
  { id: 'rotate-dots', lesson: 'rotate', slot: { track: 'figural', grid: true, opts: { difficulty: 2, family: 'rotate', format: 'series', variant: 'dots' } } },
  { id: 'matrix-dots', lesson: 'matrix', slot: { track: 'figural', grid: true, opts: { difficulty: 1, format: 'matrix', variant: 'dots' } } },
];
const LAST_CARD = { title: 'עכשיו פותרים אחת ביחד', text: 'בשאלה הבאה הרמז כבר פתוח. קחו את הזמן, אין שעון.' };

function levelFor(progress, track, wave) {
  const base = progress.levels[track] || 1;
  const d = wave === 'e' ? base - 1 : wave === 'h' ? base + 1 : base;
  return Math.max(1, Math.min(MAX_LEVEL[track], d));
}

function verbalQuestion(rng, item) {
  const [first, ...rest] = item.options;
  const placed = placeOptions(rng, { text: first[0], tag: null }, rest.map(([text, tag]) => ({ text, tag })));
  const isRel = item.category === 'relations';
  return {
    id: item.id, category: item.category, subtype: item.subtype, ruleFamily: item.subtype, difficulty: item.difficulty,
    variant: 'text', gen: { id: 'verbal-bank', version: 1, approved: item.approved },
    prompt: isRel ? 'מצאו את זוג המילים שהקשר ביניהן דומה ביותר לקשר שבזוג הזה:' : 'בחרו את התשובה שמשלימה את המשפט בצורה הטובה ביותר.',
    stem: isRel ? { kind: 'pair', text: item.pair } : { kind: 'sentence', text: item.sentence },
    options: placed.options.map((o) => ({ kind: 'text', text: o.text, tag: o.tag })),
    correctIndex: placed.correctIndex,
    hint: isRel
      ? 'נסו לומר משפט קצר שמחבר בין שתי המילים. איזה זוג מתאים בדיוק לאותו משפט, ובאותו סדר?'
      : 'קראו את המשפט עם כל אחת מהתשובות. שימו לב למילים כמו "למרות", "אבל", "ולכן", "אם".',
    explanation: { text: item.explain },
  };
}

// Only approved items reach the child. Drafts appear only while the parent has switched showDraftVerbal on to review them.
export function verbalPool(config, category) {
  // Approved means: marked approved in the bank, or given "keep" by the parent on the review sheet. "drop" removes an item even while drafts are shown.
  const review = config.verbalReview || {};
  const decision = (it) => (review[it.id] || {}).decision;
  return VERBAL_BANK.filter((it) => (!category || it.category === category) && decision(it) !== 'drop'
    && (it.approved || decision(it) === 'keep' || (config.showDraftVerbal && decision(it) !== 'fix')));
}
function pickVerbal(rng, progress, config, category, usedNow, targetDifficulty) {
  let pool = verbalPool(config, category).filter((it) => !usedNow.has(it.id));
  if (!pool.length) return null;
  if (targetDifficulty) { // printed sets have a fixed level: take the items closest to it
    const gap = Math.min(...pool.map((it) => Math.abs(it.difficulty - targetDifficulty)));
    pool = pool.filter((it) => Math.abs(it.difficulty - targetDifficulty) === gap);
  }
  const fresh = pool.filter((it) => !progress.recentVerbal.includes(it.id));
  const from = fresh.length ? fresh : pool;
  const minSeen = Math.min(...from.map((it) => progress.seen[it.id] || 0));
  return rng.pick(from.filter((it) => (progress.seen[it.id] || 0) === minSeen));
}

export function makeQuestion(slot, seed, progress, config, rng, usedNow) {
  const d = (track) => levelFor(progress, track, slot.wave);
  if (slot.track === 'figural') {
    if (slot.opts) return slot.glyph ? generateGlyph(seed, slot.opts) : generateFigural(seed, slot.opts);
    // Half the figure questions use the drawing style of the official test, half use grid figures.
    return rng.next() < 0.5 ? generateGlyph(seed, { difficulty: d('figural') }) : generateFigural(seed, { difficulty: d('figural'), variant: rng.pick(['grid', 'blocks']) });
  }
  if (slot.track === 'numshapes') return generateNumShapes(seed, slot.opts || { difficulty: d('numshapes') });
  if (slot.track === 'arithmetic') return generateArithmetic(seed, slot.opts || { difficulty: d('arithmetic') });
  if (slot.track === 'wordproblems') {
    // Variety: never the same kind of story twice in one mission or one printed set.
    let q = null;
    for (let t = 0; t < 12; t++) {
      q = generateWordProblem((seed + t * 15485863) >>> 0, slot.opts || { difficulty: d('wordproblems') });
      if (slot.opts?.template || !usedNow.has('wp:' + q.variant)) break;
    }
    usedNow.add('wp:' + q.variant);
    return q;
  }
  const item = pickVerbal(rng, progress, config, slot.track, usedNow, slot.verbalDifficulty);
  if (!item) return null;
  usedNow.add(item.id);
  return verbalQuestion(makeRng(seed), item);
}

export function buildDemo(demoQ, seed) {
  return demoQ.gen === 'glyph' ? generateGlyph(seed, demoQ.opts) : generateNumShapes(seed, demoQ.opts);
}

export function buildMission(progress, config, now = Date.now()) {
  const index = progress.missionsDone;
  const seedBase = (Math.floor(now / 1000) ^ (index * 2654435761)) >>> 0;
  const rng = makeRng(seedBase);
  const lessonId = LESSON_ORDER.find((id) => !progress.lessons[id]);
  const base = lessonId ? LESSONS[lessonId] : null;
  const lesson = base ? { ...base, cards: [...base.cards.map((c) => (c.demoQ ? { ...c, demoQuestion: buildDemo(c.demoQ, seedBase + 17) } : c)), LAST_CARD] } : null;

  let slots = SHAPES[index % SHAPES.length].map((code) => { const [track, wave] = code.split(':'); return { track, wave, mode: 'practice' }; });
  if (lesson) {
    // Lesson needs come before variety: a guided question first, the same idea once more later. Drop one hard slot to protect the time budget.
    slots = slots.filter((sl) => sl.wave !== 'h').slice(1);
    slots.unshift({ ...lesson.guided, mode: 'guided' });
    slots.splice(3, 0, { ...lesson.practice, mode: 'practice' });
  } else {
    // A fresh probe: a rule he was already taught, in a look he has never seen. Each probe counts as fresh once only.
    // The next time the same look appears it is logged as review, so "fresh" results always mean a first encounter.
    const probe = FRESH_PROBES.find((pr) => progress.lessons[pr.lesson]);
    const unseen = FRESH_PROBES.find((pr) => progress.lessons[pr.lesson] && !(progress.freshSeen || {})[pr.id]);
    const use = unseen || (index % 3 === 0 ? probe : null);
    if (use) slots.splice(3, 0, { ...use.slot, mode: unseen ? 'fresh' : 'review', probeId: use.id });
  }

  // Variety rule: no track twice in a row. The guided question stays first and the closing question stays last.
  for (let i = 1; i < slots.length - 1; i++) {
    if (slots[i].track !== slots[i - 1].track) continue;
    const j = slots.findIndex((sl, k) => k > i && k < slots.length - 1 && sl.track !== slots[i - 1].track && (k + 1 >= slots.length || slots[k + 1].track !== slots[i].track) && slots[k - 1].track !== slots[i].track);
    if (j > 0) [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const usedNow = new Set();
  const questions = [];
  slots.forEach((slot, i) => {
    const q = makeQuestion(slot, (seedBase + (i + 1) * 104729) >>> 0, progress, config, rng, usedNow);
    if (q) questions.push({ ...q, mode: slot.mode, probeId: slot.probeId });
  });
  return { id: 'm-' + now.toString(36), index, startedAt: now, lesson, questions };
}

// Tentative level changes. Independent practice answers only, judged over a rolling window, not one mission.
export function adjustLevels(progress, attempts) {
  progress.recent ||= {};
  for (const track of Object.keys(MAX_LEVEL)) {
    const mine = attempts.filter((a) => a.category === track && a.hinted === false && (a.mode === 'practice' || a.mode === 'review')).map((a) => (a.correct ? 1 : 0));
    const win = [...(progress.recent[track] || []), ...mine].slice(-WINDOW);
    progress.recent[track] = win;
    if (win.length < 4) continue;
    const acc = win.reduce((s, v) => s + v, 0) / win.length;
    if (acc >= 0.8 && progress.levels[track] < MAX_LEVEL[track]) { progress.levels[track]++; progress.recent[track] = []; }
    else if (acc <= 0.4 && progress.levels[track] > 1) { progress.levels[track]--; progress.recent[track] = []; }
  }
}

// A printable practice set in the order of the official test parts. Fixed difficulty, no adaptation.
export const PAPER_PARTS = [
  { key: 'relations', title: 'מה הקשר בין המילים?', track: 'relations', count: 2,
    intro: 'בכל שאלה בחלק זה מופיע זוג מילים מודגשות. עליכם למצוא את הקשר בין שתי המילים, ולבחור מבין התשובות את זוג המילים שהקשר ביניהן הוא הדומה ביותר.' },
  { key: 'sentences', title: 'מהן המילים החסרות במשפט?', track: 'sentences', count: 2,
    intro: 'בכל שאלה מופיע משפט שחסרות בו מילה אחת או יותר. עליכם לבחור את התשובה שמשלימה את המשפט בצורה הטובה ביותר.' },
  { key: 'wordproblems', title: 'מה הפתרון לבעיה?', track: 'wordproblems', count: 3,
    intro: 'בחלק זה שאלות מילוליות. קראו כל שאלה בתשומת לב ובחרו את התשובה הנכונה.' },
  { key: 'numshapes', title: 'מה המספר החסר בצורה?', track: 'numshapes', count: 4,
    intro: 'בשאלות בחלק זה מופיעים מספרים שמסודרים בצורות לפי כלל מסוים. עליכם לגלות את הכלל, ולבחור את המספר שצריך לבוא במקום סימן השאלה.' },
  { key: 'figural', title: 'מה הצורה הבאה?', track: 'figural', count: 3,
    intro: 'בשאלות בחלק זה הצורות מסודרות לפי כלל מסוים. עליכם לגלות את הכלל, ולבחור את הצורה שצריכה לבוא במקום סימן השאלה.' },
];
export function buildPaperSet(progress, config, difficulty, now = Date.now()) {
  const seedBase = (Math.floor(now / 1000) * 31 + 7) >>> 0;
  const rng = makeRng(seedBase);
  const usedNow = new Set();
  const flat = { ...progress, levels: { figural: difficulty, numshapes: Math.min(2, difficulty), arithmetic: difficulty, wordproblems: difficulty }, recentVerbal: [] };
  let n = 0;
  const parts = PAPER_PARTS.map((part) => {
    const questions = [];
    for (let i = 0; i < part.count; i++) {
      const slot = { track: part.track, wave: 'm', verbalDifficulty: difficulty };
      if (part.track === 'numshapes') slot.opts = { difficulty: Math.min(2, difficulty), format: i === 0 ? 'circles' : i === 1 ? 'pyramid' : undefined };
      if (part.track === 'figural') { slot.glyph = true; slot.opts = { difficulty, format: i === 0 ? 'series' : 'matrix' }; }
      const q = makeQuestion(slot, (seedBase + (++n) * 104729) >>> 0, flat, config, rng, usedNow);
      if (q) questions.push(q);
    }
    return { key: part.key, title: part.title, intro: part.intro, questions };
  }).filter((p) => p.questions.length);
  return { id: 'p-' + now.toString(36), createdAt: now, difficulty, parts };
}
