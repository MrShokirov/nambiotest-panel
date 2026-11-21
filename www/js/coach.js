// "Aqlli murabbiy": load suggestions, safety guard, in-session autoregulation, plateau / fatigue /
// break detection, plates, warm-ups, readiness, nutrition estimates, schedule helpers.
// Pure functions — no DOM, no storage. Reasons are short, simple Uzbek.

export const rnd = (w, step = 0.5) => Math.round(w / step) * step;
const fmt = w => String(Math.round(w * 100) / 100);

export function e1rm(w, r) {
  if (!w || !r || r > 12) return null;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

// history: [[{w, r, rating}], ...] newest session first (non-deload sessions only)
export function suggest(ex, item, history, factor = 1) {
  const { unit, inc } = ex;
  const { lo, hi } = item;
  const deload = (item.note || '').includes('deload');
  if (!history.length) return { weight: null, reason: 'Birinchi marta: ' + ex.start };

  const last = history[0];
  const reps = last.map(s => s.r);
  const ws = last.map(s => s.w || 0);
  const w = ex.assist ? Math.min(...ws) : Math.max(...ws);

  if (unit === 'min') return { weight: null, reason: `O‘tgan safar: ${Math.max(...reps)} daqiqa.` };
  if (unit === 'bw' || unit === 'sec') {
    const best = Math.max(...reps);
    if (unit === 'sec') return { weight: null, target: Math.max(best + 5, lo), reason: `O‘tgan safar eng yaxshisi: ${best} s. Bugun: ${Math.max(best + 5, lo)} s.` };
    if (best >= hi) return { weight: null, target: hi, reason: `O‘tgan safar ${best} takror — oraliq bajarildi ✅. Endi pastga tushishni 3 soniyaga sekinlashtiring.` };
    return { weight: null, target: Math.max(best + 1, lo), reason: `O‘tgan safar eng yaxshisi: ${best} takror. Bugun: ${Math.max(best + 1, lo)} takror.` };
  }
  const adj = x => ex.assist ? rnd(x + (1 - factor) * 50) : rnd(x * factor);
  const note = factor >= 1 ? '' : ` (bugungi holat ×${factor})`;
  if (deload) {
    const dw = ex.assist ? rnd(w + 10) : rnd(w * 0.6);
    return { weight: dw, target: lo, reason: `Yengil hafta (deload): odatdagi ${fmt(w)} kg ning ~60%. Toza texnika.` };
  }
  const allTop = reps.length >= Math.min(2, item.sets) && reps.every(r => r >= hi);
  const below = reps.some(r => r < lo);
  const prevBelow = history.length > 1 && history[1].some(s => s.r < lo);
  const lastHard = last.length && last[last.length - 1].rating === 'hard';
  const allEasy = last.length && last.every(s => s.rating === 'easy');

  if (allTop && lastHard) {
    return { weight: adj(w), target: hi, reason: `Takrorlar bajarildi, lekin oxirgi set og‘ir bo‘ldi → vazn o‘sha (${fmt(w)} kg), yana bir marta mustahkamlaymiz${note}.` };
  }
  if (allTop) {
    const nw = Math.max(0, rnd(w + inc));
    if (ex.assist) return { weight: adj(nw), target: lo, reason: `Hamma setlarda ${hi}+ takror ✅ → yordam −${Math.abs(inc)} kg${note}.` };
    return { weight: adj(nw), target: lo, reason: `Hamma setlarda ${hi}+ takror ✅ → +${inc} kg. ${lo} takrordan boshlab, asta oshiring${note}.` };
  }
  if (below && prevBelow) {
    const nw = ex.assist ? rnd(w + 5) : rnd(w * 0.9);
    return { weight: adj(nw), target: lo, reason: `Ikki marta ketma-ket ${lo} takrordan kam → vazn −10%, qaytadan quramiz${note}.` };
  }
  const best = Math.max(...reps);
  const target = Math.min(hi, Math.max(lo, best + (allEasy ? 2 : 1)));
  return { weight: adj(w), target,
    reason: `O‘tgan safar: ${fmt(w)} kg × ${reps.join(', ')}${allEasy ? ' (yengil)' : ''}. Vazn o‘sha — bugun ${target} takrorga intiling${note}.` };
}

// No load increase with recent joint pain, bad form / pain last time, or low readiness.
export function guard(sg, ex, history, factor = 1, { pain = false, formBad = false } = {}) {
  if (sg.weight == null || !history.length) return sg;
  const ws = history[0].map(s => s.w || 0);
  const last = ex.assist ? Math.min(...ws) : Math.max(...ws);
  const up = ex.assist ? sg.weight < last : sg.weight > last;
  const why = [];
  if (pain) why.push('shu bo‘g‘imda yaqinda og‘riq qayd etilgan');
  if (formBad) why.push('o‘tgan safar texnika buzilgan yoki og‘riq bo‘lgan');
  if (factor < 1) why.push('bugun holatingiz (uyqu/charchoq) past');
  if (!up || !why.length) return sg;
  const held = ex.assist ? rnd(last + (1 - factor) * 50) : rnd(last * factor);
  return { ...sg, weight: held, held: true,
    reason: `Vazn oshirilmaydi, chunki ${why.join(', ')}. ${fmt(last)} kg da texnikani mukammal qiling — keyingi safar oshiramiz.` };
}

// Plateau: best e1RM of the last 3 sessions not higher than the best before them.
export function plateau(history) {
  if (history.length < 4) return false;
  const best = h => Math.max(0, ...h.map(s => e1rm(s.w, s.r) || 0));
  const recent = Math.max(...history.slice(0, 3).map(best));
  const before = Math.max(...history.slice(3).map(best));
  return before > 0 && recent <= before;
}

export function applyPlateau(sg, ex, history) {
  if (sg.weight == null || ex.assist || ex.unit !== 'reps' || !plateau(history) || sg.held) return sg;
  return { ...sg, weight: rnd(sg.weight * 0.9), plateau: true,
    reason: '3 mashg‘ulotdan beri kuch o‘smadi (plato) → vazn −10% va takrorlar bilan qayta quramiz. Yoki 🔁 boshqa variantni sinang.' };
}

// Long break → lighter start.
export function breakFactor(daysSince) {
  if (daysSince == null) return { factor: 1, reason: '' };
  if (daysSince >= 14) return { factor: 0.85, reason: `${daysSince} kunlik tanaffus → vaznlar −15%.` };
  if (daysSince >= 7) return { factor: 0.9, reason: `${daysSince} kunlik tanaffus → vaznlar −10%.` };
  return { factor: 1, reason: '' };
}

// Fatigue signals across recent finished sessions → suggest a lighter day.
export function fatigue(recentSessions, recentSets, readinessScores = []) {
  const s = recentSessions.slice(0, 2);
  const highRpe = s.length === 2 && s.every(x => (x.rpe || 0) >= 9);
  const rated = recentSets.filter(x => x.rating);
  const hardShare = rated.length >= 6 ? rated.filter(x => x.rating === 'hard').length / rated.length : 0;
  const lowSleep = readinessScores.slice(0, 3).filter(x => x === 'red').length >= 2;
  const reasons = [];
  if (highRpe) reasons.push('oxirgi 2 mashg‘ulot juda og‘ir (RPE 9+)');
  if (hardShare >= 0.5) reasons.push('setlarning yarmidan ko‘pi «og‘ir» deb baholangan');
  if (lowSleep) reasons.push('ketma-ket kam uyqu / past tayyorlik');
  return { tired: reasons.length > 0, reasons };
}

// In-session autoregulation after a set rating → next set draft.
export function nextSetDraft(ex, item, w, r, rating, held = false) {
  const step = weightStep(ex);
  if (ex.unit === 'sec') {
    if (rating === 'easy') return { w, r: r + 5, msg: 'Yengil → keyingi set +5 soniya.' };
    if (rating === 'hard') return { w, r: Math.max(5, r - 5), msg: 'Og‘ir → keyingi set −5 soniya.' };
    return { w, r, msg: '' };
  }
  if (ex.unit === 'min') return { w, r, msg: '' };
  if (rating === 'easy') {
    if (ex.unit === 'reps' && r >= item.hi && !held && step) {
      const nw = ex.assist ? Math.max(0, w - step) : w + step;
      return { w: nw, r: item.lo, msg: `Yengil va ${item.hi}+ takror → keyingi set ${ex.assist ? '−' : '+'}${step} kg.` };
    }
    return { w, r: Math.min(item.hi + 2, r + 1), msg: 'Yengil → keyingi setda +1 takror.' };
  }
  if (rating === 'hard') {
    if (ex.unit === 'reps' && r < item.lo && step) {
      const nw = ex.assist ? w + step : Math.max(0, rnd(w - Math.max(step, w * 0.07), 0.5));
      return { w: nw, r: item.lo, msg: `Og‘ir va ${item.lo} takrordan kam → keyingi set vazn kamaytirildi.` };
    }
    return { w, r: Math.max(1, r - 1), msg: 'Og‘ir → vazn o‘sha, texnikaga e’tibor bering.' };
  }
  return { w, r, msg: '' };
}

export function weightStep(ex) {
  if (ex.unit !== 'reps') return 0;
  if (ex.barbell) return 2.5;
  return Math.abs(ex.inc || 0) || 1;
}

export function platesPerSide(total, bar = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  let side = (total - bar) / 2;
  if (side < 0) return null;
  const out = [];
  for (const p of plates) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return { plates: out, rem: Math.round(side * 100) / 100 };
}
export function platesText(total) {
  const p = platesPerSide(total);
  if (!p) return `${fmt(total)} kg bo‘sh grifdan (20 kg) yengil.`;
  if (!p.plates.length) return `${fmt(total)} kg = bo‘sh grif (20 kg).`;
  return `Grif 20 + har tomonga: ${p.plates.join(' + ')}` + (p.rem ? ` (≈${p.rem} kg yetmaydi)` : '');
}
export function warmupSets(work, barbell = true) {
  if (!work) return [];
  if (barbell) {
    const sets = [[20, 10]];
    for (const [pct, reps] of [[0.5, 8], [0.7, 5], [0.85, 2]]) {
      const w = Math.max(20, rnd(work * pct, 2.5));
      if (w < work && w > sets[sets.length - 1][0]) sets.push([w, reps]);
    }
    return sets;
  }
  const out = [];
  for (const [pct, reps] of [[0.5, 10], [0.75, 5]]) {
    const w = rnd(work * pct, 1);
    if (w > 0 && w < work) out.push([w, reps]);
  }
  return out;
}

export function readinessScore(sleep, energy, soreness) {
  const pts = (sleep < 5 ? 0 : sleep < 6 ? 1 : sleep < 7 ? 2 : 3) + energy + soreness;
  return pts >= 5 ? 'green' : pts >= 3 ? 'yellow' : 'red';
}
export const READINESS_FACTOR = { green: 1, yellow: 0.9, red: 0.8 };

export function targets(p, goalDelta = { recomp: -350, fatloss: -500, muscle: 150 }) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + 5;
  const tdee = bmr * 1.4;
  const delta = goalDelta[p.goal] ?? -350;
  const kcal = p.kcalOverride || Math.round((tdee + delta) / 50) * 50;
  const protein = p.proteinOverride || Math.round(p.weight * 1.9 / 5) * 5;
  const fat = Math.round(p.weight * 0.8 / 5) * 5;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat,
           carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5),
           water: Math.round(p.weight * 35 / 100) * 100, delta };
}

// ── schedule: 3 non-consecutive weekdays, or 4 weekdays with never 3 days in a row (0 = Monday) ──
export function daysOk(days) {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 3) return d.every((x, i) => ((d[(i + 1) % 3] - x) % 7 + 7) % 7 >= 2);
  if (d.length === 4) { const s = new Set(d); return d.every(x => !(s.has((x + 1) % 7) && s.has((x + 2) % 7))); }
  return false;
}
export function daysHint(days) {
  const n = new Set(days).size;
  if (daysOk(days)) return n === 4 ? '✅ 4 kun: 3 tasi asosiy, 1 tasi bonus (yengilroq)' : '✅ 3 kun — oralig‘i bilan';
  if (n < 3) return '3 yoki 4 kun tanlang';
  if (n > 4) return 'Ko‘pi bilan 4 kun — tiklanish uchun dam kerak';
  return n === 3 ? '3 kun bo‘lsa — ketma-ket bo‘lmasin' : '4 kun bo‘lsa — 3 kun ketma-ket bo‘lmasin';
}
export const PRESETS4 = { '0,1,3,4': 'Du · Se · Pay · Ju', '0,2,4,5': 'Du · Chor · Ju · Sha', '0,1,3,5': 'Du · Se · Pay · Sha', '1,2,4,5': 'Se · Chor · Ju · Sha', '0,2,4,6': 'Du · Chor · Ju · Yak' };

// Role of a training day: the first 3 sessions of a calendar week move the program forward ("core");
// any further session is a lighter "bonus". With a 4-day schedule the bonus is placed right after a core day
// when the remaining planned days of the week are still enough for 3 core sessions (no two hard days in a row).
export function dayRole({ coreThisWeek = 0, yesterdayCore = false, plannedLeft = 0, four = false }) {
  if (coreThisWeek >= 3) return 'bonus';
  if (four && yesterdayCore && plannedLeft >= 3 - coreThisWeek) return 'bonus';
  return 'core';
}
const wd = date => (date.getDay() + 6) % 7;
// Projected training days: [{ d, role }] until `count` core sessions are placed.
// 3-day schedules keep ≥1 rest day between sessions (a missed day shifts the rest).
// o: { trainedOnStart, prevCore (the day before the first projected day was a core session), coreThisWeek }
export function projectSchedule(start, days, count, o = {}) {
  const set = new Set(days.length ? days : [0, 2, 4]), four = set.size >= 4;
  const out = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let last = o.trainedOnStart ? new Date(d) : null, core = 0, weekCore = o.coreThisWeek || 0, yCore = !!o.prevCore;
  if (o.trainedOnStart) d.setDate(d.getDate() + 1);
  for (let g = 0; core < count && g < 5000; g++) {
    if (wd(d) === 0) weekCore = 0;
    const gapOk = four || !last || Math.round((d - last) / 86400000) >= 2;
    if (set.has(wd(d)) && gapOk) {
      const role = dayRole({ coreThisWeek: weekCore, yesterdayCore: yCore, plannedLeft: [...set].filter(x => x > wd(d)).length, four });
      out.push({ d: new Date(d), role });
      if (role === 'core') { core++; weekCore++; }
      yCore = role === 'core'; last = new Date(d);
    } else yCore = false;
    d.setDate(d.getDate() + 1);
  }
  return out;
}
export function projectDates(start, days, count, trainedOnStart = false, o = {}) {
  return projectSchedule(start, days, count, { ...o, trainedOnStart }).filter(x => x.role === 'core').map(x => x.d);
}

// ── Bonus session (4th day of the week): does not move the program. Lagging muscle groups (opposite
// emphasis to yesterday) + shoulders, arms, core + 20 min easy zone-2 cardio. Moderate effort (RIR 2–3).
const LOWER_G = ['quads', 'hams', 'glutes'], UPPER_G = ['chest', 'back', 'shoulders'];
export function bonusPlan({ weekSets = {}, weekTarget = {}, yesterday = [], avoid = [], deload = false, mode = 'normal', missing = [] }, EX) {
  const out = [], changes = [], used = new Set();
  const yG = {};
  yesterday.forEach(k => { const g = muscleOf(k); if (g) yG[g] = (yG[g] || 0) + 1; });
  const lo = LOWER_G.reduce((a, g) => a + (yG[g] || 0), 0), up = UPPER_G.reduce((a, g) => a + (yG[g] || 0), 0);
  const emphasis = !yesterday.length ? 'balanced' : lo > up * 1.5 ? 'upper' : up > lo * 1.5 ? 'lower' : 'balanced';
  const travel = mode === 'travel';
  const ok = k => EX[k] && !used.has(k) && !EX[k].areas.some(a => avoid.includes(a)) && equipOk(k, missing) && (!travel || TRAVEL_OK.has(k) || ['db_curl', 'hammer', 'db_oh_tri', 'rear_delt_fly', 'dead_bug', 'plank', 'treadmill'].includes(k));
  const add = (keys, item) => { const k = keys.find(ok); if (!k) return null; used.add(k); const it = { key: k, rir: '2-3', note: '', bonus: true, ...item }; out.push(it); return it; };
  const s = n => (deload ? Math.min(2, n) : n);
  // 1) lagging groups this week (not the ones loaded yesterday)
  if (!deload && mode !== 'short') {
    const allowed = g => emphasis === 'upper' ? UPPER_G.includes(g) : emphasis === 'lower' ? LOWER_G.includes(g) : (yG[g] || 0) < 2;
    const def = Object.keys(MUSCLE).map(g => ({ g, d: Math.round((weekTarget[g] || 0) - (weekSets[g] || 0)) }))
      .filter(x => x.d >= 3 && allowed(x.g)).sort((a, b) => b.d - a.d).slice(0, 2);
    for (const { g, d } of def) {
      const it = add(COMP_PICK[g], { sets: d >= 6 ? 3 : 2, lo: 10, hi: 15, rest: 90, comp: true });
      if (it) changes.push(`⚖️ Bu hafta ${MUSCLE_UZ[g]} kam ishlandi (−${d} set) → ${EX[it.key].short}`);
    }
  }
  // 2) shoulders (side + rear delts) — low joint stress, good for posture
  if (!out.some(e => e.comp && muscleOf(e.key) === 'shoulders')) add(['lateral', 'face_pull'], { sets: s(3), lo: 12, hi: 20, rest: 60 });
  add(['face_pull', 'rear_delt_fly'], { sets: s(2), lo: 15, hi: 20, rest: 60 });
  // 3) arms — biceps + triceps (become a superset when time is short)
  add(['db_curl', 'hammer', 'incline_curl'], { sets: s(3), lo: 10, hi: 15, rest: 60 });
  add(['pushdown', 'db_oh_tri', 'oh_tri', 'pushups'], { sets: s(3), lo: 10, hi: 15, rest: 60 });
  // 4) core
  add(avoid.includes('lowback') ? ['dead_bug'] : ['dead_bug', 'plank', 'cable_crunch'], { sets: 2, lo: 8, hi: 12, rest: 45 });
  const c = out[out.length - 1];
  if (c && EX[c.key].unit === 'sec') { c.lo = 30; c.hi = 45; }
  // 5) easy cardio
  out.push({ key: 'treadmill', sets: 1, lo: mode === 'short' ? 12 : 20, hi: mode === 'short' ? 12 : 20, rir: '', rest: 0, note: 'Zona 2: gaplasha olasiz, lekin qo‘shiq ayta olmaysiz', bonus: true });
  const compG = [...new Set(out.filter(e => e.comp).map(e => MUSCLE_UZ[muscleOf(e.key)]))].filter(g => g !== 'yelka');
  const focus = (compG.length ? compG.join(', ') + ' + ' : '') + 'yelka, qo‘l, kor';
  changes.unshift(`➕ Bonus kun: dastur oldinga siljimaydi. ${emphasis === 'upper' ? 'Kecha oyoq ishlagan — bugun ustki tana.' : emphasis === 'lower' ? 'Kecha ustki tana ishlagan — bugun oyoqqa yengil yuk.' : 'Og‘ir asosiy mashqlar yo‘q — tiklanishga xalaqit bermaydi.'}`);
  if (deload) changes.push('🟢 Yengil hafta — bonus ham yengil (2 set)');
  return { plan: out, changes, focus, emphasis };
}

// ════════ Daily readiness index (0–100) → today's load, volume, mode and exercise choice ════════
// inputs: { sleep, sleepAvg3, energy (0–2), soreness: 'none'|'upper'|'legs'|'whole',
//           stepsYesterday, stepsBaseline, daysSince, lastRpe, hardShare, painAreas: [] }
export function readinessIndex(i) {
  let score = 100;
  const reasons = [];
  const pen = (n, why) => { if (n > 0) { score -= n; reasons.push(`${why} (−${n})`); } };
  const s = i.sleep ?? 7.5;
  pen(s < 5 ? 30 : s < 6 ? 20 : s < 7 ? 8 : 0, `Uyqu ${s < 5 ? '5 soatdan kam' : s < 6 ? '5–6 soat' : '6–7 soat'}`);
  if (i.sleepAvg3 != null && i.sleepAvg3 < 6.5 && s < 7.5) pen(8, `Uyqu qarzi: 3 kecha o‘rtacha ${i.sleepAvg3.toFixed(1)} soat`);
  pen(i.energy === 0 ? 15 : i.energy === 1 ? 5 : 0, i.energy === 0 ? 'Kuch-quvvat past' : 'Kuch-quvvat o‘rtacha');
  const sore = i.soreness || 'none';
  pen(sore === 'whole' ? 20 : sore === 'legs' || sore === 'upper' ? 8 : 0, sore === 'whole' ? 'Butun tana og‘riyapti' : sore === 'legs' ? 'Oyoq mushaklari og‘riyapti' : 'Yuqori tana og‘riyapti');
  const base = Math.max(6000, i.stepsBaseline || 8000);
  const legLoad = i.stepsYesterday != null && i.stepsYesterday > base * 1.6 && i.stepsYesterday > 14000;
  if (legLoad) pen(5, `Kecha ${i.stepsYesterday.toLocaleString('ru')} qadam — odatdagidan ancha ko‘p`);
  if (i.lastRpe != null && i.lastRpe >= 9 && (i.daysSince ?? 3) <= 2) pen(10, `Oxirgi mashg‘ulot juda og‘ir (RPE ${i.lastRpe})`);
  if ((i.hardShare || 0) >= 0.5) pen(8, 'Oxirgi setlarning yarmi «og‘ir» deb baholangan');
  if (i.daysSince === 0) pen(25, 'Bugun allaqachon shug‘ullangansiz');
  else if (i.daysSince === 1) pen(8, 'Kecha shug‘ullangansiz (48 soat tiklanish yaxshiroq)');
  if ((i.painAreas || []).length) pen(10, 'Yaqinda bo‘g‘im og‘rig‘i yozilgan');
  // resting heart rate from the watch: a clear rise above the personal baseline = poor recovery / illness
  if (i.hrDelta != null && i.hrDelta >= 5) pen(i.hrDelta >= 10 ? 15 : 7, `Tinch puls odatdagidan +${i.hrDelta} zarba/daq (soatdan)`);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? 'green' : score >= 65 ? 'yellow' : score >= 50 ? 'orange' : score >= 35 ? 'red' : 'rest';
  const P = { green: { factor: 1, setsDelta: 0, mode: 'normal' }, yellow: { factor: 0.95, setsDelta: 0, mode: 'normal' },
              orange: { factor: 0.9, setsDelta: -1, mode: 'normal' }, red: { factor: 0.85, setsDelta: -1, mode: 'short' },
              rest: { factor: 0.8, setsDelta: -1, mode: 'rest' } }[level];
  const avoid = new Set(i.painAreas || []);
  return { score, level, ...P, reasons, legFatigue: legLoad || sore === 'legs' || sore === 'whole', avoid: [...avoid] };
}
export const LEVEL_TEXT = {
  green: '🟢 Zo‘r holat — to‘liq dastur, vazn oshirish mumkin.',
  yellow: '🟡 Yaxshi — vaznlar −5%, texnikaga e’tibor.',
  orange: '🟠 O‘rtacha — vaznlar −10%, yordamchi mashqlar 1 setga kam.',
  red: '🔴 Charchagansiz — qisqa rejim: faqat asosiy mashqlar, yengilroq.',
  rest: '⛔ Bugun dam oling: 30–45 daqiqa yengil yurish va cho‘zilish. Dasturdagi o‘rningiz saqlanadi.',
};

// Exercise substitution by movement pattern: a joint that hurts is not loaded; tired legs get
// machine variants (less balance / spinal load). Main lifts keep their sets, accessories lose 1 set.
export const PATTERN = {
  knee: ['squat', 'goblet', 'leg_press', 'split_squat', 'leg_ext'],
  hinge: ['rdl', 'db_rdl', 'hip_thrust', 'seated_leg_curl', 'leg_curl', 'back_ext'],
  pushH: ['bench', 'db_bench', 'incline_db', 'machine_chest', 'pushups', 'pec_deck'],
  pushV: ['ohp_db', 'ohp_bb', 'lateral'],
  pullV: ['pulldown', 'assisted_pullup'],
  pullH: ['cable_row', 'db_row', 'bb_row'], rear: ['face_pull', 'rear_delt_fly'],
  biceps: ['db_curl', 'incline_curl', 'hammer'], triceps: ['pushdown', 'oh_tri', 'db_oh_tri'],
  core: ['plank', 'dead_bug', 'cable_crunch', 'knee_raise'], calf: ['calf'], cardio: ['treadmill'],
};
const MACHINE_FIRST = ['leg_press', 'seated_leg_curl', 'leg_curl', 'leg_ext', 'hip_thrust', 'machine_chest', 'cable_row', 'pulldown'];
const LEG_HEAVY = new Set(['squat', 'split_squat', 'goblet', 'rdl', 'db_rdl']);
const MAIN_KEYS = new Set(['squat', 'bench', 'rdl', 'bb_row', 'ohp_bb', 'ohp_db', 'leg_press', 'pulldown', 'hip_thrust',
                           'incline_db', 'db_bench', 'goblet', 'assisted_pullup', 'cable_row', 'db_row']);
const patternOf = k => Object.keys(PATTERN).find(p => PATTERN[p].includes(k));

export function adaptPlan(plan, ri, EX) {
  const changes = [];
  const used = new Set(plan.map(p => p.key));
  let out = plan.map(it => {
    const ex = EX[it.key];
    const hitsPain = ex.areas.some(a => ri.avoid.includes(a));
    const legHeavy = ri.legFatigue && LEG_HEAVY.has(it.key);
    const item = { ...it };
    if (hitsPain || legHeavy) {
      const RELATED = { pullH: 'pullV', pullV: 'pullH', pushH: 'pushV', pushV: 'pushH' };
      const pn = patternOf(it.key);
      const pat = [...(PATTERN[pn] || []), ...(hitsPain && RELATED[pn] ? PATTERN[RELATED[pn]] : [])];
      const pool = [...new Set([...(legHeavy ? MACHINE_FIRST : []), ...pat, ...(ex.alts || [])])];
      const cand = pool.find(k => EX[k] && k !== it.key && !used.has(k) && pat.includes(k) && (EX[k].unit === ex.unit || patternOf(k) === 'core') &&
        !EX[k].areas.some(a => ri.avoid.includes(a)) && !(legHeavy && LEG_HEAVY.has(k)));
      if (cand) {
        used.add(cand); item.key = cand;
        if (EX[cand].unit !== ex.unit) { const l = { sec: [20, 40], bw: [8, 12] }[EX[cand].unit] || [8, 12]; item.lo = l[0]; item.hi = l[1]; }
        changes.push(`${ex.short} → ${EX[cand].short} (${hitsPain ? 'og‘riq bor bo‘g‘imni ayash' : 'oyoqlar charchagan'})`);
      } else {
        item.factor = hitsPain ? 0.7 : 0.9;
        changes.push(`${ex.short}: ${hitsPain ? 'og‘riq bor — vazn −30%, og‘risa to‘xtating' : 'oyoqlar charchagan — vazn −10%'}`);
      }
    }
    if (ri.setsDelta < 0 && !MAIN_KEYS.has(item.key) && item.key !== 'treadmill' && item.sets > 2) item.sets += ri.setsDelta;
    return item;
  });
  if (ri.setsDelta < 0) changes.push('Yordamchi mashqlar 1 setga kamaytirildi');
  if (ri.mode === 'short') {
    out = out.filter(e => e.key !== 'treadmill').slice(0, 4).map(e => ({ ...e, rest: Math.min(e.rest, 120) }));
    changes.push('Qisqa rejim: faqat dastlabki 4 ta mashq');
  }
  if (ri.factor < 1) changes.push(`Vaznlar ×${ri.factor} (${Math.round((1 - ri.factor) * 100)}% yengil)`);
  return { plan: out, changes };
}

// ════════ Body-weight trend from sparse weigh-ins (every 1–2 weeks is enough) ════════
export function weightTrend(entries, goal = 'recomp') {
  const pts = entries.filter(e => e.weight).map(e => ({ t: Date.parse(e.date) / 86400000, w: e.weight })).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return { enough: false, n: pts.length };
  const recent = pts.filter(p => p.t >= pts[pts.length - 1].t - 56);         // last 8 weeks
  const use = recent.length >= 2 ? recent : pts.slice(-2);
  const n = use.length, mt = use.reduce((a, p) => a + p.t, 0) / n, mw = use.reduce((a, p) => a + p.w, 0) / n;
  const slope = use.reduce((a, p) => a + (p.t - mt) * (p.w - mw), 0) / (use.reduce((a, p) => a + (p.t - mt) ** 2, 0) || 1);
  const perWeek = slope * 7, pct = perWeek / mw * 100;
  const span = use[n - 1].t - use[0].t;
  const target = { recomp: [-0.5, 0], fatloss: [-1, -0.4], muscle: [0.1, 0.4] }[goal] || [-0.5, 0];
  let advice = null, kcalDelta = 0;
  if (span >= 21) {
    if (pct < target[0]) { kcalDelta = 150; advice = `Vazn haftasiga ${Math.abs(perWeek).toFixed(2)} kg tushyapti — juda tez. Kaloriyani +150 kkal oshirish tavsiya etiladi (mushak saqlanishi uchun).`; }
    else if (pct > target[1]) { kcalDelta = goal === 'muscle' ? -100 : -150; advice = `Vazn maqsaddan ${perWeek > 0 ? 'tezroq oshyapti' : 'sekin tushyapti'} (${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(2)} kg/hafta). Kaloriyani ${kcalDelta} kkal to‘g‘rilash tavsiya etiladi.`; }
    else advice = `Trend maqsadga mos: ${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(2)} kg/hafta ✅`;
  }
  return { enough: true, perWeek, pct, spanDays: Math.round(span), advice, kcalDelta, last: pts[pts.length - 1] };
}

// ════════ Compensation: missed days / skipped exercises → autonomous plan changes ════════
export const MUSCLE = {
  quads: ['squat', 'goblet', 'leg_press', 'split_squat', 'leg_ext'],
  hams: ['rdl', 'db_rdl', 'seated_leg_curl', 'leg_curl', 'back_ext'],
  glutes: ['hip_thrust'],
  chest: ['bench', 'db_bench', 'incline_db', 'machine_chest', 'pushups', 'pec_deck'],
  back: ['pulldown', 'assisted_pullup', 'cable_row', 'db_row', 'bb_row'],
  shoulders: ['ohp_db', 'ohp_bb', 'lateral', 'face_pull', 'rear_delt_fly'],
};
export const MUSCLE_UZ = { quads: 'son oldi', hams: 'son orqasi', glutes: 'dumba', chest: 'ko‘krak', back: 'orqa', shoulders: 'yelka' };
const COMP_PICK = { quads: ['leg_press', 'leg_ext', 'goblet'], hams: ['seated_leg_curl', 'leg_curl', 'db_rdl'], glutes: ['hip_thrust'],
                    chest: ['db_bench', 'machine_chest', 'incline_db', 'pushups'], back: ['cable_row', 'pulldown', 'db_row'], shoulders: ['lateral', 'ohp_db'] };
const TRAVEL_OK = new Set(['goblet', 'db_rdl', 'hip_thrust', 'db_bench', 'incline_db', 'pushups', 'db_row', 'lateral', 'ohp_db', 'split_squat']);
export const muscleOf = k => Object.keys(MUSCLE).find(g => MUSCLE[g].includes(k));

export function estimateMinutes(items, EX) {
  let t = 7 * 60;
  for (const e of items) {
    if (e.key === 'treadmill') { t += e.hi * 60; continue; }
    const work = EX[e.key].unit === 'sec' ? e.hi : 45;
    const mult = (e.note || '').includes('har ') ? 2 : 1;
    t += e.sets * (work * mult + e.rest) + 60;
  }
  return Math.round(t / 60);
}

// weekSets: {group: sets done in last 7 days}, weekTarget: {group: sets per program week},
// expectedFrac: share of the week's sessions that should be done by now (0–1),
// carry: [exercise keys left unfinished last time], budgetMin: user's time per session.
export function compensate(plan, { weekSets = {}, weekTarget = {}, expectedFrac = 1, carry = [], budgetMin = 75,
                                     daysSince = 2, mode = 'normal', avoid = [] }, EX) {
  const changes = [];
  if (daysSince != null && daysSince >= 8) return { plan, changes: ['Uzoq tanaffusdan keyin kompensatsiya qo‘shilmaydi — avval tanani qayta moslashtiramiz.'] };
  const out = plan.map(x => ({ ...x }));
  const tail = out.findIndex(e => e.key === 'treadmill');
  const insertAt = () => (tail >= 0 ? out.findIndex(e => e.key === 'treadmill') : out.length);
  const inPlan = new Set(out.map(e => e.key));
  const todayGroup = {};
  out.forEach(e => { const g = muscleOf(e.key); if (g) todayGroup[g] = (todayGroup[g] || 0) + e.sets; });
  const maxAdd = mode === 'short' ? 1 : 2;
  const fits = item => estimateMinutes([...out, item], EX) <= budgetMin + 5;
  const ok = k => EX[k] && !inPlan.has(k) && !EX[k].areas.some(a => avoid.includes(a)) && (mode !== 'travel' || TRAVEL_OK.has(k));
  let added = 0;
  // 1) carry over exercises skipped / unfinished last time
  for (const k of carry) {
    if (added >= maxAdd) break;
    const g = muscleOf(k);
    const key = ok(k) ? k : (g ? COMP_PICK[g].find(ok) : null);
    if (!key || (g && (todayGroup[g] || 0) >= 3)) continue;
    const item = { key, sets: 2, lo: 8, hi: 12, rir: '2', rest: 90, note: '', comp: true };
    if (!fits(item)) { changes.push(`↪️ ${EX[k].short} qolib ketgan, lekin vaqt yetmaydi — keyingi safar`); continue; }
    out.splice(insertAt(), 0, item); inPlan.add(key); added++;
    if (g) todayGroup[g] = (todayGroup[g] || 0) + 2;
    changes.push(`↪️ O‘tgan safar qolib ketgan: ${EX[key].short} +2 set`);
  }
  // 2) weekly volume deficit per muscle group (missed days)
  const deficits = Object.keys(MUSCLE).map(g => ({ g, d: Math.round((weekTarget[g] || 0) * expectedFrac - (weekSets[g] || 0)) }))
    .filter(x => x.d >= 3 && (todayGroup[x.g] || 0) < 3).sort((a, b) => b.d - a.d);
  for (const { g, d } of deficits) {
    if (added >= maxAdd) break;
    const key = COMP_PICK[g].find(ok);
    if (!key) continue;
    const item = { key, sets: d >= 6 ? 3 : 2, lo: 10, hi: 12, rir: '2', rest: 75, note: '', comp: true };
    if (!fits(item)) { if (item.sets > 2 && fits({ ...item, sets: 2 })) item.sets = 2; else { changes.push(`⏱ ${MUSCLE_UZ[g]} uchun vaqt yetmaydi (${budgetMin} daq)`); continue; } }
    out.splice(insertAt(), 0, item); inPlan.add(key); added++;
    changes.push(`⚖️ Bu hafta ${MUSCLE_UZ[g]} kam ishlandi (−${d} set) → ${EX[key].short} +${item.sets} set`);
  }
  return { plan: out, changes };
}

// ════════ Progress analytics ════════
export function navyBodyfat(waist, neck, height) {
  if (!(waist && neck && height) || waist <= neck) return null;
  const w = waist / 2.54, n = neck / 2.54, h = height / 2.54;
  return Math.round((86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76) * 10) / 10;
}
// Trend of the last 4 values (e1RM per session): up / flat / down.
export function trendStatus(vals) {
  if (vals.length < 3) return { s: 'new', label: 'Yangi', icon: '🆕' };
  const v = vals.slice(-4), n = v.length, mx = (n - 1) / 2, my = v.reduce((a, b) => a + b, 0) / n;
  const slope = v.reduce((a, y, i) => a + (i - mx) * (y - my), 0) / v.reduce((a, _, i) => a + (i - mx) ** 2, 0);
  const pct = slope / my * 100;
  if (pct > 0.75) return { s: 'up', label: 'O‘syapti', icon: '📈' };
  if (pct < -1.5) return { s: 'down', label: 'Pasaymoqda', icon: '📉' };
  return { s: 'flat', label: 'Plato', icon: '➡️' };
}
export const ACHIEVEMENTS = [
  ['first', '🎉', 'Birinchi mashg‘ulot', s => s.workouts >= 1],
  ['w10', '🥉', '10 ta mashg‘ulot', s => s.workouts >= 10],
  ['w25', '🥈', '25 ta mashg‘ulot', s => s.workouts >= 25],
  ['w50', '🥇', '50 ta mashg‘ulot', s => s.workouts >= 50],
  ['w100', '🏆', '100 ta mashg‘ulot', s => s.workouts >= 100],
  ['w156', '👑', '12 oylik dastur tugadi', s => s.workouts >= 156],
  ['s4', '🔥', '4 hafta ketma-ket', s => s.bestStreak >= 4],
  ['s12', '⚡', '12 hafta ketma-ket', s => s.bestStreak >= 12],
  ['pr5', '💪', '5 ta shaxsiy rekord', s => s.prs >= 5],
  ['pr25', '🦾', '25 ta shaxsiy rekord', s => s.prs >= 25],
  ['t10', '🏗', '10 tonna ko‘tarildi', s => s.volume >= 10000],
  ['t100', '🏔', '100 tonna ko‘tarildi', s => s.volume >= 100000],
  ['pre10', '🛡', '10 marta himoya bloki', s => (s.prehab || 0) >= 10],
  ['m7', '🌅', '7 kun ertalabki mashq', s => (s.morning || 0) >= 7],
  ['m30', '🌄', '30 kun ertalabki mashq', s => (s.morning || 0) >= 30],
  ['p2', '🚩', '2-bosqichga o‘tildi', s => s.phase >= 2],
  ['p4', '🎯', '6 oylik marra', s => s.phase >= 5],
];

// ════════ "Bugun X daqiqam bor": fit the plan into the time the user has ════════
// 1) accessories −1 set (min 2)  2) antagonist supersets (no rest between partners)
// 3) drop the cardio finisher  4) drop lowest-priority accessories. Main lifts stay.
const SS_PAIRS = [['pushH', 'pullH'], ['pushH', 'pullV'], ['pushV', 'pullV'], ['pushV', 'pullH'], ['biceps', 'triceps'], ['knee', 'core'], ['hinge', 'core'], ['rear', 'biceps'], ['calf', 'core']];
export function fitToTime(plan, minutes, EX) {
  let out = plan.map(x => ({ ...x }));
  const changes = [];
  const est = () => estimateMinutes(out, EX);
  if (est() <= minutes) return { plan: out, changes };
  const isMain = e => MAIN_KEYS.has(e.key);
  for (const e of out) if (!isMain(e) && e.key !== 'treadmill' && e.sets > 2) { e.sets -= 1; }
  if (out.some((e, i) => e.sets !== plan[i].sets)) changes.push('Yordamchi mashqlar 1 setga kamaytirildi');
  if (est() > minutes) {
    const used = new Set();
    for (const [a, b] of SS_PAIRS) {
      const i = out.findIndex((e, k) => !used.has(k) && e.ssWith == null && patternOf(e.key) === a);
      const j = out.findIndex((e, k) => !used.has(k) && k !== i && e.ssWith == null && patternOf(e.key) === b);
      if (i < 0 || j < 0) continue;
      const [f, s2] = i < j ? [i, j] : [j, i];
      out[f].ssWith = s2; out[f].ssFirst = true; out[s2].ssWith = f; out[s2].ssFirst = false;
      out[s2].rest = Math.max(out[f].rest, out[s2].rest);
      out[f].rest = 0;
      used.add(i); used.add(j);
      changes.push(`Superset: ${EX[out[f].key].short} + ${EX[out[s2].key].short} (orasida dam yo‘q)`);
      if (est() <= minutes) break;
    }
    // keep partners next to each other
    const order = [];
    out.forEach((e, k) => { if (order.includes(k)) return; order.push(k); if (e.ssFirst) order.push(e.ssWith); });
    const remap = new Map(order.map((k, n) => [k, n]));
    out = order.map(k => ({ ...out[k], ssWith: out[k].ssWith != null ? remap.get(out[k].ssWith) : undefined }));
  }
  if (est() > minutes && out.some(e => e.key === 'treadmill')) { out = out.filter(e => e.key !== 'treadmill'); changes.push('Yakuniy kardio olib tashlandi (uyda yurish bilan to‘ldiring)'); }
  while (est() > minutes) {
    let k = -1;
    for (let n = out.length - 1; n >= 0; n--) if (!isMain(out[n])) { k = n; break; }
    if (k < 0) break;
    const p = out[k].ssWith;
    const drop = p != null && !isMain(out[p]) ? [k, p].sort((a, b) => b - a) : [k];
    if (p != null && isMain(out[p])) { delete out[p].ssWith; delete out[p].ssFirst; out[p].rest = Math.max(out[p].rest, 90); }
    for (const d of drop) { changes.push(`${EX[out[d].key].short} bugun tushirildi (vaqt)`); out.splice(d, 1); out.forEach(e => { if (e.ssWith != null && e.ssWith > d) e.ssWith -= 1; }); }
  }
  for (const e of out) { if (est() <= minutes) break; if (isMain(e) && e.sets > 2) { e.sets -= 1; changes.push(`${EX[e.key].short}: ${e.sets} set`); } }
  if (est() > minutes) changes.push(`Asosiy mashqlar saqlandi — taxminan ${est()} daqiqa kerak bo‘ladi`);
  return { plan: out, changes };
}

// ════════ Gym equipment: missing equipment → automatic alternatives ════════
export const EQUIP = {
  barbell: 'Shtanga (grif + disklar)', rack: 'Shtanga ramasi (stoyka)', dumbbell: 'Gantellar', bench: 'Tekis skameyka',
  incline_bench: 'Qiya skameyka', cable: 'Blok / tros trenajyori', lat_machine: 'Yuqori blok (pulldown)', leg_press: 'Leg press trenajyori',
  leg_curl_seated: 'O‘tirib oyoq bukish trenajyori', leg_curl_lying: 'Yotib oyoq bukish trenajyori', leg_ext: 'Oyoq yozish trenajyori',
  chest_press: 'Ko‘krak press trenajyori', pec_deck: 'Pec deck (butterfly)', assist_machine: 'Gravitron (yordamchi tortilish)',
  pullup_bar: 'Turnik', hyper_bench: 'Giperekstenziya (45°) skameykasi', calf_machine: 'Boldir trenajyori',
  treadmill: 'Yugurish yo‘lakchasi', band: 'Rezina lentalar',
};
export const NEEDS = {
  squat: ['barbell', 'rack'], goblet: ['dumbbell'], rdl: ['barbell'], db_rdl: ['dumbbell'], leg_press: ['leg_press'],
  seated_leg_curl: ['leg_curl_seated'], leg_curl: ['leg_curl_lying'], split_squat: ['dumbbell'], hip_thrust: ['barbell', 'bench'],
  calf: ['calf_machine'], leg_ext: ['leg_ext'], bench: ['barbell', 'bench', 'rack'], db_bench: ['dumbbell', 'bench'],
  incline_db: ['dumbbell', 'incline_bench'], machine_chest: ['chest_press'], pec_deck: ['pec_deck'], pushups: [],
  ohp_db: ['dumbbell', 'bench'], ohp_bb: ['barbell', 'rack'], lateral: ['dumbbell'], rear_delt_fly: ['dumbbell'], face_pull: ['cable'],
  pushdown: ['cable'], oh_tri: ['cable'], db_oh_tri: ['dumbbell'], pulldown: ['lat_machine'], cable_row: ['cable'],
  db_row: ['dumbbell', 'bench'], bb_row: ['barbell'], assisted_pullup: ['assist_machine'], db_curl: ['dumbbell'],
  incline_curl: ['dumbbell', 'incline_bench'], hammer: ['dumbbell'], plank: [], dead_bug: [], cable_crunch: ['cable'],
  knee_raise: ['pullup_bar'], back_ext: ['hyper_bench'], treadmill: ['treadmill'],
  pre_er_band: ['band'], pre_er_side: ['dumbbell'], pre_ir_band: ['band'], pre_pull_apart: ['band'], pre_scaption: ['dumbbell'],
  pre_scap_pull: ['pullup_bar'], pre_rev_fly_er: ['dumbbell', 'incline_bench'], pre_side_bridge: [], pre_glute_bridge: [],
  pre_monster_walk: ['band'], pre_hip_add: ['band'], pre_ankle: [], pre_wrist: [],
};
// extra candidates when the usual alternatives also need missing equipment
const EQUIP_FALLBACK = { calf: ['split_squat'], knee_raise: ['dead_bug', 'plank'], cable_crunch: ['dead_bug', 'plank'], back_ext: ['hip_thrust', 'db_rdl'],
  face_pull: ['rear_delt_fly'], pushdown: ['db_oh_tri', 'pushups'], oh_tri: ['db_oh_tri'], pec_deck: ['db_bench', 'pushups'], machine_chest: ['db_bench', 'pushups'],
  pulldown: ['assisted_pullup', 'db_row'], assisted_pullup: ['pulldown', 'db_row'], cable_row: ['db_row', 'bb_row'], leg_ext: ['split_squat', 'goblet'],
  db_curl: ['pulldown', 'assisted_pullup'], incline_curl: ['db_curl', 'hammer', 'pulldown'], hammer: ['db_curl', 'pulldown'], lateral: ['face_pull', 'ohp_bb'],
  rear_delt_fly: ['face_pull'], db_oh_tri: ['oh_tri', 'pushdown', 'pushups'], ohp_db: ['ohp_bb', 'machine_chest'], db_bench: ['bench', 'machine_chest', 'pushups'],
  incline_db: ['db_bench', 'bench', 'machine_chest', 'pushups'], goblet: ['leg_press', 'squat'], db_rdl: ['rdl', 'back_ext', 'seated_leg_curl'],
  split_squat: ['leg_press', 'goblet', 'squat'], db_row: ['cable_row', 'bb_row'], hip_thrust: ['back_ext', 'db_rdl', 'seated_leg_curl'],
  squat: ['leg_press', 'goblet'], bench: ['db_bench', 'machine_chest', 'pushups'], rdl: ['db_rdl', 'back_ext'], bb_row: ['cable_row', 'db_row'],
  ohp_bb: ['ohp_db', 'machine_chest'], seated_leg_curl: ['leg_curl', 'db_rdl'], leg_curl: ['seated_leg_curl', 'db_rdl'], leg_press: ['goblet', 'squat', 'split_squat'],
  pre_er_band: ['pre_er_side'], pre_ir_band: ['pre_er_side'], pre_pull_apart: ['pre_rev_fly_er', 'pre_scaption'], pre_scaption: ['pre_pull_apart'],
  pre_er_side: ['pre_er_band'], pre_scap_pull: ['pre_pull_apart'], pre_rev_fly_er: ['pre_pull_apart', 'pre_er_band'], pre_monster_walk: ['pre_glute_bridge'], pre_hip_add: ['pre_side_bridge'] };
export const equipOk = (key, missing) => (NEEDS[key] || []).every(n => !missing.includes(n));

export function substituteEquipment(plan, missing, EX) {
  if (!missing || !missing.length) return { plan, changes: [] };
  const changes = [];
  const used = new Set(plan.map(p => p.key));
  const out = plan.map(it => {
    if (equipOk(it.key, missing)) return it;
    if (it.key === 'treadmill') { changes.push('🏗 Yugurish yo‘lakchasi yo‘q → 10–15 daqiqa velosiped yoki tez yurish'); return { ...it, note: 'velosiped yoki tez yurish' }; }
    const ex = EX[it.key], pat = PATTERN[patternOf(it.key)] || [];
    const pool = [...new Set([...(ex.alts || []), ...(ex.travel || []), ...pat, ...(EQUIP_FALLBACK[it.key] || [])])];
    const unitOk = k => EX[k].unit === ex.unit || patternOf(k) === 'core' || ex.unit === 'bw' || EX[k].unit === 'bw';
    const cand = pool.find(k => EX[k] && k !== it.key && !used.has(k) && equipOk(k, missing) && unitOk(k)) ||
                 pool.find(k => EX[k] && k !== it.key && equipOk(k, missing));
    if (!cand) { changes.push(`🏗 ${ex.short}: kerakli jihoz yo‘q va muqobil topilmadi — o‘tkazib yuboring`); return { ...it, noEquip: true }; }
    used.add(cand);
    const item = { ...it, key: cand, equipSwap: it.key };
    if (['db_curl', 'incline_curl', 'hammer'].includes(it.key) && ['pulldown', 'assisted_pullup'].includes(cand)) item.note = 'teskari ushlash — kaftlar o‘zingizga (biseps)';
    if (EX[cand].unit !== ex.unit) { const l = { sec: [20, 40], bw: [8, 15] }[EX[cand].unit] || [8, 12]; item.lo = l[0]; item.hi = l[1]; }
    changes.push(`🏗 ${ex.short} → ${EX[cand].short} (jihoz yo‘q)`);
    return item;
  });
  return { plan: out, changes };
}
