// Guided workout — pure state machine (no DOM, no storage). Ported from the Telegram bot.
// Every change bumps st.v; UI actions carry the version they were drawn with, so a double tap
// can never log a set twice. Timers keep an absolute end time (ms) → survive app restarts.
//
// Stages: warmup → exercise → rest → … → feedback (after the last set of an exercise) → finish → done

export function newState(plan, warmupMin = 7, prehab = []) {
  return { v: 1, stage: 'warmup', ex: plan.length ? 0 : null, w: null, r: null, timer: null,
           paused: false, skipped: [], fb: {}, warmMin: warmupMin, lastRating: null, note: '',
           prehab, preChecked: [], prehabDone: !prehab.length };
}

const bump = st => { st.v += 1; return st; };
export const doneSets = (counts, i) => (i != null && i < counts.length ? counts[i] : 0);

// ── timers ──
export function timerLeft(st, now) {
  const t = st.timer;
  if (!t) return null;
  if (t.paused) return Math.max(0, Math.round(t.left));
  return Math.max(0, Math.round((t.ends - now) / 1000));
}
export function startTimer(st, kind, secs, now) {
  st.timer = { kind, ends: now + secs * 1000, total: secs, left: secs, paused: false };
  return bump(st);
}
export function pause(st, now) {
  const t = st.timer;
  if (t && !t.paused) { t.left = timerLeft(st, now); t.paused = true; }
  st.paused = true;
  return bump(st);
}
export function resume(st, now) {
  const t = st.timer;
  if (t && t.paused) { t.ends = now + t.left * 1000; t.paused = false; }
  st.paused = false;
  return bump(st);
}
export function addTime(st, secs) {
  const t = st.timer;
  if (t) { if (t.paused) t.left += secs; else t.ends += secs * 1000; t.total += secs; }
  return bump(st);
}
export const timerDue = (st, now) => !!st.timer && !st.timer.paused && now >= st.timer.ends;

// ── navigation ──
export function nextIndex(plan, counts, skipped, cur) {
  const n = plan.length, c = cur ?? 0;
  const order = [];
  for (let i = c + 1; i < n; i++) order.push(i);
  for (let i = 0; i <= c && i < n; i++) order.push(i);
  for (const i of order) if (i !== cur && !skipped.includes(i) && doneSets(counts, i) < plan[i].sets) return i;
  return null;
}
export function goto(st, i) {
  st.timer = null; st.paused = false; st.w = st.r = null; st.lastRating = null;
  if (i == null) st.stage = 'finish';
  else { st.stage = 'exercise'; st.ex = i; st.skipped = st.skipped.filter(x => x !== i); }
  return bump(st);
}
export function warmupStart(st, minutes, now) {
  st.stage = 'warmup'; st.warmMin = minutes;
  return startTimer(st, 'warmup', minutes * 60, now);
}
export function warmupDone(st, plan, counts) {
  if (st.prehab && st.prehab.length && !st.prehabDone) {
    st.timer = null; st.paused = false; st.stage = 'prehab';
    return bump(st);
  }
  const cur = st.ex;
  const i = cur != null && doneSets(counts, cur) < plan[cur].sets ? cur : nextIndex(plan, counts, st.skipped, cur ?? -1);
  return goto(st, i);
}
export function preCheck(st, key) {
  st.preChecked = st.preChecked.includes(key) ? st.preChecked.filter(k => k !== key) : [...st.preChecked, key];
  return bump(st);
}
export function prehabDone(st, plan, counts, skipped = false) {
  st.prehabDone = true; st.prehabSkipped = skipped;
  return warmupDone(st, plan, counts);
}
export function setDraft(st, w, r) { st.w = w; st.r = r; return st; }
export function adjust(st, dw = 0, dr = 0, minR = 1, maxR = 900) {
  st.w = Math.max(0, Math.round(((st.w || 0) + dw) * 4) / 4);
  st.r = Math.max(minR, Math.min(maxR, (st.r || 0) + dr));
  return bump(st);
}
// a set was saved (counts include it) → rest, or feedback after the last set
export function afterSet(st, plan, counts, restSecs, now) {
  const i = st.ex;
  st.lastRating = 'ok';
  const it = plan[i], j = it.ssWith;
  if (j != null && plan[j]) {                        // superset: A1 → A2 without rest, rest after A2, back to A1
    const mineLeft = doneSets(counts, i) < it.sets, partnerLeft = doneSets(counts, j) < plan[j].sets;
    if (it.ssFirst && partnerLeft) { st.ex = j; st.w = st.r = null; st.stage = 'exercise'; st.timer = null; return bump(st); }
    if (!it.ssFirst && (mineLeft || partnerLeft)) {
      st.afterRest = partnerLeft ? j : i;
      if (restSecs) { st.stage = 'rest'; return startTimer(st, 'rest', restSecs, now); }
      return restDone(st);
    }
    if (!mineLeft && !partnerLeft) { st.stage = 'feedback'; st.timer = null; return bump(st); }
    if (it.ssFirst && !partnerLeft && mineLeft) {
      if (restSecs) { st.stage = 'rest'; return startTimer(st, 'rest', restSecs, now); }
      st.stage = 'exercise'; return bump(st);
    }
  }
  if (doneSets(counts, i) >= plan[i].sets) { st.stage = 'feedback'; st.timer = null; return bump(st); }
  if (restSecs) { st.stage = 'rest'; return startTimer(st, 'rest', restSecs, now); }
  st.stage = 'exercise';
  return bump(st);
}
export function restDone(st) {
  st.timer = null; st.paused = false; st.stage = 'exercise';
  if (st.afterRest != null) { if (st.afterRest !== st.ex) { st.ex = st.afterRest; st.w = st.r = null; } st.afterRest = null; }
  return bump(st);
}
export function feedback(st, plan, counts, value) {
  st.fb[String(st.ex)] = value;
  const j = plan[st.ex] && plan[st.ex].ssWith;
  if (j != null) st.fb[String(j)] = value;
  const from = j != null ? Math.max(st.ex, j) : st.ex;
  return goto(st, nextIndex(plan, counts, st.skipped, from));
}
export function skip(st, plan, counts) {
  const i = st.ex;
  if (i != null && !st.skipped.includes(i)) st.skipped.push(i);
  return goto(st, nextIndex(plan, counts, st.skipped, i));
}
export function back(st, plan) {
  if (st.stage === 'rest') return restDone(st);
  if (st.stage === 'feedback') return goto(st, st.ex);
  if (st.stage === 'finish' && plan.length) return goto(st, plan.length - 1);
  if (st.stage === 'exercise' && st.ex > 0) return goto(st, st.ex - 1);
  return bump(st);
}
export function undoSet(st) { st.timer = null; st.paused = false; st.stage = 'exercise'; st.lastRating = null; return bump(st); }
export function replaced(st) { st.w = st.r = null; st.stage = 'exercise'; st.timer = null; return bump(st); }
export function finishNow(st) { st.stage = 'finish'; st.timer = null; st.paused = false; return bump(st); }
export const isStale = (st, v) => Number(v) !== st.v;
