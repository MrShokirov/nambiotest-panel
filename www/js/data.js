// Static content (program, exercises, texts) + helpers that read the user's data.
import * as S from './store.js';
import * as C from './coach.js';

export let EX = {}, PRG = {}, TX = {};
export async function loadStatic() {
  const get = p => fetch(p).then(r => r.json());
  let pre;
  [EX, PRG, TX, pre] = await Promise.all([get('data/exercises.json'), get('data/program.json'), get('data/texts.json'), get('data/prehab.json')]);
  PRE = Object.keys(pre);
  Object.assign(EX, pre);
}
export let PRE = [];

// Injury-prevention block (3–5 min after the warm-up): chosen by today's focus, rotated for variety,
// and a drill for any recently painful area goes first.
const UPPER_PAT = ['bench', 'db_bench', 'incline_db', 'machine_chest', 'pushups', 'pec_deck', 'ohp_db', 'ohp_bb', 'lateral', 'pulldown', 'assisted_pullup', 'cable_row', 'db_row', 'bb_row'];
const LOWER_PAT = ['squat', 'goblet', 'leg_press', 'split_squat', 'leg_ext', 'rdl', 'db_rdl', 'hip_thrust', 'seated_leg_curl', 'leg_curl', 'back_ext'];
const PAIN_DRILL = { shoulder: 'pre_er_side', lowback: 'pre_side_bridge', knee: 'pre_monster_walk', wrist: 'pre_wrist', elbow: 'pre_wrist', neck: 'pre_pull_apart', other: 'pre_hip_add' };
export function prehabBlock(plan, no) {
  const up = plan.filter(e => UPPER_PAT.includes(e.key)).length, lo = plan.filter(e => LOWER_PAT.includes(e.key)).length;
  const focus = up && lo ? 'full' : up ? 'upper' : 'lower';
  const rot = (arr) => arr[no % arr.length];
  let keys = focus === 'upper' ? ['pre_er_band', 'pre_pull_apart', rot(['pre_scaption', 'pre_scap_pull', 'pre_er_side', 'pre_ir_band', 'pre_rev_fly_er'])]
    : focus === 'lower' ? ['pre_glute_bridge', 'pre_monster_walk', rot(['pre_hip_add', 'pre_side_bridge', 'pre_ankle'])]
    : ['pre_er_band', 'pre_glute_bridge', rot(['pre_pull_apart', 'pre_monster_walk', 'pre_side_bridge', 'pre_scaption'])];
  if (plan.some(e => EX[e.key] && EX[e.key].barbell) && focus !== 'lower') keys.push('pre_wrist');
  for (const a of recentPainAreas(7)) { const k = PAIN_DRILL[a]; if (k && !keys.includes(k)) keys.unshift(k); }
  const missing = S.db().profile.missing || [];
  const n = Math.min(4, new Set(keys).size);
  keys = [...new Set(keys)].filter(k => C.equipOk(k, missing));
  const fill = focus === 'lower' ? ['pre_glute_bridge', 'pre_side_bridge', 'pre_ankle'] : ['pre_er_side', 'pre_scaption', 'pre_side_bridge', 'pre_glute_bridge', 'pre_wrist'];
  for (const k of fill) if (keys.length < Math.min(n, 3) && !keys.includes(k) && C.equipOk(k, missing)) keys.push(k);
  return keys.slice(0, 4);
}
export const TOTAL = () => PRG.sessions.length;

export const pad = n => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtW = w => String(Math.round((w || 0) * 100) / 100);
export const WD = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Yak'];
export const fmtDate = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${WD[(d.getDay() + 6) % 7]}`;

// Permanent swaps (user's choice) applied to a program plan.
export function effectivePlan(no, mode) {
  const s = PRG.sessions[no - 1];
  const swaps = S.db().swaps || {};
  const used = new Set();
  return s.plans[mode].map(e => {
    let key = swaps[e.key] || e.key;
    if (used.has(key)) key = e.key;
    used.add(key);
    const item = { ...e, key, orig: e.key };
    if (EX[key].unit !== EX[e.key].unit) {
      const lim = { sec: [20, 40], min: [10, 15] }[EX[key].unit] || [8, 12];
      item.lo = lim[0]; item.hi = lim[1];
    }
    return item;
  });
}
export const planForView = (no, mode = 'normal') => C.substituteEquipment(effectivePlan(no, mode), S.db().profile.missing || [], EX).plan;

export function finishedSessions() {
  return S.db().sessions.filter(s => s.finishedAt).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}
export function daysSinceLast() {
  const f = finishedSessions()[0];
  if (!f) return null;
  const a = new Date(f.finishedAt), b = new Date();
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}
export const trainedToday = () => daysSinceLast() === 0;
export const sessLabel = s => (s.bonus ? `➕ ${s.title}` : `#${s.no} ${s.title}`);

// ── week structure: 3 core sessions advance the program, extra sessions are "bonus" ──
const weekStartMs = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
export function weekInfo() {
  const ws = weekStartMs(), wk = finishedSessions().filter(s => Date.parse(s.finishedAt) >= ws);
  const core = wk.filter(s => !s.bonus).length;
  return { core, bonus: wk.length - core, total: wk.length, planned: S.db().profile.trainDays.length };
}
const coreOn = d => finishedSessions().some(s => !s.bonus && dateKey(new Date(s.finishedAt)) === dateKey(d));
export function todayRole() {
  const db = S.db(), p = db.profile;
  if (db.nextSession > TOTAL()) return { bonus: false };
  const wi = weekInfo();
  const ov = db.roleOverride;
  if (ov && ov.date === dateKey()) return { bonus: ov.role === 'bonus', forced: true, coreThisWeek: wi.core, why: ov.role === 'bonus' ? 'Bugun bonus mashg‘ulotni tanladingiz.' : 'Bugun asosiy mashg‘ulotni tanladingiz.' };
  const y = new Date(); y.setDate(y.getDate() - 1);
  const t = (new Date().getDay() + 6) % 7;
  if (coreOn(new Date())) return { bonus: true, coreThisWeek: wi.core, why: 'Bugun asosiy mashg‘ulot bajarilgan — qo‘shimchasi faqat bonus bo‘ladi.' };
  if (trainedToday()) {                                   // bonus already done today → show the next planned day
    const nx = schedule(1)[0];
    return { bonus: !!nx && nx.role === 'bonus', coreThisWeek: wi.core, why: nx && nx.role === 'bonus' ? 'Keyingi kun — bonus.' : '' };
  }
  const role = C.dayRole({ coreThisWeek: wi.core, yesterdayCore: coreOn(y), plannedLeft: p.trainDays.filter(x => x > t).length, four: p.trainDays.length >= 4 });
  const why = role === 'core' ? '' : wi.core >= 3 ? 'Bu hafta 3 ta asosiy mashg‘ulot bajarildi — bugungisi bonus.'
    : 'Kecha asosiy mashg‘ulot bo‘ldi — bugun yengilroq bonus kun, asosiylari haftaning qolgan kunlarida.';
  return { bonus: role === 'bonus', coreThisWeek: wi.core, why };
}
// Projected schedule [{ d, role, no? }]: core days carry the program session number.
export function schedule(count) {
  const db = S.db(), today = new Date(), t = trainedToday();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const left = TOTAL() - db.nextSession + 1;
  if (left <= 0) return [];
  const sch = C.projectSchedule(today, db.profile.trainDays, Math.min(count, left), { trainedOnStart: t, prevCore: t ? coreOn(today) : coreOn(y), coreThisWeek: weekInfo().core });
  let no = db.nextSession;
  return sch.map(x => (x.role === 'core' ? { ...x, no: no++ } : x));
}

// History for one exercise: [[{w,r,rating}], ...] newest first, finished non-deload sessions only.
export function historyFor(key, excludeSid = null, n = 8) {
  const db = S.db();
  const sids = finishedSessions().filter(s => !s.deload && s.id !== excludeSid).map(s => s.id);
  const out = [];
  for (const sid of sids) {
    const sets = db.sets.filter(x => x.sid === sid && x.key === key).map(x => ({ w: x.w, r: x.r, rating: x.rating }));
    if (sets.length) out.push(sets);
    if (out.length >= n) break;
  }
  return out;
}
export function recentPainAreas(days = 3) {
  const lim = Date.now() - days * 86400000;
  return new Set(S.db().pain.filter(p => (p.type === 'joint' || p.type === 'sharp') && Date.parse(p.at) >= lim).map(p => p.area));
}
export function lastFormBad(key, excludeSid) {
  const f = S.db().formfb.filter(x => x.key === key && x.sid !== excludeSid);
  const last = f[f.length - 1];
  return !!last && (last.value === 'bad' || last.value === 'pain');
}
export function readinessToday() { return S.db().readiness[dateKey()] || null; }
export function todayFactor() {
  const r = readinessToday();
  if (r && r.factor) return r.factor;
  return r && r.score ? (C.READINESS_FACTOR[r.score] || 1) : 1;
}
// Inputs for the daily readiness index from the user's data (sleep, steps, recent training, pain).
export function readinessInputs(ans) {
  const db = S.db();
  const prevDays = [1, 2].map(i => { const d = new Date(); d.setDate(d.getDate() - i); return db.readiness[dateKey(d)]; }).filter(Boolean);
  const sleeps = [ans.sleep, ...prevDays.map(r => r.sleep)].filter(x => x != null);
  const y = new Date(); y.setDate(y.getDate() - 1);
  const stepVals = [];
  for (let i = 2; i <= 15; i++) { const d = new Date(); d.setDate(d.getDate() - i); const v = db.steps[dateKey(d)]; if (v) stepVals.push(v); }
  stepVals.sort((a, b) => a - b);
  const fin = finishedSessions();
  const lastIds = new Set(fin.slice(0, 2).map(s => s.id));
  const rated = db.sets.filter(x => lastIds.has(x.sid) && x.rating);
  return { sleep: ans.sleep, sleepAvg3: sleeps.length >= 2 ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
           energy: ans.energy, soreness: ans.soreness, stepsYesterday: db.steps[dateKey(y)] ?? null,
           stepsBaseline: stepVals.length ? stepVals[Math.floor(stepVals.length / 2)] : null, daysSince: daysSinceLast(),
           lastRpe: fin[0] ? fin[0].rpe : null, hardShare: rated.length >= 4 ? rated.filter(x => x.rating === 'hard').length / rated.length : 0,
           painAreas: [...recentPainAreas(3)], hrDelta: ans.hrDelta ?? null };
}

// Full coaching suggestion for one plan item.
export function suggestion(item, factor = 1, excludeSid = null) {
  const ex = EX[item.key];
  const hist = historyFor(item.key, excludeSid);
  const brk = C.breakFactor(daysSinceLast());
  const f = Math.round(factor * brk.factor * 100) / 100;
  const fi = Math.round(f * (item.factor || 1) * 100) / 100;
  let sg = C.suggest(ex, item, hist, fi);
  sg = C.applyPlateau(sg, ex, hist);
  const pain = ex.areas.some(a => recentPainAreas().has(a));
  sg = C.guard(sg, ex, hist, fi, { pain, formBad: lastFormBad(item.key, excludeSid) });
  if (brk.reason && sg.weight != null) sg = { ...sg, reason: brk.reason + ' ' + sg.reason };
  if (sg.weight == null && ex.unit === 'reps' && !hist.length && ex.startWeight) sg = { ...sg, draftW: ex.startWeight };
  return { ...sg, pain };
}

export function fatigueStatus() {
  const fs = finishedSessions().slice(0, 3);
  const sids = new Set(fs.map(s => s.id));
  const sets = S.db().sets.filter(x => sids.has(x.sid));
  const rs = Object.keys(S.db().readiness).sort().reverse().map(k => S.db().readiness[k].score);
  return C.fatigue(fs, sets, rs);
}

export const unitLabel = u => ({ reps: 'takror', bw: 'takror', sec: 'soniya', min: 'daqiqa' })[u];
export function scheme(item) {
  const ex = EX[item.key];
  const rng = item.lo === item.hi ? `${item.lo}` : `${item.lo}–${item.hi}`;
  return `${item.sets} × ${rng} ${unitLabel(ex.unit)}` + (item.note ? ` (${item.note})` : '');
}
export function setLabel(ex, w, r) {
  if (ex.unit === 'sec') return `${r} s`;
  if (ex.unit === 'min') return `${r} daq`;
  if (ex.unit === 'bw') return w ? `+${fmtW(w)} kg × ${r}` : `${r} takror`;
  if (!w) return `o‘z vazni × ${r}`;
  return `${fmtW(w)} kg × ${r}`;
}
export function stepGoal(week) { return PRG.stepGoals[String(Math.min(52, week))] || 10000; }

// Inputs for compensation (last 7 days of training vs. the program's weekly target).
export function compensationInputs(mode = 'normal') {
  const db = S.db();
  const no = Math.min(db.nextSession, TOTAL());
  const week = PRG.sessions[no - 1].week;
  const weekTarget = {};
  PRG.sessions.filter(s => s.week === week).forEach(s => s.plans.normal.forEach(e => { const g = C.muscleOf(e.key); if (g) weekTarget[g] = (weekTarget[g] || 0) + e.sets; }));
  const since = Date.now() - 7 * 86400000;
  const fin = finishedSessions();
  const recent = fin.filter(s => Date.parse(s.finishedAt) >= since);
  const ids = new Set(recent.map(s => s.id));
  const weekSets = {};
  db.sets.filter(x => ids.has(x.sid)).forEach(x => { const g = C.muscleOf(x.key); if (g) weekSets[g] = (weekSets[g] || 0) + 1; });
  // how many sessions should have happened in the last 7 days (only counting days since the user started)
  const start = Date.parse(db.profile.startedAt || db.createdAt || new Date().toISOString());
  let expected = 0;
  for (let i = 1; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (d.getTime() >= start && db.profile.trainDays.includes((d.getDay() + 6) % 7)) expected++; }
  expected = Math.min(3, expected);                                   // a missed 4th (bonus) day is never a debt
  const recentCore = recent.filter(s => !s.bonus).length;
  const expectedFrac = fin.length ? Math.min(1, (Math.max(expected, recentCore) + 1) / 3) : 0;   // +1 = today's session
  const last = fin.find(s => !s.bonus);
  const carry = last ? last.plan.map((p, i) => ({ p, n: db.sets.filter(x => x.sid === last.id && x.exIdx === i).length }))
    .filter(x => x.n === 0 && x.p.key !== 'treadmill' && !x.p.comp).map(x => x.p.key) : [];
  return { weekSets, weekTarget, expectedFrac, carry, budgetMin: db.profile.sessionMin || 75, daysSince: daysSinceLast(), mode,
           avoid: [...recentPainAreas(3)], missed: Math.max(0, expected - recentCore) };
}

// Today's plan = program plan → permanent swaps → readiness adaptation → compensation.
// On a bonus day: bonus builder (lagging groups, shoulders, arms, core, zone-2 cardio) instead.
export function todaysPlan(mode, adapt = true, role = todayRole()) {
  if (role.bonus) return bonusToday(mode, adapt, role);
  const no = Math.min(S.db().nextSession, TOTAL());
  let plan = effectivePlan(no, mode), changes = [];
  const eq = C.substituteEquipment(plan, S.db().profile.missing || [], EX);
  plan = eq.plan; changes = changes.concat(eq.changes);
  const r = readinessToday();
  const ri = r && r.inputs ? C.readinessIndex(r.inputs) : null;
  if (adapt && ri) { const a = C.adaptPlan(plan, ri, EX); plan = a.plan; changes = changes.concat(a.changes); }
  if (adapt && !(ri && ri.level === 'rest') && !(ri && ri.level === 'red')) {
    const ci = compensationInputs(mode);
    const comp = C.compensate(plan, ci, EX);
    plan = comp.plan; changes = changes.concat(comp.changes);
  }
  const tm = S.db().todayMin;
  if (tm && tm.date === dateKey() && tm.min) {
    const f = C.fitToTime(plan, tm.min, EX);
    plan = f.plan; changes = changes.concat(f.changes);
  }
  return { plan, changes, ri, bonus: false };
}
export function bonusToday(mode, adapt = true, role = {}) {
  const db = S.db(), no = Math.min(db.nextSession, TOTAL()), s = PRG.sessions[no - 1];
  const ci = compensationInputs(mode);
  const y = new Date(); y.setDate(y.getDate() - 1);
  const recentIds = new Set(finishedSessions().filter(f => [dateKey(), dateKey(y)].includes(dateKey(new Date(f.finishedAt)))).map(f => f.id));
  const yesterday = db.sets.filter(x => recentIds.has(x.sid)).map(x => x.key);
  const b = C.bonusPlan({ weekSets: ci.weekSets, weekTarget: ci.weekTarget, yesterday, avoid: ci.avoid, deload: s.deload || s.test, mode, missing: db.profile.missing || [] }, EX);
  let plan = b.plan, changes = (role.why ? [role.why] : []).concat(b.changes);
  const eq = C.substituteEquipment(plan, db.profile.missing || [], EX);
  plan = eq.plan; changes = changes.concat(eq.changes);
  const r = readinessToday();
  const ri = r && r.inputs ? C.readinessIndex(r.inputs) : null;
  if (adapt && ri) { const a = C.adaptPlan(plan, ri, EX); plan = a.plan; changes = changes.concat(a.changes); }
  // time budget: easy cardio is part of the bonus — it is shortened (min 10 min), not dropped
  const tm = db.todayMin;
  const min = tm && tm.date === dateKey() && tm.min ? tm.min : mode === 'short' ? 40 : Math.min(60, db.profile.sessionMin || 60);
  const cardio = plan.find(e => e.key === 'treadmill');
  let rest = plan.filter(e => e !== cardio);
  if (cardio) {
    const cm = Math.min(cardio.hi, min >= 50 ? 20 : min >= 40 ? 15 : 10);
    if (cm < cardio.hi) changes.push(`Kardio ${cm} daqiqaga qisqartirildi (vaqt)`);
    const f = C.fitToTime(rest, min - cm, EX);
    rest = f.plan; changes = changes.concat(f.changes);
    plan = [...rest, { ...cardio, lo: cm, hi: cm }];
  } else { const f = C.fitToTime(rest, min, EX); plan = f.plan; changes = changes.concat(f.changes); }
  return { plan, changes, ri, bonus: true, title: `Bonus — ${b.focus}`, minutes: C.estimateMinutes(plan, EX) };
}
export const todayMinutes = () => { const tm = S.db().todayMin; return tm && tm.date === dateKey() ? tm.min : null; };
