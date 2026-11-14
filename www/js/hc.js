// ⌚ Health Connect: steps, sleep, resting heart rate (and weight) from the Huawei watch.
// Huawei Health does not write to Health Connect itself — the «Health Sync» app copies the data.
// Read-only: the app never writes to Health Connect. All data stays on the phone.
import * as S from './store.js';
import * as D from './data.js';

const P = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Health) || null;
export const READ = ['steps', 'distance', 'heartRate', 'restingHeartRate', 'sleep', 'weight'];
const iso = d => new Date(d).toISOString();
const dayStart = off => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off); return d; };
export const on = () => !!S.db().profile.hcOn;
export const native = () => !!P();

export async function status() {
  const H = P();
  if (!H) return { available: false, reason: 'web' };
  try { return await H.isAvailable(); } catch (e) { return { available: false, reason: e.message }; }
}

export async function connect() {
  const H = P();
  if (!H) return { ok: false, msg: 'Bu funksiya faqat telefondagi ilovada ishlaydi.' };
  const av = await status();
  if (!av.available) return { ok: false, msg: 'Health Connect topilmadi. Telefon sozlamalarida «Health Connect»ni yoqing yoki Play Market’dan o‘rnating.', install: true };
  try {
    const r = await H.requestAuthorization({ read: READ });
    const granted = (r.readAuthorized || []).filter(x => READ.includes(x));
    S.db().profile.hcOn = granted.length > 0;
    S.db().profile.hcGranted = granted;
    await S.save();
    return { ok: granted.length > 0, granted, msg: granted.length ? '' : 'Ruxsat berilmadi.' };
  } catch (e) { return { ok: false, msg: e.message || String(e) }; }
}

export async function disconnect() { S.db().profile.hcOn = false; await S.save(); }
export async function openSettings() { const H = P(); if (H) try { await H.openHealthConnectSettings(); } catch (e) { /* */ } }

// minutes asleep in one sleep record (stage-level when available)
function asleepMinutes(s) {
  if (s.stages && s.stages.length) return s.stages.filter(x => !['awake', 'inBed'].includes(x.stage)).reduce((a, x) => a + (x.durationMinutes || 0), 0);
  if (s.sleepState === 'awake' || s.sleepState === 'inBed') return 0;
  return s.unit === 'minute' ? s.value : (Date.parse(s.endDate) - Date.parse(s.startDate)) / 60000;
}

let busy = null;
export function sync(force = false) {
  if (!on() || !P()) return Promise.resolve(null);
  const db = S.db();
  if (!force && db.hcLast && Date.now() - Date.parse(db.hcLast) < 10 * 60000) return Promise.resolve(null);
  if (busy) return busy;
  busy = doSync().finally(() => { busy = null; });
  return busy;
}

async function doSync() {
  const H = P(), db = S.db(), got = {};
  db.stepsSrc ||= {}; db.sleep ||= {}; db.hr ||= {};
  const now = iso(Date.now());
  // steps per day, last 14 days
  try {
    const r = await H.queryAggregated({ dataType: 'steps', startDate: iso(dayStart(13)), endDate: now, bucket: 'day', aggregation: 'sum' });
    for (const s of r.samples || []) {
      const k = D.dateKey(new Date(s.startDate)), v = Math.round(s.value || 0);
      if (v > 0 && (db.stepsSrc[k] === 'hc' || !db.steps[k] || v > db.steps[k])) { db.steps[k] = v; db.stepsSrc[k] = 'hc'; }
    }
    got.steps = true;
  } catch (e) { got.stepsErr = e.message; }
  // sleep: nights ending in the last 4 days (key = the morning date)
  try {
    const r = await H.readSamples({ dataType: 'sleep', startDate: iso(dayStart(4)), endDate: now, limit: 60 });
    const per = {};
    for (const s of r.samples || []) { const k = D.dateKey(new Date(s.endDate)); per[k] = (per[k] || 0) + asleepMinutes(s); }
    for (const [k, m] of Object.entries(per)) if (m > 60) db.sleep[k] = Math.round(m / 6) / 10;   // hours, 0.1 h
    got.sleep = true;
  } catch (e) { got.sleepErr = e.message; }
  // resting heart rate (daily), fallback: daily minimum of heart rate
  try {
    const r = await H.readSamples({ dataType: 'restingHeartRate', startDate: iso(dayStart(14)), endDate: now, limit: 100 });
    for (const s of r.samples || []) { const k = D.dateKey(new Date(s.startDate)); db.hr[k] = { ...(db.hr[k] || {}), rest: Math.round(s.value) }; }
    if (!(r.samples || []).length) {
      const a = await H.queryAggregated({ dataType: 'heartRate', startDate: iso(dayStart(13)), endDate: now, bucket: 'day', aggregation: ['min', 'average', 'max'] });
      for (const s of a.samples || []) {
        const k = D.dateKey(new Date(s.startDate)), v = s.values || {};
        if (v.min) db.hr[k] = { ...(db.hr[k] || {}), rest: Math.round(v.min), avg: Math.round(v.average || 0), max: Math.round(v.max || 0) };
      }
    }
    got.hr = true;
  } catch (e) { got.hrErr = e.message; }
  // weight from a smart scale (only adds days that have no manual entry)
  try {
    const r = await H.readSamples({ dataType: 'weight', startDate: iso(dayStart(30)), endDate: now, limit: 30 });
    for (const s of r.samples || []) {
      const k = D.dateKey(new Date(s.startDate)), w = Math.round(s.value * 10) / 10;
      if (w > 35 && w < 250 && !db.body.some(b => b.date === k)) { db.body.push({ date: k, weight: w, src: 'hc' }); db.profile.weight = w; }
    }
  } catch (e) { /* weight permission is optional */ }
  db.hcLast = new Date().toISOString();
  await S.save();
  return got;
}

// helpers for the UI / readiness
export const sleepLast = () => (S.db().sleep || {})[D.dateKey()] ?? null;
export function restHr() {
  const hr = S.db().hr || {}, today = hr[D.dateKey()] && hr[D.dateKey()].rest;
  const base = [];
  for (let i = 1; i <= 14; i++) { const v = hr[D.dateKey(dayStart(i))]; if (v && v.rest) base.push(v.rest); }
  base.sort((a, b) => a - b);
  const median = base.length >= 4 ? base[Math.floor(base.length / 2)] : null;
  return { today: today || null, baseline: median, delta: today && median ? today - median : null };
}
export function series(kind, days = 14) {
  const db = S.db(), out = [], labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayStart(i), k = D.dateKey(d);
    out.push(kind === 'sleep' ? (db.sleep || {})[k] ?? null : kind === 'hr' ? ((db.hr || {})[k] || {}).rest ?? null : db.steps[k] || 0);
    labels.push(`${d.getDate()}`);
  }
  return { values: out, labels };
}
