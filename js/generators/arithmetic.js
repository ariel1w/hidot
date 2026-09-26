// Arithmetic fluency. See docs/QUESTION_TAXONOMY.md section F.
import { makeRng, placeOptions } from '../rng.js?v=muic26cd';

export const GEN = { id: 'arithmetic', version: 2 };

function build(rng, difficulty) {
  const subtype = rng.pick(difficulty === 1 ? ['times-table', 'add-2digit', 'sub-2digit'] : ['times-table', 'add-2digit', 'sub-2digit', 'missing-number', 'division-fact']);
  let a, b, answer, shown, cands, explain, method, hint = null;
  if (subtype === 'times-table') {
    a = difficulty === 1 ? rng.pick([2, 3, 4, 5, 10]) : difficulty === 2 ? rng.int(6, 9) : rng.int(11, 13);
    b = difficulty === 3 ? rng.int(3, 9) : rng.int(3, 9);
    answer = a * b; shown = `${a} × ${b} = ?`;
    cands = [[a * (b + 1), 'neighbour-fact'], [a * (b - 1), 'neighbour-fact'], [a + b, 'added-instead'], [(a + 1) * b, 'neighbour-fact']];
    if (a > 10) {
      method = 'כשאחד המספרים גדול מ-10, מפרקים אותו לעשרת ולאחדות, כופלים כל חלק לחוד ומחברים.';
      explain = [`10 × ${b} = ${10 * b}`, `${a - 10} × ${b} = ${(a - 10) * b}`, `${10 * b} + ${(a - 10) * b} = ${answer}`];
    } else if (b % 2 === 0) {
      method = 'אם לא זוכרים בעל פה, אפשר לחשב חצי ולהכפיל: זה אותו תרגיל פעמיים.';
      explain = [`${a} × ${b / 2} = ${a * b / 2}`, `${a * b / 2} + ${a * b / 2} = ${answer}`];
    } else {
      method = 'אם לא זוכרים בעל פה, נעזרים בתרגיל שכן שכבר יודעים, ומוסיפים עוד קבוצה אחת.';
      explain = [`${a} × ${b - 1} = ${a * (b - 1)}`, `${a * (b - 1)} + ${a} = ${answer}`];
    }
    hint = b > 2 ? `אפשר לפרק: ${a} × ${b} זה ${a} × ${b - 1} ועוד ${a} אחד.` : null;
  } else if (subtype === 'add-2digit') {
    a = rng.int(12, difficulty === 1 ? 40 : 68); b = rng.int(11, difficulty === 1 ? 35 : 29);
    if (difficulty === 1 && (a % 10) + (b % 10) > 9) b -= b % 10;
    answer = a + b; shown = `${a} + ${b} = ?`;
    cands = [[answer - 10, 'borrow-slip'], [answer + 10, 'borrow-slip'], [answer + 1, 'off-by-one'], [answer - 1, 'off-by-one']];
    method = 'מחברים בשני צעדים: קודם מוסיפים את העשרות, ואחר כך את האחדות.';
    explain = b % 10 === 0 ? [`${a} + ${b} = ${answer}`] : [`${a} + ${b - (b % 10)} = ${a + b - (b % 10)}`, `${a + b - (b % 10)} + ${b % 10} = ${answer}`];
  } else if (subtype === 'sub-2digit') {
    a = rng.int(40, 99); b = rng.int(12, 38);
    if (difficulty === 1 && a % 10 < b % 10) a += (b % 10) - (a % 10);
    answer = a - b; shown = `${a} − ${b} = ?`;
    cands = [[answer + 10, 'borrow-slip'], [answer - 10, 'borrow-slip'], [a + b, 'added-instead'], [answer + 1, 'off-by-one']];
    method = 'מחסרים בשני צעדים: קודם מורידים את העשרות, ואחר כך את האחדות.';
    explain = b % 10 === 0 ? [`${a} − ${b} = ${answer}`] : [`${a} − ${b - (b % 10)} = ${a - b + (b % 10)}`, `${a - b + (b % 10)} − ${b % 10} = ${answer}`];
  } else if (subtype === 'missing-number') {
    b = rng.int(14, 48); answer = rng.int(13, 49); a = answer + b;
    shown = `? + ${b} = ${a}`;
    cands = [[a + b, 'added-instead'], [answer + 10, 'borrow-slip'], [answer - 10, 'borrow-slip'], [answer - 1, 'off-by-one']];
    explain = [`${a} − ${b} = ${answer}`, `${answer} + ${b} = ${a}`];
    method = 'חיבור וחיסור הם פעולות הפוכות. כדי למצוא מספר חסר בתרגיל חיבור, מחסרים מהתוצאה את המספר שכן יודעים, ואז בודקים.';
    hint = 'חשבו הפוך: אם מחברים ומקבלים את התוצאה, אפשר לחסר כדי למצוא את המספר החסר.';
  } else {
    b = rng.int(3, 9); answer = rng.int(3, 9); a = answer * b;
    shown = `${a} ÷ ${b} = ?`;
    cands = [[answer + 1, 'neighbour-fact'], [answer - 1, 'neighbour-fact'], [a - b, 'added-instead'], [answer + 2, 'neighbour-fact']];
    explain = [`${answer} × ${b} = ${a}`, `${a} ÷ ${b} = ${answer}`];
    method = 'חילוק הוא כפל הפוך. שואלים: איזה מספר כפול המחלק נותן את המספר הגדול?';
    hint = `חשבו על לוח הכפל: כמה פעמים ${b} נכנס ב-${a}?`;
  }
  return { subtype, answer, shown, cands, explain, method, hint };
}

export function generateArithmetic(seed, { difficulty = 1 } = {}) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const rng = makeRng(s);
    const q = build(rng, difficulty);
    const found = [];
    for (const [v, tag] of rng.shuffle(q.cands)) {
      if (Number.isInteger(v) && v >= 0 && v !== q.answer && !found.some((f) => f.value === v)) found.push({ value: v, tag });
    }
    if (found.length < 3) continue;
    const placed = placeOptions(rng, { value: q.answer, tag: null }, found.slice(0, 3));
    return {
      id: `arithmetic-${s}-${difficulty}`,
      category: 'arithmetic', subtype: q.subtype, ruleFamily: q.subtype, difficulty, variant: 'plain',
      gen: { ...GEN, seed: s },
      prompt: 'כמה זה?',
      stem: { kind: 'equation', text: q.shown },
      options: placed.options.map((o) => ({ kind: 'number', value: o.value, tag: o.tag })),
      correctIndex: placed.correctIndex,
      hint: q.hint,
      explanation: { text: q.method, lines: [].concat(q.explain) },
      rejectsBeforeAccept: attempt,
    };
  }
  throw new Error('arithmetic generator failed for seed ' + seed);
}
