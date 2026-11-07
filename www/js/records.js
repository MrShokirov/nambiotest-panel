// Data pages: all workouts, all sets, steps & distance, "all data" overview + shared statistics.
import * as HL from './health.js';
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import { ic } from './icons.js';
import * as N from './native.js';
import { esc, sheet, closeSheet, prompt, toast } from './ui.js';
import { summaryHtml } from './workout.js';
import { bars } from './charts.js';

let ctx = null, setFilter = 'all';
export const init = c => { ctx = c; };

export const strideM = () => (S.db().profile.height || 175) * 0.415 / 100;
export const stepsKm = steps => steps * strideM() / 1000;
export function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

export function stats() {
  const db = S.db(), fin = D.finishedSessions();
  const ids = new Set(fin.map(s => s.id));
  const sets = db.sets.filter(x => ids.has(x.sid));
  const vol = sets.filter(x => D.EX[x.key].unit === 'reps' && !D.EX[x.key].assist).reduce((a, x) => a + x.w * x.r, 0);
  const tread = sets.filter(x => x.key === 'treadmill').reduce((a, x) => a + x.r, 0);
  const counts = {};
  fin.forEach(s => { const k = weekStart(new Date(s.finishedAt)).getTime(); counts[k] = (counts[k] || 0) + 1; });
  let streak = 0, cur = weekStart().getTime();
  if ((counts[cur] || 0) >= 3) streak++;
  cur -= 7 * 86400000;
  while ((counts[cur] || 0) >= 3) { streak++; cur -= 7 * 86400000; }
  const last7 = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7.push(db.steps[D.dateKey(d)] || 0); }
  const steps7 = last7.reduce((a, b) => a + b, 0);
  return { workouts: fin.length, sets: sets.length, volume: vol, streak, km7: stepsKm(steps7), stepsToday: db.steps[D.dateKey()] || 0,
           treadKm: tread / 60 * 5, weekDone: fin.filter(s => !s.bonus && Date.parse(s.finishedAt) >= weekStart().getTime()).length };
}

export function weeklyVolume(weeks = 8) {
  const db = S.db(), fin = D.finishedSessions();
  const out = [], labels = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const a = weekStart(); a.setDate(a.getDate() - 7 * i);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    const ids = new Set(fin.filter(s => { const t = Date.parse(s.finishedAt); return t >= a && t < b; }).map(s => s.id));
    out.push(Math.round(db.sets.filter(x => ids.has(x.sid) && D.EX[x.key].unit === 'reps' && !D.EX[x.key].assist).reduce((s, x) => s + x.w * x.r, 0)));
    labels.push(`${a.getDate()}.${a.getMonth() + 1}`);
  }
  return { values: out, labels };
}
export function stepsSeries(days = 14) {
  const db = S.db(), values = [], labels = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); values.push(db.steps[D.dateKey(d)] || 0); labels.push(String(d.getDate())); }
  return { values, labels };
}
export function bestByExercise() {
  const db = S.db(), ids = new Set(D.finishedSessions().map(s => s.id)), best = {};
  for (const x of db.sets) {
    if (!ids.has(x.sid) || D.EX[x.key].unit !== 'reps') continue;
    const e = C.e1rm(x.w, x.r) || 0, b = best[x.key] || { e1rm: 0, w: 0 };
    best[x.key] = { e1rm: Math.max(b.e1rm, e), w: Math.max(b.w, x.w) };
  }
  return best;
}

const topbar = title => `<div class="topbar"><button class="icon" data-a="drawer" aria-label="Menyu">${ic('menu')}</button><b>${title}</b><span></span></div>`;

export function workoutsPage(root) {
  const db = S.db(), fin = D.finishedSessions();
  root.innerHTML = `<div class="page">${topbar('Barcha mashg‘ulotlar')}
    <p class="muted">${fin.length} ta mashg‘ulot. Bosing — barcha setlar chiqadi.</p>
    ${fin.map(s => {
      const sets = db.sets.filter(x => x.sid === s.id);
      const vol = sets.filter(x => D.EX[x.key].unit === 'reps').reduce((a, x) => a + x.w * x.r, 0);
      return `<button class="histrow" data-a="rec-sess" data-arg="${s.id}"><span class="datebox"><b>${new Date(s.finishedAt).getDate()}</b><small>${new Date(s.finishedAt).toLocaleDateString('ru', { month: 'short' })}</small></span>
        <span class="grow"><b>${esc(D.sessLabel(s))}</b><small>${sets.length} set · ${Math.round(vol).toLocaleString('ru')} kg · RPE ${s.rpe || '—'}${s.deload ? ' · deload' : ''}</small></span><span>›</span></button>`;
    }).join('') || '<div class="empty">🏋️<p>Hali mashg‘ulot yo‘q. Birinchisini boshlang!</p></div>'}</div>`;
}

export function sessionSheet(sid) {
  const db = S.db(), sess = db.sessions.find(s => s.id === sid), sets = db.sets.filter(x => x.sid === sid);
  const byEx = sess.plan.map((p, i) => ({ p, sets: sets.filter(x => x.exIdx === i) })).filter(x => x.sets.length);
  return sheet(`<div class="center-card">${summaryHtml(sid)}</div>${byEx.map(x => `<div class="setgroup"><b>${esc(D.EX[x.p.key].short)}</b>
    <table class="tbl"><tr><th>Set</th><th>Natija</th><th>Baho</th></tr>${x.sets.map((s, i) => `<tr><td>${i + 1}</td><td>${D.setLabel(D.EX[s.key], s.w, s.r)}</td><td>${s.rating === 'easy' ? '😌' : s.rating === 'hard' ? '🥵' : s.rating === 'ok' ? '💪' : '—'}</td></tr>`).join('')}</table></div>`).join('')}
    <button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
}

export function setsPage(root) {
  const db = S.db(), fin = D.finishedSessions(), byId = new Map(fin.map(s => [s.id, s]));
  const keys = [...new Set(db.sets.filter(x => byId.has(x.sid)).map(x => x.key))];
  const rows = db.sets.filter(x => byId.has(x.sid) && (setFilter === 'all' || x.key === setFilter)).sort((a, b) => b.at.localeCompare(a.at));
  const groups = [];
  for (const x of rows) {
    const day = x.at.slice(0, 10), k = day + x.key;
    let g = groups[groups.length - 1];
    if (!g || g.k !== k) { g = { k, day, key: x.key, sets: [] }; groups.push(g); }
    g.sets.push(x);
  }
  root.innerHTML = `<div class="page">${topbar('Barcha setlar')}
    <select class="input" id="setf"><option value="all">Hamma mashqlar (${rows.length} set)</option>${keys.map(k => `<option value="${k}" ${k === setFilter ? 'selected' : ''}>${esc(D.EX[k].short)}</option>`).join('')}</select>
    <button class="btn wide ghost" data-a="rec-csv">📤 CSV eksport (Excel uchun)</button>
    ${groups.map(g => `<div class="setgroup"><div class="row between"><b>${esc(D.EX[g.key].short)}</b><small class="muted">${new Date(g.day).toLocaleDateString('ru')}</small></div>
      <div class="setchips">${g.sets.reverse().map(s => `<span class="setchip ${s.rating || ''}">${D.setLabel(D.EX[s.key], s.w, s.r)}</span>`).join('')}</div></div>`).join('') || '<div class="empty">📋<p>Hali set yo‘q.</p></div>'}</div>`;
  document.getElementById('setf').addEventListener('change', e => { setFilter = e.target.value; ctx.render(); });
}

export function stepsPage(root) {
  const db = S.db(), st = stats(), ser = stepsSeries(14), goal = D.stepGoal(D.PRG.sessions[Math.min(db.nextSession, D.TOTAL()) - 1].week);
  const days = Object.keys(db.steps).sort().reverse().slice(0, 30);
  root.innerHTML = `<div class="page">${topbar('Qadam va masofa')}
    <div class="stats"><div><b>${st.stepsToday.toLocaleString('ru')}</b><small>bugun qadam</small></div><div><b>${stepsKm(st.stepsToday).toFixed(1)}</b><small>km bugun</small></div>
      <div><b>${st.km7.toFixed(1)}</b><small>km 7 kunda</small></div><div><b>${goal.toLocaleString('ru')}</b><small>kunlik maqsad</small></div></div>
    <div class="row gap"><button class="btn primary grow" data-a="rec-steps" data-arg="0">✏️ Bugungi qadam</button><button class="btn grow" data-a="rec-steps" data-arg="1">Kechagi</button></div>
    <div class="card"><h3>Oxirgi 14 kun</h3>${bars(ser.values, { labels: ser.labels, goal, color: 'var(--c-steps)' })}<p class="tiny muted">Chiziq — kunlik maqsad. To‘q rang — maqsadga yetilgan kun.</p></div>
    <div class="card"><h3>Kunlar</h3>${days.map(k => `<div class="row between"><span>${new Date(k).toLocaleDateString('ru')}</span><span>${db.steps[k].toLocaleString('ru')} qadam · <b>${stepsKm(db.steps[k]).toFixed(1)} km</b></span></div>`).join('') || '<p class="muted tiny">Hali yozuv yo‘q.</p>'}
      <p class="tiny muted">Masofa = qadam × qadam uzunligi (bo‘yingiz × 0,415 ≈ ${(strideM() * 100).toFixed(0)} sm). Yugurish yo‘lakchasida jami ~${st.treadKm.toFixed(1)} km (taxmin). Soatdan avtomatik olish — v3.</p></div></div>`;
}

export function dataPage(root) {
  const db = S.db(), p = db.profile, t = C.targets(p), st = stats(), best = bestByExercise();
  const rp = Object.keys(db.readiness).sort().reverse().slice(0, 10);
  root.innerHTML = `<div class="page">${topbar('Barcha ma’lumotlar')}
    <div class="card"><h3>👤 Profil</h3><table class="tbl">
      <tr><td>Ism</td><td>${esc(p.name || '—')}</td></tr><tr><td>Yosh / bo‘y / vazn</td><td>${p.age} · ${p.height} sm · ${p.weight} kg</td></tr>
      <tr><td>Maqsad</td><td>${esc(D.TX.goalName[p.goal])}</td></tr><tr><td>Kunlar</td><td>${p.trainDays.map(i => D.WD[i]).join(' · ')}</td></tr>
      <tr><td>Dasturdagi o‘rin</td><td>#${db.nextSession} / ${D.TOTAL()}</td></tr>
      <tr><td>Kaloriya / oqsil (taxminiy)</td><td>${t.kcal} kkal · ${t.protein} g</td></tr></table></div>
    <div class="card"><h3>📊 Umumiy</h3><table class="tbl">
      <tr><td>Mashg‘ulotlar</td><td>${st.workouts}</td></tr><tr><td>Setlar</td><td>${st.sets}</td></tr>
      <tr><td>Umumiy ko‘tarilgan vazn</td><td>${Math.round(st.volume).toLocaleString('ru')} kg</td></tr>
      <tr><td>Ketma-ket haftalar</td><td>${st.streak}</td></tr><tr><td>Masofa (7 kun)</td><td>${st.km7.toFixed(1)} km</td></tr></table></div>
    <button class="card linkcard" data-a="tab" data-arg="health"><h3>🩺 Salomatlik ›</h3><table class="tbl">${HL.dataRows()}</table></button>
    <div class="card"><h3>🏆 Rekordlar</h3><table class="tbl"><tr><th>Mashq</th><th>Eng og‘ir</th><th>Kuch ko‘rsatkichi</th></tr>
      ${Object.entries(best).sort((a, b) => b[1].e1rm - a[1].e1rm).map(([k, b]) => `<tr><td>${esc(D.EX[k].short)}</td><td>${D.fmtW(b.w)} kg</td><td>${b.e1rm || '—'}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Hali yo‘q</td></tr>'}</table></div>
    <div class="card"><h3>⚖️ Vazn yozuvlari</h3>${[...db.body].reverse().slice(0, 15).map(b => `<div class="row between"><span>${b.date}</span><b>${b.weight} kg</b></div>`).join('') || '<p class="muted tiny">Yo‘q</p>'}</div>
    <div class="card"><h3>☀️ Tayyorlik (oxirgi 10)</h3>${rp.map(k => `<div class="row between"><span>${k}</span><span>${db.readiness[k].sleep} soat · ${{ green: '🟢', yellow: '🟡', red: '🔴' }[db.readiness[k].score] || ''}</span></div>`).join('') || '<p class="muted tiny">Yo‘q</p>'}</div>
    <div class="card"><h3>🩹 Og‘riq yozuvlari</h3>${[...db.pain].reverse().slice(0, 15).map(x => `<div class="row between"><span>${new Date(x.at).toLocaleDateString('ru')}</span><span>${esc(D.TX.painAreas[x.area] || x.area)} · ${x.type}</span></div>`).join('') || '<p class="muted tiny">Yo‘q 👍</p>'}</div>
    <div class="card" id="storage"><h3>💽 Xotira</h3><p class="muted tiny">Hisoblanmoqda…</p></div></div>`;
  Promise.all([S.countVideos(), S.listTracks()]).then(([v, m]) => {
    const el = document.getElementById('storage');
    if (el) el.innerHTML = `<h3>💽 Xotira</h3><table class="tbl"><tr><td>Videolar</td><td>${v.total} ta · ${(v.bytes / 1048576).toFixed(0)} MB</td></tr>
      <tr><td>Musiqa</td><td>${m.length} ta · ${(m.reduce((a, x) => a + (x.size || 0), 0) / 1048576).toFixed(0)} MB</td></tr>
      <tr><td>Oxirgi zaxira</td><td>${db.lastBackup ? new Date(db.lastBackup).toLocaleDateString('ru') : 'yo‘q'}</td></tr></table>`;
  }).catch(() => {});
}

export async function action(a, arg) {
  if (a === 'rec-sess') return sessionSheet(Number(arg));
  if (a === 'rec-steps') {
    const d = new Date(); d.setDate(d.getDate() - Number(arg || 0));
    const k = D.dateKey(d);
    const v = await prompt(arg === '1' ? 'Kechagi qadamlar' : 'Bugungi qadamlar', { value: S.db().steps[k] || '', type: 'number', inputmode: 'numeric', hint: 'Telefon yoki Huawei Health ilovasidagi son.' });
    const n = parseInt(String(v || '').replace(/\s/g, ''), 10);
    if (!(n >= 0 && n <= 100000)) return v == null ? null : toast('Son 0–100 000 oralig‘ida bo‘lsin');
    S.db().steps[k] = n; await S.save(); toast(`✅ ${n.toLocaleString('ru')} qadam · ${stepsKm(n).toFixed(1)} km`); return ctx.render();
  }
  if (a === 'rec-csv') {
    const db = S.db(), byId = new Map(db.sessions.map(s => [s.id, s]));
    const lines = ['sana;mashg‘ulot;mashq;vazn_kg;takror;baho'];
    for (const x of db.sets) { const s = byId.get(x.sid); if (s && s.finishedAt) lines.push([x.at.slice(0, 10), s.no, D.EX[x.key].en, x.w, x.r, x.rating || ''].join(';')); }
    return N.shareFile(`sokhibjon-gym-sets-${D.dateKey()}.csv`, '﻿' + lines.join('\n'), 'Setlar CSV');
  }
}
