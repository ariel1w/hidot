import { renameUser, removeUser, listBackups, restoreBackup, makeBackupFile, readBackupFile, importIntoBrowser, importIntoCloud } from './storage.js?v=muic26cd';

// Parent view, MVP form: one dense table, mission history, save status. Adult analytics live only here.
const TRACKS = { wordproblems: 'בעיות מילוליות', figural: 'צורות', numshapes: 'מספרים בצורות', arithmetic: 'חשבון מהיר', relations: 'יחסי מילים', sentences: 'השלמת משפטים' };
const median = (arr) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
const secs = (ms) => (ms == null ? '-' : (ms / 1000).toFixed(1));
const when = (ts) => new Date(ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function renderParent(app, store, progress) {
  // Paper answers have no per-question timing or hint history, so they are reported separately and never mixed in.
  const attempts = store.records.filter((r) => r.kind === 'attempt' && r.source !== 'paper');
  const paperAttempts = store.records.filter((r) => r.kind === 'attempt' && r.source === 'paper');
  const groups = {};
  for (const a of attempts) {
    const key = a.category + '|' + a.ruleFamily;
    (groups[key] ||= []).push(a);
  }
  const rows = Object.entries(groups).sort().map(([key, list]) => {
    const [cat, fam] = key.split('|');
    const indep = list.filter((a) => !a.hinted), hinted = list.filter((a) => a.hinted), fresh = list.filter((a) => a.mode === 'fresh');
    const tags = {};
    list.filter((a) => a.possibleMisconception).forEach((a) => (tags[a.possibleMisconception] = (tags[a.possibleMisconception] || 0) + 1));
    const tagText = Object.entries(tags).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} ×${n}`).join(', ');
    return `<tr><td>${TRACKS[cat] || cat}</td><td dir="ltr">${fam}</td><td>${list.length}</td>
      <td>${pct(indep.filter((a) => a.correct).length, indep.length)} <small>(${indep.length})</small></td>
      <td>${hinted.length ? pct(hinted.filter((a) => a.correct).length, hinted.length) + ` <small>(${hinted.length})</small>` : '-'}</td>
      <td>${fresh.length ? pct(fresh.filter((a) => a.correct).length, fresh.length) + ` <small>(${fresh.length})</small>` : '-'}</td>
      <td>${secs(median(indep.filter((a) => a.correct).map((a) => a.responseTimeMs)))}</td><td dir="ltr" class="tags">${tagText}</td></tr>`;
  }).join('');

  const ends = Object.fromEntries(store.records.filter((r) => r.kind === 'mission-end').map((r) => [r.missionId, r]));
  const missions = store.records.filter((r) => r.kind === 'mission-start').slice(-15).reverse().map((s) => {
    const e = ends[s.missionId];
    const answered = attempts.filter((a) => a.missionId === s.missionId).length;
    const status = !e ? 'נקטעה באמצע' : e.status === 'completed' ? 'הושלמה' : 'סיים מוקדם';
    return `<tr><td>${when(s.ts)}</td><td>${status}</td><td>${answered} / ${s.planned}</td><td>${e ? pct(e.correct, e.answered) : '-'}</td>
      <td>${e ? Math.round(e.durationMs / 60000 * 10) / 10 + ' דק׳' : '-'}</td><td>${e ? e.pauses : '-'}</td><td>${s.lesson || ''}</td></tr>`;
  }).join('');

  const paperRows = store.records.filter((r) => r.kind === 'paper-result').slice(-10).reverse().map((r) => {
    const mine = paperAttempts.filter((a) => a.missionId === r.setId);
    const byTrack = {};
    mine.forEach((a) => { (byTrack[a.category] ||= [0, 0])[1]++; if (a.correct) byTrack[a.category][0]++; });
    return `<tr><td dir="ltr">${r.setId}</td><td>${when(r.ts)}</td><td>${mine.filter((a) => a.correct).length} / ${mine.length}</td><td>${mine.filter((a) => a.blank).length}</td>
      <td>${r.totalMinutes ? r.totalMinutes + ' דק׳' : 'לא נמדד'}</td><td>${{ unknown: 'לא ידוע', none: 'לבד', some: 'עם עזרה' }[r.assistance]}</td>
      <td>${Object.entries(byTrack).map(([t, [ok, n]]) => `${TRACKS[t] || t} ${ok}/${n}`).join(' · ')}</td><td><a href="#paper/${r.setId}">פירוט</a></td></tr>`;
  }).join('');
  const saved = store.lastSaved ? when(store.lastSaved) : 'עדיין לא נשמר דבר';
  app.innerHTML = `<section class="parent">
    <div class="p-head"><h1>תצוגת הורים: ${store.user.name || 'שחקן'}</h1><a href="#">חזרה</a></div>
    ${true ? `<p class="p-note profile-tools">פרופיל: <input id="rename" value="${String(store.user.name).replace(/"/g, '&quot;')}" maxlength="30"> <button id="doRename">שינוי שם</button> · <a href="#users">מעבר לשחקן אחר או הוספת שחקן</a>${store.backend === 'cloud' ? ' · <a href="#board"><b>לוח ההתקדמות של כולם</b></a>' : ''} · <button id="askRemove">הסרת הפרופיל</button><span id="confirmRemove" hidden> בטוח? הנתונים לא נמחקים, הם רק יוצאים מהרשימה. <button id="doRemove">כן, להסיר</button></span></p>` : ''}
    <p class="p-status ${store.saveFailed ? 'bad' : ''}">שמירה אחרונה: ${saved} · מקום השמירה: ${{ disk: 'קובץ במחשב (data/log.jsonl), עם גיבוי יומי', cloud: 'באינטרנט, לפי השם. אותו שם ממשיך מכל מכשיר' }[store.backend] || 'בדפדפן הזה, במכשיר הזה בלבד. כדאי להוריד קובץ גיבוי מדי פעם'}${store.saveFailed ? ` · <b>${store.unsent.length} רשומות עדיין לא נשמרו</b> (נשמרות זמנית בדפדפן ונשלחות שוב אוטומטית). שגיאה אחרונה: ${store.lastError || ''}` : ' · כל הרשומות נשמרו'}</p>
    <p class="p-note">רמות נוכחיות (זמניות): צורות ${progress.levels.figural}, מספרים בצורות ${progress.levels.numshapes}, חשבון ${progress.levels.arithmetic}, בעיות מילוליות ${progress.levels.wordproblems || 1}. משימות: ${progress.missionsDone}. כוכבים: ${progress.stars}.
    ${store.config.showDraftVerbal ? ' <b>שים לב: שאלות מילוליות בטיוטה מוצגות כרגע, לצורך בדיקה שלך.</b>' : ''}</p>
    <p class="p-note"><a href="#paper"><b>דפי תרגול מודפסים: הדפסה והזנת תשובות</b></a> · <a href="#review"><b>דף אישור לשאלות המילוליות (כל השאלות בעמוד אחד)</b></a></p>
    <h2>תרגול באפליקציה, לפי מסלול וחוק</h2>
    <p class="p-note">עם ילד אחד ומעט נתונים, מסתכלים על מגמות לאורך שבועות, לא על מפגש בודד. טעות שנבחרה מרמזת על טעות חשיבה אפשרית, לא מאבחנת אותה.</p>
    <table><thead><tr><th>מסלול</th><th>חוק</th><th>ניסיונות</th><th>דיוק עצמאי</th><th>דיוק עם רמז</th><th>שאלות טריות</th><th>חציון זמן (שנ׳)</th><th>טעויות אפשריות</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8">אין עדיין נתונים.</td></tr>'}</tbody></table>
    <h2>דפים מודפסים</h2>
    <p class="p-note">בדפים אין זמן לשאלה ואין מידע על רמזים. הנתונים האלה מסומנים כלא ידועים ולא מתערבבים בטבלה שלמעלה.</p>
    <table><thead><tr><th>סט</th><th>הוזן</th><th>נכון</th><th>לא סימן</th><th>זמן כולל</th><th>עזרה</th><th>לפי חלק</th><th></th></tr></thead>
    <tbody>${paperRows || '<tr><td colspan="8">עדיין לא הוזנו דפים.</td></tr>'}</tbody></table>
    <h2>גיבויים</h2>
    <p class="p-note backup-file"><button id="exportFile">הורדת קובץ גיבוי</button>${store.backend !== 'disk' ? ' · טעינת קובץ גיבוי: <input type="file" id="importFile" accept=".json,application/json"><span id="confirmImport" hidden> הנתונים הנוכחיים של הפרופיל יוחלפו (ונשמרים בצד). <button id="doImport">כן, לטעון</button></span>' : ''} <span id="backupMsg"></span></p>
    <div id="backups" class="p-note">בודק גיבויים...</div>
    <h2>משימות אחרונות</h2>
    <table><thead><tr><th>מתי</th><th>מצב</th><th>נענו</th><th>דיוק</th><th>משך</th><th>הפסקות</th><th>שיעור</th></tr></thead>
    <tbody>${missions || '<tr><td colspan="7">אין עדיין משימות.</td></tr>'}</tbody></table>
  </section>`;
  const $ = (sel) => app.querySelector(sel);
  if (store.backend === 'disk') {
    listBackups(store.user.id).then((list) => {
      const box = $('#backups'); if (!box) return;
      if (!list.length) { box.textContent = 'עדיין אין גיבוי. גיבוי נוצר פעם ביום, לפני השמירה הראשונה של אותו יום, ולא נדרס.'; return; }
      box.innerHTML = '<table><thead><tr><th>תאריך</th><th>רשומות</th><th>תשובות</th><th>בדיקת קריאה</th><th></th></tr></thead><tbody>' + list.slice(0, 10).map((b) =>
        `<tr><td dir="ltr">${b.day}</td><td>${b.records}</td><td>${b.answers}</td><td>${b.readable ? 'נקרא בהצלחה' : 'פגום: ' + b.unreadableLines + ' שורות'}</td>
        <td>${b.readable ? `<button class="ask-restore" data-day="${b.day}">שחזור ליום הזה</button><span hidden> בטוח? המצב הנוכחי נשמר בצד ולא נמחק. <button class="do-restore" data-day="${b.day}">כן, לשחזר</button></span>` : ''}</td></tr>`).join('') + '</tbody></table>';
      box.querySelectorAll('.ask-restore').forEach((btn) => btn.addEventListener('click', () => { btn.nextElementSibling.hidden = false; }));
      box.querySelectorAll('.do-restore').forEach((btn) => btn.addEventListener('click', async () => { await restoreBackup(store.user.id, btn.dataset.day); location.reload(); }));
    }).catch(() => { const box = $('#backups'); if (box) box.textContent = 'לא ניתן לקרוא את רשימת הגיבויים.'; });
  } else if ($('#backups')) $('#backups').textContent = store.backend === 'cloud' ? 'ההתקדמות שמורה באינטרנט. קובץ גיבוי הוא עותק נוסף ליתר ביטחון. טעינת קובץ מוסיפה את התשובות שבו ולא מוחקת אף תשובה.' : 'באתר המקוון אין גיבוי אוטומטי. קובץ הגיבוי שלמעלה הוא הגיבוי, והוא גם הדרך להעביר התקדמות למכשיר אחר.';
  $('#exportFile').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(makeBackupFile(store, progress))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'hidot-backup-' + (store.user.name || 'player') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(a.href);
    $('#backupMsg').textContent = 'הקובץ ירד.';
  });
  if ($('#importFile')) {
    let pending = null;
    $('#importFile').addEventListener('change', async (e) => {
      try { pending = readBackupFile(await e.target.files[0].text()); $('#confirmImport').hidden = false; $('#backupMsg').textContent = `בקובץ: ${pending.records.filter((r) => r.kind === 'attempt').length} תשובות, של ${pending.user?.name || 'שחקן'}.`; }
      catch (err) { pending = null; $('#backupMsg').textContent = 'לא ניתן לקרוא את הקובץ: ' + err.message; }
    });
    $('#doImport').addEventListener('click', async () => {
      if (!pending) return;
      try { if (store.backend === 'cloud') await importIntoCloud(store, pending); else importIntoBrowser(store.user.id, pending); location.reload(); } catch (err) { $('#backupMsg').textContent = err.message; }
    });
  }
  if ($('#doRename')) {
    $('#doRename').addEventListener('click', async () => { const name = $('#rename').value.trim(); if (!name) return; await renameUser(store.user.id, name); location.reload(); });
    $('#askRemove').addEventListener('click', () => { $('#confirmRemove').hidden = false; });
    $('#doRemove').addEventListener('click', async () => { await removeUser(store.user.id); try { sessionStorage.removeItem('gp.user'); } catch { /* ignore */ } location.hash = '#users'; location.reload(); });
  }
}
