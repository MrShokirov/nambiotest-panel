// Sokhibjon GYM APP — bootstrap, navigation, onboarding, Today, settings, backup.
import * as S from './store.js';
import * as C from './coach.js';
import * as N from './native.js';
import * as D from './data.js';
import * as W from './workout.js';
import * as L from './library.js';
import * as P from './plan.js';
import * as G from './progress.js';
import * as R from './records.js';
import * as M from './music.js';
import { line, bars, rings, spark } from './charts.js';
import * as K from './calendar.js';
import * as NT from './notify.js';
import { ic } from './icons.js';
import * as MO from './morning.js';
import * as HL from './health.js';
import * as NU from './nutrition.js';
import * as SK from './shakes.js';
import * as HC from './hc.js';
import * as RP from './report.js';
import * as TH from './theme.js';
import * as V from './voice.js';
import { esc, md, sheet, closeSheet, sheetOpen, confirmBox, choose, prompt, toast } from './ui.js';

export const VERSION = '1.1.0';
const root = () => document.getElementById('view');
let route = { name: 'today', arg: null, prev: null };
const TABS = [['today', 'home', 'Bosh sahifa'], ['calendar', 'calendar', 'Kalendar'], ['library', 'book', 'Mashqlar'], ['progress', 'chart', 'Progress'], ['drawer', 'menu', 'Menyu']];
const MENU = [['today', 'home', 'Bosh sahifa'], ['workout-go', 'dumbbell', 'Mashg‘ulot'], ['calendar', 'calendar', 'Kalendar'], ['plan', 'program', 'Dastur (12 oy)'],
  ['library', 'book', 'Mashqlar va videolar'], ['progress', 'chart', 'Progress va grafiklar'], ['workouts', 'list', 'Barcha mashg‘ulotlar'], ['sets', 'sets', 'Barcha setlar'],
  ['steps', 'steps', 'Qadam va masofa'], ['health', 'heart', 'Salomatlik va tahlillar'], ['food', 'food', 'Ovqatlanish'], ['music', 'music', 'Musiqa'], ['data', 'data', 'Barcha ma’lumotlar'], ['settings', 'settings', 'Sozlamalar']];

const ctx = {
  render: () => render(),
  go: (name, arg = null) => { route = { name, arg, prev: route.name === name ? route.prev : route }; window.scrollTo(0, 0); render(true); },
  showExercise: (key, videos = false) => { route = { name: 'exercise', arg: key, videos, prev: route }; window.scrollTo(0, 0); render(true); },
  summary: sid => { route = { name: 'summary', arg: sid, prev: { name: 'today' } }; render(true); },
  duck: () => M.duck(),
  afterFinish: () => NT.reschedule(),
  afterHealth: () => NT.reschedule(),
};

// ───────── rendering ─────────
async function render(anim = false) {
  const db = S.db();
  const el = root();
  const nav = document.getElementById('nav');
  if (!db.profile.onboarded) { nav.hidden = true; return onboarding(el); }
  const inWorkout = !!W.active();
  if (inWorkout && !['exercise'].includes(route.name)) route = { name: 'workout', prev: null };
  if (!inWorkout && route.name === 'workout') route = { name: 'today', prev: null };
  nav.hidden = ['workout', 'exercise', 'summary'].includes(route.name);
  document.body.classList.toggle('in-workout', route.name === 'workout');
  const ti = TABS.findIndex(t => t[0] === route.name);
  nav.style.setProperty('--ti', ti < 0 ? -1 : ti);
  nav.classList.toggle('noind', ti < 0);
  if (!nav.firstElementChild) nav.innerHTML = '<i class="tab-ind"></i>' + TABS.map(([k, i, l]) => `<button class="tab" data-a="${k === 'drawer' ? 'drawer' : 'tab'}" data-arg="${k}">${ic(i)}<small>${l}</small></button>`).join('');
  nav.querySelectorAll('.tab').forEach((b, i) => b.classList.toggle('sel', i === ti));
  if (anim) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
  switch (route.name) {
    case 'workout': W.render(el); el.querySelector('.workout')?.insertAdjacentHTML('beforeend', M.miniHtml()); return;
    case 'workouts': return R.workoutsPage(el);
    case 'sets': return R.setsPage(el);
    case 'steps': return R.stepsPage(el);
    case 'data': return R.dataPage(el);
    case 'music': return M.render(el);
    case 'calendar': return K.render(el);
    case 'exercise': return L.renderDetail(el, route.arg, route.videos);
    case 'summary': el.innerHTML = `<div class="page"><div class="center-card celebrate">${W.summaryHtml(route.arg)}
        <button class="btn primary wide xl" data-a="tab" data-arg="today">🏠 Bosh sahifa</button>
        <button class="btn wide" data-a="tab" data-arg="food">🥤 Tiklovchi kokteyl retsepti</button></div></div>`; return confetti();
    case 'plan': return P.render(el);
    case 'library': return L.renderList(el);
    case 'progress': return G.render(el);
    case 'settings': return settings(el);
    case 'health': return HL.render(el);
    case 'food': return NU.render(el);
    case 'shake': return SK.render(el);
    default: return today(el);
  }
}

function confetti() {
  const c = document.createElement('div'); c.className = 'confetti';
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + '%'; s.style.animationDelay = Math.random() * 0.6 + 's';
    s.style.background = ['var(--accent)', '#ffd166', '#3a7bff', '#ef476f'][i % 4];
    s.style.setProperty('--x', Math.random().toFixed(2));
    c.appendChild(s);
  }
  document.body.appendChild(c); setTimeout(() => c.remove(), 2600);
  N.buzz();
}

// ───────── Today ─────────
function startMode() {
  const p = S.db().profile;
  return p.equipment === 'dumbbell' ? 'travel' : p.sessionMin <= 50 ? 'short' : 'normal';
}
let liftSel = null;
function today(el) {
  const db = S.db(), p = db.profile;
  const no = db.nextSession;
  const h = new Date().getHours();
  const hello = h < 5 ? 'Xayrli tun' : h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech';
  const st = R.stats();
  const s = D.PRG.sessions[Math.min(no, D.TOTAL()) - 1], mode = startMode();
  const r = D.readinessToday();
  const ri = r && r.inputs ? C.readinessIndex(r.inputs) : null;
  const role = D.todayRole();
  const tp = D.todaysPlan(ri && ri.mode === 'short' ? 'short' : mode, true, role);
  const { plan, changes } = tp;
  const factor = D.todayFactor();
  const sch = D.schedule(7);
  const cal = sch.filter(x => x.role === 'core');
  const next = cal[0];
  const wi = D.weekInfo();
  const isToday = next && D.dateKey(next.d) === D.dateKey();
  const since = D.daysSinceLast();
  const strip = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const planned = sch.find(c => D.dateKey(c.d) === D.dateKey(d));
    const done = D.finishedSessions().some(x => D.dateKey(new Date(x.finishedAt)) === D.dateKey(d));
    strip.push(`<div class="sday ${planned ? 'train' : ''} ${planned && planned.role === 'bonus' ? 'bonus' : ''} ${i === 0 ? 'today' : ''} ${done ? 'done' : ''}"><small>${D.WD[(d.getDay() + 6) % 7]}</small><b>${d.getDate()}</b><i></i></div>`);
  }
  const notes = [];
  if (since === 0) notes.push('✅ Bugungi mashg‘ulot bajarildi. Mushak dam olganda o‘sadi.');
  if (s.deload) notes.push('🟢 Yengil (deload) hafta: vaznlar ~60%, maqsad — tiklanish.');
  if (s.test) notes.push(md(D.TX.testDay));
  const body = [...db.body].sort((a, b) => a.date.localeCompare(b.date));
  const lastW = body[body.length - 1];
  const wDays = lastW ? Math.round((Date.now() - Date.parse(lastW.date)) / 86400000) : 99;
  const trend = C.weightTrend(body, p.goal);
  const needBackup = db.sessions.some(x => x.finishedAt) && (!db.lastBackup || (Date.now() - Date.parse(db.lastBackup)) > 7 * 86400000);
  // charts
  const lifts = ['squat', 'bench', 'rdl', 'leg_press', 'pulldown', 'goblet', 'db_bench', 'ohp_db', 'hip_thrust', 'bb_row'];
  const fin = [...D.finishedSessions()].reverse();
  const series = {};
  for (const k of lifts) {
    const v = [];
    for (const f of fin) { if (f.deload) continue; const b = Math.max(0, ...db.sets.filter(x => x.sid === f.id && x.key === k).map(x => C.e1rm(x.w, x.r) || 0)); if (b) v.push(b); }
    if (v.length) series[k] = v;
  }
  const avail = Object.keys(series);
  if (!liftSel || !series[liftSel]) liftSel = avail.sort((a, b) => series[b].length - series[a].length)[0];
  const wv = R.weeklyVolume(8), ss = R.stepsSeries(14);
  const stepGoal = D.stepGoal(s.week);
  const ringPct = ri ? ri.score : 0;
  el.innerHTML = `<div class="page dash">
    <header class="hello"><button class="icon" data-a="drawer" aria-label="Menyu">${ic('menu')}</button>
      <div class="grow"><small class="eyebrow">${DAYS_UZ[(new Date().getDay() + 6) % 7]}, ${new Date().getDate()}-${MONTHS_UZ[new Date().getMonth()]}</small><h1 class="h1">${hello}${p.name ? ',<br>' + esc(p.name) : ''}</h1></div>
      <button class="icon theme-btn" data-a="theme-cycle" aria-label="Mavzu">${TH.resolved() === 'light' ? '☾' : '☀︎'}</button></header>
    <div class="strip">${strip.join('')}</div>
    <div class="card ring-card" data-a="tab" data-arg="progress">
      ${rings([{ value: wi.core / 3, color: 'var(--c-train)' }, { value: st.stepsToday / stepGoal, color: 'var(--c-steps)' }, { value: NU.todayRingValue(), color: 'var(--c-food)' }], 124)}
      <div class="ring-legend">
        <div style="--c:var(--c-train)"><small>Mashg‘ulot</small><b>${wi.core}<i>/3 hafta</i></b></div>
        <div style="--c:var(--c-steps)"><small>Qadam</small><b>${st.stepsToday.toLocaleString('ru')}<i>/${(stepGoal / 1000).toFixed(0)}k</i></b></div>
        <div style="--c:var(--c-food)"><small>Oqsil</small><b>${Math.round(NU.totals().p)}<i>/${NU.targets().protein} g</i></b></div>
      </div></div>
    ${MO.cardHtml()}
    ${no > D.TOTAL() ? '<div class="card hero"><h2>🎉 12 oylik dastur tugadi!</h2><p>Sozlamalar → Dasturni boshidan boshlash.</p></div>' : `
    <div class="card hero ${tp.bonus ? 'bonus' : ''}">
      <div class="row between">${tp.bonus ? '<span class="pill bonus">➕ Bonus kun</span>' : `<span class="pill">${s.phase}-bosqich · ${s.week}-hafta</span>`}<span class="muted">${tp.bonus ? `keyingi asosiy: #${no}` : `#${no}/${D.TOTAL()}`}</span></div>
      <div class="row gap center-y"><div class="grow"><h2>${esc(tp.bonus ? tp.title : s.title)}</h2>
        <p class="muted">${tp.bonus ? '' : isToday ? '📍 Bugun mashg‘ulot kuni · ' : next ? `📍 Keyingi: ${D.fmtDate(next.d)} · ` : ''}⏱ ~${tp.bonus ? tp.minutes : s.minutes[mode === 'short' ? 'short' : 'normal']} daq · bu hafta ${wi.core}/3${wi.bonus ? ` + ${wi.bonus} bonus` : ''}</p></div>
        ${ri ? `<button class="ri ${ri.level}" data-a="ri-show" style="--p:${ringPct / 100}"><b>${ri.score}</b><small>tayyorlik</small></button>` : `<button class="ri none" data-a="ri-check"><b>?</b><small>tayyorlik</small></button>`}</div>
      ${ri ? `<p class="note">${C.LEVEL_TEXT[ri.level]}</p>` : '<p class="note">☀️ Boshlashdan oldin 4 ta savol: uyqu, kuch, og‘riq, qadam — ilova bugungi rejani shunga moslaydi.</p>'}
      ${changes.length ? `<details class="note"><summary>🧠 Bugun moslashtirildi (${changes.length})</summary><ul class="tl">${changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
      ${notes.map(n => `<p class="note">${n}</p>`).join('')}
      <ol class="plan">${plan.map(it => {
        const sg = D.suggestion(it, factor);
        const wv = sg.weight ?? (D.EX[it.key].unit === 'reps' && sg.draftW ? sg.draftW : null);
        return `<li class="${it.comp ? 'comp' : ''}"><span>${esc(D.EX[it.key].short)}${it.comp ? ' <em>+kompensatsiya</em>' : ''}</span><small>${esc(D.scheme(it))}${wv != null ? ` · <b>${sg.weight == null ? '~' : ''}${D.fmtW(wv)} kg</b>` : ''}${sg.pain ? ' ⚠️' : ''}</small></li>`;
      }).join('')}</ol>
      ${ri && ri.level === 'rest' ? `<button class="btn primary wide xl" data-a="rest-day">🚶 Bugun dam olaman</button><button class="btn wide" data-a="start" data-arg="short">Baribir qisqa mashg‘ulot</button>`
        : `<button class="btn primary wide xl pulse" data-a="start" data-arg="${ri && ri.mode === 'short' ? 'short' : mode}">▶️ Boshlash</button>`}
      <div class="row gap"><button class="btn grow" data-a="quicklog" data-arg="${ri && ri.mode === 'short' ? 'short' : mode}">✅ Bajardim</button>
        <button class="btn grow" data-a="time-pick">⏱ ${D.todayMinutes() ? D.todayMinutes() + ' daq' : 'Vaqtim'}</button></div>
      <details class="more"><summary>Boshqa variantlar</summary><div class="more-b">
        ${mode !== 'short' ? '<button class="btn" data-a="start" data-arg="short">⚡ Qisqa rejim</button>' : '<button class="btn" data-a="start" data-arg="normal">🏋️ To‘liq rejim</button>'}
        ${mode !== 'travel' ? '<button class="btn" data-a="start" data-arg="travel">🏨 Faqat gantel</button>' : '<button class="btn" data-a="start" data-arg="normal">🏋️ Zal</button>'}
        ${ri ? '<button class="btn" data-a="start-full">💪 Baribir to‘liq</button>' : ''}
        ${tp.bonus ? '<button class="btn" data-a="role-core">⏭ Asosiy #' + no + ' ni qilaman</button>'
          : role.forced || (p.trainDays.length >= 4 && wi.core >= 1) ? '<button class="btn" data-a="role-bonus">➕ Yengil bonus qilaman</button>' : ''}
      </div></details>
    </div>`}
    <div class="tiles">
      <button class="tile" style="--c:var(--c-train)" data-a="tab" data-arg="workouts"><i class="tdot"></i><small>Mashg‘ulot</small><b>${st.workouts}</b></button>
      <button class="tile" style="--c:var(--c-strength)" data-a="tab" data-arg="sets"><i class="tdot"></i><small>Setlar</small><b>${st.sets}</b></button>
      <button class="tile" style="--c:var(--c-bonus)" data-a="tab" data-arg="data"><i class="tdot"></i><small>Ko‘tarilgan</small><b>${st.volume >= 10000 ? (st.volume / 1000).toFixed(1) + ' t' : Math.round(st.volume) + ' kg'}</b></button>
      <button class="tile" style="--c:var(--c-mind)" data-a="tab" data-arg="progress"><i class="tdot"></i><small>Seriya</small><b>🔥 ${st.streak}<i> hafta</i></b></button>
      <button class="tile" style="--c:var(--c-steps)" data-a="tab" data-arg="steps"><i class="tdot"></i><small>7 kunda</small><b>${st.km7.toFixed(1)}<i> km</i></b>${spark(ss.values.slice(-7), 'var(--c-steps)')}</button>
      ${HC.on() && HC.sleepLast() != null ? `<button class="tile" style="--c:var(--c-sleep)" data-a="tab" data-arg="steps"><i class="tdot"></i><small>Uyqu</small><b>${HC.sleepLast()}<i> soat</i></b>${spark(HC.series('sleep', 7).values, 'var(--c-sleep)')}</button>`
        : `<button class="tile" style="--c:var(--c-food)" data-a="tab" data-arg="food"><i class="tdot"></i><small>Suv bugun</small><b>${(NU.totals().water / 1000).toFixed(1)}<i> L</i></b></button>`}
    </div>
    ${wDays >= 10 ? `<button class="card linkcard" data-a="pr-weight">⚖️ Vaznni kiritish vaqti (${lastW ? `oxirgisi ${wDays} kun oldin` : 'hali yo‘q'}) — har 1–2 haftada</button>` : ''}
    <div class="card"><h3><i class="hdot" style="--c:var(--c-strength)"></i>Kuch</h3>
      ${avail.length ? `<p class="insight">${strengthInsight(series[liftSel])}</p><div class="chips">${avail.map(k => `<button class="chipbtn ${k === liftSel ? 'sel' : ''}" data-a="dash-lift" data-arg="${k}">${esc(D.EX[k].short.split(' ').slice(0, 2).join(' '))}</button>`).join('')}</div>${line(series[liftSel], { unit: ' kg', color: 'var(--c-strength)' })}` : '<p class="muted tiny chart-empty">Birinchi mashg‘ulotlardan keyin kuchingiz o‘sishi shu yerda ko‘rinadi.</p>'}</div>
    <div class="card"><div class="row between"><h3><i class="hdot" style="--c:var(--c-weight)"></i>Vazn</h3><button class="btn small" data-a="pr-weight">+ Kiritish</button></div>
      <p class="insight">${weightInsight(body, trend)}</p>
      ${line(body.map(b => b.weight), { labels: body.map(b => b.date.slice(5).split('-').reverse().join('.')), unit: ' kg', color: 'var(--c-weight)' })}</div>
    <div class="card"><h3><i class="hdot" style="--c:var(--c-train)"></i>Haftalik ish hajmi</h3><p class="insight">${volumeInsight(wv.values)}</p>${bars(wv.values, { labels: wv.labels, unit: ' kg', color: 'var(--c-train)' })}</div>
    <div class="card"><div class="row between"><h3><i class="hdot" style="--c:var(--c-steps)"></i>Qadamlar${HC.on() ? ' <span class="pill tiny-pill">⌚ soatdan</span>' : ''}</h3><button class="btn small" data-a="rec-steps" data-arg="0">+ Bugun</button></div><p class="insight">${stepsInsight(ss.values, stepGoal)}</p>${bars(ss.values, { labels: ss.labels, goal: stepGoal, color: 'var(--c-steps)' })}</div>
    ${watchCards()}
    <div class="quick">
      <button class="qcard" style="--c:var(--c-food)" data-a="tab" data-arg="food"><span>🥗</span><b>Ovqatlanish</b><small>${Math.round(NU.totals().p)} g oqsil bugun</small></button>
      <button class="qcard" style="--c:var(--c-health)" data-a="tab" data-arg="health"><span>🩺</span><b>Salomatlik</b><small>TMI, bosim, tahlillar</small></button>
      <button class="qcard" style="--c:var(--c-weight)" data-a="report"><span>📄</span><b>Oylik PDF</b><small>hisobot ulashish</small></button>
    </div>
    <div class="card"><div class="row between"><h3><i class="hdot" style="--c:var(--c-train)"></i>Oxirgi mashg‘ulotlar</h3><button class="btn small" data-a="tab" data-arg="workouts">Barchasi →</button></div>
      ${D.finishedSessions().slice(0, 4).map(f => `<button class="histrow" data-a="rec-sess" data-arg="${f.id}"><span class="grow"><b>${esc(D.sessLabel(f))}</b><small>${new Date(f.finishedAt).toLocaleDateString('ru')} · ${db.sets.filter(x => x.sid === f.id).length} set · RPE ${f.rpe || '—'}</small></span><span>›</span></button>`).join('') || '<p class="muted tiny">Hali yo‘q.</p>'}</div>
    ${!db.sessions.some(x => x.finishedAt) ? `<button class="card linkcard" data-a="day1">📘 Zalda birinchi kun — o‘qing</button>` : ''}
    ${needBackup ? `<button class="card linkcard warncard" data-a="backup">💾 Zaxirani Google Drive'ga yuboring (haftada 1 marta)</button>` : ''}
    <p class="tiny muted center">⚕️ Ko‘krakda og‘riq, nafas qisishi yoki bosh aylanishi — darhol to‘xtang, 103.</p>
  </div>`;
}

const DAYS_UZ = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
// sleep + resting heart-rate cards (only when the watch data exists)
function watchCards() {
  if (!HC.on()) return '';
  const sl = HC.series('sleep', 14), hr = HC.series('hr', 14), r = HC.restHr();
  const sv = sl.values.filter(v => v != null), hv = hr.values.filter(v => v != null);
  const avgS = sv.length ? (sv.reduce((a, b) => a + b, 0) / sv.length).toFixed(1) : null;
  return `${sv.length >= 2 ? `<div class="card"><h3><i class="hdot" style="--c:var(--c-sleep)"></i>Uyqu</h3><p class="insight">${avgS >= 7 ? `O‘rtacha <b>${avgS} soat</b> — tiklanish uchun yaxshi.` : `O‘rtacha ${avgS} soat — 7+ soat mushak o‘sishi uchun muhim.`}</p>${bars(sl.values.map(v => v || 0), { labels: sl.labels, goal: 7, unit: ' s', color: 'var(--c-sleep)' })}</div>` : ''}
    ${hv.length >= 2 ? `<div class="card"><h3><i class="hdot" style="--c:var(--c-health)"></i>Tinch puls</h3><p class="insight">${r.delta != null && r.delta >= 5 ? `Bugun odatdagidan <b>+${r.delta}</b> — tiklanish to‘liq emas, yengilroq mashq qiling.` : r.today ? `Bugun ${r.today} zarba/daq — me’yorida.` : 'Pasayib borishi — chidamlilik oshayotganini bildiradi.'}</p>${line(hv, { unit: '', color: 'var(--c-health)' })}</div>` : ''}`;
}

// One plain sentence above every chart.
const pctTxt = p => `${p >= 0 ? '+' : ''}${Math.round(p)}%`;
function strengthInsight(v) {
  if (!v || v.length < 2) return 'Yana bitta mashg‘ulotdan keyin o‘sish ko‘rinadi.';
  const p = (v[v.length - 1] - v[0]) / v[0] * 100;
  return p > 1 ? `Boshlagandan beri kuchingiz <b>${pctTxt(p)}</b> oshdi 💪` : p < -3 ? `Biroz pasaygan (${pctTxt(p)}) — uyqu va ovqatga e’tibor bering.` : 'Hozircha barqaror — algoritm keyingi qadamni tanlaydi.';
}
function weightInsight(body, trend) {
  if (body.length < 2) return 'Har 1–2 haftada vazn kiritsangiz, o‘zgarish shu yerda ko‘rinadi.';
  const d = body[body.length - 1].weight - body[0].weight;
  const weeks = Math.max(1, Math.round((Date.parse(body[body.length - 1].date) - Date.parse(body[0].date)) / 604800000));
  return `${weeks} haftada <b>${d > 0 ? '+' : ''}${d.toFixed(1)} kg</b>` + (trend.enough && trend.advice ? ` — ${trend.kcalDelta ? '⚠️ ' : ''}${trend.advice.replace(/^Trend maqsadga mos:.*$/, 'maqsadga mos ✅')}` : '');
}
function volumeInsight(v) {
  const cur = v[v.length - 1], prev = v[v.length - 2];
  if (!cur && !prev) return 'Bajarilgan barcha setlar (vazn × takror) yig‘indisi — mehnatingiz o‘lchovi.';
  if (!prev) return `Bu hafta <b>${cur.toLocaleString('ru')} kg</b> ko‘tardingiz.`;
  return `Bu hafta <b>${cur.toLocaleString('ru')} kg</b> — o‘tgan haftadan ${pctTxt((cur - prev) / prev * 100)}.`;
}
function stepsInsight(v, goal) {
  const last7 = v.slice(-7).filter(Boolean);
  if (!last7.length) return 'Qadamlarni kiritsangiz, kunlik maqsad bilan solishtiriladi.';
  const avg = Math.round(last7.reduce((a, b) => a + b, 0) / last7.length);
  return `O‘rtacha <b>${avg.toLocaleString('ru')}</b> qadam/kun · maqsad ${goal.toLocaleString('ru')} ${avg >= goal ? '✅' : ''}`;
}

async function readinessFlow() {
  if (HC.on()) await HC.sync(true).catch(() => null);
  const watchSleep = HC.sleepLast();
  const sleep = watchSleep != null ? String(watchSleep)
    : await choose('😴 Kecha necha soat uxladingiz?', [['4.5', '5 soatdan kam'], ['5.5', '5–6 soat'], ['6.5', '6–7 soat'], ['7.5', '7–8 soat'], ['8.5', '8+ soat']]);
  if (!sleep) return null;
  if (watchSleep != null) toast(`⌚ Soatdan: ${watchSleep} soat uyqu`);
  const energy = await choose('⚡ Hozir kuch-quvvatingiz?', [['0', '😴 Past'], ['1', '🙂 Normal'], ['2', '⚡ Zo‘r']]);
  if (!energy) return null;
  const sore = await choose('🔥 Mushaklar og‘riyaptimi (krepatura)?', [['none', '✅ Yo‘q'], ['legs', '🦵 Oyoqlar'], ['upper', '💪 Yuqori tana'], ['whole', '🔥 Butun tana']]);
  if (!sore) return null;
  const db = S.db();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (db.steps[D.dateKey(y)] == null) {
    const st = await choose('🚶 Kecha qancha yurdingiz?', [['4000', '5 mingdan kam qadam'], ['7500', '5–10 ming'], ['12500', '10–15 ming'], ['17000', '15 mingdan ko‘p'], ['skip', 'Bilmayman']]);
    if (st && st !== 'skip') db.steps[D.dateKey(y)] = Number(st);
  }
  const ans = { sleep: Number(sleep), energy: Number(energy), soreness: sore, hrDelta: HC.restHr().delta, sleepSrc: watchSleep != null ? 'watch' : 'manual' };
  const inputs = D.readinessInputs(ans);
  const ri = C.readinessIndex(inputs);
  db.readiness[D.dateKey()] = { ...ans, inputs, index: ri.score, score: ri.level === 'green' ? 'green' : ri.level === 'yellow' ? 'yellow' : 'red', factor: ri.factor, level: ri.level };
  await S.save();
  return ri;
}
function riSheet(ri) {
  const { changes } = D.todaysPlan(ri.mode === 'short' ? 'short' : startMode());
  return sheet(`<div class="center-card"><div class="ri big ${ri.level}" style="--p:${ri.score / 100}"><b>${ri.score}</b><small>/100</small></div>
    <p><b>${C.LEVEL_TEXT[ri.level]}</b></p></div>
    ${ri.reasons.length ? `<h3>Nega?</h3><ul class="tl">${ri.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Hamma ko‘rsatkichlar yaxshi 👍</p>'}
    ${changes.length ? `<h3>Bugungi reja qanday o‘zgaradi</h3><ul class="tl">${changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <p class="tiny muted">Indeks: uyqu, uyqu qarzi, kuch-quvvat, krepatura, kechagi qadamlar, oxirgi mashg‘ulot og‘irligi, dam olgan kunlar va og‘riq yozuvlaridan hisoblanadi.</p>
    <button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
}

// ───────── onboarding ─────────
let ob = null;
function onboarding(el) {
  const p = S.db().profile;
  if (!ob) ob = { step: 0, d: { ...p } };
  const d = ob.d;
  const steps = [
    () => `<div class="ob-hero"><img class="logo-xl" src="img/logo.svg" alt=""><h1>Sokhibjon<br>GYM APP</h1>
      <p class="muted">Shaxsiy murabbiyingiz: 12 oylik ilmiy dastur, bosqichma-bosqich mashg‘ulot, aqlli vazn tavsiyasi. Internetsiz ishlaydi.</p></div>
      <button class="btn primary wide xl" data-a="ob-next">Boshladik →</button>`,
    () => `<h2>Siz haqingizda</h2><p class="muted">Raqamlar vazn tavsiyasi va ovqat hisobini aniq qiladi.</p>
      <label class="field">Ismingiz<input class="input" id="ob-name" value="${esc(d.name)}" placeholder="Sokhibjon"></label>
      <div class="grid3"><label class="field">Yosh<input class="input" id="ob-age" type="number" inputmode="numeric" value="${d.age}"></label>
      <label class="field">Bo‘y (sm)<input class="input" id="ob-height" type="number" inputmode="decimal" value="${d.height}"></label>
      <label class="field">Vazn (kg)<input class="input" id="ob-weight" type="number" inputmode="decimal" value="${d.weight}"></label></div>
      <p class="warn" id="ob-err" hidden></p><button class="btn primary wide xl" data-a="ob-body">Davom →</button>`,
    () => pick('Zalda tajribangiz?', 'experience', [['beginner', 'Yangi boshlovchi (0–3 oy)'], ['novice', 'Biroz tajriba (3–12 oy)'], ['intermediate', 'Tajribali (1 yildan ko‘p)']]),
    () => pick('Asosiy maqsad?', 'goal', [['recomp', 'Mushak + yog‘ yo‘qotish', 'Boshlovchi uchun eng samarali'], ['fatloss', 'Asosan yog‘ yo‘qotish'], ['muscle', 'Asosan mushak yig‘ish']]),
    () => pick('Qanday jihoz bor?', 'equipment', [['gym', 'To‘liq jihozlangan zal'], ['dumbbell', 'Faqat gantel + skameyka']]),
    () => pick('Bitta mashg‘ulotga vaqt?', 'sessionMin', [[45, '45 daqiqa', 'Qisqa rejim avtomatik'], [60, '60 daqiqa'], [75, '75 daqiqa'], [90, '90 daqiqa']]),
    () => `<h2>Qaysi kunlari?</h2><p class="muted">3 yoki 4 kun. 4 kun bo‘lsa — 3 tasi asosiy, 4-si yengil bonus (ba’zan 3 kun borsangiz ham qarz bo‘lmaydi).</p>
      <div class="days">${D.WD.map((n, i) => `<button class="day ${d.trainDays.includes(i) ? 'sel' : ''}" data-a="ob-day" data-arg="${i}">${n}</button>`).join('')}</div>
      <p class="${C.daysOk(d.trainDays) ? 'ok' : 'warn'} tiny">${C.daysHint(d.trainDays)}</p>
      <div class="col gap">${[...Object.entries(D.PRG.presets).slice(0, 2), ...Object.entries(C.PRESETS4).slice(0, 2)].map(([k, l]) => `<button class="btn left" data-a="ob-preset" data-arg="${k}">${esc(l)}${k.split(',').length === 4 ? ' <small>4 kun</small>' : ''}</button>`).join('')}</div>
      <button class="btn primary wide xl" data-a="ob-days" ${C.daysOk(d.trainDays) ? '' : 'disabled'}>Davom →</button>`,
    () => `<h2>⌚ Soat va bildirishnomalar</h2><p>Dam olish taymeri tugaganda ilova bildirishnoma yuboradi — telefon qulflangan bo‘lsa ham. Huawei Health ilovasi uni <b>Watch GT 6 Pro</b>ga uzatadi va soat titraydi.</p>
      <p class="muted tiny">Keyingi oynada «Ruxsat berish»ni bosing.</p>
      <button class="btn primary wide xl" data-a="ob-notif">Ruxsat berish →</button>`,
    () => {
      const t = C.targets(d);
      const exp = d.experience === 'intermediate' && S.db().nextSession === 1;
      return `<h2>✅ Tayyor!</h2><div class="card"><p>👤 ${d.age} yosh · ${d.height} sm · ${d.weight} kg</p><p>🎯 ${esc(D.TX.goalName[d.goal])}</p>
        <p>📅 ${d.trainDays.map(i => D.WD[i]).join(' · ')} · ~${d.sessionMin} daqiqa</p>
        <p>🍗 Taxminan ${t.kcal} kkal, oqsil ${t.protein} g kuniga <small class="muted">(taxminiy)</small></p></div>
        ${exp ? '<button class="btn wide" data-a="ob-finish" data-arg="13">⏩ 2-bosqichdan boshlash (#13)</button>' : ''}
        <button class="btn primary wide xl" data-a="ob-finish">Boshlash 💪</button>`;
    },
  ];
  el.innerHTML = `<div class="page onboarding"><div class="ob-progress"><i style="width:${(ob.step / (steps.length - 1)) * 100}%"></i></div>
    ${ob.step ? '<button class="icon back-ob" data-a="ob-back" aria-label="Orqaga">←</button>' : ''}<div class="ob-step enter">${steps[ob.step]()}</div></div>`;
  function pick(title, field, opts) {
    return `<h2>${title}</h2><div class="col gap">${opts.map(([v, l, sub]) => `<button class="btn left big ${String(d[field]) === String(v) ? 'sel' : ''}" data-a="ob-pick" data-arg="${field}|${v}">${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('')}</div>`;
  }
}
async function obAction(a, arg) {
  const d = ob.d;
  if (a === 'ob-next') ob.step++;
  if (a === 'ob-back') ob.step = Math.max(0, ob.step - 1);
  if (a === 'ob-body') {
    const age = parseInt(document.getElementById('ob-age').value, 10);
    const height = parseFloat(document.getElementById('ob-height').value.replace(',', '.'));
    const weight = parseFloat(document.getElementById('ob-weight').value.replace(',', '.'));
    const err = document.getElementById('ob-err');
    if (!(age >= 14 && age <= 90 && height >= 130 && height <= 230 && weight >= 35 && weight <= 250)) {
      err.hidden = false; err.textContent = 'Qiymatlarni tekshiring: yosh 14–90, bo‘y 130–230 sm, vazn 35–250 kg.'; return;
    }
    Object.assign(d, { age, height, weight, name: document.getElementById('ob-name').value.trim().slice(0, 30) });
    ob.step++;
  }
  if (a === 'ob-pick') { const [f, v] = arg.split('|'); d[f] = f === 'sessionMin' ? Number(v) : v; ob.step++; }
  if (a === 'ob-day') { const i = Number(arg); d.trainDays = d.trainDays.includes(i) ? d.trainDays.filter(x => x !== i) : [...d.trainDays, i].sort(); }
  if (a === 'ob-preset') d.trainDays = arg.split(',').map(Number);
  if (a === 'ob-days' && C.daysOk(d.trainDays)) ob.step++;
  if (a === 'ob-notif') { await N.initNotifications(); ob.step++; }
  if (a === 'ob-finish') {
    const db = S.db();
    Object.assign(db.profile, d, { onboarded: true });
    if (arg === '13' && db.nextSession === 1) db.nextSession = 13;
    if (!db.body.length) db.body.push({ date: D.dateKey(), weight: d.weight });
    if (!db.profile.startedAt) db.profile.startedAt = new Date().toISOString();
    await S.save();
    ob = null;
    route = { name: 'today' };
    toast('✅ Profil saqlandi');
  }
  render(true);
}

// ───────── settings / backup ─────────
function settings(el) {
  const db = S.db(), p = db.profile, t = C.targets(p);
  const tg = (k, l, sub) => `<button class="toggle ${p[k] ? 'on' : ''}" data-a="set-toggle" data-arg="${k}"><span><b>${l}</b><small>${sub}</small></span><i></i></button>`;
  el.innerHTML = `<div class="page"><div class="topbar"><button class="icon" data-a="drawer" aria-label="Menyu">${ic('menu')}</button><b>Sozlamalar</b><span></span></div>
    <div class="card"><h3>🎨 Ko‘rinish</h3><p class="tiny muted">«Avto» — telefon kun/tun rejimiga ergashadi.</p>${TH.segHtml('theme')}</div>
    <div class="card"><div class="row between"><h3>👤 Profil</h3><button class="btn small" data-a="set-profile">Tahrirlash</button></div>
      <p>${esc(p.name || '—')} · ${p.age} yosh · ${p.height} sm · ${p.weight} kg</p>
      <p class="muted tiny">${esc(D.TX.goalName[p.goal])} · ${p.trainDays.map(i => D.WD[i]).join(' · ')} · ~${p.sessionMin} daqiqa</p>
      <p class="muted tiny">Taxminiy maqsad: ${t.kcal} kkal, oqsil ${t.protein} g, suv ${(t.water / 1000).toFixed(1)} L</p></div>
    <div class="card"><h3>🏋️ Mashg‘ulot</h3>
      ${tg('sound', '🔔 Ovoz', 'Taymer tugaganda signal')}${tg('vibrate', '📳 Titrash', 'Telefon titraydi')}${tg('keepAwake', '💡 Ekran o‘chmasin', 'Mashg‘ulot paytida')}<button class="toggle ${p.logMode === 'detailed' ? 'on' : ''}" data-a="set-logmode"><span><b>📝 Batafsil rejim</b><small>Har set uchun vazn va takrorni alohida kiritish (odatda shart emas)</small></span><i></i></button>${tg('prehabOn', '🛡 Himoya bloki', 'Qizishdan keyin 3–5 daqiqa (shikastlanish profilaktikasi)')}
      <button class="btn wide" data-a="set-warm">🔥 Qizish: ${p.warmupMin || 7} daqiqa</button></div>
    <div class="card"><div class="row between"><h3>🏗 Zalimdagi jihozlar</h3><button class="btn small" data-a="set-equip">Tahrirlash</button></div>
      <p class="tiny muted">${(p.missing || []).length ? 'Yo‘q: ' + esc((p.missing || []).map(k => C.EQUIP[k]).join(', ')) + ' — bu jihozdagi mashqlar avtomatik almashtiriladi.' : 'Hamma jihoz bor deb hisoblanadi. Zalda yo‘g‘ini o‘chirib qo‘ying.'}</p></div>
    <div class="card"><h3>🔔 Bildirishnomalar</h3>
      ${tg('remindOn', '🏋️ Mashg‘ulot kuni eslatmasi', 'Tanlangan kunlarda')}<button class="btn wide" data-a="set-rtime">⏰ Eslatma vaqti: ${p.remindTime || '08:00'}</button>
      ${tg('weeklyOn', '📊 Haftalik xulosa', 'Yakshanba 20:00')}
      ${tg('morningOn', '🌅 Ertalabki 3 daqiqa', 'Tos tubi (Kegel) mashqi — yo‘naltiruvchi taymer, avtomatik yoziladi')}
      ${p.morningOn ? `<button class="btn wide" data-a="set-mtime">🌅 Ertalabki eslatma: ${p.morningTime || '07:00'}</button>` : ''}<button class="btn ghost wide" data-a="weekly">👁 Haftalik xulosani hozir ko‘rish</button></div>
    <div class="card"><h3>⌚ Huawei Watch GT 6 Pro</h3>
      <p class="tiny muted">1) Taymer tugaganda soat titraydi (bildirishnoma). 2) Qadam, uyqu va puls — Health Connect orqali ilovaga avtomatik keladi.</p>
      <button class="btn wide" data-a="set-testwatch">🔔 Soatni sinash (bildirishnoma yuborish)</button>
      <button class="btn wide ghost" data-a="set-exact">⏰ Aniq taymer ruxsatini tekshirish</button>
      <details><summary>Soatda titrashi uchun sozlash</summary><ol class="tl">
        <li>Telefonda <b>Huawei Health</b> → Qurilmalar → Watch GT 6 Pro → <b>Bildirishnomalar</b> → yoqing.</li>
        <li>Ro‘yxatdan <b>Sokhibjon GYM</b> ilovasini toping va yoqing.</li>
        <li>Telefon sozlamalari → Ilovalar → Sokhibjon GYM → Batareya → <b>Cheklovsiz</b> (taymer kechikmasligi uchun).</li>
        <li>«Soatni sinash» tugmasini bosing — 2 soniyada soat titrashi kerak.</li></ol></details></div>
    <div class="card"><h3>❤️ Qadam · uyqu · puls (Health Connect)</h3>
      ${HC.on() ? `<p class="ok tiny">✅ Ulangan${db.hcLast ? ' · oxirgi sinxron ' + new Date(db.hcLast).toLocaleString('ru').slice(0, 17) : ''}</p>
        <div class="row gap"><button class="btn grow" data-a="hc-sync">🔄 Hozir yangilash</button><button class="btn grow" data-a="hc-settings">⚙️ Ruxsatlar</button></div>
        <button class="btn ghost wide" data-a="hc-off">Uzish</button>`
      : `<button class="btn primary wide" data-a="hc-connect">⌚ Ulash</button>`}
      <details><summary>Huawei soatini Health Connect’ga ulash (1 marta)</summary><ol class="tl">
        <li>Huawei Health ma’lumotlarni o‘zi Health Connect’ga bermaydi — shuning uchun <b>Health Sync</b> ilovasi kerak (Play Market, bir martalik to‘lov, 1 hafta bepul sinov).</li>
        <li>Health Sync → manba: <b>Huawei Health</b>, manzil: <b>Health Connect</b> → qadam, uyqu, puls, vaznni belgilang.</li>
        <li>Shu yerda <b>«Ulash»</b> → barcha ruxsatlarga «Ruxsat berish».</li>
        <li>Ilova har ochilganda ma’lumotni o‘zi oladi: qadamlar grafiklarda, uyqu va tinch puls tayyorlik indeksida ishlatiladi.</li></ol>
        <p class="tiny muted">Ilova faqat o‘qiydi, hech narsa yozmaydi va hech qayerga yubormaydi.</p></details></div>
    <div class="card"><h3>🔊 Ovozli murabbiy</h3>
      ${tg('voiceOn', 'Ovozli signal', 'Naushnikda: «Dam tugadi, 2-set, 60 kg × 10»')}
      <div class="row gap"><button class="btn grow" data-a="vo-lang">🗣 ${V.LANGS.find(l => l[0] === (p.voiceLang || 'ru-RU'))[1]}</button><button class="btn grow" data-a="vo-test">▶️ Sinash</button></div>
      <p class="tiny muted">Android’da o‘zbek ovozi yo‘q — rus yoki ingliz tilida gapiradi. Telefon qulflanganda — bildirishnoma va soat titrashi ishlaydi.</p></div>
    <div class="card"><h3>📄 Oylik hisobot</h3><p class="tiny muted">Kuch, vazn, mashg‘ulotlar, ovqat, salomatlik — chiroyli PDF. Telegram yoki Drive’ga o‘zingiz yuborasiz.</p>
      <button class="btn wide" data-a="report">📄 PDF yaratish</button></div>
    <div class="card"><h3>💾 Zaxira</h3>
      <p class="tiny muted">Ma’lumotlar faqat telefonda. Haftada 1 marta Google Drive'ga yuboring. Videolar zaxiraga kirmaydi (hajmi katta).</p>
      <button class="btn primary wide" data-a="backup">📤 Zaxira yaratish va yuborish</button>
      <label class="btn wide">📥 Zaxiradan tiklash<input type="file" accept=".json,application/json" hidden id="restore-file"></label>
      <p class="tiny muted">Oxirgi zaxira: ${db.lastBackup ? new Date(db.lastBackup).toLocaleString('ru') : 'hali yo‘q'}</p></div>
    <div class="card"><h3>🧭 Dastur</h3>
      <button class="btn wide" data-a="set-jump">📍 Dasturdagi o‘rinni o‘zgartirish (hozir #${db.nextSession})</button>
      <button class="btn wide ghost" data-a="set-restart">🔄 Dasturni boshidan boshlash</button></div>
    <details class="card"><summary>🩺 Salomatlik va xavfsizlik</summary><p>${md(D.TX.health)}</p></details>
    <details class="card"><summary>ℹ️ Ilova haqida</summary><p class="tiny">Sokhibjon GYM APP v${VERSION}. Rasmlar: ${esc(D.TX.photoSource.name)} (${esc(D.TX.photoSource.license)}). Videolar — YouTube/MuscleWiki havolalari (yuklab olinmagan). Ilova shifokor o‘rnini bosmaydi.</p>
      <button class="btn danger wide small" data-a="set-reset">🗑 Barcha ma’lumotlarni o‘chirish</button></details>
  </div>`;
  document.getElementById('restore-file').addEventListener('change', e => restore(e.target.files[0]));
}

const backupName = () => `sokhibjon-gym-${D.dateKey()}.json`;
const backupText = () => JSON.stringify({ app: 'sokhibjon-gym', version: VERSION, exportedAt: new Date().toISOString(), db: S.db() });
async function backup() {
  try {
    await N.shareFile(backupName(), backupText(), 'Sokhibjon GYM zaxira');
    S.db().lastBackup = new Date().toISOString(); await S.save();
    toast('✅ Zaxira tayyor. Google Drive yoki Telegram «Saqlangan xabarlar»ga yuboring.', 4000);
  } catch (e) { toast('❌ Zaxira yaratilmadi: ' + esc(e.message || e)); }
  render();
}
async function restore(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return toast('❌ Bu JSON zaxira fayli emas. Hech narsa o‘zgarmadi.', 4000); }
  if (!data || data.app !== 'sokhibjon-gym' || !data.db || !Array.isArray(data.db.sessions) || !Array.isArray(data.db.sets)) {
    return toast('❌ Bu Sokhibjon GYM zaxirasi emas. Hech narsa o‘zgarmadi.', 4000);
  }
  const cur = S.db(), nw = data.db;
  const row = (l, a, b) => `<tr><td>${l}</td><td>${a}</td><td>→</td><td><b>${b}</b></td></tr>`;
  const ok = await confirmBox(`<b>Zaxira tekshirildi ✅</b><br>Tiklasangiz, hozirgi ma’lumotlar ALMASHTIRILADI:<table class="tbl">
    ${row('Mashg‘ulotlar', cur.sessions.filter(s => s.finishedAt).length, nw.sessions.filter(s => s.finishedAt).length)}
    ${row('Setlar', cur.sets.length, nw.sets.length)}${row('Vazn yozuvlari', cur.body.length, (nw.body || []).length)}
    ${row('Dasturdagi o‘rin', '#' + cur.nextSession, '#' + nw.nextSession)}</table>
    <small>Avval hozirgi holatning ehtiyot nusxasi telefonga saqlanadi. Videolar o‘zgarmaydi.</small>`, 'Ha, tiklash', 'Bekor qilish', true);
  if (!ok) return toast('Bekor qilindi. Hech narsa o‘zgarmadi.');
  await N.writePrivate(`before-restore-${Date.now()}.json`, backupText());
  await S.replaceAll(nw);
  toast('✅ Tiklandi');
  route = { name: 'today' };
  render(true);
}

async function settingsAction(a, arg) {
  const db = S.db(), p = db.profile;
  if (a === 'set-toggle') { p[arg] = p[arg] === undefined && ['remindOn', 'weeklyOn', 'prehabOn', 'morningOn'].includes(arg) ? false : !p[arg]; await S.save(); NT.reschedule(); return render(); }
  if (a === 'set-equip') {
    let miss = new Set(p.missing || []);
    const html = () => `<h3>🏗 Zalimdagi jihozlar</h3><p class="muted tiny">Yo‘g‘ini o‘chiring — ilova shu jihozdagi mashqlarni boshqasiga almashtiradi.</p>
      ${Object.entries(C.EQUIP).map(([k, l]) => `<button class="toggle ${miss.has(k) ? '' : 'on'}" data-s="${k}"><span><b>${esc(l)}</b></span><i></i></button>`).join('')}
      <button class="btn primary wide" data-s="__save">Saqlash</button>`;
    const ok = await sheet(html(), { onClick: (v, b, wrap) => {
      if (v === '__save') return closeSheet(true);
      miss.has(v) ? miss.delete(v) : miss.add(v);
      b.classList.toggle('on', !miss.has(v));
    } });
    if (ok) { p.missing = [...miss]; await S.save(); toast('✅ Saqlandi — rejalar zalingizga moslandi'); render(); }
    return;
  }
  if (a === 'set-logmode') { p.logMode = p.logMode === 'detailed' ? 'quick' : 'detailed'; await S.save(); return render(); }
  if (a === 'set-mtime') { const v = await choose('Ertalabki eslatma vaqti', ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '09:00', 'off'].map(t => [t, t === 'off' ? 'Eslatmasiz' : t])); if (v) { p.morningTime = v; await S.save(); NT.reschedule(); render(); } return; }
  if (a === 'set-rtime') { const v = await choose('Eslatma vaqti', ['06:00', '07:00', '08:00', '09:00', '12:00', '16:00', '17:00', '18:00', '19:00'].map(t => [t, t])); if (v) { p.remindTime = v; await S.save(); NT.reschedule(); render(); } return; }
  if (a === 'set-profile') { ob = { step: 1, d: { ...p } }; p.onboarded = false; return render(true); }
  if (a === 'set-warm') { const v = await choose('Qizish davomiyligi', [['5', '5 daqiqa'], ['7', '7 daqiqa'], ['10', '10 daqiqa']]); if (v) { p.warmupMin = Number(v); await S.save(); render(); } return; }
  if (a === 'set-testwatch') { await N.initNotifications(); const ok = await N.notifyNow('🔔 Sinov', 'Soatingiz titrasa — hammasi to‘g‘ri ✅'); return toast(ok ? 'Yuborildi — 2 soniyada telefon va soatni tekshiring.' : 'Bildirishnoma ruxsati berilmagan.'); }
  if (a === 'set-exact') {
    const s = await N.exactAlarmStatus();
    if (s === 'granted') return toast('✅ Aniq taymer ruxsati bor.');
    if (await confirmBox('Taymer aniq vaqtda ishlashi uchun «Signal va eslatmalar» ruxsati kerak. Sozlamalarni ochaymi?')) N.openExactAlarmSettings();
    return;
  }
  if (a === 'set-jump') {
    const v = await prompt(`Keyingi mashg‘ulot raqami (1–${D.TOTAL()})`, { value: db.nextSession, type: 'number', inputmode: 'numeric' });
    const n = parseInt(v, 10);
    if (n >= 1 && n <= D.TOTAL() && (await confirmBox(`Keyingi mashg‘ulot #${n} — ${esc(D.PRG.sessions[n - 1].title)} bo‘lsinmi? Tarix saqlanadi.`))) { db.nextSession = n; await S.save(); render(); }
    return;
  }
  if (a === 'set-restart') { if (await confirmBox('Dasturni 1-mashg‘ulotdan boshlaymizmi? Tarix va rekordlar saqlanadi.')) { db.nextSession = 1; await S.save(); render(); } return; }
  if (a === 'set-reset') {
    if (!(await confirmBox('<b>Barcha ma’lumotlar o‘chiriladi.</b> Avval zaxira oldingizmi?', 'Ha, o‘chirish', 'Yo‘q', true))) return;
    if (!(await confirmBox('Aniqmi? Bu qaytarib bo‘lmaydi.', 'O‘chirish', 'Bekor', true))) return;
    await N.writePrivate(`before-reset-${Date.now()}.json`, backupText());
    await S.replaceAll(S.emptyDb()); ob = null; route = { name: 'today' }; return render(true);
  }
}

function weeklySheet() {
  return sheet(`<h3>📊 Haftalik xulosa</h3><p>${esc(NT.weeklyText())}</p><button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
}

// ───────── side drawer ─────────
function drawer() {
  closeDrawer();
  const d = document.createElement('div');
  d.className = 'drawer-wrap';
  const p = S.db().profile;
  d.innerHTML = `<nav class="drawer" aria-label="Menyu"><div class="drawer-head"><img src="img/logo.svg" alt=""><div><b>Sokhibjon GYM</b><small>${esc(p.name || '')} · #${S.db().nextSession}/${D.TOTAL()}</small></div></div>
    ${MENU.map(([k, i, l], n) => `<button class="drawer-item ${route.name === k ? 'sel' : ''}" style="--d:${n * 22}ms" data-a="tab" data-arg="${k}">${ic(i)}<span>${l}</span></button>`).join('')}
    <div class="drawer-foot">${TH.segHtml('theme')}<small class="muted">v${VERSION} · offline</small></div></nav>`;
  d.addEventListener('click', e => { if (e.target === d) closeDrawer(); });
  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add('open'));
}
function closeDrawer() {
  const d = document.querySelector('.drawer-wrap');
  if (!d) return;
  d.classList.remove('open'); d.classList.add('closing');
  setTimeout(() => d.remove(), 320);
}

// ───────── events ─────────
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.closest('.sheet-wrap')) return;
  if (b.closest('.drawer-wrap') && !['tab', 'theme'].includes(b.dataset.a)) return;
  const a = b.dataset.a, arg = b.dataset.arg;
  if (a.startsWith('ob-')) return obAction(a, arg);
  if (a.startsWith('w-')) return W.action(a, arg, b);
  if (a.startsWith('lib-') || a.startsWith('vid-') || a === 'open-url' || a === 'yt-play') return L.action(a, arg);
  if (a === 'ex-open') return ctx.showExercise(arg);
  if (a.startsWith('pl-')) return P.action(a, arg);
  if (a.startsWith('pr-') || a.startsWith('pg-') || a.startsWith('ph-')) return G.action(a, arg);
  if (a.startsWith('set-')) return settingsAction(a, arg);
  if (a.startsWith('hl-')) return HL.action(a, arg);
  if (a.startsWith('fd-')) return NU.action(a, arg);
  if (a.startsWith('sh-')) return SK.action(a, arg);
  if (a === 'theme') { await TH.set(arg); const dw = document.querySelector('.drawer-foot'); if (dw) dw.innerHTML = `${TH.segHtml('theme')}<small class="muted">v${VERSION} · offline</small>`; return render(); }
  if (a === 'theme-cycle') { await TH.set(TH.resolved() === 'light' ? 'dark' : 'light'); return render(); }
  if (a === 'report') { closeDrawer(); return RP.make(); }
  if (a === 'hc-connect') { const r = await HC.connect(); if (r.ok) { toast('✅ Ulandi — ma’lumot olinmoqda…'); await HC.sync(true); } else { toast(r.msg || 'Ulanmadi'); if (r.install) HC.openSettings(); } return render(); }
  if (a === 'hc-sync') { const g = await HC.sync(true); toast(g ? '✅ Yangilandi' : 'Ma’lumot olinmadi'); return render(); }
  if (a === 'hc-settings') return HC.openSettings();
  if (a === 'hc-off') { await HC.disconnect(); return render(); }
  if (a === 'vo-lang') { const l = await choose('Ovoz tili', V.LANGS.map(([k, n]) => [k, n])); if (l) { S.db().profile.voiceLang = l; await S.save(); render(); } return; }
  if (a === 'vo-test') { const ok = await V.supported(); await V.say(V.t().test, true); if (!ok) { toast('Bu til ovozi o‘rnatilmagan — sozlamalar ochiladi'); V.openInstall(); } return; }
  if (a === 'tab') { closeDrawer(); if (arg === 'workout-go') { route = { name: W.active() ? 'workout' : 'today' }; return render(true); } route = { name: arg }; window.scrollTo(0, 0); return render(true); }
  if (a === 'back') return goBack();
  if (a === 'backup') return backup();
  if (a === 'day1') return sheet(`<div class="prose">${md(D.TX.day1)}</div><button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
  if (a === 'start' || a === 'start-full') {
    let mode = a === 'start-full' ? 'normal' : arg;
    if (!D.readinessToday() || D.readinessToday().index == null) {
      const ri = await readinessFlow();
      if (!ri) return render();
      await riSheet(ri);
      if (ri.level === 'rest') return render();
      if (ri.mode === 'short' && mode === 'normal') mode = 'short';
    }
    return W.start(mode, a !== 'start-full');
  }
  if (a === 'quicklog') return W.quickLog(arg);
  if (a === 'role-core' || a === 'role-bonus') { S.db().roleOverride = { date: D.dateKey(), role: a === 'role-core' ? 'core' : 'bonus' }; await S.save(); toast(a === 'role-core' ? 'Bugun asosiy mashg‘ulot — dastur oldinga siljiydi' : 'Bugun bonus — dastur joyida qoladi'); return render(); }
  if (a === 'time-pick') {
    const v = await choose('⏱ Bugun qancha vaqtingiz bor?', [['0', `Odatdagidek (~${S.db().profile.sessionMin} daq)`], ['30', '30 daqiqa'], ['45', '45 daqiqa'], ['60', '60 daqiqa'], ['75', '75 daqiqa'], ['90', '90 daqiqa']]);
    if (v == null) return;
    S.db().todayMin = Number(v) ? { date: D.dateKey(), min: Number(v) } : null;
    await S.save();
    if (Number(v)) toast('⏱ Reja vaqtga moslandi: supersetlar va qisqartirishlar «Bugun moslashtirildi» ichida');
    return render();
  }
  if (a === 'ri-check') { const ri = await readinessFlow(); if (ri) await riSheet(ri); return render(); }
  if (a === 'ri-show') { const r = D.readinessToday(); if (r && r.inputs) await riSheet(C.readinessIndex(r.inputs)); return; }
  if (a === 'rest-day') return sheet(`<h3>🚶 Faol tiklanish kuni</h3><ul class="tl"><li>30–45 daqiqa yengil yurish</li><li>10 daqiqa cho‘zilish</li><li>Har ovqatda oqsil, 2.5–3 L suv</li><li>Bugun 30–60 daqiqa ertaroq yoting</li></ul><p class="muted">Dasturdagi o‘rningiz saqlanadi — ertaga shu mashg‘ulot kutadi.</p><button class="btn wide" data-s="x">Tushunarli</button>`, { onClick: () => closeSheet() });
  if (a === 'dash-lift') { liftSel = arg; return render(); }
  if (a === 'drawer') return drawer();
  if (a.startsWith('rec-')) return R.action(a, arg);
  if (a.startsWith('mu-')) return M.action(a, arg);
  if (a.startsWith('cal-')) return K.action(a, arg);
  if (a.startsWith('mo-')) return MO.action(a, arg);
  if (a === 'weekly') return weeklySheet();
});

function goBack() {
  if (sheetOpen()) return closeSheet(null);
  if (document.querySelector('.drawer-wrap')) return closeDrawer();
  if (route.name === 'exercise' || route.name === 'summary') { route = route.prev && route.prev.name ? route.prev : { name: 'today' }; return render(true); }
  if (route.name === 'workout') return W.action('w-menu');
  if (!S.db().profile.onboarded) { if (ob && ob.step > 0) { ob.step--; return render(true); } return N.exitApp(); }
  if (route.name !== 'today') { route = { name: 'today' }; return render(true); }
  N.exitApp();
}

async function boot() {
  try {
    await Promise.all([D.loadStatic(), S.load()]);
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="page"><p class="warn">Xatolik: ${esc(e.message)}</p></div>`;
    return;
  }
  W.init(ctx); L.init(ctx); P.init(ctx); G.init(ctx); R.init(ctx); M.init(ctx); K.init(ctx); MO.init(ctx); HL.init(ctx); NU.init(ctx); SK.init(ctx);
  TH.init(() => render());
  V.setDuck(ms => M.duck(ms));
  NT.onTap(open => { if (open === 'weekly') weeklySheet(); else if (open === 'weight') G.action('pr-weight'); else if (open === 'backup') backup(); else if (open === 'morning') MO.start(); else if (open === 'photos') { route = { name: 'progress' }; render(true); } else if (open === 'health') { route = { name: 'health' }; render(true); } });
  M.refresh().catch(() => {});
  S.persist();
  N.onBackButton(goBack);
  N.onAppResume(async () => { await W.catchUp(); render(); if (HC.on()) HC.sync().then(g => { if (g && !W.active()) render(); }).catch(() => {}); });
  if (S.db().profile.onboarded) N.initNotifications();
  // silent weekly copy inside the app (in addition to manual Google Drive backups)
  let last = null;
  try { last = localStorage.getItem('autoBackup'); } catch (e) { /* storage blocked */ }
  if (S.db().sessions.length && (!last || Date.now() - Number(last) > 7 * 86400000)) {
    if (await N.writePrivate(`auto-${D.dateKey()}.json`, backupText())) { try { localStorage.setItem('autoBackup', String(Date.now())); } catch (e) { /* */ } }
  }
  await W.catchUp();
  if (S.db().profile.onboarded) NT.reschedule();
  document.getElementById('splash').classList.add('hide');
  render(true);
  if (HC.on()) HC.sync().then(g => { if (g && !W.active()) render(); }).catch(() => {});
}
boot();
