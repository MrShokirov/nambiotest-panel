// Optional morning pelvic-floor (Kegel-type) routine: guided 2–4 min timer, auto-recorded, gentle progression.
import * as S from './store.js';
import * as D from './data.js';
import * as N from './native.js';
import { esc, sheet, closeSheet, toast } from './ui.js';

let ctx = null, run = null;
export const init = c => { ctx = c; };
const enabled = () => !!S.db().profile.morningOn;
const log = () => (S.db().morning ||= {});

export function streak() {
  let n = 0;
  const d = new Date();
  if (!log()[D.dateKey(d)]) d.setDate(d.getDate() - 1);         // today not done yet → count from yesterday
  while (log()[D.dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const doneToday = () => !!log()[D.dateKey()];
export const totalDays = () => Object.keys(log()).length;
export function level() {
  const n = totalDays();
  return n < 7 ? { hold: 3, reps: 10, name: '1-daraja' } : n < 14 ? { hold: 5, reps: 10, name: '2-daraja' }
    : n < 28 ? { hold: 8, reps: 10, name: '3-daraja' } : { hold: 10, reps: 10, name: '4-daraja' };
}

export function cardHtml() {
  if (!enabled()) return '';
  const lv = level(), mins = Math.round((30 + lv.reps * lv.hold * 2 + 20) / 60);
  return doneToday()
    ? `<div class="card mcard done"><div class="row between"><b>🌅 Ertalabki ${mins} daqiqa</b><span class="pill green">✅ bajarildi</span></div><p class="tiny muted">🔥 ${streak()} kun ketma-ket · ${lv.name}</p></div>`
    : `<button class="card mcard linkcard" data-a="mo-start"><div class="row between"><b>🌅 Ertalabki ${mins} daqiqa</b><span class="pill">▶ Boshlash</span></div>
       <p class="tiny muted">Tos tubi mashqi · ${lv.name}: ${lv.reps} × ${lv.hold} s ushlab turish${streak() ? ` · 🔥 ${streak()} kun` : ''}</p></button>`;
}

// phases: [label, seconds, kind]  kind: breathe | squeeze | relax | quick
function phases() {
  const lv = level(), ph = [['Diafragma bilan chuqur nafas oling', 30, 'breathe']];
  for (let i = 1; i <= lv.reps; i++) { ph.push([`SIQING · ${i}/${lv.reps}`, lv.hold, 'squeeze']); ph.push(['BO‘SHATING', lv.hold, 'relax']); }
  for (let i = 1; i <= 10; i++) { ph.push([`TEZ SIQING · ${i}/10`, 1, 'squeeze']); ph.push(['bo‘shating', 1, 'relax']); }
  return ph;
}

export async function start() {
  const lv = level();
  const ph = phases();
  const total = ph.reduce((a, p) => a + p[1], 0);
  let i = 0, left = ph[0][1], elapsed = 0, paused = false;
  const body = () => `<div class="mo">
      <p class="muted tiny">${lv.name} · jami ~${Math.round(total / 60)} daqiqa</p>
      <div class="mo-ring ${ph[i][2]}" id="moRing"><b id="moLeft">${left}</b></div>
      <h2 id="moLabel">${esc(ph[i][0])}</h2>
      <div class="bar"><i id="moBar" style="width:${elapsed / total * 100}%"></i></div>
      <p class="tiny muted">Qorin, dumba va sonni siqmang · nafasni ushlamang · og‘riq bo‘lsa to‘xtating</p>
      <div class="row gap"><button class="btn grow" data-s="pause">${paused ? '▶ Davom' : '⏸ Pauza'}</button><button class="btn grow" data-s="stop">To‘xtatish</button></div>
      <details class="note"><summary>Qanday topaman?</summary><p class="tiny">Siydik yoki gazni ushlab qolayotgandek his qiling — shu mushaklar. Faqat ularni yuqoriga va ichkariga torting. Muntazam ravishda siyish paytida mashq qilmang.</p></details></div>`;
  const tick = () => {
    if (paused) return;
    left -= 1; elapsed += 1;
    if (left <= 0) {
      i += 1;
      if (i >= ph.length) return finish(true);
      left = ph[i][1];
      N.buzz(ph[i][2] === 'squeeze' ? 'tap' : 'tap');
      const ring = document.getElementById('moRing');
      if (ring) { ring.className = 'mo-ring ' + ph[i][2]; ring.style.setProperty('--dur', ph[i][1] + 's'); }
      const lab = document.getElementById('moLabel'); if (lab) lab.textContent = ph[i][0];
    }
    const l = document.getElementById('moLeft'); if (l) l.textContent = left;
    const b = document.getElementById('moBar'); if (b) b.style.width = (elapsed / total * 100) + '%';
  };
  const finish = async ok => {
    clearInterval(run); run = null;
    N.keepAwake(false);
    if (ok) {
      log()[D.dateKey()] = { at: new Date().toISOString(), hold: lv.hold, reps: lv.reps };
      await S.save();
      closeSheet(true);
      N.buzz();
      toast(`✅ Ertalabki mashq bajarildi · 🔥 ${streak()} kun ketma-ket`);
      ctx.render();
    } else closeSheet(false);
  };
  N.keepAwake(true);
  run = setInterval(tick, 1000);
  await sheet(body(), { onClick: (v, b, wrap) => {
    if (v === 'stop') return finish(false);
    if (v === 'pause') { paused = !paused; b.textContent = paused ? '▶ Davom' : '⏸ Pauza'; }
  } });
  if (run) { clearInterval(run); run = null; N.keepAwake(false); }
}

export function action(a) { if (a === 'mo-start') return start(); }
