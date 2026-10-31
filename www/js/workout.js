// Guided workout screens: warm-up → one exercise at a time → rest timer + set rating → feedback →
// finish (RPE + summary). Saved after every tap; survives app restarts.
import * as S from './store.js';
import * as E from './engine.js';
import * as C from './coach.js';
import * as N from './native.js';
import * as D from './data.js';
import { esc, md, sheet, closeSheet, confirmBox, choose, toast, mmss } from './ui.js';
import { ic } from './icons.js';
import * as V from './voice.js';

let ctx = null;          // { render, go, showExercise }
let tick = null;
export const init = c => { ctx = c; };

export const active = () => {
  const db = S.db();
  return db.activeSid ? db.sessions.find(s => s.id === db.activeSid && !s.finishedAt) || null : null;
};
const countsOf = sess => sess.plan.map((_, i) => S.db().sets.filter(x => x.sid === sess.id && x.exIdx === i).length);
const setsOf = (sess, i) => S.db().sets.filter(x => x.sid === sess.id && x.exIdx === i);

export async function start(mode, adapt = true) {
  const db = S.db();
  if (active()) return ctx.render();
  const no = db.nextSession;
  const s = D.PRG.sessions[no - 1];
  const r = D.readinessToday();
  const role = D.todayRole();
  const tp = D.todaysPlan(mode, adapt, role);
  const plan = tp.plan;
  const sess = { id: S.nextId(), no, week: s.week, phase: s.phase, title: tp.bonus ? tp.title : s.title, bonus: !!tp.bonus, mode, deload: s.deload, test: tp.bonus ? false : s.test,
                 factor: adapt ? D.todayFactor() : 1, adapted: adapt && !!(r && r.index != null), plan,
                 state: E.newState(plan, db.profile.warmupMin || 7, db.profile.prehabOn === false ? [] : D.prehabBlock(plan, no)),
                 startedAt: new Date().toISOString(), finishedAt: null, rpe: null };
  db.sessions.push(sess);
  db.activeSid = sess.id;
  await S.save();
  if (db.profile.keepAwake) N.keepAwake(true);
  ctx.render();
}

// ── draft (pre-filled weight / reps for the next set) ──
function fillDraft(sess, st) {
  if (st.stage !== 'exercise' || st.ex == null || (st.w != null && st.r != null)) return;
  const it = sess.plan[st.ex], ex = D.EX[it.key];
  const done = setsOf(sess, st.ex);
  if (done.length) { E.setDraft(st, done[done.length - 1].w || 0, done[done.length - 1].r); return; }
  const sg = D.suggestion(it, sess.factor, sess.id);
  let w = sg.weight ?? sg.draftW ?? 0;
  if (ex.unit !== 'reps') w = 0;
  E.setDraft(st, w, sg.target || it.lo);
}

// ── timers ──
function scheduleNotif(sess, st) {
  const t = st.timer;
  if (!t || t.paused) return N.cancelTimer();
  let body = '';
  if (t.kind === 'rest') {
    const it = sess.plan[st.ex], ex = D.EX[it.key];
    body = `Keyingi: set ${setsOf(sess, st.ex).length + 1}/${it.sets} — ${ex.short} ${D.setLabel(ex, st.w || 0, st.r || it.lo)}`;
  } else body = 'Qizish tugadi — birinchi mashqqa o‘tamiz';
  N.scheduleTimer(t.ends, t.kind === 'rest' ? '⏰ Dam olish tugadi!' : '🔥 Qizish tugadi!', body);
}
function startTicker() {
  stopTicker();
  tick = setInterval(onTick, 250);
}
function stopTicker() { if (tick) clearInterval(tick); tick = null; }
async function onTick() {
  const sess = active();
  if (!sess || !sess.state.timer) return stopTicker();
  const st = sess.state, now = Date.now();
  const el = document.getElementById('tleft');
  const left = E.timerLeft(st, now);
  if (el) el.textContent = mmss(left);
  const ring = document.getElementById('tring');
  if (ring) ring.style.setProperty('--p', String(1 - left / Math.max(1, st.timer.total)));
  if (left === 10 && st.timer.total > 25 && !st.timer.said10) { st.timer.said10 = true; V.tenLeft(); }
  if (E.timerDue(st, now)) {
    stopTicker();
    await timerFinished(sess, true);
  }
}
async function timerFinished(sess, inApp) {
  const st = sess.state;
  const kind = st.timer && st.timer.kind;
  if (kind === 'warmup') E.warmupDone(st, sess.plan, countsOf(sess)); else E.restDone(st);
  await S.save();
  if (inApp) {
    if (ctx.duck) ctx.duck();
    const p = S.db().profile;
    if (p.sound) N.beep();
    if (p.vibrate) N.buzz();
    toast(kind === 'warmup' ? '🔥 Qizish tugadi — birinchi mashq!' : '⏰ Dam olish tugadi — keyingi set!');
    if (V.on() && st.stage === 'exercise' && st.ex != null) {
      fillDraft(sess, st);
      const it = sess.plan[st.ex], n = setsOf(sess, st.ex).length + 1;
      if (kind === 'warmup') { await V.warmupDone(); }
      else if (n === 1) V.nextExercise(it);
      else V.restOver(it, n, st.w || 0, st.r || it.lo);
    }
  }
  ctx.render();
}
// app came back from background / phone unlocked
export async function catchUp() {
  const sess = active();
  if (sess && sess.state.timer && E.timerDue(sess.state, Date.now())) await timerFinished(sess, false);
}

// ── rendering ──
export function render(root) {
  const sess = active();
  if (!sess) { ctx.go('today'); return; }
  const st = sess.state, counts = countsOf(sess);
  fillDraft(sess, st);
  const n = sess.plan.length;
  const dots = sess.plan.map((p, i) => `<i class="${counts[i] >= p.sets ? 'done' : st.skipped.includes(i) ? 'skip' : i === st.ex ? 'cur' : ''}"></i>`).join('');
  const head = `<header class="wk-head"><button class="icon" data-a="w-menu" aria-label="Menyu">${ic('menu')}</button>
    <div class="wk-title"><b>${esc(sess.title)}</b><small>${sess.bonus ? '➕ bonus' : '#' + sess.no} · ${({ normal: 'to‘liq', short: 'qisqa', travel: 'gantel' })[sess.mode]} · ⏱ <span id="elapsed">${mmss((Date.now() - Date.parse(sess.startedAt)) / 1000)}</span></small></div>
    <div class="dots">${dots}</div></header>`;
  let body = '';
  if (st.stage === 'warmup') body = warmupView(sess, st);
  else if (st.stage === 'prehab') body = prehabView(sess, st);
  else if (st.stage === 'exercise') body = st.paused ? pausedView(sess, st) : exerciseView(sess, st, counts);
  else if (st.stage === 'rest') body = restView(sess, st, counts);
  else if (st.stage === 'feedback') body = feedbackView(sess, st, counts);
  else if (st.stage === 'finish') body = finishView(sess, st, counts);
  root.innerHTML = `<div class="workout">${head}<main class="wk-body">${body}</main></div>`;
  const stageKey = st.stage + ':' + st.ex;
  if (stageKey !== lastStageKey) { window.scrollTo(0, 0); lastStageKey = stageKey; }
  if (st.timer && !st.timer.paused) { startTicker(); onTick(); } else stopTicker();
  startClock(sess);
}
let clock = null, sw = null, lastStageKey = '';   // workout stopwatch + set stopwatch (timed exercises)
function startClock(sess) {
  if (clock) clearInterval(clock);
  clock = setInterval(() => {
    const e = document.getElementById('elapsed');
    if (!e || !active()) { clearInterval(clock); clock = null; return; }
    const sec = (Date.now() - Date.parse(sess.startedAt)) / 1000;
    e.textContent = sec >= 3600 ? `${Math.floor(sec / 3600)}:${mmss(sec % 3600)}` : mmss(sec);
    const swEl = document.getElementById('swv');
    if (swEl && sw) swEl.textContent = Math.round((Date.now() - sw) / 1000) + ' s';
  }, 500);
}

const btn = (a, label, cls = '', arg = '') => `<button class="btn ${cls}" data-a="${a}" data-arg="${esc(arg)}">${label}</button>`;

function warmupView(sess, st) {
  const t = st.timer;
  if (!t) return `<section class="center-card">
    <div class="big-emoji">🔥</div><h2>1-qadam: Qizish</h2>
    <p class="muted">Yugurish yo‘lakchasi (treadmill): tezlik 5–6 km/soat, qiyalik 1–5%. Gapira oladigan darajada yuring.</p>
    <div class="row gap">${[5, 7, 10].map(m => btn('w-wu', `${m} daq`, m === (st.warmMin || 7) ? 'primary grow' : 'grow', m)).join('')}</div>
    ${btn('w-wskip', '⏭ Qizishni o‘tkazish', 'ghost wide')}
    <p class="tiny muted">Taymer tugaganda telefon va soat titraydi.</p></section>`;
  const left = E.timerLeft(st, Date.now());
  return `<section class="center-card"><h2>🔥 Qizish</h2>
    <div class="ring" id="tring" style="--p:${1 - left / t.total}"><span id="tleft">${mmss(left)}</span></div>
    ${t.paused ? '<p class="warn">⏸ Pauza</p>' : ''}
    <div class="row gap">${t.paused ? btn('w-resume', '▶️ Davom', 'primary grow') : btn('w-pause', '⏸ Pauza', 'grow')}
    ${btn('w-wdone', '✅ Tugatdim', 'grow')}</div>${btn('w-wskip', '⏭ O‘tkazish', 'ghost wide')}</section>`;
}

function prehabView(sess, st) {
  const cards = st.prehab.map(k => {
    const ex = D.EX[k], ph = ex.media.photos, on = st.preChecked.includes(k);
    return `<div class="pre ${on ? 'on' : ''}">
      <div class="pre-img">${ph.map(p => `<img src="${p.src}" alt="${esc(p.label)}" loading="lazy">`).join('')}</div>
      <div class="pre-t"><b>${esc(ex.short)}</b><small>${esc(ex.en)}</small><span class="pill">${esc(ex.dose)}</span>
        <p class="tiny muted">🎯 ${esc(ex.muscles)}</p></div>
      <div class="row gap"><button class="btn small grow" data-a="w-pretech" data-arg="${k}">📖 Qanday?</button>
        <button class="btn small grow ${on ? 'primary' : ''}" data-a="w-precheck" data-arg="${k}">${on ? '✅ Bajarildi' : 'Bajardim'}</button></div></div>`;
  }).join('');
  return `<section class="ex"><div class="center-card"><div class="big-emoji">🛡</div><h2>2-qadam: Himoya bloki</h2>
    <p class="muted">3–5 daqiqa, juda yengil. Yelka manjeti, dumba va bo‘g‘imlarni bugungi mashqlarga tayyorlaydi — shikastlanish xavfini kamaytiradi.</p></div>
    ${cards}
    ${btn('w-predone', `✅ Tugatdim (${st.preChecked.length}/${st.prehab.length})`, 'primary wide xl')}
    ${btn('w-preskip', '⏭ Bugun o‘tkazib yuborish', 'ghost wide')}</section>`;
}

function pausedView(sess, st) {
  return `<section class="center-card"><div class="big-emoji">⏸</div><h2>Pauza</h2>
    <p class="muted">Hammasi saqlangan. Tayyor bo‘lganingizda davom eting.</p>${btn('w-resume', '▶️ Davom etish', 'primary wide xl')}</section>`;
}

function mediaBox(key) {
  const ex = D.EX[key], m = ex.media;
  if (m.gif) return `<button class="media" data-a="w-tech" aria-label="Texnika"><img src="${m.gif}" alt="${esc(ex.short)}" loading="lazy"><span class="media-hint">📖 Texnika</span></button>`;
  return `<button class="media fallback" data-a="w-tech"><span>🖼</span><small>${esc(ex.fallback || 'Rasm yo‘q')}</small></button>`;
}

const quick = () => S.db().profile.logMode !== 'detailed';

// ── plate visual (IWF colours) ──
const PLATE_C = { 25: '#e5383b', 20: '#2f6fdf', 15: '#f2c94c', 10: '#27ae60', 5: '#f5f5f5', 2.5: '#333a45', 1.25: '#b8c0cc' };
export function platesSvg(total) {
  const p = C.platesPerSide(total);
  if (!p) return '';
  const H = { 25: 70, 20: 70, 15: 62, 10: 54, 5: 40, 2.5: 32, 1.25: 26 }, Wd = { 25: 12, 20: 11, 15: 10, 10: 9, 5: 7, 2.5: 6, 1.25: 5 };
  let x = 0;
  const side = p.plates.map(pl => { const r = `<rect x="${x}" y="${40 - H[pl] / 2}" width="${Wd[pl]}" height="${H[pl]}" rx="2" fill="${PLATE_C[pl]}" stroke="#0b0d10" stroke-width="1"/>`; x += Wd[pl] + 1; return r; }).join('');
  const sw = x;
  return `<div class="plates"><svg viewBox="0 0 ${2 * sw + 150} 80" aria-hidden="true">
    <rect x="0" y="37" width="${2 * sw + 150}" height="6" rx="3" fill="#9aa3af"/>
    <g transform="translate(40 0)">${side}</g><g transform="translate(${2 * sw + 110} 0) scale(-1 1)">${side}</g>
    <rect x="${sw + 40}" y="35" width="70" height="10" rx="3" fill="#c7ced8"/></svg>
    <small>${p.plates.length ? `Har tomonga: <b>${p.plates.join(' + ')}</b> kg` : 'Bo‘sh grif (20 kg)'}${p.rem ? ` · ≈${p.rem} kg yetmaydi` : ''}</small></div>`;
}

function quickExerciseView(sess, st, counts) {
  const i = st.ex, it = sess.plan[i], ex = D.EX[it.key], done = setsOf(sess, i);
  const sg = D.suggestion(it, sess.factor, sess.id);
  const left = it.sets - done.length;
  const partner = it.ssWith != null ? sess.plan[it.ssWith] : null;
  const wtxt = ex.unit === 'reps' ? (st.w ? `${D.fmtW(st.w)} kg` : 'o‘z vazni') : ex.unit === 'bw' && st.w ? `+${D.fmtW(st.w)} kg` : '';
  const dots = Array.from({ length: it.sets }, (_, k) => `<i class="${k < done.length ? 'done' : k === done.length ? 'cur' : ''}"></i>`).join('');
  const firstW = sess.plan.findIndex(p => D.EX[p.key].unit === 'reps');
  const ws = !done.length && sg.weight && (i === firstW || ex.barbell) ? C.warmupSets(sg.weight, ex.barbell) : [];
  return `<section class="ex">
    ${mediaBox(it.key)}
    <h2 class="ex-name">${esc(ex.short)} <small>${esc(ex.en)}</small></h2>
    ${partner ? `<p class="pill">🔗 Superset — keyin dam olmasdan: ${esc(D.EX[partner.key].short)}</p>` : ''}
    <div class="task"><div><small>Bugungi vazifa</small><b>${it.sets} × ${st.r} ${D.unitLabel(ex.unit)}${wtxt ? ` · ${wtxt}` : ''}</b></div>
      <div class="setdots">${dots}</div></div>
    ${!done.length ? `<p class="reason">💡 ${esc(sg.reason)}${ex.stack && !D.historyFor(it.key).length ? ' Trenajyor plitalari har xil bo‘ladi — kerak bo‘lsa ✏️ bilan to‘g‘rilang.' : ''}</p>` : ''}
    ${st.note ? `<p class="reason">${esc(st.note)}</p>` : ''}
    ${sg.pain ? '<p class="warn">⚠️ Yaqinda shu bo‘g‘imda og‘riq yozilgan — yengilroq bajaring yoki 🔁 almashtiring.</p>' : ''}
    ${ex.barbell && st.w ? platesSvg(st.w) : ''}
    ${ws.length ? `<p class="tiny muted">🔥 Avval tayyorlov setlari (yozilmaydi): ${ws.map(([w, r]) => `${D.fmtW(w)}×${r}`).join(' → ')}</p>` : ''}
    ${ex.unit === 'sec' ? `<div class="row gap center-y">${sw ? `${btn('w-swstop', '⏹ To‘xtatish', 'danger grow')}<b class="swv" id="swv">${Math.round((Date.now() - sw) / 1000)} s</b>` : btn('w-swstart', '⏱ Taymerni boshlash', 'grow')}</div>` : ''}
    ${btn('w-save', left > 1 ? `✔ ${done.length + 1}-set tugadi → dam olish` : '✔ Oxirgi set tugadi', 'primary wide xl')}
    <div class="row gap">${left > 1 ? btn('w-exdone', '✅ Hammasini bajardim', 'grow') : ''}${btn('w-edit', '✏️ Boshqacha bo‘ldi', 'grow')}</div>
    <div class="row gap">${btn('w-tech', ic('info') + ' Texnika', 'grow')}${btn('w-videos', ic('video') + ' Videolar', 'grow')}${btn('w-swap', ic('swap') + ' Almashtirish', 'grow')}</div>
    <div class="ctrl">${btn('w-back', ic('back') + '<small>Orqaga</small>', 'cbtn')}${btn('w-skip', ic('skip') + '<small>O‘tkazish</small>', 'cbtn')}${btn('w-pause', ic('pause') + '<small>Pauza</small>', 'cbtn')}${btn('w-fin', ic('flag') + '<small>Yakunlash</small>', 'cbtn')}</div>
  </section>`;
}

function exerciseView(sess, st, counts) {
  if (quick()) return quickExerciseView(sess, st, counts);
  const i = st.ex, it = sess.plan[i], ex = D.EX[it.key], done = setsOf(sess, i);
  const sg = D.suggestion(it, sess.factor, sess.id);
  const lines = [];
  if (!done.length) {
    if (sg.weight != null) lines.push(`<div class="chip ok">Tavsiya: <b>${D.fmtW(sg.weight)} kg</b>${sg.held ? ' 🛡' : ''}${sg.plateau ? ' 📉' : ''}</div>`);
    lines.push(`<p class="reason">💡 ${esc(sg.reason)}</p>`);
    const firstW = sess.plan.findIndex(p => D.EX[p.key].unit === 'reps');
    if (sg.weight && (i === firstW || ex.barbell)) {
      const ws = C.warmupSets(sg.weight, ex.barbell);
      if (ws.length) lines.push(`<p class="tiny">🔥 Tayyorlov setlari (yozilmaydi): ${ws.map(([w, r]) => `${D.fmtW(w)}×${r}`).join(' → ')}</p>`);
    }
  } else {
    lines.push(`<p class="tiny">Bajarildi: ${done.map(s => D.setLabel(ex, s.w, s.r) + (s.rating === 'easy' ? ' 😌' : s.rating === 'hard' ? ' 🥵' : '')).join(' · ')}</p>`);
  }
  if (st.note) lines.push(`<p class="reason">${esc(st.note)}</p>`);
  if (sg.pain) lines.push(`<p class="warn">⚠️ Yaqinda shu bo‘g‘imda og‘riq yozilgan — vaznni kamaytiring yoki 🔁 almashtiring. Og‘riq kuchaysa to‘xtang.</p>`);
  if (ex.barbell && st.w) lines.push(`<p class="tiny">🧮 ${esc(C.platesText(st.w))}</p>`);
  const step = C.weightStep(ex), rs = ex.unit === 'sec' ? 5 : 1;
  const wBox = ex.unit === 'reps' ? `<div class="stepper"><button class="step" data-a="w-wm">−${D.fmtW(step)}</button>
      <div class="val"><b>${D.fmtW(st.w)}</b><small>${ex.assist ? 'kg yordam' : 'kg'}</small></div><button class="step" data-a="w-wp">+${D.fmtW(step)}</button></div>` : '';
  const rBox = `<div class="stepper"><button class="step" data-a="w-rm">−${rs}</button>
      <div class="val"><b>${st.r}</b><small>${D.unitLabel(ex.unit)}</small></div><button class="step" data-a="w-rp">+${rs}</button></div>`;
  return `<section class="ex">
    ${mediaBox(it.key)}
    <h2 class="ex-name">${esc(ex.short)} <small>${esc(ex.en)}</small></h2>
    <p class="muted tiny">🎯 ${esc(ex.muscles)}</p>
    <div class="setline"><span class="badge">Set ${Math.min(done.length + 1, it.sets)}/${it.sets}</span>
      <span class="muted">${esc(D.scheme(it))}${it.rir !== '-' ? ` · RIR ${esc(it.rir)}` : ''}${it.rest ? ` · dam ${it.rest}s` : ''}</span></div>
    ${lines.join('')}
    <div class="steppers">${wBox}${rBox}</div>
    ${ex.unit === 'sec' ? `<div class="row gap center-y">${sw ? `${btn('w-swstop', '⏹ To‘xtatish', 'danger grow')}<b class="swv" id="swv">${Math.round((Date.now() - sw) / 1000)} s</b>` : btn('w-swstart', '⏱ Set taymerini boshlash', 'grow')}</div>` : ''}
    ${btn('w-save', `✅ Bajarildi — ${esc(D.setLabel(ex, st.w || 0, st.r))}`, 'primary wide xl')}
    ${it.sets - done.length > 1 ? btn('w-exdone', `☑️ Mashqni tugatdim (qolgan ${it.sets - done.length} set shu natija bilan)`, 'ghost wide') : ''}
    <div class="row gap">${btn('w-tech', ic('info') + ' Texnika', 'grow')}${btn('w-videos', ic('video') + ' Videolar', 'grow')}${btn('w-swap', ic('swap') + ' Almashtirish', 'grow')}</div>
    <div class="ctrl">${btn('w-back', ic('back') + '<small>Orqaga</small>', 'cbtn')}${btn('w-skip', ic('skip') + '<small>O‘tkazish</small>', 'cbtn')}${btn('w-pause', ic('pause') + '<small>Pauza</small>', 'cbtn')}${btn('w-fin', ic('flag') + '<small>Yakunlash</small>', 'cbtn')}</div>
  </section>`;
}

function ratingRow(cur) {
  const r = [['easy', '😌 Yengil'], ['ok', '💪 Me’yorida'], ['hard', '🥵 Og‘ir']];
  return `<div class="rating">${r.map(([v, l]) => `<button class="btn ${cur === v ? 'sel' : ''}" data-a="w-rate" data-arg="${v}">${l}</button>`).join('')}</div>`;
}

function restView(sess, st, counts) {
  const t = st.timer || { total: 1, paused: false };
  const left = E.timerLeft(st, Date.now()) ?? 0;
  const it = sess.plan[st.ex], ex = D.EX[it.key], done = counts[st.ex];
  return `<section class="center-card">
    <p class="muted">${esc(ex.short)} · set ${done}/${it.sets} ✅</p>
    ${quick() ? '' : `<p class="q">Oxirgi set qanday bo‘ldi?</p>${ratingRow(st.lastRating)}`}
    ${st.note ? `<p class="reason">${esc(st.note)}</p>` : ''}
    <div class="ring" id="tring" style="--p:${1 - left / Math.max(1, t.total)}"><span id="tleft">${mmss(left)}</span><small>dam olish</small></div>
    ${t.paused ? '<p class="warn">⏸ Pauza</p>' : ''}
    <p>Keyingi: <b>${st.afterRest != null && st.afterRest !== st.ex ? esc(D.EX[sess.plan[st.afterRest].key].short) : `set ${done + 1}/${it.sets} — ${esc(D.setLabel(ex, st.w || 0, st.r || it.lo))}`}</b></p>
    <div class="row gap">${t.paused ? btn('w-resume', '▶️', 'grow') : btn('w-pause', '⏸', 'grow')}${btn('w-plus30', '+30 s', 'grow')}${btn('w-restskip', '⏭ Tayyorman', 'primary grow')}</div>
    <div class="row gap">${btn('w-undo', '↩️ Oxirgi setni o‘chirish', 'ghost grow')}${btn('w-fin', '🏁', 'ghost')}</div>
  </section>`;
}

function quickFeedbackView(sess, st, counts) {
  const it = sess.plan[st.ex], ex = D.EX[it.key], f = st.flags || {};
  const names = [ex.short].concat(it.ssWith != null ? [D.EX[sess.plan[it.ssWith].key].short] : []);
  const opt = (v, t, sub) => `<button class="btn left big" data-a="w-fbq" data-arg="${v}">${t}<small>${sub}</small></button>`;
  return `<section class="center-card"><div class="big-emoji">✅</div>
    <h2>${esc(names.join(' + '))} tugadi</h2>
    <p class="q">Qanday bo‘ldi?</p>
    <div class="col gap">${opt('easy', '😌 Oson', 'Yana 3+ takror qila olardim → keyingi safar og‘irroq')}${opt('ok', '💪 Me’yorida', '1–2 takror zaxira qoldi')}${opt('hard', '🥵 Og‘ir', 'Zo‘rg‘a bajardim → vazn ushlab turiladi')}</div>
    <div class="row gap"><button class="chipbtn ${f.bad ? 'sel' : ''}" data-a="w-flag" data-arg="bad">⚠️ Texnika buzildi</button><button class="chipbtn ${f.pain ? 'sel' : ''}" data-a="w-flag" data-arg="pain">🩹 Og‘riq bo‘ldi</button></div>
    ${btn('w-back', '⬅️ Yana set qo‘shish', 'ghost wide')}</section>`;
}

function feedbackView(sess, st, counts) {
  if (quick()) return quickFeedbackView(sess, st, counts);
  const it = sess.plan[st.ex], ex = D.EX[it.key];
  return `<section class="center-card"><div class="big-emoji">✅</div>
    <h2>${esc(ex.short)} tugadi</h2><p class="muted">${counts[st.ex]} ta set bajarildi.</p>
    <p class="q">Oxirgi set qanday bo‘ldi?</p>${ratingRow(st.lastRating)}
    <p class="q">Texnika qanday bo‘ldi? <small class="muted">(keyingi safar vazn shunga qarab tanlanadi)</small></p>
    <div class="col gap">${btn('w-fb', '✅ Yaxshi, og‘riqsiz', 'primary wide', 'ok')}${btn('w-fb', '⚠️ Texnika buzildi', 'wide', 'bad')}${btn('w-fb', '🩹 Og‘riq bo‘ldi', 'wide', 'pain')}</div>
    ${btn('w-back', '⬅️ Yana set qo‘shish', 'ghost wide')}</section>`;
}

function finishView(sess, st, counts) {
  const rows = sess.plan.map((p, i) => `<li>${counts[i] >= p.sets ? '✅' : st.skipped.includes(i) ? '⏭' : '▫️'} ${esc(D.EX[p.key].short)} — ${counts[i]}/${p.sets}</li>`).join('');
  return `<section class="center-card"><div class="big-emoji">🏁</div><h2>Mashg‘ulot tugadi!</h2>
    <ul class="plain">${rows}</ul>
    ${sess.plan.some((p, i) => counts[i] < p.sets) ? btn('w-alldone', '☑️ Belgilanmaganlarni ham bajardim', 'ghost wide') : ''}
    <p class="q">Umuman qanchalik og‘ir bo‘ldi? <small class="muted">1 = juda oson, 10 = maksimal</small></p>
    <div class="rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => btn('w-rpe', k, k >= 9 ? 'hot' : '', k)).join('')}</div>
    ${btn('w-back', '⬅️ Orqaga', 'ghost wide')}</section>`;
}

// ── actions ──
export async function action(a, arg, el) {
  const sess = active();
  if (!sess) return;
  const st = sess.state, plan = sess.plan, now = Date.now();
  const it = st.ex != null ? plan[st.ex] : null, ex = it ? D.EX[it.key] : null;
  let rerender = true;
  switch (a) {
    case 'w-wu': E.warmupStart(st, Number(arg) || 7, now); S.db().profile.warmupMin = Number(arg) || 7; break;
    case 'w-wskip': case 'w-wdone': E.warmupDone(st, plan, countsOf(sess)); break;
    case 'w-precheck': E.preCheck(st, arg); N.buzz('tap'); break;
    case 'w-pretech': return ctx.showExercise(arg);
    case 'w-predone': case 'w-preskip':
      sess.prehab = { keys: st.prehab, done: a === 'w-predone' ? (st.preChecked.length ? st.preChecked : st.prehab) : [], skipped: a === 'w-preskip' };
      E.prehabDone(st, plan, countsOf(sess), a === 'w-preskip');
      if (a === 'w-predone') toast('🛡 Himoya bloki bajarildi');
      break;
    case 'w-pause': E.pause(st, now); break;
    case 'w-resume': E.resume(st, now); break;
    case 'w-plus30': E.addTime(st, 30); break;
    case 'w-restskip': E.restDone(st); break;
    case 'w-wp': case 'w-wm': case 'w-rp': case 'w-rm': {
      const step = C.weightStep(ex), rs = ex.unit === 'sec' ? 5 : 1;
      const max = { reps: 100, bw: 200, sec: 900, min: 180 }[ex.unit];
      E.adjust(st, a === 'w-wp' ? step : a === 'w-wm' ? -step : 0, a === 'w-rp' ? rs : a === 'w-rm' ? -rs : 0, 1, max);
      N.buzz('tap'); break;
    }
    case 'w-save': {
      if (st.stage !== 'exercise' || !ex) break;
      if (el) el.disabled = true;                       // no double logging
      const v = st.v;
      if (E.isStale(st, v)) break;
      const n = setsOf(sess, st.ex).length + 1;
      S.db().sets.push({ id: S.nextId(), sid: sess.id, exIdx: st.ex, key: it.key, w: ex.unit === 'reps' || ex.unit === 'bw' ? (st.w || 0) : 0,
                         r: st.r, rating: null, at: new Date().toISOString(), deload: !!sess.deload });
      st.note = '';
      E.afterSet(st, plan, countsOf(sess), n < it.sets ? it.rest : 0, now);
      N.buzz('tap');
      break;
    }
    case 'w-rate': {
      const mine = S.db().sets.filter(x => x.sid === sess.id && x.exIdx === st.ex);
      const last = mine[mine.length - 1];
      if (!last) break;
      last.rating = arg; st.lastRating = arg;
      const sg = D.suggestion(it, sess.factor, sess.id);
      const nx = C.nextSetDraft(ex, it, last.w, last.r, arg, !!sg.held || !!sg.pain);
      E.setDraft(st, nx.w, nx.r);
      st.note = nx.msg;
      st.v += 1;
      break;
    }
    case 'w-fb': {
      S.db().formfb.push({ sid: sess.id, key: it.key, value: arg, at: new Date().toISOString() });
      E.feedback(st, plan, countsOf(sess), arg);
      await S.save();
      if (arg === 'pain') await askPain(sess.id);
      else if (arg === 'bad') toast('👍 Yozib qo‘ydim — keyingi safar vazn oshirilmaydi. 📖 Texnika va videoni ko‘rib chiqing.', 4000);
      break;
    }
    case 'w-flag': st.flags = { ...(st.flags || {}), [arg]: !(st.flags || {})[arg] }; st.v += 1; break;
    case 'w-fbq': {
      const idxs = [st.ex].concat(it.ssWith != null ? [it.ssWith] : []);
      for (const ix of idxs) {
        const mine = S.db().sets.filter(x => x.sid === sess.id && x.exIdx === ix);
        mine.forEach((x, n) => { x.rating = arg === 'hard' ? (n === mine.length - 1 ? 'hard' : 'ok') : arg; });
        const f = st.flags || {};
        S.db().formfb.push({ sid: sess.id, key: plan[ix].key, value: f.pain ? 'pain' : f.bad ? 'bad' : 'ok', at: new Date().toISOString() });
      }
      const pain = st.flags && st.flags.pain;
      st.flags = {};
      E.feedback(st, plan, countsOf(sess), arg);
      await S.save();
      if (pain) await askPain(sess.id);
      break;
    }
    case 'w-edit': return editSheet(sess);
    case 'w-skip': E.skip(st, plan, countsOf(sess)); break;
    case 'w-back': E.back(st, plan); break;
    case 'w-undo': {
      if (!(await confirmBox('Oxirgi saqlangan setni o‘chiraymi?', 'Ha, o‘chirish', 'Yo‘q', true))) { rerender = false; break; }
      const sets = S.db().sets;
      const idx = sets.map(x => x.sid).lastIndexOf(sess.id);
      if (idx >= 0) {
        const [rm] = sets.splice(idx, 1);
        E.undoSet(st); st.ex = rm.exIdx; E.setDraft(st, rm.w, rm.r);
      }
      break;
    }
    case 'w-swstart': sw = Date.now(); N.buzz('tap'); break;
    case 'w-swstop': if (sw) { st.r = Math.max(1, Math.round((Date.now() - sw) / 1000)); sw = null; st.v += 1; N.buzz('tap'); } break;
    case 'w-exdone': {
      if (st.stage !== 'exercise' || !ex) break;
      const left = it.sets - setsOf(sess, st.ex).length;
      for (let k = 0; k < left; k++) S.db().sets.push({ id: S.nextId(), sid: sess.id, exIdx: st.ex, key: it.key, w: ex.unit === 'reps' || ex.unit === 'bw' ? (st.w || 0) : 0, r: st.r, rating: 'ok', at: new Date().toISOString(), deload: !!sess.deload });
      st.note = '';
      E.afterSet(st, plan, countsOf(sess), 0, now);
      toast(`☑️ ${left} ta set yozildi`);
      break;
    }
    case 'w-alldone': {
      if (!(await confirmBox('Belgilanmagan barcha setlar tavsiya qilingan vazn bilan «bajarildi» deb yoziladi. Davom etamizmi?', 'Ha, yozish'))) { rerender = false; break; }
      const c = countsOf(sess);
      plan.forEach((p, i) => {
        const e2 = D.EX[p.key];
        if (c[i] >= p.sets) return;
        const prev = setsOf(sess, i), sg = D.suggestion(p, sess.factor, sess.id);
        const w = prev.length ? prev[prev.length - 1].w : (e2.unit === 'reps' ? (sg.weight ?? sg.draftW ?? 0) : 0);
        const r = prev.length ? prev[prev.length - 1].r : (sg.target || p.lo);
        for (let k = c[i]; k < p.sets; k++) S.db().sets.push({ id: S.nextId(), sid: sess.id, exIdx: i, key: p.key, w, r, rating: 'ok', at: new Date().toISOString(), deload: !!sess.deload, bulk: true });
      });
      st.skipped = []; st.v += 1;
      toast('☑️ Hammasi yozildi');
      break;
    }
    case 'w-swap': return swapSheet(sess);
    case 'w-tech': return ctx.showExercise(it.key);
    case 'w-videos': return ctx.showExercise(it.key, true);
    case 'w-fin': {
      const left = plan.reduce((a2, p, i) => a2 + Math.max(0, p.sets - countsOf(sess)[i]), 0);
      if (!(await confirmBox('🏁 Mashg‘ulotni hozir yakunlaymizmi?' + (left ? `<br><small>Bajarilmagan setlar: ${left}. Saqlanganlari yo‘qolmaydi.</small>` : ''), 'Ha, yakunlash'))) { rerender = false; break; }
      E.finishNow(st); break;
    }
    case 'w-rpe': return finish(sess, Number(arg));
    case 'w-menu': return menuSheet(sess);
    default: rerender = false;
  }
  if (!['w-wp', 'w-wm', 'w-rp', 'w-rm'].includes(a)) scheduleNotif(sess, st);
  await S.save();
  if (rerender) ctx.render();
}

async function menuSheet(sess) {
  const v = await choose('Mashg‘ulot', [['plan', '📋 Bugungi reja'], ['back', '⬅️ Oldingi mashq'], ['pause', '⏸ Pauza'],
    ['fin', '🏁 Yakunlash'], ['cancel', '✖️ Bekor qilish (setlar o‘chadi)']]);
  if (v === 'plan') {
    const c = countsOf(sess);
    return sheet(`<h3>📋 Bugungi reja</h3><ul class="plain">${sess.plan.map((p, i) => `<li>${c[i] >= p.sets ? '✅' : sess.state.skipped.includes(i) ? '⏭' : i === sess.state.ex ? '▶️' : '▫️'} ${i + 1}. ${esc(D.EX[p.key].short)} — ${c[i]}/${p.sets}<br><small class="muted">${esc(D.scheme(p))}</small></li>`).join('')}</ul>
      <button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
  }
  if (v === 'back') return action('w-back');
  if (v === 'pause') return action('w-pause');
  if (v === 'fin') return action('w-fin');
  if (v === 'cancel') {
    const n = S.db().sets.filter(x => x.sid === sess.id).length;
    if (!(await confirmBox(`✖️ Mashg‘ulotni bekor qilasizmi?${n ? `<br><b>Bugun saqlangan ${n} ta set o‘chiriladi.</b>` : ''}<br><small>Dasturdagi o‘rningiz o‘zgarmaydi.</small>`, 'Ha, bekor qilish', 'Yo‘q', true))) return;
    const db = S.db();
    db.sets = db.sets.filter(x => x.sid !== sess.id);
    db.formfb = db.formfb.filter(x => x.sid !== sess.id);
    db.sessions = db.sessions.filter(x => x.id !== sess.id);
    db.activeSid = null;
    await N.cancelTimer(); N.keepAwake(false);
    await S.save();
    toast('Mashg‘ulot bekor qilindi. O‘rningiz saqlandi.');
    ctx.go('today');
  }
}

async function editSheet(sess) {
  const st = sess.state, it = sess.plan[st.ex], ex = D.EX[it.key];
  const step = C.weightStep(ex) || 1, rs = ex.unit === 'sec' ? 5 : 1;
  const html = () => `<h3>✏️ Bugun qanday bo‘ldi?</h3><p class="muted tiny">Faqat rejadan farq qilsa o‘zgartiring. Qolgan setlar shu qiymat bilan yoziladi.</p>
    ${ex.unit === 'reps' ? `<div class="stepper"><button class="step" data-s="wm">−${D.fmtW(step)}</button><div class="val"><b>${D.fmtW(st.w)}</b><small>kg</small></div><button class="step" data-s="wp">+${D.fmtW(step)}</button></div>` : ''}
    <div class="stepper"><button class="step" data-s="rm">−${rs}</button><div class="val"><b>${st.r}</b><small>${D.unitLabel(ex.unit)}</small></div><button class="step" data-s="rp">+${rs}</button></div>
    <button class="btn primary wide" data-s="ok">Saqlash</button>`;
  await sheet(html(), { onClick: (v, b, wrap) => {
    if (v === 'ok') return closeSheet(true);
    if (v === 'wm') st.w = Math.max(0, (st.w || 0) - step); if (v === 'wp') st.w = (st.w || 0) + step;
    if (v === 'rm') st.r = Math.max(1, st.r - rs); if (v === 'rp') st.r = st.r + rs;
    N.buzz('tap');
    wrap.querySelector('.sheet').innerHTML = '<div class="sheet-grip"></div>' + html();
  } });
  st.v += 1;
  await S.save();
  ctx.render();
}

async function swapSheet(sess) {
  const st = sess.state, it = sess.plan[st.ex], ex = D.EX[it.key];
  const alts = [...new Set([...(ex.alts || []), ...(ex.travel || []), ...(it.orig && it.orig !== it.key ? [it.orig] : [])])]
    .filter(k => k !== it.key && D.EX[k]);
  const missing = S.db().profile.missing || [];
  const okAlts = alts.filter(k => C.equipOk(k, missing));
  let pick = await choose('🔁 Nimaga almashtiramiz?', [['__noequip', '🚫 Zalda bu jihoz yo‘q', 'Ilova muqobilini o‘zi tanlaydi va keyingi safarlarda ham hisobga oladi']]
    .concat(okAlts.map(k => [k, D.EX[k].short, D.EX[k].en])));
  if (!pick) return;
  if (pick === '__noequip') {
    const needs = C.NEEDS[it.key] || [];
    if (!needs.length) return toast('Bu mashq uchun jihoz kerak emas');
    const eq = needs.length === 1 ? needs[0] : await choose('Qaysi jihoz yo‘q?', needs.map(n => [n, C.EQUIP[n]]));
    if (!eq) return;
    S.db().profile.missing = [...new Set([...(S.db().profile.missing || []), eq])];
    const sub = C.substituteEquipment([it], S.db().profile.missing, D.EX).plan[0];
    if (sub.key === it.key) { await S.save(); return toast('Muqobil topilmadi — bu mashqni o‘tkazib yuboring'); }
    Object.assign(it, sub);
    E.replaced(st);
    await S.save();
    toast(`🏗 «${C.EQUIP[eq]}» yo‘q deb belgilandi → ${D.EX[it.key].short}. Sozlamalardan qaytarish mumkin.`, 4500);
    return ctx.render();
  }
  const how = await choose('Qancha muddatga?', [['once', 'Faqat bugun', 'Trenajyor band yoki jihoz yo‘q'],
    ['always', 'Doimiy — dasturda ham almashsin', 'Masalan, bu mashq sizga to‘g‘ri kelmasa']]);
  if (!how) return;
  const old = it.key;
  it.key = pick;
  if (D.EX[pick].unit !== D.EX[old].unit) { const l = { sec: [20, 40], min: [10, 15] }[D.EX[pick].unit] || [8, 12]; it.lo = l[0]; it.hi = l[1]; }
  if (how === 'always') { S.db().swaps[it.orig || old] = pick; if (pick === (it.orig || old)) delete S.db().swaps[pick]; }
  E.replaced(st);
  await S.save();
  toast(how === 'always' ? '🔁 Doimiy almashtirildi (Dastur → Almashtirishlar bo‘limidan qaytarish mumkin)' : '🔁 Bugun uchun almashtirildi');
  ctx.render();
}

export async function askPain(sid) {
  const areas = D.TX.painAreas;
  const area = await choose('🩹 Qayerda og‘riq?', Object.entries(areas).map(([k, v]) => [k, v]).concat([['muscle', 'Mushak (bo‘g‘im emas)']]));
  if (!area) return;
  const type = await choose('Qanday og‘riq?', [['muscle', '💪 Mushak achishishi / zo‘riqish'], ['joint', '🦴 Bo‘g‘im og‘rig‘i'],
    ['sharp', '⚡ O‘tkir / sanchiqli'], ['chest', '🚨 Ko‘krakda og‘riq / nafas qisishi / bosh aylanishi']]);
  if (!type) return;
  S.db().pain.push({ at: new Date().toISOString(), area, type, sid });
  await S.save();
  if (type === 'chest') return sheet(`<h3>🚨 Darhol to‘xtang</h3><p class="sheet-text">Ko‘krakda og‘riq, nafas qisishi, bosh aylanishi yoki hushdan ketish holatida mashqni <b>darhol to‘xtating va 103 ga qo‘ng‘iroq qiling</b>. Yolg‘iz qolmang.</p><a class="btn danger wide" href="tel:103">📞 103 ga qo‘ng‘iroq</a><button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
  if (type === 'sharp' || type === 'joint') return sheet(`<h3>🦴 Ehtiyot bo‘ling</h3><p class="sheet-text">Bugun shu bo‘g‘imni yuklaydigan mashqlarni yengillating yoki almashtiring. 3 kun ichida bu mashqlarda vazn oshirilmaydi.<br><br>Shish, ko‘karish, harakat cheklanishi yoki og‘riq 3–5 kundan ortiq davom etsa — shifokorga murojaat qiling. Kuchli mushak og‘rig‘i bilan siydik qoramtir (kola rangida) bo‘lsa — darhol 103.</p><button class="btn wide" data-s="x">Tushunarli</button>`, { onClick: () => closeSheet() });
  toast('Yozib qo‘ydim. Mushak achishishi 24–72 soatda o‘tadi.');
}

async function finish(sess, rpe) {
  if (sess.finishedAt) return;
  const db = S.db();
  sess.rpe = rpe; sess.finishedAt = new Date().toISOString();
  sess.state.stage = 'done'; sess.state.v += 1;
  db.activeSid = null;
  V.done();
  if (!sess.bonus) db.nextSession = Math.min(D.TOTAL() + 1, sess.no + 1);   // a bonus session never moves the program
  await N.cancelTimer(); N.keepAwake(false); stopTicker();
  if (clock) { clearInterval(clock); clock = null; }
  await S.save();
  if (ctx.afterFinish) ctx.afterFinish();
  ctx.summary(sess.id);
}

// Summary card for a finished session (also used from history).
export function summaryHtml(sid) {
  const db = S.db(), sess = db.sessions.find(s => s.id === sid);
  const sets = db.sets.filter(x => x.sid === sid);
  const mins = Math.max(1, Math.round((Date.parse(sess.finishedAt) - Date.parse(sess.startedAt)) / 60000));
  const vol = sets.filter(x => D.EX[x.key].unit === 'reps' && !D.EX[x.key].assist).reduce((a, x) => a + x.w * x.r, 0);
  const recs = [];
  for (const key of new Set(sets.map(x => x.key))) {
    const ex = D.EX[key];
    if (ex.unit !== 'reps' || ex.assist) continue;
    const now = Math.max(0, ...sets.filter(x => x.key === key).map(x => C.e1rm(x.w, x.r) || 0));
    const before = Math.max(0, ...D.historyFor(key, sid, 60).flat().map(x => C.e1rm(x.w, x.r) || 0));
    if (before && now > before) recs.push(`🏆 ${esc(ex.short)}: ${now} kg (avval ${before})`);
  }
  const done = new Set(sets.map(x => x.exIdx));
  const missed = sess.plan.filter((p, i) => !done.has(i)).map(p => D.EX[p.key].short);
  return `<div class="big-emoji">🏁</div><h2>${sess.bonus ? 'Bonus mashg‘ulot' : `Mashg‘ulot #${sess.no}`} yakunlandi!</h2>
    <div class="stats"><div><b>${mins}</b><small>daqiqa</small></div><div><b>${sets.length}</b><small>set</small></div><div><b>${Math.round(vol).toLocaleString('ru')}</b><small>kg hajm</small></div><div><b>${sess.rpe || '—'}</b><small>RPE</small></div></div>
    ${missed.length ? `<p class="muted">⏭ Bajarilmadi: ${esc(missed.join(', '))}</p>` : ''}
    ${recs.length ? `<h3>Yangi rekordlar (kuch ko‘rsatkichi)</h3><ul class="plain">${recs.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
    ${sess.rpe >= 9 && !sess.deload ? '<p class="warn">Juda og‘ir bo‘ldi. Takrorlansa — uyqu va ovqatni tekshiring.</p>' : ''}
    <p class="muted">🥤 1 soat ichida oqsilga boy ovqat yoki kokteyl. Kamida 1 kun dam oling.</p>`;
}

export function onResume() { catchUp(); }
export function stop() { stopTicker(); }

// ── one-tap logging of a whole workout (no timers, no per-set input) ──
export async function quickLog(mode) {
  const db = S.db();
  if (active()) return ctx.render();
  const no = db.nextSession;
  if (no > D.TOTAL()) return;
  const s = D.PRG.sessions[no - 1];
  const tp = D.todaysPlan(mode, true, D.todayRole());
  const plan = tp.plan;
  const title = tp.bonus ? tp.title : s.title;
  const factor = D.todayFactor();
  const sug = plan.map(p => {
    const ex = D.EX[p.key], sg = D.suggestion(p, factor);
    const w = ex.unit === 'reps' ? (sg.weight ?? sg.draftW ?? 0) : 0;
    const r = ex.unit === 'min' ? p.hi : (sg.target || p.lo);
    return { w, r, ex };
  });
  const skip = new Set();
  const html = () => `<h3>✅ Bugungi mashg‘ulot</h3><p class="muted tiny">${tp.bonus ? '➕' : '#' + no} ${esc(title)}. Rejadagi vazn bilan yoziladi. Qilmagan mashq bo‘lsa — ustiga bosing.</p>
    <div class="qlist">${plan.map((p, i) => `<button class="qrow ${skip.has(i) ? 'off' : ''}" data-s="t${i}"><span class="qchk">${skip.has(i) ? '' : '✓'}</span>
      <span class="grow"><b>${esc(sug[i].ex.short)}</b><small>${p.sets} × ${D.setLabel(sug[i].ex, sug[i].w, sug[i].r)}</small></span></button>`).join('')}</div>
    <p class="q">Qanday o‘tdi?</p>
    <div class="rating"><button class="btn" data-s="easy">😌 Oson</button><button class="btn" data-s="ok">💪 Me’yorida</button><button class="btn" data-s="hard">🥵 Og‘ir</button></div>`;
  const res = await sheet(html(), { onClick: (v, b, wrap) => {
    if (v.startsWith('t')) { const i = Number(v.slice(1)); skip.has(i) ? skip.delete(i) : skip.add(i); wrap.querySelector('.sheet').innerHTML = '<div class="sheet-grip"></div>' + html(); N.buzz('tap'); return; }
    closeSheet(v);
  } });
  if (!res) return;
  if (skip.size === plan.length) return toast('Hech qaysi mashq belgilanmadi');
  const mins = C.estimateMinutes(plan.filter((_, i) => !skip.has(i)), D.EX);
  const now = Date.now();
  const sess = { id: S.nextId(), no, week: s.week, phase: s.phase, title, bonus: !!tp.bonus, mode, deload: s.deload, test: tp.bonus ? false : s.test, factor, plan,
                 state: { v: 1, stage: 'done', skipped: [...skip] }, startedAt: new Date(now - mins * 60000).toISOString(),
                 finishedAt: new Date(now).toISOString(), rpe: { easy: 6, ok: 7, hard: 9 }[res], quick: true };
  db.sessions.push(sess);
  plan.forEach((p, i) => {
    if (skip.has(i)) return;
    for (let k = 0; k < p.sets; k++) db.sets.push({ id: S.nextId(), sid: sess.id, exIdx: i, key: p.key, w: sug[i].w, r: sug[i].r,
      rating: res === 'hard' ? (k === p.sets - 1 ? 'hard' : 'ok') : res, at: sess.finishedAt, deload: !!s.deload });
    db.formfb.push({ sid: sess.id, key: p.key, value: 'ok', at: sess.finishedAt });
  });
  if (!tp.bonus) db.nextSession = Math.min(D.TOTAL() + 1, no + 1);
  await S.save();
  if (ctx.afterFinish) ctx.afterFinish();
  ctx.summary(sess.id);
}
