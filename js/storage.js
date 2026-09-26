// The only place that knows where data lives. Three modes, chosen automatically:
//   disk     the local launcher (start.bat) is running: one folder per profile on this computer, daily backups.
//   cloud    the public online site: progress is saved online BY NAME (Ariel's choice, 2026-09-26: no logins), so the
//            same name continues on any device. The database role the site uses can only call the functions in
//            db/setup.sql. A copy of the last loaded data stays in this browser, so a dropped connection loses nothing.
//   browser  the old online mode (everything in this browser only). Used only if the online save was never reachable
//            on this device. Its data is moved online automatically the first time the online save answers.
//
// Reliability: a record that could not be saved is never dropped. It waits in a queue that is itself kept in
// browser storage, and is retried on the next save, every 20 seconds, and the next time the profile opens.
import { CLOUD } from './cloud-config.js?v=muic26cd';

const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

async function call(url, payload) {
  const r = await fetch(url, payload === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('request failed with status ' + r.status);
  return r.json();
}
async function post(url, payload) {
  const out = await call(url, payload);
  if (!out.ok) throw new Error('save was not confirmed');
  return out;
}

// ---------- profiles ----------
let mode = 'disk';
const uKey = (id, part) => `gp.u.${id}.${part}`;
const cKey = (id, part) => `gp.c.${id}.${part}`; // this browser's copy of an online player

// One call to the online save. Every function returns a single value named v.
export async function cloud(fn, ...args) {
  const params = args.map((a) => (a !== null && typeof a === 'object' ? JSON.stringify(a) : a));
  const list = params.map((p, i) => `$${i + 1}` + (args[i] !== null && typeof args[i] === 'object' ? '::jsonb' : '')).join(', ');
  const r = await fetch(`https://${CLOUD.host}/sql`, {
    method: 'POST', headers: { 'Neon-Connection-String': CLOUD.conn }, // no Content-Type: the database's CORS rules do not list it
    body: JSON.stringify({ query: `select hidot.${fn}(${list}) as v`, params }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.message || 'online save answered ' + r.status);
  return out.rows[0].v;
}

// Old browser-only profiles on this device go online once, under their name. Adding is safe to repeat:
// records already online are skipped, and progress only replaces the online copy if it is further along.
async function moveLocalProfilesOnline() {
  for (const u of readLocal('gp.users', [])) {
    if (readLocal('gp.movedOnline.' + u.id, false)) continue;
    const records = readLocal(uKey(u.id, 'records'), []).concat(readLocal('gp.unsent.' + u.id, []).filter((j) => j.kind === 'log').map((j) => j.payload));
    const progress = readLocal(uKey(u.id, 'progress'), null);
    if (records.some((r) => r.kind === 'attempt') || progress) {
      const player = await cloud('join', u.name);
      for (let i = 0; i < records.length; i += 400) await cloud('log_many', player.id, records.slice(i, i + 400));
      if (progress) await cloud('save_progress', player.id, progress, true);
    }
    writeLocal('gp.movedOnline.' + u.id, new Date().toISOString());
  }
}

export async function listUsers() {
  try { const out = await call('/api/users'); mode = 'disk'; return { users: out.users, server: true }; }
  catch { /* no launcher: the online site */ }
  try {
    mode = 'cloud';
    await moveLocalProfilesOnline();
    const users = await cloud('players');
    writeLocal('gp.c.players', users);
    return { users, server: false, cloud: true };
  } catch {
    const cached = readLocal('gp.c.players', null);
    if (cached) return { users: cached, server: false, cloud: true, offline: true }; // played online before: keep going, saves wait
    mode = 'browser'; return { users: readLocal('gp.users', []), server: false };
  }
}
export async function createUser(name) {
  if (mode === 'disk') return (await post('/api/users', { name })).user;
  if (mode === 'cloud') return cloud('join', name); // an existing name simply opens that player's progress
  const user = { id: 'u' + Date.now().toString(36), name: String(name).trim().slice(0, 30), createdAt: new Date().toISOString() };
  if (!writeLocal('gp.users', [...readLocal('gp.users', []), user])) throw new Error('browser storage is blocked');
  return user;
}
export async function renameUser(id, name) {
  if (mode === 'disk') return (await post('/api/users/rename', { id, name })).users;
  if (mode === 'cloud') {
    const users = await cloud('rename', id, name);
    const renamed = users.find((u) => u.name === String(name).trim().replace(/\s+/g, ' ').slice(0, 30));
    try { if (renamed) sessionStorage.setItem('gp.user', renamed.id); } catch { /* private window */ }
    return users;
  }
  const users = readLocal('gp.users', []).map((u) => (u.id === id ? { ...u, name: String(name).trim().slice(0, 30) } : u));
  writeLocal('gp.users', users); return users;
}
export async function removeUser(id) {
  if (mode === 'disk') return (await post('/api/users/remove', { id })).users;
  if (mode === 'cloud') return cloud('hide', id); // hidden from the list, nothing deleted; typing the name brings it back
  const all = readLocal('gp.users', []);
  writeLocal('gp.removedUsers', [...readLocal('gp.removedUsers', []), ...all.filter((u) => u.id === id)]); // the data keys stay in place, nothing is deleted
  const users = all.filter((u) => u.id !== id);
  writeLocal('gp.users', users); return users;
}
export const loadVerbalReview = () => call('/api/verbal-review');
export const saveVerbalReview = (review, showDraftVerbal) => post('/api/verbal-review', { review, showDraftVerbal });
export const listBackups = async (id) => (await call('/api/backups?user=' + encodeURIComponent(id))).backups;
export const restoreBackup = async (id, day) => post('/api/restore?user=' + encodeURIComponent(id), { day });

// ---------- the save queue (exported separately so it can be tested without a browser) ----------
// One flush runs at a time. A job leaves the queue only after the backend acknowledged that exact job.
export function makeQueue(backend, initial, persist) {
  const q = {
    unsent: initial.slice(), lastError: null, lastSaved: null, onChange: null, running: null, again: false,
    push(job) {
      if (job.kind === 'progress') q.unsent = q.unsent.filter((j) => j.kind !== 'progress' || j === q.inFlight); // only the newest progress matters
      q.unsent.push(job); persist(q.unsent);
      return q.flush();
    },
    flush() {
      if (q.running) { q.again = true; return q.running; }
      q.running = (async () => {
        do {
          q.again = false;
          while (q.unsent.length) {
            const job = q.unsent[0];
            q.inFlight = job;
            try {
              const out = job.kind === 'progress' ? await backend.saveProgress(job.payload) : await backend.log(job.payload);
              q.lastSaved = out.lastSaved; q.lastError = null;
              q.unsent = q.unsent.filter((j) => j !== job); persist(q.unsent);
            } catch (e) { q.lastError = String(e.message || e); q.again = false; break; } finally { q.inFlight = null; }
          }
        } while (q.again);
      })().finally(() => { q.running = null; if (q.onChange) q.onChange(); });
      return q.running;
    },
  };
  return q;
}

// ---------- the backup file: works in both modes, and is how progress moves between devices online ----------
const BACKUP_MARK = 'gifted-prep-backup';
export function makeBackupFile(store, progress) {
  return { app: BACKUP_MARK, version: 1, exportedAt: new Date().toISOString(), user: { name: store.user.name }, records: store.records, progress };
}
export function readBackupFile(text) {
  const data = JSON.parse(text);
  if (data.app !== BACKUP_MARK || !Array.isArray(data.records)) throw new Error('זה לא קובץ גיבוי של האפליקציה');
  return data;
}
// Browser mode only: replaces this profile's data with the file's, after setting the current data aside.
export function importIntoBrowser(userId, data) {
  const stamp = Date.now().toString(36);
  writeLocal(uKey(userId, 'before-import-' + stamp), { records: readLocal(uKey(userId, 'records'), []), progress: readLocal(uKey(userId, 'progress'), null) });
  if (!writeLocal(uKey(userId, 'records'), data.records) || !writeLocal(uKey(userId, 'progress'), data.progress || null)) throw new Error('אין מספיק מקום בדפדפן');
  writeLocal(uKey(userId, 'lastSaved'), new Date().toISOString());
}

// Online: backup files add their answers to the player's online history (nothing online is removed)
// and replace the progress, after the current progress is kept as a record.
export async function importIntoCloud(store, data) {
  await cloud('log', store.user.id, { kind: 'progress-before-import', ts: Date.now(), progress: store.progress });
  for (let i = 0; i < data.records.length; i += 400) await cloud('log_many', store.user.id, data.records.slice(i, i + 400));
  if (data.progress) await cloud('save_progress', store.user.id, data.progress, false);
}
export const loadBoard = () => cloud('board');
export const loadBoardDetail = (id) => cloud('board_detail', id);

export async function openStore(user) {
  const queueKey = mode === 'cloud' ? 'gp.c.' + user.id + '.unsent' : 'gp.unsent.' + user.id, u = '?user=' + encodeURIComponent(user.id);
  const stamp = (id) => { const t = new Date().toISOString(); writeLocal(uKey(id, 'lastSaved'), t); return { lastSaved: t }; };
  const backend = mode === 'cloud' ? {
    name: 'cloud',
    async load() {
      try {
        const state = await cloud('load', user.id);
        if (!state) throw new Error('no such player online');
        writeLocal(cKey(user.id, 'copy'), state); // best effort: a very long history may not fit, the online copy is the real one
        return { ...state, config: { showDraftVerbal: false } };
      } catch (e) {
        const copy = readLocal(cKey(user.id, 'copy'), null);
        if (!copy) throw e;
        return { ...copy, config: { showDraftVerbal: false } };
      }
    },
    log: async (record) => ({ lastSaved: await cloud('log', user.id, record) }),
    saveProgress: async (progress) => ({ lastSaved: await cloud('save_progress', user.id, progress, false) }),
  } : mode === 'disk' ? {
    name: 'disk',
    load: () => call('/api/state' + u),
    log: (record) => post('/api/log' + u, record),
    saveProgress: (progress) => post('/api/progress' + u, progress),
  } : {
    name: 'browser',
    // Online there is no review sheet, so only items approved inside the bank itself are served. Drafts stay hidden.
    async load() { return { records: readLocal(uKey(user.id, 'records'), []), progress: readLocal(uKey(user.id, 'progress'), null), config: { showDraftVerbal: false }, lastSaved: readLocal(uKey(user.id, 'lastSaved'), null) }; },
    async log(record) {
      const all = readLocal(uKey(user.id, 'records'), []);
      if (!all.some((r) => r.kind === record.kind && r.ts === record.ts && r.questionId === record.questionId)) all.push(record);
      if (!writeLocal(uKey(user.id, 'records'), all)) throw new Error('browser storage is full or blocked');
      return stamp(user.id);
    },
    async saveProgress(progress) {
      if (!writeLocal(uKey(user.id, 'progress'), progress)) throw new Error('browser storage is full or blocked');
      return stamp(user.id);
    },
  };

  const state = await backend.load();
  const queue = makeQueue(backend, readLocal(queueKey, []), (jobs) => writeLocal(queueKey, jobs));
  queue.lastSaved = state.lastSaved;

  const store = {
    user, backend: backend.name, records: state.records || [], progress: state.progress, config: { showDraftVerbal: false, ...(state.config || {}) },
    get unsent() { return queue.unsent; },
    get lastError() { return queue.lastError; },
    get lastSaved() { return queue.lastSaved; },
    get saveFailed() { return queue.unsent.length > 0 && !queue.running; },
    log(record) { this.records.push(record); return queue.push({ kind: 'log', payload: record }); },
    saveProgress(progress) { this.progress = progress; return queue.push({ kind: 'progress', payload: progress }); },
    close() { clearInterval(timer); },
  };

  // Records left over from a session whose saves failed: show them in this session too, then try to save them.
  const known = new Set(store.records.map((r) => r.kind + ':' + r.ts));
  queue.unsent.filter((j) => j.kind === 'log' && !known.has(j.payload.kind + ':' + j.payload.ts)).forEach((j) => store.records.push(j.payload));
  if (queue.unsent.length) queue.flush();
  const timer = setInterval(() => { if (queue.unsent.length) queue.flush(); }, 20000);
  return store;
}
