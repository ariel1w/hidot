// Figural questions. Every figure is a small bitmap, so "same figure" is an exact comparison
// and the checker can detect symmetric-shape traps. See docs/QUESTION_TAXONOMY.md section A.
import { makeRng, placeOptions } from '../rng.js?v=muic26cd';

export const GEN = { id: 'figural', version: 1 };

// ---------- bitmap helpers (row 0 is the top row, column 0 is the left column) ----------
const key = (b) => b.n + ':' + b.cells.join('');
const same = (a, b) => key(a) === key(b);
const count = (b) => b.cells.reduce((s, v) => s + v, 0);
const map = (b, fn) => {
  const cells = new Array(b.n * b.n);
  for (let r = 0; r < b.n; r++) for (let c = 0; c < b.n; c++) cells[r * b.n + c] = fn(r, c);
  return { n: b.n, cells };
};
const at = (b, r, c) => b.cells[r * b.n + c];

function ring(n) {
  const out = [];
  for (let c = 0; c < n; c++) out.push([0, c]);
  for (let r = 1; r < n; r++) out.push([r, n - 1]);
  for (let c = n - 2; c >= 0; c--) out.push([n - 1, c]);
  for (let r = n - 2; r >= 1; r--) out.push([r, 0]);
  return out;
}
function walk(b, step) {
  const rg = ring(b.n);
  const cells = b.cells.slice();
  rg.forEach(([r, c], i) => {
    const [pr, pc] = rg[(i - step + rg.length) % rg.length];
    cells[r * b.n + c] = at(b, pr, pc);
  });
  return { n: b.n, cells };
}
function grow(b, order) {
  const cells = b.cells.slice();
  for (let i = 0; i < b.n * b.n; i++) {
    const idx = order === 'cols' ? (i % b.n) * b.n + Math.floor(i / b.n) : i;
    if (!cells[idx]) { cells[idx] = 1; break; }
  }
  return { n: b.n, cells };
}

// ---------- the rule families ----------
const OPS = {
  walkCW: { family: 'walk', inverse: 'walkCCW', fn: (b) => walk(b, 1), keepsCount: true,
    text: 'בכל שלב המשבצות השחורות זזות צעד אחד לאורך המסגרת, עם כיוון השעון.' },
  walkCCW: { family: 'walk', inverse: 'walkCW', fn: (b) => walk(b, -1), keepsCount: true,
    text: 'בכל שלב המשבצות השחורות זזות צעד אחד לאורך המסגרת, נגד כיוון השעון.' },
  shiftR: { family: 'shift', inverse: 'shiftL', fn: (b) => map(b, (r, c) => at(b, r, (c - 1 + b.n) % b.n)), keepsCount: true,
    text: 'בכל שלב כל הציור זז משבצת אחת ימינה. מה שיוצא מצד אחד נכנס מהצד השני.' },
  shiftL: { family: 'shift', inverse: 'shiftR', fn: (b) => map(b, (r, c) => at(b, r, (c + 1) % b.n)), keepsCount: true,
    text: 'בכל שלב כל הציור זז משבצת אחת שמאלה. מה שיוצא מצד אחד נכנס מהצד השני.' },
  shiftD: { family: 'shift', inverse: 'shiftU', fn: (b) => map(b, (r, c) => at(b, (r - 1 + b.n) % b.n, c)), keepsCount: true,
    text: 'בכל שלב כל הציור זז משבצת אחת למטה. מה שיוצא למטה נכנס מלמעלה.' },
  shiftU: { family: 'shift', inverse: 'shiftD', fn: (b) => map(b, (r, c) => at(b, (r + 1) % b.n, c)), keepsCount: true,
    text: 'בכל שלב כל הציור זז משבצת אחת למעלה. מה שיוצא למעלה נכנס מלמטה.' },
  rotCW: { family: 'rotate', inverse: 'rotCCW', sibling: 'flipH', fn: (b) => map(b, (r, c) => at(b, b.n - 1 - c, r)), keepsCount: true,
    text: 'בכל שלב הצורה מסתובבת רבע סיבוב ימינה, עם כיוון השעון.' },
  rotCCW: { family: 'rotate', inverse: 'rotCW', sibling: 'flipH', fn: (b) => map(b, (r, c) => at(b, c, b.n - 1 - r)), keepsCount: true,
    text: 'בכל שלב הצורה מסתובבת רבע סיבוב שמאלה, נגד כיוון השעון.' },
  rot180: { family: 'half-turn', inverse: 'rot180', sibling: 'flipV', fn: (b) => map(b, (r, c) => at(b, b.n - 1 - r, b.n - 1 - c)), keepsCount: true,
    text: 'בכל שלב הצורה מסתובבת חצי סיבוב, כלומר מתהפכת על הראש.' },
  flipH: { family: 'mirror', inverse: 'flipH', sibling: 'rotCW', fn: (b) => map(b, (r, c) => at(b, r, b.n - 1 - c)), keepsCount: true,
    text: 'בכל שלב הצורה מתהפכת כמו במראה: ימין ושמאל מתחלפים.' },
  flipV: { family: 'mirror', inverse: 'flipV', sibling: 'rot180', fn: (b) => map(b, (r, c) => at(b, b.n - 1 - r, c)), keepsCount: true,
    text: 'בכל שלב הצורה מתהפכת כמו במראה: למעלה ולמטה מתחלפים.' },
  growRows: { family: 'grow', fn: (b) => grow(b, 'rows'), keepsCount: false,
    text: 'בכל שלב נוספת עוד משבצת שחורה אחת, לפי הסדר, שורה אחרי שורה.' },
  growCols: { family: 'grow', fn: (b) => grow(b, 'cols'), keepsCount: false,
    text: 'בכל שלב נוספת עוד משבצת שחורה אחת, לפי הסדר, טור אחרי טור.' },
  invert: { family: 'invert', inverse: 'invert', fn: (b) => map(b, (r, c) => (at(b, r, c) ? 0 : 1)), keepsCount: false,
    text: 'בכל שלב הצבעים מתחלפים: שחור נהיה לבן, ולבן נהיה שחור.' },
};
const SINGLE_IDS = Object.keys(OPS);

// Two rules at once (difficulty 3).
const COMBOS = [['rotCW', 'invert'], ['rotCCW', 'invert'], ['walkCW', 'invert'], ['shiftR', 'growRows'], ['shiftD', 'growCols'], ['flipH', 'invert']];
const comboText = (a, b) => 'קורים כאן שני דברים בבת אחת. ' + OPS[a].text + ' וגם: ' + OPS[b].text;
const applyIds = (ids, b) => ids.reduce((acc, id) => OPS[id].fn(acc), b);

// Every alternative rule the checker knows: all single rules and all ordered pairs of them.
const ALTERNATIVES = [];
for (const a of SINGLE_IDS) ALTERNATIVES.push([a]);
for (const a of SINGLE_IDS) for (const b of SINGLE_IDS) if (OPS[a].family !== OPS[b].family) ALTERNATIVES.push([a, b]);

// ---------- figure builders ----------
function randomBitmap(rng, n, filled, where) {
  const cells = new Array(n * n).fill(0);
  let pool = [];
  for (let i = 0; i < n * n; i++) pool.push(i);
  if (where === 'ring') pool = ring(n).map(([r, c]) => r * n + c);
  rng.shuffle(pool).slice(0, filled).forEach((i) => (cells[i] = 1));
  return { n, cells };
}
// A connected shape (cells touching side to side), grown from a random cell. Easier to follow than scattered cells.
function connectedBitmap(rng, n, filled) {
  const cells = new Array(n * n).fill(0);
  cells[rng.int(0, n * n - 1)] = 1;
  for (let k = 1; k < filled; k++) {
    const edge = [];
    cells.forEach((v, i) => {
      if (v) return;
      const r = Math.floor(i / n), c = i % n;
      const touches = (r > 0 && cells[i - n]) || (r < n - 1 && cells[i + n]) || (c > 0 && cells[i - 1]) || (c < n - 1 && cells[i + 1]);
      if (touches) edge.push(i);
    });
    cells[rng.pick(edge)] = 1;
  }
  return { n, cells };
}
function isChiral(b) {
  const m = OPS.flipH.fn(b);
  let r = b;
  for (let i = 0; i < 4; i++) { if (same(m, r)) return false; r = OPS.rotCW.fn(r); }
  return true;
}
function startFigure(rng, ids, format) {
  const fam = OPS[ids[0]].family;
  if (fam === 'grow') return growStart(rng, ids[0]);
  if (ids.includes('growRows') || ids.includes('growCols')) return randomBitmap(rng, 3, rng.int(1, 2));
  if (fam === 'walk') return randomBitmap(rng, 3, ids.length > 1 ? 2 : rng.int(1, 2), 'ring');
  if (fam === 'shift') return randomBitmap(rng, rng.pick([3, 4]), rng.int(2, 3));
  if (fam === 'invert') return randomBitmap(rng, 3, rng.int(3, 5));
  // rotate, half-turn, mirror: needs a figure with no symmetry at all
  for (let i = 0; i < 50; i++) {
    const b = connectedBitmap(rng, 3, rng.int(4, 5));
    if (isChiral(b)) return b;
  }
  return null;
}
function growStart(rng, id) {
  let b = { n: 3, cells: new Array(9).fill(0) };
  const k = rng.int(1, 3);
  for (let i = 0; i < k; i++) b = OPS[id].fn(b);
  return b;
}

// ---------- the checker ----------
// Returns null when the item is sound, or a reason string when it must be rejected.
export function checkItem(item) {
  const { ids, shown, answer, options } = item._check;
  for (const [from, to] of shown) if (same(from, to)) return 'a step changes nothing';
  for (const alt of ALTERNATIVES) {
    if (alt.join() === ids.join()) continue;
    if (shown.every(([from, to]) => same(applyIds(alt, from), to))) {
      const last = item._check.applyTo;
      if (!same(applyIds(alt, last), answer)) return 'ambiguous with ' + alt.join('+');
    }
  }
  const keys = options.map(key);
  if (new Set(keys).size !== options.length) return 'duplicate options';
  if (keys.filter((k) => k === key(answer)).length !== 1) return 'answer not unique among options';
  return null;
}

// ---------- distractors ----------
function nearMiss(rng, b, keepsCount) {
  const cells = b.cells.slice();
  const on = [], off = [];
  cells.forEach((v, i) => (v ? on : off).push(i));
  if (keepsCount && on.length && off.length) { cells[rng.pick(on)] = 0; cells[rng.pick(off)] = 1; }
  else { const i = rng.int(0, cells.length - 1); cells[i] = cells[i] ? 0 : 1; }
  return { n: b.n, cells };
}
function buildDistractors(rng, ids, from, answer) {
  const found = [];
  const add = (b, tag) => {
    if (!b || same(b, answer) || found.some((f) => same(f.bm, b))) return;
    if (count(b) === 0 || count(b) === b.n * b.n) return;
    found.push({ bm: b, tag });
  };
  const first = OPS[ids[0]];
  if (ids.length === 2) {
    add(OPS[ids[0]].fn(from), 'one-rule-only');
    add(OPS[ids[1]].fn(from), 'one-rule-only');
  }
  if (first.inverse && first.inverse !== ids[0]) add(applyIds([first.inverse, ...ids.slice(1)], from), 'wrong-direction');
  if (first.sibling) add(applyIds([first.sibling, ...ids.slice(1)], from), first.family === 'mirror' ? 'rotation-for-mirror' : 'mirror-for-rotation');
  add(applyIds(ids, answer), 'double-step');
  add(from, 'no-change');
  const keeps = ids.every((id) => OPS[id].keepsCount);
  for (let i = 0; i < 30 && found.length < 3; i++) add(nearMiss(rng, answer, keeps), 'near-miss');
  return rng.shuffle(found.slice(0, 4)).slice(0, 3);
}

// ---------- public: generate one question ----------
const BY_DIFFICULTY = {
  1: [['walkCW'], ['walkCCW'], ['shiftR'], ['shiftL'], ['shiftD'], ['shiftU'], ['growRows'], ['growCols']],
  2: [['rotCW'], ['rotCCW'], ['rot180'], ['flipH'], ['flipV'], ['invert']],
  3: COMBOS,
};
const enc = (b) => ({ n: b.n, s: b.cells.join('') });

export function generateFigural(seed, { difficulty = 1, format, variant, family, debug = false } = {}) {
  let rejects = 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const rng = makeRng(s);
    let pool = BY_DIFFICULTY[difficulty] || BY_DIFFICULTY[1];
    if (family) pool = Object.values(BY_DIFFICULTY).flat().filter((ids) => ids.length === 1 && OPS[ids[0]].family === family);
    const ids = rng.pick(pool);
    // Official formats are the series and the 3x3 matrix. The 2x2 analogy is an introductory exercise of our own.
    let fmt = format;
    if (!fmt) {
      const roll = rng.next();
      fmt = roll < 0.3 ? 'matrix' : roll < 0.45 && difficulty >= 2 && ids.length === 1 && OPS[ids[0]].family !== 'invert' ? 'analogy' : 'series';
    }
    // Colour-swap figures need their gridlines, otherwise a mostly black figure reads as a blob.
    let vr = variant || rng.pick(['grid', 'grid', 'blocks']);
    if (vr === 'blocks' && ids.includes('invert')) vr = 'grid';

    let stem, shown, from, answer;
    if (fmt === 'series') {
      const f0 = startFigure(rng, ids, fmt);
      if (!f0) { rejects++; continue; }
      // Four frames, as in the official demonstration test (its rotating arrow also returns to the first frame).
      const shownCount = 4;
      const frames = [f0];
      for (let i = 0; i < shownCount; i++) frames.push(applyIds(ids, frames[i]));
      answer = frames[shownCount]; from = frames[shownCount - 1];
      shown = [];
      for (let i = 0; i < shownCount - 1; i++) shown.push([frames[i], frames[i + 1]]);
      stem = { kind: 'series', frames: frames.slice(0, shownCount).map(enc) };
    } else if (fmt === 'matrix') {
      // The same rule repeats in every row and starts again in each row, as in the official 3x3 questions.
      const rows = [];
      for (let r = 0; r < 3; r++) {
        const f = startFigure(rng, ids, fmt);
        if (!f || rows.some((row) => same(row[0], f))) break;
        rows.push([f, applyIds(ids, f), applyIds(ids, applyIds(ids, f))]);
      }
      if (rows.length < 3) { rejects++; continue; }
      from = rows[2][1]; answer = rows[2][2];
      shown = [[rows[0][0], rows[0][1]], [rows[0][1], rows[0][2]], [rows[1][0], rows[1][1]], [rows[1][1], rows[1][2]], [rows[2][0], rows[2][1]]];
      stem = { kind: 'matrix', cells: rows.flat().slice(0, 8).map(enc) };
    } else {
      const a = startFigure(rng, ids, fmt), c = startFigure(rng, ids, fmt);
      if (!a || !c || same(a, c)) { rejects++; continue; }
      from = c; answer = applyIds(ids, c);
      shown = [[a, applyIds(ids, a)]];
      stem = { kind: 'analogy', a: enc(a), b: enc(applyIds(ids, a)), c: enc(c) };
    }
    if (count(answer) === 0 || count(answer) === answer.n * answer.n) { rejects++; continue; }

    const distractors = buildDistractors(rng, ids, from, answer);
    if (distractors.length < 3) { rejects++; continue; }
    const placed = placeOptions(rng, { bm: answer, tag: null }, distractors);
    const item = {
      id: `figural-${s}-${difficulty}`,
      category: 'figural', subtype: fmt, ruleFamily: ids.map((id) => OPS[id].family).join('+'),
      difficulty, variant: vr, gen: { ...GEN, seed: s, ops: ids },
      prompt: fmt === 'series' ? 'איזו צורה ממשיכה את הסדרה?' : fmt === 'matrix' ? 'בכל שורה הצורות מסודרות לפי אותו כלל. איזו צורה חסרה בסוף השורה השלישית?' : 'מה שקרה לצורה בשורה העליונה צריך לקרות גם בשורה התחתונה. איזו צורה מתאימה?',
      stem,
      options: placed.options.map((o) => ({ kind: 'bitmap', bm: enc(o.bm), tag: o.tag })),
      correctIndex: placed.correctIndex,
      hint: fmt === 'series'
        ? 'השוו בין שתי הצורות הראשונות. מה בדיוק השתנה? עכשיו בדקו אם אותו דבר קורה גם בצעד הבא.'
        : fmt === 'matrix' ? 'הסתכלו רק על השורה הראשונה, משמאל לימין. מה משתנה מצורה לצורה? בדקו שזה נכון גם בשורה השנייה, ואז המשיכו את השורה השלישית.'
        : 'הסתכלו רק על השורה העליונה. מה קרה לצורה? עכשיו עשו בדיוק את אותו הדבר לצורה שלמטה.',
      explanation: { text: (fmt === 'matrix' ? 'הכלל חוזר בכל שורה, ומתחיל מחדש בכל שורה. ' : '') + (ids.length === 2 ? comboText(ids[0], ids[1]) : OPS[ids[0]].text), answerBm: enc(answer) },
      _check: { ids, shown, applyTo: from, answer, options: placed.options.map((o) => o.bm) },
    };
    const problem = checkItem(item);
    if (problem) { rejects++; continue; }
    item.rejectsBeforeAccept = rejects;
    if (!debug) delete item._check;
    return item;
  }
  throw new Error('figural generator could not produce a sound item for seed ' + seed);
}
