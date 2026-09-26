// Word problems, modelled on part 3 of the official demonstration test (Ministry, יסודי תשפ"ה):
// equal groups, divide then multiply, proportion, number riddles, balance equations, multi-step stories.
// Every explanation teaches the modelling step first ("what is the story asking?") and then the calculation.
// See docs/SOURCE_MAP.md. All text is without nikud.
import { makeRng, placeOptions } from '../rng.js?v=muic26cd';

export const GEN = { id: 'wordproblems', version: 2 };

const T = {
  // ---------- difficulty 1: one step, the work is choosing the operation ----------
  groups(rng) {
    const ctx = rng.pick([
      ['בכיתה יש', 'שולחנות', 'ליד כל שולחן יושבים', 'ילדים', 'כמה ילדים יושבים בכיתה?', 'ילדים'],
      ['במדף יש', 'קופסאות', 'בכל קופסה יש', 'עפרונות', 'כמה עפרונות יש במדף?', 'עפרונות'],
      ['בחניון יש', 'שורות', 'בכל שורה חונות', 'מכוניות', 'כמה מכוניות חונות בחניון?', 'מכוניות'],
    ]);
    const a = rng.int(4, 9), b = rng.int(3, 9);
    return {
      subtype: 'equal-groups', text: `${ctx[0]} ${a} ${ctx[1]}. ${ctx[2]} ${b} ${ctx[3]}. ${ctx[4]}`, unit: ctx[5], answer: a * b,
      model: 'יש כמה קבוצות שוות, ושואלים כמה יש בסך הכול. כשיש קבוצות שוות, כופלים.', steps: [`${a} × ${b} = ${a * b}`],
      wrong: [[a + b, 'wrong-operation'], [a * b + b, 'off-by-one-group'], [a * b - a, 'off-by-one-group']], params: { a, b },
    };
  },
  share(rng) {
    const k = rng.int(3, 8), each = rng.int(4, 9), n = k * each;
    const ctx = rng.pick([['סבתא אפתה', 'עוגיות וחילקה אותן שווה בשווה בין', 'נכדים', 'כמה עוגיות קיבל כל נכד?', 'עוגיות'],
      ['המורה חילקה', 'מדבקות שווה בשווה בין', 'תלמידים', 'כמה מדבקות קיבל כל תלמיד?', 'מדבקות']]);
    return {
      subtype: 'sharing', text: `${ctx[0]} ${n} ${ctx[1]} ${k} ${ctx[2]}. ${ctx[3]}`, unit: ctx[4], answer: each,
      model: 'מחלקים כמות לקבוצות שוות ושואלים כמה יש בכל קבוצה. כשמחלקים שווה בשווה, עושים חילוק.', steps: [`${n} ÷ ${k} = ${each}`],
      wrong: [[n - k, 'wrong-operation'], [each + 1, 'off-by-one'], [k, 'copied-number']], params: { n, k },
    };
  },
  // ---------- difficulty 2: two steps, or a relation that must be understood first ----------
  divideThenMultiply(rng) { // official question 4
    const boxes = rng.int(3, 9), per = rng.int(4, 9), sold = rng.int(2, boxes - 1), n = boxes * per;
    const ctx = rng.pick([['מטריות', 'המוכר', 'אותן'], ['כדורים', 'המוכר', 'אותם'], ['מחברות', 'המוכר', 'אותן']]); // object pronoun agrees with the noun
    return {
      subtype: 'divide-then-multiply', unit: ctx[0], answer: per * sold,
      text: `בחנות יש ${n} ${ctx[0]}. ${ctx[1]} חילק ${ctx[2]} ל-${boxes} ארגזים, כך שבכל ארגז יש מספר שווה של ${ctx[0]}. השבוע נמכרו ${sold} ארגזים. כמה ${ctx[0]} נמכרו השבוע?`,
      model: 'יש כאן שני שלבים. קודם צריך לגלות כמה יש בארגז אחד, ורק אחר כך כמה יש בארגזים שנמכרו.',
      steps: [`${n} ÷ ${boxes} = ${per}  (בארגז אחד)`, `${per} × ${sold} = ${per * sold}  (בארגזים שנמכרו)`],
      wrong: [[per, 'first-step-only'], [sold * boxes, 'wrong-operation'], [n - per * sold, 'answered-other-question'], [per * sold + per, 'off-by-one-group']], params: { n, boxes, sold },
    };
  },
  proportion(rng) { // official question 5
    const base = rng.pick([6, 8, 12, 15, 20]), times = rng.int(3, 7), perKg = rng.pick([1, 2, 3]);
    return {
      subtype: 'proportion', unit: 'קילוגרם', answer: times * perKg,
      text: `בגן משחקים כל הקוביות זהות. המשקל של ${base} קוביות הוא ${perKg} קילוגרם. מה המשקל של ${base * times} קוביות?`,
      model: `צריך לבדוק כמה פעמים ${base} נכנס ב-${base * times}. כל פעם כזאת שוקלת ${perKg} קילוגרם.`,
      steps: [`${base * times} ÷ ${base} = ${times}  (כמה קבוצות של ${base})`, `${times} × ${perKg} = ${times * perKg}  (קילוגרם)`],
      wrong: [[times * perKg + 1, 'off-by-one'], [times + perKg, 'wrong-operation'], [times * perKg * 2, 'wrong-operation'], [times * perKg - 1, 'off-by-one']], params: { base, times, perKg },
    };
  },
  balance(rng) { // official question 6
    const b = rng.int(3, 9), c = rng.int(3, 9), a = rng.int(5, b * c - 2), x = b * c - a;
    return {
      subtype: 'balance-equation', unit: '', answer: x, equation: `${a} + ? = ${b} × ${c}`,
      text: 'לפניכם תרגיל שחסר בו מספר. מהו המספר החסר?',
      model: 'שני הצדדים של סימן השווה חייבים להיות שווים. קודם מחשבים את הצד השלם, ואז מוצאים מה חסר בצד השני.',
      steps: [`${b} × ${c} = ${b * c}`, `${b * c} − ${a} = ${x}`, `${a} + ${x} = ${b * c}`],
      wrong: [[b * c, 'first-step-only'], [b * c + a, 'wrong-operation'], [Math.abs(a - b), 'ignored-one-side'], [x + 1, 'off-by-one']], params: { a, b, c },
    };
  },
  change(rng) {
    const price = rng.int(4, 9), count = rng.int(3, 6), extra = rng.int(6, 15), paid = rng.pick([50, 100]);
    const total = price * count + extra;
    return {
      subtype: 'multi-step-money', unit: 'שקלים', answer: paid - total,
      text: `דניאל קנה ${count} מחברות. כל מחברת עולה ${price} שקלים. הוא קנה גם קלמר שעולה ${extra} שקלים, ושילם בשטר של ${paid} שקלים. כמה עודף קיבל?`,
      model: 'עודף הוא מה שנשאר מהשטר אחרי שמשלמים. לכן קודם מחשבים כמה עלתה כל הקנייה, ורק בסוף מחסרים מהשטר.',
      steps: [`${count} × ${price} = ${count * price}  (המחברות)`, `${count * price} + ${extra} = ${total}  (כל הקנייה)`, `${paid} − ${total} = ${paid - total}  (העודף)`],
      wrong: [[total, 'first-step-only'], [paid - count * price, 'skipped-a-step'], [paid - total + 10, 'borrow-slip'], [paid - price - extra, 'skipped-a-step']], params: { price, count, extra, paid },
    };
  },
  compare(rng) {
    const a = rng.int(6, 15), k = rng.int(2, 4);
    const [n1, n2] = rng.pick([['יעל', 'נועה'], ['איתי', 'עומר'], ['מאיה', 'תמר']]);
    return {
      subtype: 'comparison-times', unit: 'מדבקות', answer: a + a * k,
      text: `ל${n1} יש ${a} מדבקות. ל${n2} יש פי ${k} מדבקות מאשר ל${n1}. כמה מדבקות יש לשתיהן ביחד?`.replace('לשתיהן', n1 === 'איתי' ? 'לשניהם' : 'לשתיהן'),
      model: `"פי ${k}" פירושו כפול ${k}. קודם מוצאים כמה יש ל${n2}, ואחר כך מחברים את שתי הכמויות, כי שאלו כמה יש ביחד.`,
      steps: [`${a} × ${k} = ${a * k}  (ל${n2})`, `${a} + ${a * k} = ${a + a * k}  (ביחד)`],
      wrong: [[a * k, 'first-step-only'], [a + k, 'wrong-operation'], [a + a + k, 'wrong-operation'], [a * k + a * k, 'answered-other-question']], params: { a, k },
    };
  },
  // ---------- difficulty 3: two-digit multiplication and riddles, as in the official sample ----------
  hall(rng) { // official question 2: 17 rows, 187 chairs
    const rows = rng.int(12, 19), per = rng.pick([11, 12, 13, 14, 15]);
    return {
      subtype: 'two-digit-multiplication', unit: 'כיסאות', answer: rows * per,
      text: `באולם הרצאות יש ${rows} שורות. בכל שורה יש ${per} כיסאות. כמה כיסאות יש באולם?`,
      model: 'שורות שוות הן קבוצות שוות, ולכן כופלים. כשהמספרים גדולים, מפרקים אחד מהם לעשרות ואחדות.',
      steps: [`${rows} × 10 = ${rows * 10}`, `${rows} × ${per - 10} = ${rows * (per - 10)}`, `${rows * 10} + ${rows * (per - 10)} = ${rows * per}`],
      wrong: [[rows * 10 + (per - 10), 'partial-product'], [rows * per - 10, 'borrow-slip'], [rows + per, 'wrong-operation'], [rows * per + rows, 'off-by-one-group']], params: { rows, per },
    };
  },
  chain(rng) { // official Grade 3 example 2 (Karni 2022): each day is described relative to the days before it
    const d1 = rng.int(12, 25), more = rng.int(6, 15), extra = rng.int(8, 24), d2 = d1 + more, d3 = d1 + d2 + extra;
    const club = rng.pick(['לחוג הריצה', 'לחוג השחמט', 'לספרייה', 'לחוג הציור']);
    return {
      subtype: 'relational-chain', unit: 'ילדים', answer: d1 + d2 + d3,
      text: `ביום ראשון הגיעו ${club} ${d1} ילדים. ביום שלישי הגיעו ${more} ילדים יותר מאשר ביום ראשון. ביום חמישי הגיעו ${extra} ילדים יותר מאשר בימים ראשון ושלישי יחד. כמה ילדים הגיעו ${club} בשלושת הימים יחד?`,
      model: 'כל יום מתואר בעזרת הימים שלפניו, ולכן מחשבים לפי הסדר: יום ראשון ידוע, ממנו מוצאים את יום שלישי, ומשניהם את יום חמישי. רק בסוף מחברים את שלושת הימים.',
      steps: [`${d1} + ${more} = ${d2}  (יום שלישי)`, `${d1} + ${d2} = ${d1 + d2}  (ראשון ושלישי יחד)`, `${d1 + d2} + ${extra} = ${d3}  (יום חמישי)`, `${d1 + d2} + ${d3} = ${d1 + d2 + d3}  (שלושת הימים)`],
      wrong: [[d3, 'answered-other-question'], [d1 + d2 + d2 + extra, 'misread-relation'], [d1 + more + extra, 'added-the-numbers-in-the-text'], [d1 + d2 + d3 - 10, 'borrow-slip']], params: { d1, more, extra },
    };
  },
  rate(rng) { // official Grade 3 example 3 (Karni 2022): a daily rate, "פי", and weeks that must be turned into days
    const base = rng.pick([15, 20, 25, 30, 40]), k = rng.int(2, 5), weeks = rng.int(1, 3), days = weeks * 7;
    const [place, item] = rng.pick([['בקיוסק', 'קרטיבים'], ['במאפייה', 'לחמניות'], ['בדוכן', 'כוסות מיץ']]);
    const weeksText = weeks === 1 ? 'בשבוע הראשון' : weeks === 2 ? 'בשבועיים הראשונים' : 'בשלושת השבועות הראשונים';
    return {
      subtype: 'rate-with-units', unit: item, answer: base * k * days,
      text: `${place} מוכרים ${base} ${item} ביום. לעומת זאת, בחודשי הקיץ מוכרים בכל יום פי ${k} יותר ${item}. כמה ${item} מכרו ${place} ${weeksText} של חודש יולי?`,
      model: `יש כאן שלושה דברים לשים לב אליהם: יולי הוא חודש קיץ, "פי ${k}" פירושו כפול ${k}, ושבועות צריך להפוך לימים.`,
      steps: [`${base} × ${k} = ${base * k}  (ביום קיץ אחד)`, `${weeks} × 7 = ${days}  (ימים)`, `${base * k} × ${days} = ${base * k * days}  (בסך הכול)`],
      wrong: [[base * days, 'ignored-the-summer-rate'], [base * k * weeks, 'forgot-weeks-to-days'], [base * k * 30, 'whole-month'], [base * k * days * 2, 'wrong-operation']], params: { base, k, weeks },
    };
  },
  riddle(rng) { // official question 3
    const tens = rng.int(1, 7), diff = rng.int(1, 9 - tens), units = tens + diff, n = tens * 10 + units;
    const parity = n % 2 ? 'אי-זוגי' : 'זוגי';
    const fits = [];
    for (let x = 10; x <= 99; x++) { const t = Math.floor(x / 10), u = x % 10; if (x % 2 === n % 2 && t + u === tens + units && u - t === diff) fits.push(x); }
    if (fits.length !== 1) return null;
    const partial = [];
    for (let x = 10; x <= 99 && partial.length < 12; x++) {
      const t = Math.floor(x / 10), u = x % 10, ok = [x % 2 === n % 2, t + u === tens + units, u - t === diff].filter(Boolean).length;
      if (ok === 2 || (ok === 1 && t + u === tens + units)) partial.push([x, 'partial-conditions']);
    }
    return {
      subtype: 'number-riddle', unit: '', answer: n,
      text: `אני מספר ${parity}, ואני מורכב מ-2 ספרות. סכום הספרות שלי הוא ${tens + units}. ספרת האחדות שלי גדולה ב-${diff} מספרת העשרות שלי. מי אני?`,
      model: 'בחידה כזאת כל התנאים חייבים להתקיים ביחד. בודקים כל תשובה מול כל תנאי, ומוחקים תשובה ברגע שתנאי אחד לא מתקיים.',
      steps: [`${tens} + ${units} = ${tens + units}  (סכום הספרות)`, `${units} − ${tens} = ${diff}  (ההפרש בין הספרות)`, `${n} הוא מספר ${parity}`],
      wrong: [...rng.shuffle(partial).slice(0, 3), [units * 10 + tens, 'reversed-digits'], [tens + units, 'copied-number']], params: { n, tens, units, diff },
    };
  },
};

const BY_DIFFICULTY = { 1: ['groups', 'share'], 2: ['divideThenMultiply', 'proportion', 'balance', 'change', 'compare'], 3: ['hall', 'riddle', 'chain', 'rate', 'change'] };

export function generateWordProblem(seed, { difficulty = 2, template, debug = false } = {}) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const rng = makeRng(s);
    const name = template || rng.pick(BY_DIFFICULTY[difficulty] || BY_DIFFICULTY[2]);
    const q = T[name](rng);
    if (!q || !Number.isInteger(q.answer) || q.answer <= 0) continue;
    const found = [];
    for (const [v, tag] of q.wrong) if (Number.isInteger(v) && v > 0 && v !== q.answer && !found.some((f) => f.value === v)) found.push({ value: v, tag });
    if (found.length < 3) continue;
    const placed = placeOptions(rng, { value: q.answer, tag: null }, found.slice(0, 3));
    const item = {
      id: `wordproblems-${s}-${difficulty}`, category: 'wordproblems', subtype: q.subtype, ruleFamily: q.subtype, difficulty, variant: name,
      gen: { ...GEN, seed: s, template: name },
      prompt: q.text,
      stem: q.equation ? { kind: 'equation', text: q.equation } : { kind: 'none' },
      options: placed.options.map((o) => ({ kind: 'number', value: o.value, unit: q.unit, tag: o.tag })),
      correctIndex: placed.correctIndex,
      hint: 'לפני שמחשבים: מה בדיוק שואלים? ומה צריך לדעת קודם כדי לענות?',
      explanation: { text: q.model, lines: q.steps },
      rejectsBeforeAccept: attempt,
    };
    if (debug) item._params = { name, ...q.params, answer: q.answer };
    return item;
  }
  throw new Error('word problem generator failed for seed ' + seed);
}
