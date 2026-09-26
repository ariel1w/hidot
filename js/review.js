// The parent's review sheet: every verbal item on one numbered page, with its options, the intended answer,
// the explanation, and a keep / fix / drop choice plus a note. "keep" is what lets an item reach the children.
// Decisions are shared by all profiles and saved in data/verbal-review.json, where the builder reads the fix notes.
import { VERBAL_BANK } from './content/verbal.js?v=muic26cd';
import { loadVerbalReview, saveVerbalReview } from './storage.js?v=muic26cd';

const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHOICES = [['keep', 'לאשר'], ['fix', 'לתקן'], ['drop', 'להוריד']];
// What the child is asked, exactly as the app words it.
const ASK = {
  relations: 'הילד רואה זוג מילים, וצריך לבחור מתוך ארבעה זוגות את הזוג שהקשר בין המילים שלו הוא אותו קשר, ובאותו סדר.',
  sentences: 'הילד רואה משפט שחסרות בו מילים, וצריך לבחור מתוך ארבע תשובות את המילים שמשלימות אותו הכי טוב.',
};
// Why each wrong answer is there: the mistake it is meant to tempt.
const WHY_WRONG = {
  'same-topic-wrong-relation': 'אותו נושא, אבל הקשר בין המילים שונה',
  'association-only': 'המילים רק קשורות זו לזו, בלי אותו קשר',
  'reversed-order': 'הקשר נכון, אבל הסדר הפוך',
  'degree-not-opposite': 'נראה דומה, אבל זה לא אותו סוג של קשר',
  'ignores-connector': 'לא מתאים להיגיון של המשפט',
  'half-fits': 'רק אחת מהמילים מתאימה',
  'unknown-word-avoided': 'מילה קלה ומפתה, במקום המילה הקשה והנכונה',
};

export async function renderReview(app) {
  // On the computer the decisions are saved to a file. On the online site there is no server, so they are kept in this
  // browser (saved on every change) and handed to the builder with the copy button, who then publishes the approved items.
  const LOCAL_KEY = 'gp.verbalReview';
  let data, online = false;
  try { data = await loadVerbalReview(); }
  catch { online = true; let saved = {}; try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { /* empty */ } data = { review: saved, config: {} }; }
  const review = data.review || {};
  const fill = (text) => esc(text).replace(/____/g, '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>');
  const solved = (it) => { // the sentence with the intended words in place, so it can be read as a whole
    if (it.category !== 'sentences') return '';
    const words = it.options[0][0].split(' / '); let k = 0;
    return `<p class="rv-solved">המשפט השלם: ${esc(it.sentence).replace(/____/g, () => `<b>${esc(words[k++] || '')}</b>`)}</p>`;
  };
  const items = VERBAL_BANK.map((it, n) => {
    const mine = review[it.id] || {};
    return `<div class="rv-item" data-id="${it.id}">
      <div class="rv-head"><b>${n + 1}.</b> <span dir="ltr">${it.id}</span> · ${it.category === 'relations' ? 'יחסי מילים' : 'השלמת משפטים'} · ${esc(it.subtype)} · רמה ${it.difficulty}${it.vocabulary ? ' · אוצר מילים: ' + esc(it.vocabulary.join(', ')) : ''}</div>
      <p class="rv-ask">${ASK[it.category]}</p>
      <p class="rv-stem">${it.category === 'relations' ? esc(it.pair) : fill(it.sentence)}</p>
      <ul class="rv-opts">${it.options.map(([text, tag], i) => `<li class="${i === 0 ? 'rv-right' : ''}">${i === 0 ? '✔ ' : '✘ '}${esc(text)} <small>${i === 0 ? 'זו התשובה הנכונה' : 'תשובה שגויה: ' + esc(WHY_WRONG[tag] || tag)}</small></li>`).join('')}</ul>
      ${solved(it)}
      <p class="rv-why"><b>ההסבר לילד:</b> ${esc(it.explain)}</p>
      <div class="rv-choice">${CHOICES.map(([v, label]) => `<label><input type="radio" name="d-${it.id}" value="${v}" ${mine.decision === v ? 'checked' : ''}> ${label}</label>`).join('')}
        <input class="rv-note" type="text" placeholder="הערה (מה לתקן?)" value="${esc(mine.note)}"></div>
    </div>`;
  }).join('');

  app.innerHTML = `<section class="parent review">
    <div class="p-head"><h1>דף אישור: ${VERBAL_BANK.length} השאלות המילוליות</h1><a href="#">חזרה</a></div>
    <div class="rv-guide">
      <p><b>מה זה הדף הזה?</b> אלה 27 שאלות מילוליות שכתבתי בשביל הילדים. אני לא דובר עברית מלידה, אז לפני שהן מגיעות לילד, מישהו שכן צריך לעבור עליהן. זה אתה.</p>
      <p><b>מה בודקים בכל שאלה? שלושה דברים:</b></p>
      <ol>
        <li>העברית טבעית, וילד בכיתה ג' יבין את המילים (מילה קשה אחת זה בסדר, זה חלק מהמבחן).</li>
        <li>התשובה שמסומנת ב-✔ באמת נכונה, ואף אחת מהתשובות שמסומנות ב-✘ לא יכולה להיחשב נכונה גם כן.</li>
        <li>ההסבר לילד נכון וברור.</li>
      </ol>
      <p>שלוש פעמים "כן": <b>לאשר</b>. משהו צורם: <b>לתקן</b>, ולכתוב בכמה מילים מה. השאלה לא שווה תיקון: <b>להוריד</b>. בספק? <b>לתקן</b>. (לילד התשובות מופיעות בסדר מעורבב, כאן הנכונה תמיד ראשונה.)</p>
    </div>
    <div class="rv-bar"><span id="rvCount"></span>
      ${online ? '' : `<label><input type="checkbox" id="rvDrafts" ${data.config.showDraftVerbal ? 'checked' : ''}> להציג לילדים גם שאלות שעוד לא אושרו (לכבות אחרי האישור)</label>`}
      ${online ? '<button class="primary" id="rvCopy">סיימתי: העתקת ההחלטות</button>' : '<button class="primary" id="rvSave">שמירה</button>'} <button id="rvPrint">הדפסה</button> <span id="rvSaved"></span></div>
    ${online ? '<p class="p-note">הבחירות נשמרות לבד בדפדפן הזה, אפשר לעצור ולחזור. בסוף לוחצים על "העתקת ההחלטות" ומדביקים את הטקסט ל-Claude, והוא מפרסם את השאלות שאושרו.</p><textarea id="rvText" hidden readonly style="width:100%;height:90px;direction:ltr"></textarea>' : ''}
    ${items}
  </section>`;

  const collect = () => {
    const out = {};
    app.querySelectorAll('.rv-item').forEach((el) => {
      const decision = el.querySelector('input[type=radio]:checked')?.value || null, note = el.querySelector('.rv-note').value.trim();
      if (decision || note) out[el.dataset.id] = { decision, note };
    });
    return out;
  };
  const count = () => {
    const r = collect(), n = (v) => Object.values(r).filter((x) => x.decision === v).length;
    app.querySelector('#rvCount').textContent = `אושרו ${n('keep')} · לתיקון ${n('fix')} · הורדו ${n('drop')} · נותרו ${VERBAL_BANK.length - n('keep') - n('fix') - n('drop')}`;
  };
  const autosave = () => { if (online) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(collect())); app.querySelector('#rvSaved').textContent = 'נשמר'; } catch { /* storage blocked */ } } };
  app.addEventListener('change', () => { count(); autosave(); }); app.addEventListener('input', autosave); count();
  app.querySelector('#rvPrint').addEventListener('click', () => window.print());
  if (online) {
    app.querySelector('#rvCopy').addEventListener('click', async () => {
      const text = 'VERBAL-REVIEW ' + JSON.stringify(collect());
      const box = app.querySelector('#rvText'); box.hidden = false; box.value = text; box.select();
      try { await navigator.clipboard.writeText(text); app.querySelector('#rvSaved').textContent = 'הועתק. עכשיו מדביקים ל-Claude.'; }
      catch { app.querySelector('#rvSaved').textContent = 'הטקסט מסומן למטה: Ctrl+C ואז להדביק ל-Claude.'; }
    });
  } else {
    app.querySelector('#rvSave').addEventListener('click', async () => {
      await saveVerbalReview(collect(), app.querySelector('#rvDrafts').checked);
      app.querySelector('#rvSaved').textContent = 'נשמר ' + new Date().toLocaleTimeString('he-IL');
    });
  }
}
