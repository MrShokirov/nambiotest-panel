// Progress tracking centre: strength per exercise, muscle-group volume, body, consistency, achievements.
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import * as R from './records.js';
import { line, bars } from './charts.js';
import { ic } from './icons.js';
import { esc, sheet, closeSheet, prompt, toast } from './ui.js';
import * as PH from './photos.js';

let ctx = null, seg = 'kuch', exSel = null;
export const init = c => { ctx = c; PH.init(c); };
const SEGS = [['kuch', 'Kuch'], ['mushak', 'Mushaklar'], ['tana', 'Tana'], ['intizom', 'Intizom'], ['yutuq', 'Yutuqlar']];

function perExercise() {
  const db = S.db(), fin = [...D.finishedSessions()].reverse(), out = {};
  for (const s of fin) {
    if (s.deload) continue;
    const sets = db.sets.filter(x => x.sid === s.id);
    for (const k of new Set(sets.map(x => x.key))) {
      const ex = D.EX[k]; if (ex.unit !== 'reps' || ex.assist) continue;
      const mine = sets.filter(x => x.key === k);
      const o = out[k] ||= { e1: [], best: [], vol: [], dates: [], repPR: {} };
      o.e1.push(Math.max(0, ...mine.map(x => C.e1rm(x.w, x.r) || 0)));
      o.best.push(Math.max(...mine.map(x => x.w)));
      o.vol.push(Math.round(mine.reduce((a, x) => a + x.w * x.r, 0)));
      o.dates.push(new Date(s.finishedAt));
      for (const x of mine) if (!o.repPR[x.w] || x.r > o.repPR[x.w]) o.repPR[x.w] = x.r;
    }
  }
  return out;
}
function prCount(per) {
  let n = 0;
  for (const o of Object.values(per)) { let best = 0; o.e1.forEach(v => { if (best && v > best) n++; best = Math.max(best, v); }); }
  return n;
}
function consistency() {
  const db = S.db(), start = Date.parse(db.profile.startedAt || db.createdAt);
  const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  let planned = 0;
  for (let i = 1; i <= days; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (db.profile.trainDays.includes((d.getDay() + 6) % 7)) planned++; }
  planned = Math.round(planned * Math.min(3, db.profile.trainDays.length) / Math.max(1, db.profile.trainDays.length));   // target = 3 core / week
  const done = D.finishedSessions().filter(s => !s.bonus).length;
  // longest run of weeks with ≥3 sessions
  const wk = {};
  D.finishedSessions().filter(s => !s.bonus).forEach(s => { const k = R.weekStart(new Date(s.finishedAt)).getTime(); wk[k] = (wk[k] || 0) + 1; });
  let best = 0, cur = 0;
  const keys = Object.keys(wk).map(Number).sort();
  for (let i = 0; i < keys.length; i++) { cur = wk[keys[i]] >= 3 && (i === 0 || keys[i] - keys[i - 1] <= 7 * 86400000 + 3600000) ? cur + 1 : (wk[keys[i]] >= 3 ? 1 : 0); best = Math.max(best, cur); }
  return { planned, done, pct: planned ? Math.min(100, Math.round(done / planned * 100)) : (done ? 100 : 0), bestStreak: best };
}

export function render(root) {
  const db = S.db(), per = perExercise(), st = R.stats(), cons = consistency();
  const keys = Object.keys(per).sort((a, b) => per[b].e1.length - per[a].e1.length);
  if (!exSel || !per[exSel]) exSel = keys[0] || null;
  let body = '';
  if (seg === 'kuch') {
    const o = exSel ? per[exSel] : null;
    const bw = db.profile.weight;
    body = !keys.length ? '<div class="empty">💪<p>Birinchi mashg‘ulotdan keyin har bir mashq bo‘yicha kuch grafiklari shu yerda chiqadi.</p></div>' : `
      <div class="card"><div class="chips">${keys.map(k => `<button class="chipbtn ${k === exSel ? 'sel' : ''}" data-a="pg-ex" data-arg="${k}">${esc(D.EX[k].short.split(' ').slice(0, 3).join(' '))}</button>`).join('')}</div>
        <div class="row between" style="margin-top:12px"><h3>${esc(D.EX[exSel].short)}</h3><span class="pill">${C.trendStatus(o.e1).icon} ${C.trendStatus(o.e1).label}</span></div>
        <p class="insight">${o.e1.length > 1 ? `Boshlagandan beri kuch ko‘rsatkichi <b>${Math.round((o.e1[o.e1.length - 1] - o.e1[0]) / o.e1[0] * 100)}%</b> ${o.e1[o.e1.length - 1] >= o.e1[0] ? 'oshdi 💪' : 'o‘zgardi'}` : 'Yana bitta mashg‘ulotdan keyin o‘sish ko‘rinadi.'}</p>
        ${line(o.e1, { labels: o.dates.map(d => `${d.getDate()}.${d.getMonth() + 1}`), unit: ' kg', color: 'var(--c-strength)' })}
        <p class="tiny muted">Kuch ko‘rsatkichi = shu mashqda 1 marta ko‘tara oladigan vazningiz taxmini (vazn va takrordan hisoblanadi).</p>
        <div class="stats" style="margin-top:10px"><div><b>${Math.max(...o.e1)}</b><small>kuch ko‘rsatkichi</small></div><div><b>${D.fmtW(Math.max(...o.best))}</b><small>eng og‘ir, kg</small></div>
          <div><b>${(Math.max(...o.e1) / bw).toFixed(2)}×</b><small>tana vazniga</small></div><div><b>${o.e1.length}</b><small>mashg‘ulot</small></div></div></div>
      <details class="card"><summary>🏅 Takror rekordlari</summary><table class="tbl"><tr><th>Vazn</th><th>Eng ko‘p takror</th></tr>
        ${Object.entries(o.repPR).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([w, r]) => `<tr><td>${D.fmtW(Number(w))} kg</td><td>${r}</td></tr>`).join('')}</table></details>
      <div class="card"><h3>Barcha mashqlar holati</h3>${keys.map(k => { const t = C.trendStatus(per[k].e1); return `<button class="histrow" data-a="pg-ex" data-arg="${k}"><span class="grow"><b>${esc(D.EX[k].short)}</b><small>kuch ${per[k].e1[0]} → ${per[k].e1[per[k].e1.length - 1]} kg</small></span><span class="pill ${t.s === 'up' ? 'green' : t.s === 'down' ? 'gold' : ''}">${t.icon} ${t.label}</span></button>`; }).join('')}
        <p class="tiny muted">Plato bo‘lsa, ilova keyingi mashg‘ulotda o‘zi vaznni −10% qilib qayta quradi yoki boshqa variant taklif qiladi.</p></div>`;
  }
  if (seg === 'mushak') {
    const ci = D.compensationInputs();
    const groups = Object.keys(C.MUSCLE);
    const target = groups.map(g => ci.weekTarget[g] || 0), done = groups.map(g => ci.weekSets[g] || 0);
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const a = R.weekStart(); a.setDate(a.getDate() - 7 * i); const b2 = new Date(a); b2.setDate(b2.getDate() + 7);
      const ids = new Set(D.finishedSessions().filter(s => { const t = Date.parse(s.finishedAt); return t >= a && t < b2; }).map(s => s.id));
      weeks.push({ label: `${a.getDate()}.${a.getMonth() + 1}`, sets: db.sets.filter(x => ids.has(x.sid) && C.muscleOf(x.key)).length });
    }
    body = `<div class="card"><h3>Oxirgi 7 kun: mushak guruhlari</h3><p class="insight">To‘liq yashil chiziq — o‘sha mushak bu hafta yetarli ishlagan.</p>
      ${groups.map((g, i) => { if (!target[i] && !done[i]) return ''; const pct = target[i] ? Math.min(100, done[i] / target[i] * 100) : 0; return `<div class="mrow"><span>${C.MUSCLE_UZ[g]}</span><div class="mbar"><i style="width:${pct}%" class="${pct >= 90 ? 'ok' : pct >= 50 ? 'mid' : 'low'}"></i></div><b>${done[i]}/${target[i]}</b></div>`; }).join('')}
      ${ci.missed ? `<p class="note">↪️ Shu hafta ${ci.missed} ta mashg‘ulot o‘tkazib yuborilgan — kam ishlangan guruhlar keyingi mashg‘ulotga avtomatik qo‘shiladi.</p>` : ''}</div>
      <div class="card"><h3>📊 Haftalik og‘ir setlar (jami)</h3>${bars(weeks.map(w => w.sets), { labels: weeks.map(w => w.label), color: 'var(--c-train)' })}</div>
      <p class="tiny muted">Ilmiy tavsiya: har bir mushak guruhiga haftasiga ~8–14 og‘ir set (Schoenfeld 2017).</p>`;
  }
  if (seg === 'tana') {
    const bodyE = [...db.body].sort((a, b) => a.date.localeCompare(b.date));
    const tr = C.weightTrend(bodyE, db.profile.goal);
    const ms = [...(db.measures || [])].sort((a, b) => a.date.localeCompare(b.date));
    const lastM = ms[ms.length - 1];
    const bf = lastM ? C.navyBodyfat(lastM.waist, lastM.neck, db.profile.height) : null;
    body = `<div class="card"><div class="row between"><h3>⚖️ Vazn</h3><button class="btn small primary" data-a="pr-weight">+ Kiritish</button></div>
        ${line(bodyE.map(b => b.weight), { labels: bodyE.map(b => b.date.slice(5).split('-').reverse().join('.')), unit: ' kg', color: 'var(--c-weight)' })}
        <p class="tiny ${tr.kcalDelta ? 'warn' : 'muted'}">${tr.enough ? (tr.advice || `Trend: ${tr.perWeek >= 0 ? '+' : ''}${tr.perWeek.toFixed(2)} kg/hafta. Aniq xulosa uchun 3+ hafta kerak.`) : 'Har 1–2 haftada ertalab och qoringa torting.'}</p></div>
      <div class="card"><div class="row between"><h3>📏 O‘lchovlar</h3><button class="btn small primary" data-a="pg-meas">+ Kiritish</button></div>
        ${ms.length ? `<table class="tbl"><tr><th>Sana</th><th>Bel</th><th>Ko‘krak</th><th>Qo‘l</th><th>Son</th></tr>${ms.slice(-6).reverse().map(m => `<tr><td>${m.date.slice(5).split('-').reverse().join('.')}</td><td>${m.waist || '—'}</td><td>${m.chest || '—'}</td><td>${m.arm || '—'}</td><td>${m.thigh || '—'}</td></tr>`).join('')}</table>
          ${ms.length > 1 ? `<p class="tiny muted">Bel: ${line(ms.map(m => m.waist).filter(Boolean), { unit: ' sm', h: 110, color: 'var(--c-bonus)' })}</p>` : ''}` : '<p class="muted tiny">Oyiga 1 marta: bel (kindik ustidan), bo‘yin, ko‘krak, qo‘l, son — santimetrda.</p>'}
        ${bf ? `<p>Tana yog‘i (taxminiy, US Navy usuli): <b>${bf}%</b></p>` : ''}</div><div id="phcard"></div>`;
  }
  if (seg === 'intizom') {
    const pos = Math.min(db.nextSession - 1, D.TOTAL());
    body = `<div class="stats"><div><b>${cons.pct}%</b><small>reja bajarildi</small></div><div><b>${st.streak}</b><small>hafta hozir</small></div><div><b>${cons.bestStreak}</b><small>eng uzun seriya</small></div><div><b>${Math.round(pos / D.TOTAL() * 100)}%</b><small>12 oy dasturi</small></div></div>
      <div class="card"><h3>📅 12 oylik yo‘l</h3><div class="hero-mini"><div class="bar"><i style="width:${pos / D.TOTAL() * 100}%"></i></div></div>
        <p class="muted tiny">${pos} / ${D.TOTAL()} mashg‘ulot · ${D.PRG.sessions[Math.min(db.nextSession, D.TOTAL()) - 1].phase}-bosqich</p></div>
      <div class="card"><h3>Haftalik mashg‘ulotlar</h3>${bars(R.weeklyVolume(8).labels.map((_, i) => { const a = R.weekStart(); a.setDate(a.getDate() - 7 * (7 - i)); const b2 = new Date(a); b2.setDate(b2.getDate() + 7); return D.finishedSessions().filter(s => { const t = Date.parse(s.finishedAt); return t >= a && t < b2; }).length; }), { labels: R.weeklyVolume(8).labels, goal: 3, color: 'var(--c-train)' })}<p class="tiny muted">Chiziq — haftasiga 3 ta maqsad.</p></div>`;
  }
  if (seg === 'yutuq') {
    const pos = D.PRG.sessions[Math.min(db.nextSession, D.TOTAL()) - 1].phase;
    const sx = { workouts: st.workouts, bestStreak: cons.bestStreak, prs: prCount(per), volume: st.volume, phase: pos,
      prehab: D.finishedSessions().filter(s => s.prehab && s.prehab.done && s.prehab.done.length).length,
      morning: Object.keys(db.morning || {}).length };
    body = `<div class="ach">${C.ACHIEVEMENTS.map(([id, icon, name, test]) => `<div class="achv ${test(sx) ? 'got' : ''}"><span>${icon}</span><small>${name}</small></div>`).join('')}</div>
      <p class="tiny muted center">${C.ACHIEVEMENTS.filter(a => a[3](sx)).length} / ${C.ACHIEVEMENTS.length} yutuq</p>`;
  }
  root.innerHTML = `<div class="page"><div class="topbar"><button class="icon" data-a="drawer" aria-label="Menyu">${ic('menu')}</button><b>Progress</b><span></span></div>
    <div class="seg" style="--n:${SEGS.length};--i:${SEGS.findIndex(s => s[0] === seg)}"><i></i>${SEGS.map(([k, l]) => `<button class="${k === seg ? 'sel' : ''}" data-a="pg-seg" data-arg="${k}">${l}</button>`).join('')}</div>
    <div class="segbody">${body}</div></div>`;
  if (seg === 'tana') PH.cardHtml().then(h => { const el = document.getElementById('phcard'); if (el) el.innerHTML = h; });
}

export async function action(a, arg) {
  if (a === 'pg-seg') { seg = arg; return ctx.render(); }
  if (a.startsWith('ph-')) return PH.action(a, arg);
  if (a === 'pg-ex') { exSel = arg; seg = 'kuch'; ctx.render(); return window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (a === 'pr-weight') {
    const v = await prompt('Vazn (kg)', { value: S.db().profile.weight, type: 'number', inputmode: 'decimal', hint: 'Ertalab, och qoringa. Har 1–2 haftada yetarli.' });
    const w = parseFloat(String(v || '').replace(',', '.'));
    if (!w) return;
    if (w < 35 || w > 250) return toast('Qiymat noto‘g‘ri ko‘rinadi');
    const db = S.db(), date = D.dateKey();
    db.body = db.body.filter(b => b.date !== date); db.body.push({ date, weight: w }); db.profile.weight = w;
    await S.save(); toast('✅ Saqlandi'); return ctx.render();
  }
  if (a === 'pg-meas') {
    const v = await prompt('O‘lchovlar (sm): bel bo‘yin ko‘krak qo‘l son', { hint: 'Masalan: 92 39 104 34 58 — bo‘sh joy bilan. Faqat belni yozsangiz ham bo‘ladi.', inputmode: 'decimal' });
    if (v == null) return;
    const n = String(v).replace(/,/g, '.').split(/\s+/).map(Number).filter(x => x > 0);
    if (!n.length || n.some(x => x < 15 || x > 200)) return toast('Qiymatlarni tekshiring (15–200 sm)');
    const [waist, neck, chest, arm, thigh] = n;
    const db = S.db(); (db.measures ||= []).push({ date: D.dateKey(), waist, neck, chest, arm, thigh });
    await S.save(); toast('✅ O‘lchovlar saqlandi'); return ctx.render();
  }
}
