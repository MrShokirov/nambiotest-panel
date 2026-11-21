// Program: 7 phases → weeks → workouts, calendar of the next 12 workouts, training days, permanent swaps.
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import { esc, md, sheet, closeSheet, toast } from './ui.js';

let ctx = null, openPhase = null, openWeek = null;
export const init = c => { ctx = c; };

export function calendar(count = 12) {
  return D.schedule(count).filter(x => x.role === 'core');
}

export function render(root) {
  const db = S.db(), cur = D.PRG.sessions[Math.min(db.nextSession, D.TOTAL()) - 1];
  if (openPhase == null) openPhase = cur.phase;
  const pct = Math.round((db.nextSession - 1) / D.TOTAL() * 100);
  const phases = Object.entries(D.PRG.phases).map(([n, p]) => {
    const isOpen = Number(n) === openPhase;
    const weeks = [];
    for (let w = p.weeks[0]; w <= p.weeks[1]; w++) weeks.push(w);
    return `<div class="acc ${isOpen ? 'open' : ''}"><button class="acc-h" data-a="pl-phase" data-arg="${n}">
      <span class="phase-n ${Number(n) < cur.phase ? 'done' : Number(n) === cur.phase ? 'cur' : ''}">${n}</span>
      <span><b>${esc(p.name.replace(/^\d+-bosqich · /, ''))}</b><small>${p.weeks[0]}–${p.weeks[1]}-haftalar</small></span></button>
      ${isOpen ? `<div class="acc-b"><p class="muted">${esc(p.goal)}</p><div class="weeks">${weeks.map(w =>
        `<button class="wk ${w === cur.week ? 'cur' : ''} ${D.PRG.deloadWeeks.includes(w) ? 'deload' : ''} ${w === openWeek ? 'sel' : ''}" data-a="pl-week" data-arg="${w}">${w}</button>`).join('')}</div>
        ${openWeek && openWeek >= p.weeks[0] && openWeek <= p.weeks[1] ? weekHtml(openWeek) : ''}</div>` : ''}</div>`;
  }).join('');
  const swaps = Object.entries(db.swaps || {});
  root.innerHTML = `<div class="page">
    <h1 class="h1">12 oylik dastur</h1>
    <div class="card hero-mini"><div class="row between"><span>Mashg‘ulot <b>${Math.min(db.nextSession, D.TOTAL())}</b> / ${D.TOTAL()}</span><span class="muted">${cur.phase}-bosqich · ${cur.week}-hafta</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="row gap"><button class="btn grow" data-a="tab" data-arg="calendar">🗓 Kalendar</button><button class="btn grow" data-a="pl-days">📅 Kunlar: ${db.profile.trainDays.map(i => D.WD[i]).join(' · ')}</button></div>
    ${phases}
    <div class="card"><h3>🔁 Doimiy almashtirishlar</h3>${swaps.length ? swaps.map(([a, b]) =>
      `<div class="row between"><span>${esc(D.EX[a].short)} → <b>${esc(D.EX[b].short)}</b></span><button class="btn small" data-a="pl-unswap" data-arg="${a}">Qaytarish</button></div>`).join('')
      : '<p class="muted tiny">Yo‘q. Mashg‘ulot paytida 🔁 Almashtirish → «Doimiy» tanlasangiz, shu yerda chiqadi.</p>'}</div>
    <details class="card"><summary>🔬 Nega aynan shu dastur</summary><p>${md(D.TX.evidence)}</p></details></div>`;
}

function weekHtml(w) {
  const db = S.db();
  return D.PRG.sessions.filter(s => s.week === w).map(s => {
    const items = D.planForView(s.no);
    const tag = s.deload ? '<span class="pill green">deload</span>' : s.test ? '<span class="pill gold">test</span>' : '';
    return `<div class="sess ${s.no < db.nextSession ? 'past' : s.no === db.nextSession ? 'next' : ''}">
      <div class="row between"><b>#${s.no} ${esc(s.title)}</b>${tag}</div>
      <ul class="tl">${items.map(e => `<li>${esc(D.EX[e.key].short)} <small class="muted">${esc(D.scheme(e))}${e.rest ? ` · ${e.rest}s` : ''}</small></li>`).join('')}</ul>
      <small class="muted">~${s.minutes.normal} daqiqa${s.no < db.nextSession ? ' · ✅ bajarilgan' : ''}</small></div>`;
  }).join('');
}

export function calendarSheet() {
  const rows = D.schedule(12).map(({ d, no, role }) => {
    if (role === 'bonus') return `<li class="muted"><b>${D.fmtDate(d)}</b> — ➕ Bonus (yelka, qo‘l, kor, kardio)</li>`;
    const s = D.PRG.sessions[no - 1];
    return `<li><b>${D.fmtDate(d)}</b> — #${no} ${esc(s.title)}${s.deload ? ' 🟢' : s.test ? ' 🏁' : ''}</li>`;
  }).join('');
  return sheet(`<h3>🗓 Keyingi 12 mashg‘ulot</h3><ul class="plain">${rows}</ul>
    <p class="tiny muted">Taxminiy jadval. Kun o‘tkazib yuborilsa, o‘rningiz yo‘qolmaydi — keyingi mashg‘ulot keyingi kunga suriladi.</p>
    <button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
}

export async function daysSheet() {
  let sel = [...S.db().profile.trainDays];
  const html = () => `<h3>📅 Mashg‘ulot kunlari</h3><p class="muted">3 kun (oralig‘i bilan) yoki 4 kun (3 kun ketma-ket bo‘lmasin). 4 kunlik haftada 3 tasi asosiy mashg‘ulot — dasturni oldinga suradi, 4-si yengil <b>bonus</b>: orqada qolgan mushaklar, yelka, qo‘l, kor va 20 daqiqa yengil kardio. Ba’zan 3 kun borsangiz — hech narsa yo‘qotmaysiz.</p>
    <div class="days">${D.WD.map((n, i) => `<button class="day ${sel.includes(i) ? 'sel' : ''}" data-s="d${i}">${n}</button>`).join('')}</div>
    <p class="${C.daysOk(sel) ? 'ok' : 'warn'}">${C.daysHint(sel)}</p>
    <p class="tiny muted">3 kun</p><div class="col gap">${Object.entries(D.PRG.presets).map(([k, l]) => `<button class="btn left" data-s="p${k}">${esc(l)}</button>`).join('')}</div>
    <p class="tiny muted">4 kun</p><div class="col gap">${Object.entries(C.PRESETS4).map(([k, l]) => `<button class="btn left" data-s="p${k}">${esc(l)}</button>`).join('')}</div>
    <button class="btn primary wide" data-s="save" ${C.daysOk(sel) ? '' : 'disabled'}>Saqlash</button>`;
  return sheet(html(), {
    onClick: async (v, b, wrap) => {
      if (v.startsWith('d')) { const i = Number(v.slice(1)); sel = sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i].sort((a, b) => a - b); }
      else if (v.startsWith('p')) sel = v.slice(1).split(',').map(Number);
      else if (v === 'save' && C.daysOk(sel)) {
        S.db().profile.trainDays = sel; await S.save(); closeSheet(true); toast('✅ Kunlar saqlandi. Dasturdagi o‘rningiz o‘zgarmadi.'); ctx.render(); return;
      }
      wrap.querySelector('.sheet').innerHTML = '<div class="sheet-grip"></div>' + html();
    } });
}

export async function action(a, arg) {
  if (a === 'pl-phase') { openPhase = openPhase === Number(arg) ? -1 : Number(arg); openWeek = null; return ctx.render(); }
  if (a === 'pl-week') { openWeek = openWeek === Number(arg) ? null : Number(arg); return ctx.render(); }
  if (a === 'pl-cal') return calendarSheet();
  if (a === 'pl-days') return daysSheet();
  if (a === 'pl-unswap') { delete S.db().swaps[arg]; await S.save(); toast('Asl mashq qaytarildi'); return ctx.render(); }
}
