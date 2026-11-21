// Local storage on the phone (IndexedDB). All app data = one JSON document saved after every
// change ("db"); user videos are separate blobs. Nothing leaves the phone unless exported.
const DB_NAME = 'sokhibjon-gym';
let _idb = null;

function open() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 3);
    rq.onupgradeneeded = () => {
      const d = rq.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('videos')) {
        const s = d.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
        s.createIndex('exKey', 'exKey');
      }
      if (!d.objectStoreNames.contains('music')) d.createObjectStore('music', { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
    };
    rq.onsuccess = () => { _idb = rq.result; res(_idb); };
    rq.onerror = () => rej(rq.error);
  });
}
function tx(store, mode, fn) {
  return open().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(r => { out = r; });
    t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const SCHEMA = 1;
export function emptyDb() {
  return {
    schema: SCHEMA, createdAt: new Date().toISOString(),
    profile: { name: '', age: 26, height: 175, weight: 80, experience: 'beginner', goal: 'recomp',
               equipment: 'gym', sessionMin: 75, trainDays: [0, 2, 4], warmupMin: 7,
               sound: true, vibrate: true, keepAwake: true, onboarded: false,
               remindOn: true, remindTime: '08:00', weeklyOn: true, prehabOn: true, morningOn: true, morningTime: '07:00' },
    nextSession: 1, swaps: {}, activeSid: null, seq: 1,
    sessions: [], sets: [], readiness: {}, pain: [], formfb: [], body: [], measures: [], steps: {}, morning: {}, lastBackup: null,
    music: { order: [], shuffle: false, volume: 0.8, duck: true },
  };
}

let cache = null;
export async function load() {
  if (cache) return cache;
  const v = await tx('kv', 'readonly', s => s.get('db'));
  cache = v ? migrate(v) : emptyDb();
  return cache;
}
export function migrate(d) {
  const base = emptyDb();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  for (const k of Object.keys(base.profile)) if (d.profile[k] === undefined) d.profile[k] = base.profile[k];
  d.schema = SCHEMA;
  return d;
}
let saving = Promise.resolve();
export function save() {
  const snapshot = JSON.parse(JSON.stringify(cache));
  saving = saving.then(() => tx('kv', 'readwrite', s => s.put(snapshot, 'db')));
  return saving;
}
export const db = () => cache;
export const nextId = () => cache.seq++;

export async function replaceAll(newDb) {
  cache = migrate(newDb);
  await save();
}

// ── videos ──
export async function addVideo(exKey, file, label) {
  const rec = { exKey, label, name: file.name || 'video', type: file.type || 'video/mp4', size: file.size,
                date: new Date().toISOString(), blob: file };
  return tx('videos', 'readwrite', s => s.add(rec));
}
export async function listVideos(exKey) {
  const d = await open();
  const t = d.transaction('videos', 'readonly');
  const all = await req(t.objectStore('videos').index('exKey').getAll(exKey));
  return all.sort((a, b) => b.date.localeCompare(a.date));
}
export async function countVideos() {
  const d = await open();
  const t = d.transaction('videos', 'readonly');
  const all = await req(t.objectStore('videos').getAll());
  const by = {};
  let bytes = 0;
  for (const v of all) { by[v.exKey] = (by[v.exKey] || 0) + 1; bytes += v.size || 0; }
  return { by, bytes, total: all.length };
}
export async function deleteVideo(id) { return tx('videos', 'readwrite', s => s.delete(id)); }
export async function relabelVideo(id, label) {
  const d = await open();
  const t = d.transaction('videos', 'readwrite');
  const s = t.objectStore('videos');
  const v = await req(s.get(id));
  if (v) { v.label = label; s.put(v); }
  return new Promise(res => { t.oncomplete = res; });
}

// ── offline music (user's own audio files) ──
export async function addTrack(file) {
  const rec = { name: (file.name || 'Musiqa').replace(/\.[^.]+$/, ''), type: file.type || 'audio/mpeg', size: file.size,
                date: new Date().toISOString(), blob: file };
  return tx('music', 'readwrite', s => s.add(rec));
}
export async function listTracks(withBlobs = false) {
  const d = await open();
  const all = await req(d.transaction('music', 'readonly').objectStore('music').getAll());
  return withBlobs ? all : all.map(({ blob, ...rest }) => rest);
}
export async function getTrack(id) {
  const d = await open();
  return req(d.transaction('music', 'readonly').objectStore('music').get(id));
}
export async function deleteTrack(id) { return tx('music', 'readwrite', s => s.delete(id)); }

// ── private progress photos (never leave the app) ──
export async function addPhoto(file, pose) {
  return tx('photos', 'readwrite', s => s.add({ pose, date: new Date().toISOString(), type: file.type, size: file.size, blob: file }));
}
export async function listPhotos() {
  const d = await open();
  return (await req(d.transaction('photos', 'readonly').objectStore('photos').getAll())).sort((a, b) => a.date.localeCompare(b.date));
}
export async function deletePhoto(id) { return tx('photos', 'readwrite', s => s.delete(id)); }

export async function persist() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
}
