// Numbers in shapes. Official formats (Ministry demonstration test, part 4): three circles, triangle pyramid.
// Extra practice formats from the Machon Noam Grade 3 sample: the ring and the butterfly.
// See docs/QUESTION_TAXONOMY.md section B.
import { makeRng, placeOptions } from '../rng.js?v=muic26cd';

export const GEN = { id: 'numshapes', version: 1 };

// Candidate operations the checker tries on every complete example: f(outer, inner) -> centre.
const CANDIDATES = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  subRev: (a, b) => b - a,
  mul: (a, b) => a * b,
  div: (a, b) => (b !== 0 && a % b === 0 ? a / b : NaN),
  divRev: (a, b) => (a !== 0 && b % a === 0 ? b / a : NaN),
};
const SIGN = { add: '+', sub: '−', mul: '×', div: '÷' };
const RING_TEXT = {
  add: 'בכל פרוסה, המספר החיצוני ועוד המספר הפנימי שווים למספר שבמרכז.',
  sub: 'בכל פרוסה, המספר החיצוני פחות המספר הפנימי שווה למספר שבמרכז.',
  mul: 'בכל פרוסה, המספר החיצוני כפול המספר הפנימי שווה למספר שבמרכז.',
  div: 'בכל פרוסה, המספר החיצוני חלקי המספר הפנימי שווה למספר שבמרכז.',
};

// All values of the missing number (1..400) that make `fn` produce the centre.
function solutions(fn, known, missingPos, centre) {
  const out = [];
  for (let x = 1; x <= 400; x++) {
    const v = missingPos === 'outer' ? fn(x, known) : fn(known, x);
    if (v === centre) out.push(x);
  }
  return out;
}

function numberDistractors(rng, answer, candidates) {
  const found = [];
  const add = (v, tag) => {
    if (!Number.isInteger(v) || v <= 0 || v === answer || found.some((f) => f.value === v)) return;
    found.push({ value: v, tag });
  };
  candidates.forEach(([v, tag]) => add(v, tag));
  const fillers = rng.shuffle([[answer + 1, 'off-by-one'], [answer - 1, 'off-by-one'], [answer + 10, 'borrow-slip'], [answer - 10, 'borrow-slip'], [answer * 2, 'near-miss'], [answer + 2, 'near-miss']]);
  fillers.forEach(([v, tag]) => add(v, tag));
  return found.slice(0, 3);
}

function factorPairs(n) {
  const out = [];
  for (let a = 1; a <= n; a++) if (n % a === 0) out.push([a, n / a]);
  return out;
}

// ---------- the ring ----------
function buildRing(rng, difficulty) {
  const op = difficulty === 1 ? rng.pick(['add', 'mul']) : rng.pick(['sub', 'div', 'mul', 'add']);
  let centre, sectors;
  if (op === 'mul') {
    centre = rng.pick(difficulty === 1 ? [12, 18, 20, 24, 30] : [36, 40, 42, 48, 56, 60, 72]);
    sectors = rng.shuffle(factorPairs(centre)).slice(0, 3).map(([outer, inner]) => ({ outer, inner }));
  } else if (op === 'add') {
    centre = difficulty === 1 ? rng.int(15, 40) : rng.int(45, 120);
    const used = new Set();
    sectors = [];
    while (sectors.length < 3) {
      const outer = rng.int(3, centre - 3);
      if (used.has(outer) || used.has(centre - outer)) continue;
      used.add(outer); sectors.push({ outer, inner: centre - outer });
    }
  } else if (op === 'sub') {
    centre = rng.int(6, 30);
    const inners = rng.shuffle([3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 17]).slice(0, 3);
    sectors = inners.map((inner) => ({ outer: centre + inner, inner }));
  } else {
    centre = rng.int(3, 9);
    const inners = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
    sectors = inners.map((inner) => ({ outer: centre * inner, inner }));
  }
  const missing = { sector: 2, pos: rng.pick(['outer', 'inner']) };
  return { op, centre, sectors, missing };
}

function checkRing(q) {
  const { op, centre, sectors, missing } = q;
  const complete = sectors.filter((_, i) => i !== missing.sector);
  const target = sectors[missing.sector];
  const answer = target[missing.pos];
  const known = missing.pos === 'outer' ? target.inner : target.outer;
  const fitting = Object.entries(CANDIDATES).filter(([, fn]) => complete.every((s) => fn(s.outer, s.inner) === centre));
  if (!fitting.some(([name]) => name === op)) return 'intended rule does not fit';
  for (const [name, fn] of fitting) {
    const sols = solutions(fn, known, missing.pos, centre);
    if (name === op && (sols.length !== 1 || sols[0] !== answer)) return 'intended rule has no single solution';
    if (name !== op && sols.some((v) => v !== answer)) return 'ambiguous with ' + name;
  }
  return null;
}

// ---------- the butterfly ----------
function buildButterfly(rng, difficulty) {
  const op = difficulty === 1 ? 'add' : rng.pick(['add', 'add', 'sub']);
  const fly = () => {
    if (op === 'add') {
      const body = difficulty === 1 ? rng.int(20, 50) : rng.int(40, 99);
      const tl = rng.int(6, body - 6), tr = rng.int(6, body - 6);
      return { tl, bl: body - tl, tr, br: body - tr, body };
    }
    const body = rng.int(8, 40);
    const bl = rng.int(5, 30), br = rng.int(5, 30);
    return { tl: body + bl, bl, tr: body + br, br, body };
  };
  return { op, flies: [fly(), fly()], missing: { fly: 1, pos: rng.pick(['tl', 'bl', 'tr', 'br']) } };
}

function checkButterfly(q) {
  const { op, flies, missing } = q;
  const f = (a, b) => (op === 'add' ? a + b : a - b);
  for (const b of flies) {
    if (f(b.tl, b.bl) !== b.body || f(b.tr, b.br) !== b.body) return 'intended rule does not fit';
    const vals = [b.tl, b.bl, b.tr, b.br];
    if (new Set(vals).size !== 4) return 'repeated wing numbers';
  }
  // In the teaching butterfly, no other pairing and no other operation may also give the body number.
  const t = flies[0];
  const otherPairs = [[t.tl, t.tr], [t.bl, t.br], [t.tl, t.br], [t.tr, t.bl]];
  for (const [a, b] of otherPairs) for (const fn of Object.values(CANDIDATES)) if (fn(a, b) === t.body) return 'another pairing also fits';
  for (const [name, fn] of Object.entries(CANDIDATES)) {
    if (name === op) continue;
    if (fn(t.tl, t.bl) === t.body && fn(t.tr, t.br) === t.body) return 'ambiguous with ' + name;
  }
  if (flies[1][missing.pos] <= 0) return 'bad answer';
  return null;
}

// ---------- three circles (official demonstration test, part 4, question 1) ----------
const CIRCLE_TEXT = {
  add: 'בכל עיגול, שני המספרים שלמעלה, אחד ועוד השני, שווים למספר שלמטה.',
  mul: 'בכל עיגול, שני המספרים שלמעלה, אחד כפול השני, שווים למספר שלמטה.',
  sub: 'בכל עיגול, המספר השמאלי פחות המספר הימני שווה למספר שלמטה.',
  div: 'בכל עיגול, המספר השמאלי חלקי המספר הימני שווה למספר שלמטה.',
};
function buildCircles(rng, difficulty) {
  const op = difficulty === 1 ? rng.pick(['mul', 'add']) : rng.pick(['mul', 'sub', 'div', 'add']);
  const one = () => {
    if (op === 'mul') { const a = rng.int(2, difficulty === 1 ? 6 : 12), b = rng.int(2, 9); return { a, b, c: a * b }; }
    if (op === 'add') { const a = rng.int(4, difficulty === 1 ? 20 : 60), b = rng.int(3, difficulty === 1 ? 15 : 38); return { a, b, c: a + b }; }
    if (op === 'sub') { const b = rng.int(3, 28), c = rng.int(4, 30); return { a: b + c, b, c }; }
    const b = rng.int(2, 9), c = rng.int(2, 9); return { a: b * c, b, c };
  };
  return { op, circles: [one(), one(), one()], missing: { circle: 2, pos: rng.pick(difficulty === 1 ? ['c', 'b'] : ['a', 'b', 'c']) } };
}
function circleSolutions(fn, t, pos) {
  if (pos === 'c') { const v = fn(t.a, t.b); return Number.isInteger(v) && v > 0 ? [v] : []; }
  const out = [];
  for (let x = 1; x <= 400; x++) if ((pos === 'a' ? fn(x, t.b) : fn(t.a, x)) === t.c) out.push(x);
  return out;
}
function checkCircles(q) {
  const { op, circles, missing } = q;
  const complete = circles.filter((_, i) => i !== missing.circle), target = circles[missing.circle], answer = target[missing.pos];
  if (new Set(circles.map((c) => c.a + ':' + c.b)).size !== 3) return 'repeated circle';
  const fitting = Object.entries(CANDIDATES).filter(([, fn]) => complete.every((c) => fn(c.a, c.b) === c.c));
  if (!fitting.some(([n]) => n === op)) return 'intended rule does not fit';
  for (const [name, fn] of fitting) {
    const sols = circleSolutions(fn, target, missing.pos);
    if (name === op && (sols.length !== 1 || sols[0] !== answer)) return 'intended rule has no single solution';
    if (name !== op && sols.some((v) => v !== answer)) return 'ambiguous with ' + name;
  }
  return null;
}

// ---------- triangle pyramid (official demonstration test, part 4, question 2) ----------
const PYRAMID_RULES = { sum: (l, r) => l + r, diff: (l, r) => r - l, diffRev: (l, r) => l - r, product: (l, r) => l * r };
const PYRAMID_TEXT = {
  sum: 'כל מספר בפירמידה הוא הסכום של שני המספרים שמתחתיו.',
  diff: 'כל מספר בפירמידה הוא ההפרש בין שני המספרים שמתחתיו: הימני פחות השמאלי.',
};
function buildPyramid(rng, difficulty) {
  const op = rng.pick(['diff', 'diff', 'sum']);
  let x, y, z;
  if (op === 'diff') { x = rng.int(2, 12); const m1 = rng.int(2, 9), top = rng.int(1, 9); y = x + m1; z = y + m1 + top; }
  else { x = rng.int(2, 12); y = rng.int(2, 12); z = rng.int(2, 12); }
  const g = PYRAMID_RULES[op], m1 = g(x, y), m2 = g(y, z), top = g(m1, m2);
  return { op, v: { x, y, z, m1, m2, top }, missing: difficulty === 1 ? 'top' : rng.pick(['top', 'top', 'z', 'x']) };
}
function pyramidSolutions(g, v, missing) {
  const out = [];
  for (let t = 1; t <= 400; t++) {
    const w = { ...v, [missing]: t };
    if (g(w.x, w.y) === w.m1 && g(w.y, w.z) === w.m2 && g(w.m1, w.m2) === w.top) out.push(t);
  }
  return out;
}
function checkPyramid(q) {
  const { op, v, missing } = q;
  if (Object.values(v).some((n) => !Number.isInteger(n) || n <= 0)) return 'non-positive number';
  if (new Set([v.x, v.y, v.z]).size !== 3) return 'repeated base numbers';
  for (const [name, g] of Object.entries(PYRAMID_RULES)) {
    const sols = pyramidSolutions(g, v, missing);
    if (name === op && (sols.length !== 1 || sols[0] !== v[missing])) return 'intended rule has no single solution';
    if (name !== op && sols.some((t) => t !== v[missing])) return 'ambiguous with ' + name;
  }
  return null;
}

// ---------- machine, fan, counted arrows (official demonstration test, part 4, questions 3 to 5) ----------
// machine: a number goes into a box and comes out changed (8 -> [2] -> 16, 10 -> [4] -> ?).
const MACHINE_TEXT = {
  add: 'המספר שנכנס ועוד המספר שבריבוע נותנים את המספר שיוצא.',
  sub: 'המספר שנכנס פחות המספר שבריבוע נותן את המספר שיוצא.',
  mul: 'המספר שנכנס כפול המספר שבריבוע נותן את המספר שיוצא.',
  div: 'המספר שנכנס חלקי המספר שבריבוע נותן את המספר שיוצא.',
};
function buildMachine(rng, difficulty) {
  const op = difficulty === 1 ? rng.pick(['mul', 'add']) : rng.pick(['mul', 'div', 'sub', 'add']);
  const row = () => {
    if (op === 'mul') { const a = rng.int(3, 12), b = rng.int(2, 9); return { a, b, c: a * b }; }
    if (op === 'add') { const a = rng.int(5, 40), b = rng.int(3, 25); return { a, b, c: a + b }; }
    if (op === 'sub') { const b = rng.int(3, 20), c = rng.int(3, 30); return { a: b + c, b, c }; }
    const b = rng.int(2, 9), c = rng.int(2, 9); return { a: b * c, b, c };
  };
  return { op, circles: [row(), row()], missing: { circle: 1, pos: difficulty === 1 ? 'c' : rng.pick(['c', 'c', 'a', 'b']) } };
}
// fan: one number sends arrows to two numbers, by the same two multipliers in both fans (2 -> 14, 18 and 6 -> 42, ?).
function buildFan(rng, difficulty) {
  const m1 = rng.int(2, difficulty === 1 ? 5 : 9); let m2 = rng.int(2, difficulty === 1 ? 6 : 9); if (m2 === m1) m2 = m1 + 1;
  const s1 = rng.int(2, 5); let s2 = rng.int(3, 9); if (s2 === s1) s2 = s1 + 2;
  return { m1, m2, fans: [{ s: s1, l: s1 * m1, r: s1 * m2 }, { s: s2, l: s2 * m1, r: s2 * m2 }], missing: rng.pick(['r', 'r', 'l']) };
}
function checkFan(q) {
  const [f1, f2] = q.fans, seen = q.missing === 'r' ? 'l' : 'r', answer = f2[q.missing];
  // The rival reading: the same amounts are added instead of multiplied. It must not survive the second fan's visible number.
  const addSeen = f1[seen] - f1.s, addMissing = f1[q.missing] - f1.s;
  if (f2.s + addSeen === f2[seen] && f2.s + addMissing !== answer) return 'ambiguous with addition';
  if (new Set([f1.s, f1.l, f1.r, f2.s, f2.l, f2.r]).size !== 6) return 'repeated numbers';
  return null;
}
// arrows: every arrow adds the same amount (4 -one arrow-> 5, 5 -two arrows-> 7, 7 -three arrows-> ?).
function buildArrows(rng, difficulty) {
  const k = difficulty === 1 ? 1 : rng.int(1, 4), start = rng.int(2, 15);
  const v = [start, start + k, start + 3 * k, start + 6 * k];
  return { k, v };
}

// ---------- public ----------
export function generateNumShapes(seed, { difficulty = 1, format, debug = false } = {}) {
  let rejects = 0;
  for (let attempt = 0; attempt < 300; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const rng = makeRng(s);
    const fmt = format || rng.pick(['circles', 'circles', 'pyramid', 'pyramid', 'machine', 'fan', 'arrows', 'ring', 'butterfly']);
    let q, problem, answer, stem, text, lines, hint, cands;

    if (fmt === 'ring') {
      q = buildRing(rng, difficulty);
      problem = checkRing(q);
      if (problem) { rejects++; continue; }
      const target = q.sectors[q.missing.sector];
      answer = target[q.missing.pos];
      const known = q.missing.pos === 'outer' ? target.inner : target.outer;
      stem = { kind: 'ring', centre: q.centre, sectors: q.sectors, missing: q.missing };
      text = RING_TEXT[q.op];
      lines = q.sectors.map((sec) => `${sec.outer} ${SIGN[q.op]} ${sec.inner} = ${q.centre}`);
      hint = 'הסתכלו על פרוסה שלמה. מה צריך לעשות עם שני המספרים שלה כדי לקבל את המספר שבמרכז?';
      const wrongOps = Object.entries(CANDIDATES).filter(([n]) => n !== q.op).flatMap(([, fn]) => solutions(fn, known, q.missing.pos, q.centre)).map((v) => [v, 'wrong-operation']);
      const copied = q.sectors.flatMap((sec) => [sec.outer, sec.inner]).concat(q.centre).map((v) => [v, 'copied-number']);
      cands = [...rng.shuffle(wrongOps).slice(0, 1), ...rng.shuffle(copied).slice(0, 1)];
    } else if (fmt === 'circles') {
      q = buildCircles(rng, difficulty);
      problem = checkCircles(q);
      if (problem) { rejects++; continue; }
      const target = q.circles[q.missing.circle];
      answer = target[q.missing.pos];
      stem = { kind: 'circles', circles: q.circles, missing: q.missing };
      text = CIRCLE_TEXT[q.op];
      lines = q.circles.map((c) => `${c.a} ${SIGN[q.op]} ${c.b} = ${c.c}`);
      hint = 'הסתכלו על עיגול שלם. מה צריך לעשות עם שני המספרים שלמעלה כדי לקבל את המספר שלמטה? בדקו שזה עובד גם בעיגול השני.';
      const wrongOps = Object.entries(CANDIDATES).filter(([n]) => n !== q.op).flatMap(([, fn]) => circleSolutions(fn, target, q.missing.pos)).map((v) => [v, 'wrong-operation']);
      const copied = q.circles.flatMap((c) => [c.a, c.b, c.c]).map((v) => [v, 'copied-number']);
      cands = [...rng.shuffle(wrongOps).slice(0, 2), ...rng.shuffle(copied).slice(0, 1)];
    } else if (fmt === 'machine') {
      q = buildMachine(rng, difficulty);
      const target = q.circles[1], example = q.circles[0];
      // One worked example, as in the official question: every other operation must either not fit it or lead to the same answer.
      const fitting = Object.entries(CANDIDATES).filter(([, fn]) => fn(example.a, example.b) === example.c);
      answer = target[q.missing.pos];
      problem = fitting.some(([name, fn]) => name !== q.op && circleSolutions(fn, target, q.missing.pos).some((v) => v !== answer)) ? 'ambiguous' : null;
      if (!problem && (circleSolutions(CANDIDATES[q.op], target, q.missing.pos).length !== 1 || example.a === target.a)) problem = 'no single solution';
      if (problem) { rejects++; continue; }
      stem = { kind: 'machine', rows: q.circles, missing: q.missing.pos };
      text = MACHINE_TEXT[q.op];
      lines = q.circles.map((c) => `${c.a} ${SIGN[q.op]} ${c.b} = ${c.c}`);
      hint = 'הסתכלו על השורה השלמה. מה הריבוע עושה למספר שנכנס אליו? אותו דבר קורה גם בשורה השנייה.';
      const wrongOps = Object.entries(CANDIDATES).filter(([n]) => n !== q.op).flatMap(([, fn]) => circleSolutions(fn, target, q.missing.pos)).map((v) => [v, 'wrong-operation']);
      cands = [...rng.shuffle(wrongOps).slice(0, 2), [rng.pick([example.c, target.a, target.b]), 'copied-number']];
    } else if (fmt === 'fan') {
      q = buildFan(rng, difficulty);
      problem = checkFan(q);
      if (problem) { rejects++; continue; }
      const [f1, f2] = q.fans;
      answer = f2[q.missing];
      stem = { kind: 'fan', fans: q.fans, missing: q.missing };
      text = 'מהמספר שלמטה יוצאים שני חצים. חץ אחד תמיד כופל באותו מספר, והחץ השני תמיד כופל במספר אחר. אותם שני מספרים פועלים בשני הציורים.';
      lines = [`${f1.s} × ${q.m1} = ${f1.l}`, `${f1.s} × ${q.m2} = ${f1.r}`, `${f2.s} × ${q.m1} = ${f2.l}`, `${f2.s} × ${q.m2} = ${f2.r}`];
      hint = 'בציור השלם: פי כמה גדל המספר בכל חץ? בדקו שהחץ המקביל בציור השני עושה אותו דבר.';
      const other = q.missing === 'r' ? f2.l : f2.r;
      cands = [[f2.s + (f1[q.missing] - f1.s), 'added-instead'], [other + (f1.r - f1.l), 'wrong-operation'], [other, 'copied-number'], [f2.s * (q.missing === 'r' ? q.m1 : q.m2) + f2.s, 'off-by-one-group']];
    } else if (fmt === 'arrows') {
      q = buildArrows(rng, difficulty);
      problem = null;
      const v = q.v;
      answer = v[3];
      stem = { kind: 'arrows', v };
      text = q.k === 1 ? 'כל חץ מוסיף 1. חץ אחד מוסיף 1, שני חצים מוסיפים 2, שלושה חצים מוסיפים 3.' : `כל חץ מוסיף ${q.k}. חץ אחד מוסיף ${q.k}, שני חצים מוסיפים ${2 * q.k}, שלושה חצים מוסיפים ${3 * q.k}.`;
      lines = [`${v[0]} + ${q.k} = ${v[1]}`, `${v[1]} + ${2 * q.k} = ${v[2]}`, `${v[2]} + ${3 * q.k} = ${v[3]}`];
      hint = 'ספרו את החצים בכל ציור. בכמה גדל המספר כשיש חץ אחד? ובכמה כשיש שני חצים?';
      // The doubling reading (+k, +2k, +4k) is a rival a child could defend, so that value is never offered as an option.
      const banned = v[2] + 4 * q.k;
      cands = [[v[2] + 2 * q.k, 'repeated-last-step'], [v[2] + q.k, 'one-arrow-only'], [v[2] + 3 * q.k + 1, 'off-by-one'], [v[2] + 3 * q.k - 1, 'off-by-one'], [v[2] * 2, 'wrong-operation']].filter(([x]) => x !== banned);
      q.banned = banned;
    } else if (fmt === 'pyramid') {
      q = buildPyramid(rng, difficulty);
      problem = checkPyramid(q);
      if (problem) { rejects++; continue; }
      const v = q.v;
      answer = v[q.missing];
      stem = { kind: 'pyramid', v, missing: q.missing };
      text = PYRAMID_TEXT[q.op];
      lines = q.op === 'sum'
        ? [`${v.x} + ${v.y} = ${v.m1}`, `${v.y} + ${v.z} = ${v.m2}`, `${v.m1} + ${v.m2} = ${v.top}`]
        : [`${v.y} − ${v.x} = ${v.m1}`, `${v.z} − ${v.y} = ${v.m2}`, `${v.m2} − ${v.m1} = ${v.top}`];
      hint = 'הסתכלו על מספר בשורה האמצעית ועל שני המספרים שמתחתיו. איך מקבלים אותו מהם? אותו חוק עובד בכל הפירמידה.';
      const other = q.op === 'sum' ? Math.abs(v.m2 - v.m1) : v.m1 + v.m2;
      cands = q.missing === 'top' ? [[other, 'wrong-operation'], [v.m1 * v.m2, 'wrong-operation'], [v.m2, 'copied-number']] : [[v.y + v.m2 + v.m1, 'wrong-operation'], [v.y, 'copied-number'], [Math.abs(v.y - v.m2) || v.m1, 'wrong-operation']];
    } else {
      q = buildButterfly(rng, difficulty);
      problem = checkButterfly(q);
      if (problem) { rejects++; continue; }
      const f = q.flies[1];
      answer = f[q.missing.pos];
      stem = { kind: 'butterfly', flies: q.flies, missing: q.missing };
      text = q.op === 'add'
        ? 'בכל פרפר, שתי הכנפיים שבאותו צד, אחת ועוד השנייה, שוות למספר שעל הגוף.'
        : 'בכל פרפר, הכנף העליונה פחות הכנף התחתונה שבאותו צד שווה למספר שעל הגוף.';
      const sg = SIGN[q.op];
      lines = q.flies.flatMap((b) => [`${b.tl} ${sg} ${b.bl} = ${b.body}`, `${b.tr} ${sg} ${b.br} = ${b.body}`]);
      hint = 'הסתכלו על הפרפר השלם. אילו שתי כנפיים נותנות ביחד את המספר שעל הגוף? אותו חוק עובד גם בפרפר השני.';
      const side = q.missing.pos[1] === 'l' ? 'r' : 'l';
      const across = f[q.missing.pos[0] + side];
      const opposite = f[(q.missing.pos[0] === 't' ? 'b' : 't') + side];
      cands = [[opposite, 'copied-number'], [Math.abs(f.body - across), 'wrong-pair'], [answer + (rng.next() < 0.5 ? 10 : -10), 'borrow-slip']];
    }

    let distractors = numberDistractors(rng, answer, cands);
    if (q.banned) distractors = distractors.filter((d) => d.value !== q.banned);
    if (distractors.length < 3) { rejects++; continue; }
    const placed = placeOptions(rng, { value: answer, tag: null }, distractors);
    const values = placed.options.map((o) => o.value);
    if (new Set(values).size !== 4 || values.filter((v) => v === answer).length !== 1) { rejects++; continue; }

    const item = {
      id: `numshapes-${s}-${difficulty}`,
      category: 'numshapes', subtype: fmt, ruleFamily: q.op || (fmt === 'fan' ? 'two-multipliers' : 'add-per-arrow'), difficulty, variant: fmt,
      gen: { ...GEN, seed: s },
      prompt: 'איזה מספר צריך לבוא במקום סימן השאלה?',
      stem,
      options: placed.options.map((o) => ({ kind: 'number', value: o.value, tag: o.tag })),
      correctIndex: placed.correctIndex,
      hint,
      explanation: { text, lines },
      rejectsBeforeAccept: rejects,
    };
    if (debug) item._q = q;
    return item;
  }
  throw new Error('numshapes generator could not produce a sound item for seed ' + seed);
}

export const _internals = { checkRing, checkButterfly, checkCircles, checkPyramid, checkFan };
