// Figural questions drawn the way the official demonstration test draws them (part 5):
// a rotating arrow, small circles gathering around a centre, and dot counts.
// Formats: shape series (kind a in the official test) and 3x3 matrix where the same rule repeats
// in every row and starts again in each row (kind b). See docs/SOURCE_MAP.md.
import { makeRng, placeOptions } from '../rng.js?v=muic26cd';

export const GEN = { id: 'glyph', version: 1 };
const mod = (n, m) => ((n % m) + m) % m;
const key = (st) => JSON.stringify(st);

// Each family: how to make a start state, how to step it, what to say, and which wrong ideas to offer.
const FAMILIES = {
  arrow: {
    rules(d) { return d === 1 ? [2, -2] : d === 2 ? [1, -1, 2, -2] : [3, -3, 1, -1]; },
    start: (rng) => ({ g: 'arrow', dir: rng.int(0, 7) }),
    step: (st, r) => ({ g: 'arrow', dir: mod(st.dir + r, 8) }),
    text(r) {
      const size = Math.abs(r) === 2 ? 'רבע סיבוב' : Math.abs(r) === 1 ? 'שמינית סיבוב (חצי מרבע סיבוב)' : 'שלוש שמיניות סיבוב';
      return `בכל שלב החץ מסתובב ${size} ${r > 0 ? 'ימינה, עם כיוון השעון' : 'שמאלה, נגד כיוון השעון'}.`;
    },
    wrong: (last, r, answer) => [[{ g: 'arrow', dir: mod(last.dir - r, 8) }, 'wrong-direction'], [{ g: 'arrow', dir: mod(answer.dir + r, 8) }, 'double-step'], [last, 'no-change'],
      [{ g: 'arrow', dir: mod(answer.dir + 4, 8) }, 'opposite'], [{ g: 'arrow', dir: mod(answer.dir + 1, 8) }, 'near-miss'], [{ g: 'arrow', dir: mod(answer.dir - 1, 8) }, 'near-miss']],
    numeric: (st) => st.dir, modulus: 8,
  },
  orbit: {
    rules(d) { return d === 1 ? [2, -2] : d === 2 ? [1, -1, 2, -2] : [[2, 'flip'], [-2, 'flip'], [1, 'flip']]; },
    start: (rng) => { const dots = new Array(8).fill(0); const at = rng.int(0, 7); dots[at] = 1; return { g: 'orbit', center: rng.int(0, 1), dots: dots.join(''), head: at }; },
    step(st, r) {
      const [gap, flip] = Array.isArray(r) ? r : [r, null];
      const dots = st.dots.split('').map(Number), head = mod(st.head + gap, 8);
      if (dots[head]) return null; // the ring is full along this path
      dots[head] = 1;
      return { g: 'orbit', center: flip ? 1 - st.center : st.center, dots: dots.join(''), head };
    },
    text(r) {
      const [gap, flip] = Array.isArray(r) ? r : [r, null];
      const base = `בכל שלב נוסף עוד עיגול קטן, ${Math.abs(gap) === 2 ? 'במרחק קבוע מהקודם' : 'צמוד לקודם'}, ${gap > 0 ? 'עם כיוון השעון' : 'נגד כיוון השעון'}.`;
      return flip ? 'קורים כאן שני דברים בבת אחת. ' + base + ' וגם: העיגול שבמרכז מחליף צבע בכל שלב.' : base + ' העיגול שבמרכז לא משתנה.';
    },
    wrong(last, r, answer) {
      const [gap] = Array.isArray(r) ? r : [r];
      const set = (st, idx, centre) => { const d = st.dots.split(''); d[mod(idx, 8)] = '1'; return { g: 'orbit', center: centre, dots: d.join(''), head: mod(idx, 8) }; };
      return [[set(last, last.head - gap, answer.center), 'wrong-direction'], [{ ...answer, center: 1 - answer.center }, Array.isArray(r) ? 'one-rule-only' : 'changed-the-centre'],
        [set(answer, answer.head + gap, answer.center), 'double-step'], [{ ...last, center: answer.center }, 'no-change'], [set(last, last.head + gap + 1, answer.center), 'near-miss']];
    },
  },
  dots: {
    rules(d) { return d === 1 ? [1] : d === 2 ? [1, 2, -1] : [2, -2, 3]; },
    start: (rng, r) => ({ g: 'dots', n: r > 0 ? rng.int(1, 3) : rng.int(7, 9) }),
    step: (st, r) => (st.n + r >= 1 && st.n + r <= 9 ? { g: 'dots', n: st.n + r } : null),
    text: (r) => (r > 0 ? `בכל צורה יש ${r === 1 ? 'נקודה אחת יותר' : r + ' נקודות יותר'} מאשר בצורה שלפניה.` : `בכל צורה יש ${r === -1 ? 'נקודה אחת פחות' : -r + ' נקודות פחות'} מאשר בצורה שלפניה.`),
    wrong: (last, r, answer) => [[{ g: 'dots', n: last.n - r }, 'wrong-direction'], [{ g: 'dots', n: answer.n + r }, 'double-step'], [last, 'no-change'], [{ g: 'dots', n: answer.n + 1 }, 'off-by-one'], [{ g: 'dots', n: answer.n - 1 }, 'off-by-one']],
    numeric: (st) => st.n,
  },
};

function clean(st) { const { head: _h, ...rest } = st; return rest; }
const valid = (st) => st && (st.g !== 'dots' || (st.n >= 1 && st.n <= 9));

export function generateGlyph(seed, { difficulty = 1, format, family, debug = false } = {}) {
  let rejects = 0;
  for (let attempt = 0; attempt < 300; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const rng = makeRng(s);
    const famName = family || rng.pick(difficulty === 1 ? ['arrow', 'dots', 'orbit'] : ['arrow', 'orbit', 'dots', 'orbit']);
    const fam = FAMILIES[famName];
    const fmt = format || (rng.next() < 0.5 ? 'matrix' : 'series');
    const rule = rng.pick(fam.rules(difficulty));
    const ruleNum = Array.isArray(rule) ? rule[0] : rule;

    let stem, last, answer, ok = true;
    if (fmt === 'series') {
      const shownCount = famName === 'orbit' ? 3 : 4;
      const frames = [fam.start(rng, ruleNum)];
      for (let i = 0; i < shownCount; i++) { const nx = fam.step(frames[i], rule); if (!valid(nx)) { ok = false; break; } frames.push(nx); }
      if (!ok) { rejects++; continue; }
      answer = frames[shownCount]; last = frames[shownCount - 1];
      stem = { kind: 'series', frames: frames.slice(0, shownCount).map(clean) };
    } else {
      const rows = [];
      const starts = new Set();
      for (let r = 0; r < 3 && ok; r++) {
        let st = fam.start(rng, ruleNum), guard = 0;
        while (starts.has(key(clean(st))) && guard++ < 20) st = fam.start(rng, ruleNum);
        if (starts.has(key(clean(st)))) { ok = false; break; }
        starts.add(key(clean(st)));
        const b = fam.step(st, rule), c = b && fam.step(b, rule);
        if (!valid(b) || !valid(c)) { ok = false; break; }
        rows.push([st, b, c]);
      }
      if (!ok) { rejects++; continue; }
      // A child may read the matrix by columns. If the columns also follow a steady numeric rule, it must lead to the same answer.
      if (fam.numeric) {
        const m = fam.modulus, diff = (a, b) => (m ? mod(fam.numeric(b) - fam.numeric(a), m) : fam.numeric(b) - fam.numeric(a));
        const colSteady = [0, 1].every((c) => diff(rows[0][c], rows[1][c]) === diff(rows[1][c], rows[2][c])) && diff(rows[0][0], rows[1][0]) === diff(rows[0][1], rows[1][1]);
        if (colSteady) {
          const predicted = m ? mod(fam.numeric(rows[1][2]) + diff(rows[0][2], rows[1][2]), m) : fam.numeric(rows[1][2]) + diff(rows[0][2], rows[1][2]);
          if (predicted !== fam.numeric(rows[2][2])) { rejects++; continue; }
        }
      }
      answer = rows[2][2]; last = rows[2][1];
      stem = { kind: 'matrix', cells: rows.flat().slice(0, 8).map(clean) };
    }

    const found = [];
    for (const [st, tag] of fam.wrong(last, rule, answer)) {
      if (!valid(st)) continue;
      const c = clean(st);
      if (key(c) === key(clean(answer)) || found.some((f) => key(f.st) === key(c))) continue;
      found.push({ st: c, tag });
    }
    if (found.length < 3) { rejects++; continue; }
    const placed = placeOptions(rng, { st: clean(answer), tag: null }, found.slice(0, 3));
    const keys = placed.options.map((o) => key(o.st));
    if (new Set(keys).size !== 4) { rejects++; continue; }

    const item = {
      id: `glyph-${s}-${difficulty}`, category: 'figural', subtype: fmt, ruleFamily: famName + (Array.isArray(rule) ? '+flip' : ''), difficulty, variant: 'official-' + famName,
      gen: { ...GEN, seed: s, family: famName, rule },
      prompt: fmt === 'series' ? 'איזו צורה ממשיכה את הסדרה?' : 'בכל שורה הצורות מסודרות לפי אותו כלל. איזו צורה חסרה בסוף השורה השלישית?',
      stem,
      options: placed.options.map((o) => ({ kind: 'glyph', st: o.st, tag: o.tag })),
      correctIndex: placed.correctIndex,
      hint: fmt === 'series'
        ? 'השוו בין שתי הצורות הראשונות. מה בדיוק השתנה? עכשיו בדקו אם אותו דבר קורה גם בצעד הבא.'
        : 'הסתכלו רק על השורה הראשונה, משמאל לימין. מה משתנה מצורה לצורה? בדקו שזה נכון גם בשורה השנייה, ואז המשיכו את השורה השלישית.',
      explanation: { text: (fmt === 'matrix' ? 'הכלל חוזר בכל שורה, ומתחיל מחדש בכל שורה. ' : '') + fam.text(rule), answerSt: clean(answer) },
      rejectsBeforeAccept: rejects,
    };
    if (debug) item._check = { famName, rule, answer: clean(answer), last: clean(last) };
    return item;
  }
  throw new Error('glyph generator could not produce a sound item for seed ' + seed);
}

// Used by the tests to re-derive the answer independently of the generator's own bookkeeping.
export function stepForTest(famName, state, rule, head) { return FAMILIES[famName].step({ ...state, head }, rule); }
