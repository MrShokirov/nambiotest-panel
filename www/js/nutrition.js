// 🥗 Ovqatlanish: daily protein / calories / water with one-tap presets (typical Uzbek portions).
// Values are approximate; the goal is consistency (protein every meal), not gram-perfect logging.
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import { bars, rings } from './charts.js';
import { ic } from './icons.js';
import { esc, sheet, closeSheet, confirmBox, toast } from './ui.js';
import * as SH from './shakes.js';

let ctx = null, day = 0;                      // day offset: 0 = today, 1 = yesterday …
export const init = c => { ctx = c; };

// name, emoji, protein g, kcal (one usual portion)
export const PRESETS = [
  ['egg', '🥚', 'Tuxum (2 dona)', 12, 155], ['chicken', '🍗', 'Tovuq ko‘krak 150 g', 46, 250], ['beef', '🥩', 'Mol go‘shti 150 g', 39, 375],
  ['fish', '🐟', 'Baliq 150 g', 33, 210], ['tvorog', '🧀', 'Tvorog 200 g', 32, 300], ['kefir', '🥛', 'Qatiq / kefir 250 ml', 8, 130],
  ['milk', '🥛', 'Sut 250 ml', 8, 150], ['whey', '🥤', 'Protein kokteyl (1 qoshiq)', 24, 120], ['plov', '🍚', 'Osh (1 porsiya)', 22, 700],
  ['lagman', '🍜', 'Lag‘mon (1 kosa)', 24, 650], ['shorva', '🍲', 'Sho‘rva (1 kosa)', 18, 350], ['somsa', '🥟', 'Somsa (1 dona)', 10, 330],
  ['non', '🫓', 'Non (¼ dona)', 7, 230], ['beans', '🫘', 'No‘xat / mosh 1 kosa', 15, 260], ['nuts', '🥜', 'Yong‘oq 30 g', 5, 190],
  ['yogurt', '🍶', 'Grek yogurt 200 g', 20, 140],
];
const key = (off = day) => { const d = new Date(); d.setDate(d.getDate() - off); return D.dateKey(d); };
const store = () => (S.db().food ||= {});
export const dayData = (k = key(0)) => (store()[k] ||= { items: [], water: 0 });
export const totals = (k = key(0)) => {
  const d = store()[k] || { items: [], water: 0 };
  return { p: d.items.reduce((a, x) => a + (x.p || 0), 0), kcal: d.items.reduce((a, x) => a + (x.kcal || 0), 0), water: d.water || 0, n: d.items.length };
};
export const targets = () => C.targets(S.db().profile);

export function todayRingValue() { const t = totals(), g = targets(); return g.protein ? t.p / g.protein : 0; }

export function render(root) {
  const k = key(), t = totals(k), g = targets();
  const p7 = [], l7 = [];
  for (let i = 6; i >= 0; i--) { const kk = key(i); p7.push(totals(kk).p); const dd = new Date(); dd.setDate(dd.getDate() - i); l7.push(D.WD[(dd.getDay() + 6) % 7]); }
  const logged = p7.filter(Boolean), avgP = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  const items = (store()[k] || { items: [] }).items;
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  root.innerHTML = `<div class="page food">
    <div class="topbar"><button class="icon" data-a="drawer" aria-label="Menyu">${ic('menu')}</button><b>Ovqatlanish</b><span></span></div>
    <div class="seg" style="--n:3;--i:${day}"><i></i>${['Bugun', 'Kecha', '2 kun oldin'].map((l, i) => `<button class="${i === day ? 'sel' : ''}" data-a="fd-day" data-arg="${i}">${l}</button>`).join('')}</div>
    <div class="card ring-card">
      ${rings([{ value: t.p / g.protein, color: 'var(--c-food)' }, { value: t.kcal / g.kcal, color: 'var(--c-strength)' }, { value: t.water / g.water, color: 'var(--c-water)' }], 132)}
      <div class="ring-legend">
        <div style="--c:var(--c-food)"><small>Oqsil</small><b>${Math.round(t.p)}<i>/${g.protein} g</i></b></div>
        <div style="--c:var(--c-strength)"><small>Kaloriya</small><b>${Math.round(t.kcal)}<i>/${g.kcal}</i></b></div>
        <div style="--c:var(--c-water)"><small>Suv</small><b>${(t.water / 1000).toFixed(1)}<i>/${(g.water / 1000).toFixed(1)} L</i></b></div>
      </div></div>
    <p class="insight">${t.p >= g.protein ? `Bugungi oqsil maqsadi bajarildi 💪` : t.n ? `Oqsilga yana <b>${Math.round(g.protein - t.p)} g</b> kerak — ${pct(t.p, g.protein)}% bajarildi.` : 'Har ovqatda 30–40 g oqsil — mushak o‘sishi uchun eng muhim odat.'}</p>
    <div class="card"><div class="row between"><h3>💧 Suv</h3><span class="muted tiny">${(t.water / 1000).toFixed(2)} L</span></div>
      <div class="water">${[250, 500].map(v => `<button class="btn" data-a="fd-water" data-arg="${v}">+${v} ml</button>`).join('')}<button class="btn ghost" data-a="fd-water" data-arg="-250">−250</button></div></div>
    ${SH.listHtml()}
    <div class="card"><div class="row between"><h3>⚡ Tez qo‘shish</h3><button class="btn small" data-a="fd-custom">✏️ Boshqa</button></div>
      <div class="presets">${PRESETS.map(([id, e, n, p, kc]) => `<button class="preset" data-a="fd-add" data-arg="${id}"><span>${e}</span><b>${esc(n)}</b><small>${p} g · ${kc} kkal</small></button>`).join('')}</div></div>
    <div class="card"><div class="row between"><h3>📋 ${day ? 'O‘sha kuni' : 'Bugun'} yeganlarim</h3><span class="muted tiny">${items.length} ta</span></div>
      ${items.length ? items.map(x => `<div class="fooditem"><span class="grow"><b>${esc(x.name)}</b><small>${x.at ? new Date(x.at).toTimeString().slice(0, 5) + ' · ' : ''}${Math.round(x.p)} g oqsil · ${Math.round(x.kcal)} kkal</small></span><button class="icon" data-a="fd-del" data-arg="${x.id}" aria-label="O‘chirish">${ic('close')}</button></div>`).join('') : '<p class="muted tiny">Hali hech narsa qo‘shilmadi — yuqoridagi tugmalardan birini bosing.</p>'}</div>
    <div class="card"><h3>📊 7 kunlik oqsil</h3><p class="insight">${logged.length ? `O‘rtacha <b>${avgP} g</b> kuniga (maqsad ${g.protein} g).` : 'Bir necha kun yozsangiz, odat shu yerda ko‘rinadi.'}</p>
      ${bars(p7, { labels: l7, goal: g.protein, unit: ' g', color: 'var(--c-food)' })}</div>
    <div class="card"><div class="row between"><h3>🎯 Kunlik maqsad</h3><button class="btn small" data-a="fd-goal">O‘zgartirish</button></div>
      <div class="kv"><span>Kaloriya</span><b>${g.kcal} kkal</b></div><div class="kv"><span>Oqsil</span><b>${g.protein} g</b></div>
      <div class="kv"><span>Yog‘ / uglevod</span><b>${g.fat} g / ${g.carbs} g</b></div><div class="kv"><span>Suv</span><b>${(g.water / 1000).toFixed(1)} L</b></div>
      <p class="tiny muted">Taxminiy hisob (Mifflin–St Jeor, vazn ${S.db().profile.weight} kg). 3+ hafta vazn trendiga qarab ilova o‘zgartirishni tavsiya qiladi. Porsiya qiymatlari ham taxminiy.</p></div>
  </div>`;
}

async function add(item) {
  const d = dayData(key());
  d.items.push({ id: S.nextId(), at: new Date().toISOString(), ...item });
  await S.save();
  const t = totals(key()), g = targets();
  toast(`✅ +${Math.round(item.p)} g oqsil · bugun ${Math.round(t.p)}/${g.protein} g`);
  ctx.render();
}

async function customSheet() {
  const res = await sheet(`<h3>✏️ Boshqa ovqat</h3>
    <label class="field">Nomi<input class="input" id="fd-n" placeholder="Masalan: kabob"></label>
    <div class="grid2"><label class="field">Oqsil (g)<input class="input" id="fd-p" inputmode="decimal" placeholder="25"></label>
    <label class="field">Kaloriya<input class="input" id="fd-k" inputmode="numeric" placeholder="400"></label></div>
    <p class="warn" id="fd-e" hidden></p>
    <button class="btn primary wide" data-s="ok">Qo‘shish</button><button class="btn ghost wide" data-s="x">Bekor</button>`, { onClick: (v, b, w) => {
    if (v !== 'ok') return closeSheet(null);
    const name = w.querySelector('#fd-n').value.trim().slice(0, 40) || 'Ovqat';
    const p = parseFloat(w.querySelector('#fd-p').value.replace(',', '.')) || 0, kcal = parseFloat(w.querySelector('#fd-k').value) || 0;
    if (p < 0 || p > 300 || kcal < 0 || kcal > 4000 || (!p && !kcal)) { const e = w.querySelector('#fd-e'); e.hidden = false; e.textContent = 'Oqsil 0–300 g, kaloriya 0–4000 oralig‘ida bo‘lsin.'; return; }
    closeSheet({ name, p, kcal });
  } });
  if (res) await add(res);
}

async function goalSheet() {
  const p = S.db().profile, g = targets();
  const res = await sheet(`<h3>🎯 Kunlik maqsad</h3><p class="tiny muted">Bo‘sh qoldirsangiz — ilova o‘zi hisoblaydi.</p>
    <div class="grid2"><label class="field">Kaloriya<input class="input" id="g-k" inputmode="numeric" value="${p.kcalOverride || ''}" placeholder="${g.kcal}"></label>
    <label class="field">Oqsil (g)<input class="input" id="g-p" inputmode="numeric" value="${p.proteinOverride || ''}" placeholder="${g.protein}"></label></div>
    <button class="btn primary wide" data-s="ok">Saqlash</button><button class="btn ghost wide" data-s="x">Bekor</button>`, { onClick: (v, b, w) => {
    if (v !== 'ok') return closeSheet(null);
    closeSheet({ k: parseInt(w.querySelector('#g-k').value, 10) || null, p: parseInt(w.querySelector('#g-p').value, 10) || null });
  } });
  if (!res) return;
  if (res.k && (res.k < 1200 || res.k > 5000)) return toast('Kaloriya 1200–5000 oralig‘ida bo‘lsin');
  if (res.p && (res.p < 40 || res.p > 300)) return toast('Oqsil 40–300 g oralig‘ida bo‘lsin');
  p.kcalOverride = res.k; p.proteinOverride = res.p;
  await S.save(); toast('✅ Maqsad saqlandi'); ctx.render();
}

export async function action(a, arg) {
  if (a === 'fd-day') { day = Number(arg); return ctx.render(); }
  if (a === 'fd-add') { const x = PRESETS.find(p => p[0] === arg); if (x) return add({ name: x[2], p: x[3], kcal: x[4] }); }
  if (a === 'fd-water') {
    const d = dayData(key()); d.water = Math.max(0, (d.water || 0) + Number(arg)); await S.save();
    if (Number(arg) > 0 && d.water >= targets().water && d.water - Number(arg) < targets().water) toast('💧 Suv maqsadi bajarildi!');
    return ctx.render();
  }
  if (a === 'fd-custom') return customSheet();
  if (a === 'fd-goal') return goalSheet();
  if (a === 'fd-del') {
    const d = dayData(key()), x = d.items.find(i => i.id === Number(arg));
    if (x && await confirmBox(`«${esc(x.name)}» o‘chirilsinmi?`, 'O‘chirish', 'Bekor', true)) { d.items = d.items.filter(i => i !== x); await S.save(); ctx.render(); }
  }
}
