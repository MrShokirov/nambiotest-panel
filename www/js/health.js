// 🩺 Salomatlik: BMI + waist/height, blood pressure, lab results every ~6 months (trend + status).
// General reference ranges only — the lab report's own range and the doctor's opinion always prevail.
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import * as H from './health-core.js';
import { line } from './charts.js';
import { ic } from './icons.js';
import { esc, sheet, closeSheet, confirmBox, toast } from './ui.js';

let ctx = null;
export const init = c => { ctx = c; };
export const store = () => { const db = S.db(); db.health ||= {}; db.health.labs ||= []; db.health.bp ||= []; db.health.units ||= {}; return db.health; };
const unitIdx = key => store().units[key] || 0;
const unitName = (key, ui = unitIdx(key)) => H.LAB[key].units[ui][0];
const dshort = k => k.slice(2).split('-').reverse().join('.');
const DISCLAIMER = '⚕️ Bu tashxis emas. Ko‘rsatilgan oraliqlar — kattalar erkaklar uchun umumiy ma’lumot; laboratoriya blankasidagi me’yor ustun. Natijalarni shifokor bilan muhokama qiling.';

function bodyNow() {
  const db = S.db(), p = db.profile;
  const w = [...db.body].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const m = [...(db.measures || [])].filter(x => x.waist).sort((a, b) => a.date.localeCompare(b.date)).pop();
  const weight = w ? w.weight : p.weight;
  const b = H.bmi(weight, p.height), wh = m ? H.waistHeight(m.waist, p.height) : null;
  const bf = m ? C.navyBodyfat(m.waist, m.neck, p.height) : null;
  return { weight, b, wh, bf, m };
}

// BMI scale 15–40 with WHO cut-offs.
function bmiScale(v) {
  const pos = x => Math.max(0, Math.min(100, (x - 15) / 25 * 100));
  return `<div class="bmi-scale"><i class="z1"></i><i class="z2"></i><i class="z3"></i><i class="z4"></i>
    ${v ? `<b style="left:${pos(v)}%"></b>` : ''}</div><div class="bmi-lab"><span>18.5</span><span>25</span><span>30</span></div>`;
}

export function render(root) {
  const hs = store(), { weight, b, wh, bf } = bodyNow();
  const bps = [...hs.bp].sort((a, c) => a.date.localeCompare(c.date));
  const lastBp = bps[bps.length - 1], bpS = lastBp ? H.bpStatus(lastBp.sys, lastBp.dia) : null;
  const due = H.nextLabDue(hs.labs), L = H.latest(hs.labs), sm = H.summary(hs.labs);
  const groups = Object.entries(H.GROUPS).map(([g, gname]) => {
    const rows = H.LABS.filter(l => l.group === g).map(l => {
      const x = L[l.key];
      if (!x) return `<button class="labrow empty" data-a="hl-test" data-arg="${l.key}"><span class="grow"><b>${esc(l.name)}</b><small>hali kiritilmagan</small></span><span class="st">${H.ICON.none}</span></button>`;
      const st = H.labStatus(l.key, x.v), tr = H.labTrend(l.key, x.prev, x.v);
      return `<button class="labrow" data-a="hl-test" data-arg="${l.key}"><span class="grow"><b>${esc(l.name)}</b>
        <small>${dshort(x.date)} · ${esc(st.text)}${tr ? ` · <span class="tr ${tr.dir}">${tr.arrow} ${esc(tr.text)}</span>` : ''}</small></span>
        <span class="lv"><b>${H.fmt(l.key, x.v, unitIdx(l.key))}</b><small>${esc(unitName(l.key))}</small></span><span class="st">${H.ICON[st.s]}</span></button>`;
    }).join('');
    return `<div class="card"><h3>${gname}</h3>${rows}</div>`;
  }).join('');
  root.innerHTML = `<div class="page"><div class="topbar"><button class="icon" data-a="drawer" aria-label="Menyu">${ic('menu')}</button><b>Salomatlik</b><span></span></div>
    <div class="card"><div class="row between"><h3>⚖️ Tana massasi indeksi (TMI)</h3><button class="btn small" data-a="pr-weight">+ Vazn</button></div>
      ${b ? `<div class="row gap center-y"><div class="bmi-big ${b.s}"><b>${b.v.toFixed(1)}</b><small>TMI</small></div><div class="grow"><b>${esc(b.cat)}</b><p class="tiny muted">${D.fmtW(weight)} kg · ${S.db().profile.height} sm · me’yoriy vazn ${b.healthy[0]}–${b.healthy[1]} kg</p></div></div>
        ${bmiScale(b.v)}` : '<p class="muted tiny">Bo‘y va vazn kiritilsa hisoblanadi.</p>'}
      <div class="kv"><span>Bel / bo‘y nisbati</span><b>${wh ? `${wh.v} ${H.ICON[wh.s]} <small>${esc(wh.text)}</small>` : '<button class="btn small" data-a="pg-meas">+ Bel o‘lchash</button>'}</b></div>
      ${bf ? `<div class="kv"><span>Tana yog‘i (taxminiy)</span><b>${bf}%</b></div>` : ''}
      <p class="insight">${H.bmiNote(b, wh)}</p></div>
    <div class="card"><div class="row between"><h3>❤️ Qon bosimi</h3><button class="btn small primary" data-a="hl-bp">+ Kiritish</button></div>
      ${lastBp ? `<div class="row gap center-y"><div class="bp-big ${bpS.s}"><b>${lastBp.sys}/${lastBp.dia}</b><small>mm sim. ust.</small></div><div class="grow"><b>${H.ICON[bpS.s]} ${esc(bpS.text)}</b><p class="tiny muted">${dshort(lastBp.date)}${lastBp.pulse ? ` · puls ${lastBp.pulse}` : ''}</p></div></div>
        ${bps.length > 1 ? line(bps.map(x => x.sys), { labels: bps.map(x => dshort(x.date).slice(0, 5)), h: 110, color: 'var(--c-health)' }) : ''}
        ${bpS.urgent ? '<p class="warn">180/120 dan yuqori: 5 daqiqa tinch o‘tirib qayta o‘lchang. Ko‘krakda og‘riq, kuchli bosh og‘rig‘i, ko‘rish buzilishi yoki nafas qisishi bo‘lsa — darhol 103.</p>' : ''}`
        : '<p class="muted tiny">Oyiga 1–2 marta: ertalab, 5 daqiqa tinch o‘tirib, mashg‘ulotdan oldin. 2 marta o‘lchab, o‘rtachasini yozing.</p>'}</div>
    <div class="card hero-lab ${due.overdue ? 'due' : ''}"><div class="row between"><h3>🧪 Tahlillar (6 oyda 1 marta)</h3><span class="pill">${sm.total ? `${sm.ok}✅ ${sm.mid}🟡 ${sm.bad}🔴` : 'yangi'}</span></div>
      <p class="muted">${!hs.labs.length ? 'Birinchi natijalarni kiriting — keyingi safar ilova o‘zgarishni ko‘rsatadi.' : due.overdue ? `📅 Tahlil vaqti keldi (oxirgisi ${dshort([...hs.labs].sort((a, c) => a.date.localeCompare(c.date)).pop().date)})` : `📅 Keyingi tahlil: ${due.due.toLocaleDateString('ru')} (${due.days} kun qoldi)`}</p>
      <div class="row gap"><button class="btn primary grow" data-a="hl-add">+ Natijalarni kiritish</button><button class="btn grow" data-a="hl-prep">📋 Tayyorgarlik</button></div>
      ${sm.bad ? '<p class="note">🔴 belgili natijalarni shifokorga ko‘rsating — bitta natija bilan xulosa qilinmaydi, ko‘pincha qayta topshiriladi.</p>' : ''}</div>
    ${groups}
    ${hs.labs.length ? `<div class="card"><h3>📁 Kiritilgan tahlillar</h3>${[...hs.labs].sort((a, c) => c.date.localeCompare(a.date)).map(e => `<button class="histrow" data-a="hl-entry" data-arg="${e.id}"><span class="grow"><b>${new Date(e.date).toLocaleDateString('ru')}</b><small>${Object.keys(e.values).length} ta ko‘rsatkich${e.lab ? ' · ' + esc(e.lab) : ''}</small></span><span>›</span></button>`).join('')}</div>` : ''}
    <p class="tiny muted">${DISCLAIMER}</p></div>`;
}

// ── entry sheet: all tests on one screen, any subset can be filled ──
async function addSheet(edit = null) {
  const hs = store();
  const ui = Object.fromEntries(H.LABS.map(l => [l.key, unitIdx(l.key)]));
  const vals = {};
  if (edit) for (const [k, v] of Object.entries(edit.values)) vals[k] = H.fmt(k, v, ui[k]);
  let date = edit ? edit.date : D.dateKey(), lab = edit ? edit.lab || '' : '';
  const read = wrap => {
    date = wrap.querySelector('#hl-date').value || date; lab = wrap.querySelector('#hl-lab').value.trim().slice(0, 40);
    wrap.querySelectorAll('[data-k]').forEach(i => { vals[i.dataset.k] = i.value; });
  };
  const html = () => `<h3>🧪 Tahlil natijalari</h3><p class="tiny muted">Faqat topshirganlaringizni yozing. Birlik noto‘g‘ri bo‘lsa — birlik tugmasini bosing (blankadagidek bo‘lsin).</p>
    <div class="grid2"><label class="field">Sana<input class="input" id="hl-date" type="date" value="${date}" max="${D.dateKey()}"></label>
    <label class="field">Laboratoriya<input class="input" id="hl-lab" value="${esc(lab)}" placeholder="ixtiyoriy"></label></div>
    ${Object.entries(H.GROUPS).map(([g, gname]) => `<p class="q">${gname}</p>${H.LABS.filter(l => l.group === g).map(l => `<div class="labin"><label for="in-${l.key}">${esc(l.name)}</label>
      <input class="input" id="in-${l.key}" data-k="${l.key}" inputmode="decimal" value="${esc(vals[l.key] || '')}" placeholder="—">
      <button class="unit" data-s="u${l.key}" ${l.units.length < 2 ? 'disabled' : ''}>${esc(l.units[ui[l.key]][0])}</button></div>`).join('')}`).join('')}
    <p class="warn" id="hl-err" hidden></p>
    <button class="btn primary wide xl" data-s="save">Saqlash</button><button class="btn ghost wide" data-s="x">Bekor qilish</button>`;
  const res = await sheet(html(), { onClick: (v, b, wrap) => {
    if (v === 'x') return closeSheet(null);
    read(wrap);
    if (v.startsWith('u')) {
      const k = v.slice(1), l = H.LAB[k];
      const num = parseFloat(String(vals[k] || '').replace(',', '.'));
      const base = num > 0 ? H.toBase(k, num, ui[k]) : null;
      ui[k] = (ui[k] + 1) % l.units.length;
      if (base != null) vals[k] = H.fmt(k, base, ui[k]);
      b.textContent = l.units[ui[k]][0];
      const inp = wrap.querySelector(`#in-${k}`); if (inp) inp.value = vals[k] || '';
      return;
    }
    if (v === 'save') {
      const out = {}, bad = [];
      for (const l of H.LABS) {
        const raw = String(vals[l.key] || '').trim().replace(',', '.');
        if (!raw) continue;
        const n = parseFloat(raw);
        const base = n > 0 ? H.toBase(l.key, n, ui[l.key]) : NaN;
        if (!(base > 0) || !H.plausible(l.key, base)) bad.push(l.name); else out[l.key] = Math.round(base * 1000) / 1000;
      }
      const err = wrap.querySelector('#hl-err');
      if (bad.length) { err.hidden = false; err.textContent = `Tekshiring (birlik yoki vergul): ${bad.join(', ')}`; return; }
      if (!Object.keys(out).length) { err.hidden = false; err.textContent = 'Kamida bitta natija kiriting.'; return; }
      if (!/^\d{4}-\d\d-\d\d$/.test(date) || date > D.dateKey()) { err.hidden = false; err.textContent = 'Sanani tekshiring.'; return; }
      closeSheet({ values: out });
    }
  } });
  if (!res) return;
  Object.assign(hs.units, ui);
  if (edit) Object.assign(edit, { date, lab, values: res.values });
  else hs.labs.push({ id: S.nextId(), date, lab, values: res.values });
  await S.save();
  const sm = H.summary([{ date, values: res.values }]);
  toast(`✅ Saqlandi · ${[['ok', '✅'], ['mid', '🟡'], ['bad', '🔴']].filter(([k]) => sm[k]).map(([k, i]) => sm[k] + i).join(' ')}`);
  if (ctx.afterHealth) ctx.afterHealth();
  ctx.render();
}

function testSheet(key) {
  const l = H.LAB[key], hs = store(), ui = unitIdx(key);
  const ser = H.series(hs.labs, key);
  const bands = l.bands.map(([max, s, t], i) => {
    const from = i ? l.bands[i - 1][0] : null;
    const r = from == null ? `< ${H.fmt(key, max, ui)}` : !Number.isFinite(max) ? `≥ ${H.fmt(key, from, ui)}` : `${H.fmt(key, from, ui)} – ${H.fmt(key, max, ui)}`;
    return `<li>${H.ICON[s]} ${r} ${esc(unitName(key, ui))} — ${esc(t)}</li>`;
  }).join('');
  return sheet(`<h3>${esc(l.name)}</h3><p class="sheet-text">${esc(l.info)}</p>
    ${ser.length > 1 ? line(ser.map(x => Number(H.fmt(key, x.v, ui))), { labels: ser.map(x => dshort(x.date)), unit: '', h: 130, color: 'var(--c-health)' }) : ''}
    ${ser.length ? `<table class="tbl"><tr><th>Sana</th><th>Natija</th><th></th></tr>${[...ser].reverse().map(x => { const st = H.labStatus(key, x.v); return `<tr><td>${dshort(x.date)}</td><td>${H.fmt(key, x.v, ui)} ${esc(unitName(key, ui))}</td><td>${H.ICON[st.s]} ${esc(st.text)}</td></tr>`; }).join('')}</table>` : '<p class="muted tiny">Hali natija yo‘q.</p>'}
    <p class="q">Umumiy oraliq (erkaklar)</p><ul class="plain">${bands}</ul>
    ${l.units.length > 1 ? `<button class="btn wide" data-s="unit">Birlik: ${esc(unitName(key, ui))} → ${esc(unitName(key, (ui + 1) % l.units.length))}</button>` : ''}
    <p class="tiny muted">${DISCLAIMER}</p><button class="btn wide" data-s="x">Yopish</button>`, { onClick: async v => {
    if (v === 'unit') { hs.units[key] = (ui + 1) % l.units.length; await S.save(); closeSheet(); ctx.render(); return testSheet(key); }
    closeSheet();
  } });
}

function entrySheet(id) {
  const hs = store(), e = hs.labs.find(x => x.id === Number(id));
  if (!e) return;
  return sheet(`<h3>🧪 ${new Date(e.date).toLocaleDateString('ru')}${e.lab ? ' · ' + esc(e.lab) : ''}</h3>
    <table class="tbl">${Object.entries(e.values).map(([k, v]) => { const st = H.labStatus(k, v); return `<tr><td>${esc(H.LAB[k].name)}</td><td>${H.fmt(k, v, unitIdx(k))} ${esc(unitName(k))}</td><td>${H.ICON[st.s]}</td></tr>`; }).join('')}</table>
    <div class="row gap"><button class="btn grow" data-s="edit">✏️ Tahrirlash</button><button class="btn danger grow" data-s="del">🗑 O‘chirish</button></div>
    <button class="btn wide" data-s="x">Yopish</button>`, { onClick: async v => {
    if (v === 'edit') { closeSheet(); return addSheet(e); }
    if (v === 'del') {
      closeSheet();
      if (await confirmBox('Bu tahlil yozuvi o‘chirilsinmi?', 'O‘chirish', 'Bekor', true)) { hs.labs = hs.labs.filter(x => x !== e); await S.save(); toast('O‘chirildi'); ctx.render(); }
      return;
    }
    closeSheet();
  } });
}

async function bpSheet() {
  const res = await sheet(`<h3>❤️ Qon bosimi</h3><p class="tiny muted">5 daqiqa tinch o‘tiring, qo‘l yurak balandligida. 1 daqiqa oraliq bilan 2 marta o‘lchang — o‘rtachasini yozing. Mashg‘ulot va qahvadan keyin 30 daqiqa o‘lchamang.</p>
    <div class="grid3"><label class="field">Yuqori<input class="input" id="bp-s" inputmode="numeric" placeholder="120"></label>
    <label class="field">Pastki<input class="input" id="bp-d" inputmode="numeric" placeholder="80"></label>
    <label class="field">Puls<input class="input" id="bp-p" inputmode="numeric" placeholder="ixt."></label></div>
    <p class="warn" id="bp-err" hidden></p>
    <button class="btn primary wide" data-s="ok">Saqlash</button><button class="btn ghost wide" data-s="x">Bekor</button>`, { onClick: (v, b, wrap) => {
    if (v !== 'ok') return closeSheet(null);
    const sys = parseInt(wrap.querySelector('#bp-s').value, 10), dia = parseInt(wrap.querySelector('#bp-d').value, 10);
    const pv = wrap.querySelector('#bp-p').value.trim(), pulse = pv ? parseInt(pv, 10) : null;
    if (!H.bpPlausible(sys, dia, pulse)) { const e = wrap.querySelector('#bp-err'); e.hidden = false; e.textContent = 'Qiymatlarni tekshiring (masalan 125 / 80).'; return; }
    closeSheet({ sys, dia, pulse });
  } });
  if (!res) return;
  const hs = store(), date = D.dateKey();
  hs.bp = hs.bp.filter(x => x.date !== date); hs.bp.push({ date, ...res });
  await S.save();
  const st = H.bpStatus(res.sys, res.dia);
  toast(`${H.ICON[st.s]} ${res.sys}/${res.dia} — ${st.text}`);
  ctx.render();
}

export function prepSheet() {
  return sheet(`<h3>📋 Tahlilga tayyorgarlik</h3><ol class="tl">
    <li><b>Ertalab 7:00–10:00</b>, 8–12 soat och qoringa (oddiy suv mumkin). Testosteron ertalab eng yuqori bo‘ladi — vaqti muhim.</li>
    <li><b>48–72 soat og‘ir mashg‘ulot qilmang.</b> Kuch mashqidan keyin ALT/AST va kreatinin vaqtincha oshadi — ilovada tahlil kunidan oldin dam olish kunini rejalang.</li>
    <li>Oldingi kuni spirtli ichimlik va juda yog‘li kechki ovqat yo‘q (triglitseridlarni oshiradi).</li>
    <li>Biotin (B7) yoki «soch-tirnoq» vitaminlari ichsangiz — shifokor bilan kelishib, 2–3 kun oldin to‘xtating: TSH va gormon natijalarini buzishi mumkin.</li>
    <li>Kreatin yoki boshqa qo‘shimchalar ichsangiz — laborant/shifokorga ayting.</li>
    <li>Kasal bo‘lsangiz (isitma, shamollash) — tuzalgandan 1–2 hafta keyin topshiring (ferritin va boshqalar o‘zgaradi).</li>
    <li>Iloji bo‘lsa, har safar bir xil laboratoriyada — natijalar solishtiriladigan bo‘ladi.</li></ol>
    <p class="q">Ro‘yxat (laborantga ko‘rsatish uchun)</p>
    <p class="sheet-text">Lipid profili (umumiy xolesterin, LDL, HDL, triglitseridlar) · glyukoza (och qoringa) · HbA1c · umumiy testosteron · TTG (TSH) · 25-OH vitamin D · ferritin · umumiy qon tahlili (gemoglobin) · ALT · AST · kreatinin</p>
    <p class="tiny muted">Qaysi tahlillar kerakligini shifokoringiz bilan kelishing.</p>
    <button class="btn wide" data-s="x">Tushunarli</button>`, { onClick: () => closeSheet() });
}

// Short block for «Barcha ma’lumotlar».
export function dataRows() {
  const hs = store(), { b, wh } = bodyNow(), due = H.nextLabDue(hs.labs), sm = H.summary(hs.labs);
  const bp = [...hs.bp].sort((a, c) => a.date.localeCompare(c.date)).pop();
  return `<tr><td>TMI</td><td>${b ? `${b.v.toFixed(1)} ${H.ICON[b.s]} ${esc(b.cat)}` : '—'}</td></tr>
    <tr><td>Bel/bo‘y</td><td>${wh ? `${wh.v} ${H.ICON[wh.s]}` : '—'}</td></tr>
    <tr><td>Qon bosimi</td><td>${bp ? `${bp.sys}/${bp.dia}` : '—'}</td></tr>
    <tr><td>Tahlillar</td><td>${sm.total ? `${sm.ok}✅ ${sm.mid}🟡 ${sm.bad}🔴` : '—'}${hs.labs.length ? ` · keyingisi ${due.overdue ? 'hozir' : due.due.toLocaleDateString('ru')}` : ''}</td></tr>`;
}

export async function action(a, arg) {
  if (a === 'hl-add') return addSheet();
  if (a === 'hl-prep') return prepSheet();
  if (a === 'hl-bp') return bpSheet();
  if (a === 'hl-test') return testSheet(arg);
  if (a === 'hl-entry') return entrySheet(arg);
}
