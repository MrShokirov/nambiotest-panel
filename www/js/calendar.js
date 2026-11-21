// Month calendar: planned workouts (with exercises), done ✅, missed training days.
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import { ic } from './icons.js';
import { esc, sheet, closeSheet } from './ui.js';
import { sessionSheet } from './records.js';

let ctx = null, monthOffset = 0;
export const init = c => { ctx = c; };
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

// date → session number (core) or 'B' (bonus day)
function plannedMap() {
  const map = {};
  D.schedule(140).forEach(x => { map[D.dateKey(x.d)] = x.role === 'core' ? x.no : 'B'; });
  return map;
}
function doneMap() {
  const map = {};
  for (const s of D.finishedSessions()) (map[D.dateKey(new Date(s.finishedAt))] ||= []).push(s);
  return map;
}

// a planned 4th day is not "missed" when the week already had 3 core sessions
function bonusWeekDone(date, done) {
  const ws = new Date(date); ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
  let core = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(ws.getDate() + i); core += (done[D.dateKey(d)] || []).filter(x => !x.bonus).length; }
  return core >= 3;
}

export function render(root) {
  const db = S.db(), today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const planned = plannedMap(), done = doneMap();
  const created = new Date(db.createdAt || today);
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push('<div class="cday empty"></div>');
  for (let d = 1; d <= days; d++) {
    const date = new Date(first.getFullYear(), first.getMonth(), d), k = D.dateKey(date);
    const isToday = k === D.dateKey(today), past = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dn = done[k], pl = planned[k];
    const missed = past && !dn && db.profile.trainDays.includes((date.getDay() + 6) % 7) && date >= created && !bonusWeekDone(date, done);
    const bonus = pl === 'B';
    const s = pl && !bonus ? D.PRG.sessions[pl - 1] : null;
    cells.push(`<button class="cday ${isToday ? 'today' : ''} ${dn ? 'done' : ''} ${pl ? 'plan' : ''} ${bonus ? 'bonus' : ''} ${missed ? 'missed' : ''} ${s && s.deload ? 'deload' : ''}" data-a="cal-day" data-arg="${k}">
      <b>${d}</b>${dn ? `<i>${dn.some(x => !x.bonus) ? '✅' : '➕'}</i>` : bonus ? '<i>➕</i><small>bonus</small>' : pl ? `<i>#${pl}</i><small>${esc(s.title.split(' · ')[0].split(' ').slice(0, 2).join(' '))}</small>` : missed ? '<i>·</i>' : ''}</button>`);
  }
  const weekNames = D.WD.map(w => `<div class="cwd">${w}</div>`).join('');
  root.innerHTML = `<div class="page"><div class="topbar"><button class="icon" data-a="drawer" aria-label="Menyu">${ic('menu')}</button><b>Kalendar</b><span></span></div>
    <div class="row between calnav"><button class="icon" data-a="cal-prev" aria-label="Oldingi oy">‹</button><h2>${MONTHS[first.getMonth()]} ${first.getFullYear()}</h2><button class="icon" data-a="cal-next" aria-label="Keyingi oy">›</button></div>
    <div class="cal">${weekNames}${cells.join('')}</div>
    <div class="legend"><span><i class="lg done"></i>bajarildi</span><span><i class="lg plan"></i>rejada</span><span><i class="lg missed"></i>o‘tkazildi</span><span><i class="lg bonus"></i>bonus</span><span><i class="lg deload"></i>deload</span></div>
    <p class="tiny muted">Reja — tanlangan kunlaringiz (${db.profile.trainDays.map(i => D.WD[i]).join(' · ')}) bo‘yicha taxmin. Kun o‘tkazilsa, keyingi mashg‘ulotlar o‘zi suriladi.${db.profile.trainDays.length >= 4 ? ' Haftada 3 ta asosiy mashg‘ulot bajarilgan bo‘lsa, o‘tkazilgan bonus kun «qarz» hisoblanmaydi.' : ''}</p>
    ${upcomingList(planned)}</div>`;
}
function upcomingList(planned) {
  const keys = Object.keys(planned).sort().slice(0, 6);
  return `<div class="card"><h3>Yaqin kunlar</h3>${keys.map(k => {
    const no = planned[k];
    if (no === 'B') return `<button class="histrow" data-a="cal-day" data-arg="${k}"><span class="datebox bonus"><b>${new Date(k).getDate()}</b><small>${D.WD[(new Date(k).getDay() + 6) % 7]}</small></span>
      <span class="grow"><b>➕ Bonus mashg‘ulot</b><small>Orqada qolgan mushaklar · yelka · qo‘l · kor · 20 daq kardio</small></span><span>›</span></button>`;
    const s = D.PRG.sessions[no - 1];
    return `<button class="histrow" data-a="cal-day" data-arg="${k}"><span class="datebox"><b>${new Date(k).getDate()}</b><small>${D.WD[(new Date(k).getDay() + 6) % 7]}</small></span>
      <span class="grow"><b>#${no} ${esc(s.title)}</b><small>${D.planForView(no).slice(0, 4).map(e => esc(D.EX[e.key].short.split(' ').slice(0, 2).join(' '))).join(' · ')}…</small></span><span>›</span></button>`;
  }).join('')}</div>`;
}

export function action(a, arg) {
  if (a === 'cal-prev') { monthOffset--; return ctx.render(); }
  if (a === 'cal-next') { monthOffset++; return ctx.render(); }
  if (a === 'cal-day') {
    const done = doneMap()[arg];
    if (done) return sessionSheet(done[0].id);
    const no = plannedMap()[arg];
    if (no === 'B') return sheet(`<h3>${new Date(arg).toLocaleDateString('ru')} — ➕ Bonus</h3><p class="sheet-text">Bu kun dasturni oldinga surmaydi. Ilova o‘sha kuni hafta davomida kam ishlangan mushak guruhlarini, yelka, qo‘l va korni hamda 20 daqiqa yengil (zona-2) kardioni tanlaydi. Kechagi mashg‘ulotga qarab teskari yo‘nalish beriladi — tiklanishga xalaqit bermaydi.</p><p class="tiny muted">Bormasangiz — hech narsa yo‘qolmaydi.</p><button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
    if (!no) return sheet(`<h3>${new Date(arg).toLocaleDateString('ru')}</h3><p class="muted">Dam olish kuni — 45–60 daqiqa yurish tavsiya etiladi 🚶</p><button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
    const s = D.PRG.sessions[no - 1], items = D.planForView(no);
    return sheet(`<h3>${new Date(arg).toLocaleDateString('ru')} — #${no}</h3><p><b>${esc(s.title)}</b> · ${s.phase}-bosqich, ${s.week}-hafta · ~${s.minutes.normal} daq${s.deload ? ' · 🟢 deload' : ''}${s.test ? ' · 🏁 test' : ''}</p>
      <ol class="tl">${items.map(e => `<li><b>${esc(D.EX[e.key].short)}</b><br><small class="muted">${esc(D.scheme(e))}${e.rest ? ` · dam ${e.rest}s` : ''}</small></li>`).join('')}</ol>
      <p class="tiny muted">Vaznlar mashg‘ulot kuni tayyorlik indeksiga qarab aniqlanadi.</p><button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
  }
}
