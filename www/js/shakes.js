// 🥤 Recovery shakes: 4 recipes (ingredients from Korzinka), serving size, step-by-step recipe,
// a drawn recipe card (PNG) and one Share button — image + recipe text go together (e.g. Telegram).
// Nothing is sent automatically: Android asks where to share.
import * as S from './store.js';
import * as D from './data.js';
import * as N from './native.js';
import { ic } from './icons.js';
import { esc, toast } from './ui.js';

let ctx = null, cur = null, mult = 1;
export const init = c => { ctx = c; };

// kcal, protein, fat, carbs per 100 g
const F = { tvorog: [121, 17, 5, 3], milk: [59, 2.9, 3.2, 4.7], banana: [89, 1.1, 0.3, 23], oats: [379, 13, 6.5, 67], pumpkin: [559, 30, 49, 11],
  walnut: [654, 15, 65, 14], cocoa: [228, 19.6, 13.7, 58], kuraga: [241, 3.4, 0.5, 63] };
const NAME = { tvorog: 'Tvorog PRESIDENT 5%', milk: 'Sut Musaffo 3,2%', banana: 'Banan', oats: 'Gerkules «Царь»', pumpkin: 'Qovoq urug‘i (tuzsiz)',
  walnut: 'Yong‘oq (grek)', cocoa: 'Kakao (shakarsiz)', kuraga: 'Turshak (o‘rik qoqi)' };
const HINT = { tvorog: '1 qadoq', banana: '½ kichik', oats: '1,5 osh qoshiq', pumpkin: '1 osh qoshiq', walnut: '~2 dona', cocoa: '1 choy qoshiq', kuraga: '3–4 dona', milk: '1 stakan' };
const BASE = [['tvorog', 200], ['milk', 200], ['banana', 60], ['oats', 15], ['pumpkin', 10], ['walnut', 10]];
export const SHAKES = [
  { n: 1, name: 'Klassik dolchinli', emoji: '🍌', items: BASE, flavor: [['Dolchin', 1]], note: '+ bir chimdim dolchin',
    c1: '#16b39a', c2: '#2f7df0', liquid: '#f3e3c3', top: '#c98a4b' },
  { n: 2, name: 'Shokoladli', emoji: '🍫', items: [...BASE, ['cocoa', 5]], flavor: [], note: '+ 1 choy qoshiq shakarsiz kakao',
    c1: '#7a4a2c', c2: '#c27a3e', liquid: '#9b6a4a', top: '#5b3a24' },
  { n: 3, name: 'Turshakli (o‘rikli)', emoji: '🍑', items: [...BASE.filter(i => i[0] !== 'banana'), ['kuraga', 20]], flavor: [], note: 'banan o‘rniga 3–4 dona turshak (10 daqiqa iliq suvda ivitiladi)',
    c1: '#f08a24', c2: '#f2c14e', liquid: '#f6c890', top: '#e07a1f' },
  { n: 4, name: 'Kofeli latte', emoji: '☕', items: BASE, flavor: [['Eriydigan kofe', 2]], note: '+ 1 choy qoshiq eriydigan kofe (16:00 dan keyin mashq qilsangiz qo‘shmang — uyquni buzadi)',
    c1: '#6b4f3a', c2: '#b08968', liquid: '#d9b99b', top: '#7a5136' },
];
const SIZES = [0.5, 1, 1.5, 2];
const num = x => { x = Math.round(x * 10) / 10; return Number.isInteger(x) ? String(x) : String(x).replace('.', ','); };
const unit = k => (k === 'milk' ? 'ml' : 'g');

export function totals(sh, m = 1) {
  let k = 0, p = 0, f = 0, c = 0;
  for (const [key, g] of sh.items) { const v = F[key]; k += v[0] * g * m / 100; p += v[1] * g * m / 100; f += v[2] * g * m / 100; c += v[3] * g * m / 100; }
  return { kcal: Math.round(k), p: Math.round(p), fat: Math.round(f), carbs: Math.round(c) };
}
export function items(sh, m = 1) {
  return [...sh.items.map(([k, g]) => ({ name: NAME[k], amt: `${num(g * m)} ${unit(k)}`, hint: m === 1 ? HINT[k] || '' : '' })),
    ...sh.flavor.map(([name, g]) => ({ name, amt: `${num(g * m)} g`, hint: '' }))];
}
export function steps(sh, m = 1) {
  const q = Object.fromEntries(sh.items.map(([k, g]) => [k, `${num(g * m)} ${unit(k)}`]));
  const out = [];
  if (q.kuraga) out.push(`Turshakni (${q.kuraga}) 10 daqiqa iliq suvda ivitib, suvini to‘king.`);
  if (sh.n === 4) out.push(`Kofeni (${num(2 * m)} g) 1 osh qoshiq issiq suvda eritib, sovuting.`);
  out.push(`Blenderga avval sutni quying (${q.milk}) — suyuqlik pastda bo‘lsa, pichoq oson aylanadi.`);
  const soft = [`tvorog (${q.tvorog})`];
  if (q.banana) soft.push(`banan (${q.banana})`);
  if (q.kuraga) soft.push('turshak');
  soft.push(`gerkules (${q.oats})`);
  if (q.cocoa) soft.push(`kakao (${q.cocoa})`);
  if (sh.n === 1) soft.push(`dolchin (${num(m)} g)`);
  if (sh.n === 4) soft.push('kofe');
  out.push('Keyin ' + soft.join(', ') + ' soling.');
  out.push(`Eng oxirida qovoq urug‘i (${q.pumpkin}) va yong‘oq (${q.walnut}) qo‘shing.`);
  out.push('Qopqoqni yoping, yuqori tezlikda 40–60 soniya silliq bo‘lguncha aylantiring.');
  out.push('Mashqdan keyin 1 soat ichida iching.');
  return out;
}
export function shareText(sh, m = 1) {
  const t = totals(sh, m);
  return [`🥤 Tiklovchi kokteyl: ${sh.name} (${num(m)} porsiya)`, '', 'Masalliqlar:', ...items(sh, m).map(i => `• ${i.name}: ${i.amt}`), '',
    'Tayyorlash:', ...steps(sh, m).map((s, i) => `${i + 1}. ${s}`), '', `≈ ${t.kcal} kkal · ${t.p} g oqsil`].join('\n').slice(0, 1000);
}

// small vector glass for lists
export function glassSvg(sh, size = 64) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="gl${sh.n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sh.liquid}"/><stop offset="1" stop-color="${sh.top}"/></linearGradient></defs>
    <path d="M40 4 l-6 14" stroke="${sh.c1}" stroke-width="3" stroke-linecap="round"/>
    <path d="M16 16h32l-4 42a4 4 0 0 1-4 3.6H24a4 4 0 0 1-4-3.6z" fill="rgba(255,255,255,.55)" stroke="rgba(0,0,0,.08)"/>
    <path d="M18.6 24h26.8l-3.4 33.6a3 3 0 0 1-3 2.6H25a3 3 0 0 1-3-2.6z" fill="url(#gl${sh.n})"/>
    <ellipse cx="32" cy="24" rx="13.4" ry="3.4" fill="#fff" opacity=".85"/><circle cx="27" cy="23" r="1.3" fill="${sh.top}"/><circle cx="35" cy="24" r="1.1" fill="${sh.top}"/></svg>`;
}

// ── recipe card → PNG (canvas) ──
function wrap(ctx2, text, max) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx2.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

export async function cardPng(sh, m = 1) {
  try { await Promise.all([document.fonts.load('600 64px Newsreader'), document.fonts.load('400 30px Inter'), document.fonts.load('700 30px Inter')]); } catch (e) { /* system fonts */ }
  const W = 1080, P = 64, inner = W - 2 * P;
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  const sans = (w, s) => `${w} ${s}px Inter, Roboto, sans-serif`, serif = s => `600 ${s}px Newsreader, Georgia, serif`;
  const its = items(sh, m), st = steps(sh, m), t = totals(sh, m);
  // layout pass
  c.font = sans(400, 32);
  const stepLines = st.map(s => wrap(c, s, inner - 150));
  const noteLines = wrap(c, sh.note, inner - 80);
  const H = 520 + 70 + its.length * 84 + 60 + 190 + 90 + stepLines.reduce((a, l) => a + l.length * 44 + 28, 0) + noteLines.length * 42 + 60 + 120;
  cv.width = W; cv.height = H;
  // background
  c.fillStyle = '#f2f2f7'; c.fillRect(0, 0, W, H);
  // header
  const g = c.createLinearGradient(0, 0, W, 460); g.addColorStop(0, sh.c1); g.addColorStop(1, sh.c2);
  c.fillStyle = g; rr(c, 24, 24, W - 48, 460, 48); c.fill();
  c.globalAlpha = .12; c.fillStyle = '#fff'; c.beginPath(); c.arc(W - 120, 90, 220, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(140, 470, 160, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  // glass illustration
  const gx = W - 330, gy = 92;
  c.save(); c.translate(gx, gy); c.scale(4.4, 4.4);
  c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(40, 2); c.lineTo(33, 20); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(14, 16); c.lineTo(50, 16); c.lineTo(45.5, 64); c.quadraticCurveTo(45, 68, 41, 68); c.lineTo(23, 68); c.quadraticCurveTo(19, 68, 18.5, 64); c.closePath(); c.fill();
  const lg = c.createLinearGradient(0, 24, 0, 66); lg.addColorStop(0, sh.liquid); lg.addColorStop(1, sh.top);
  c.fillStyle = lg; c.beginPath(); c.moveTo(17, 25); c.lineTo(47, 25); c.lineTo(43.4, 63.5); c.quadraticCurveTo(43, 66, 40, 66); c.lineTo(24, 66); c.quadraticCurveTo(21, 66, 20.6, 63.5); c.closePath(); c.fill();
  c.fillStyle = '#ffffff'; c.globalAlpha = .9; c.beginPath(); c.ellipse(32, 25, 15, 3.6, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  c.fillStyle = sh.top; [[26, 24], [34, 25.5], [38, 23.8]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 1.2, 0, Math.PI * 2); c.fill(); });
  c.restore();
  // header text
  c.fillStyle = 'rgba(255,255,255,.82)'; c.font = sans(700, 28); c.fillText(`TIKLOVCHI KOKTEYL #${sh.n}`, P + 10, 120);
  c.fillStyle = '#fff'; let fs = 74; c.font = serif(fs);
  const tl = wrap(c, sh.name, 600); let ty = 210;
  for (const l of tl) { c.fillText(l, P + 10, ty); ty += 80; }
  c.font = sans(600, 30); c.fillStyle = 'rgba(255,255,255,.9)';
  rr(c, P + 10, 360, 330, 64, 32); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill();
  c.fillStyle = '#fff'; c.fillText(`Porsiya: ${num(m)}×  ·  blender 1 daq`, P + 34, 403);
  // white sheet
  let y = 520;
  c.fillStyle = '#fff'; rr(c, 24, y - 20, W - 48, H - y - 4, 48); c.fill();
  // kcal / protein tiles
  const tw = (inner - 24) / 2;
  [[`${t.kcal}`, 'kkal'], [`${t.p} g`, 'oqsil']].forEach(([big, small], i) => {
    const x = P + i * (tw + 24);
    c.fillStyle = i ? '#fdeee6' : '#eef7f5'; rr(c, x, y + 20, tw, 150, 32); c.fill();
    c.fillStyle = i ? '#e8572a' : '#0d9e90'; c.font = sans(800, 64); c.textAlign = 'center'; c.fillText(big, x + tw / 2, y + 110);
    c.fillStyle = '#6c6c72'; c.font = sans(600, 28); c.fillText(small, x + tw / 2, y + 150); c.textAlign = 'left';
  });
  y += 230;
  c.fillStyle = '#8e8e93'; c.font = sans(700, 26); c.fillText('MASALLIQLAR', P, y); y += 30;
  its.forEach((it, i) => {
    if (i % 2 === 0) { c.fillStyle = '#f6f6f9'; rr(c, P - 12, y, inner + 24, 74, 20); c.fill(); }
    c.fillStyle = '#1c1c1e'; c.font = sans(500, 33); c.fillText(it.name, P + 10, y + 48);
    c.textAlign = 'right'; c.fillStyle = sh.c1 === '#16b39a' ? '#0d9e90' : sh.c1; c.font = sans(800, 34); c.fillText(it.amt, W - P - 10, y + 48);
    if (it.hint) { const aw = c.measureText(it.amt).width; c.fillStyle = '#a3a3a9'; c.font = sans(500, 25); c.fillText(it.hint, W - P - 30 - aw, y + 47); }
    c.textAlign = 'left'; y += 84;
  });
  y += 10;
  c.fillStyle = '#6c6c72'; c.font = sans(500, 30); for (const l of noteLines) { c.fillText(l, P + 10, y + 30); y += 42; }
  y += 40;
  c.fillStyle = '#8e8e93'; c.font = sans(700, 26); c.fillText('TAYYORLASH', P, y); y += 30;
  stepLines.forEach((lines, i) => {
    c.fillStyle = sh.c1; c.beginPath(); c.arc(P + 30, y + 30, 28, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = sans(800, 30); c.textAlign = 'center'; c.fillText(String(i + 1), P + 30, y + 41); c.textAlign = 'left';
    c.fillStyle = '#1c1c1e'; c.font = sans(400, 32);
    lines.forEach((l, j) => c.fillText(l, P + 90, y + 40 + j * 44));
    y += lines.length * 44 + 28;
  });
  y += 30;
  c.fillStyle = '#a3a3a9'; c.font = sans(500, 24); c.textAlign = 'center';
  c.fillText(`yog‘ ${t.fat} g · uglevod ${t.carbs} g · mashqdan keyin 1 soat ichida · Sokhibjon GYM`, W / 2, Math.min(y + 30, H - 40));
  c.textAlign = 'left';
  return cv.toDataURL('image/png');
}

// ── UI ──
const cache = new Map();
async function preview(sh, m) {
  const k = `${sh.n}:${m}`;
  if (!cache.has(k)) cache.set(k, await cardPng(sh, m));
  return cache.get(k);
}

export function listHtml() {
  return `<div class="card"><div class="row between"><h3><i class="hdot" style="--c:var(--c-food)"></i>Tiklovchi kokteyllar</h3><span class="muted tiny">mashqdan keyin</span></div>
    <div class="shakes">${SHAKES.map(sh => { const t = totals(sh); return `<button class="shk" data-a="sh-open" data-arg="${sh.n}" style="--c1:${sh.c1};--c2:${sh.c2}">
      ${glassSvg(sh, 56)}<b>${esc(sh.name)}</b><small>${t.p} g oqsil · ${t.kcal} kkal</small></button>`; }).join('')}</div></div>`;
}

export async function render(root) {
  const sh = SHAKES.find(s => s.n === cur) || SHAKES[0], t = totals(sh, mult);
  root.innerHTML = `<div class="page">
    <div class="topbar"><button class="icon" data-a="sh-back" aria-label="Orqaga">${ic('back')}</button><b>${esc(sh.name)}</b><span></span></div>
    <div class="seg" style="--n:4;--i:${SIZES.indexOf(mult)}"><i></i>${SIZES.map(s => `<button class="${s === mult ? 'sel' : ''}" data-a="sh-size" data-arg="${s}">${num(s)}× porsiya</button>`).join('')}</div>
    <div class="shcard"><img id="shimg" alt="${esc(sh.name)} retsepti"></div>
    <button class="btn primary wide xl" data-a="sh-share">${ic('share')} Ulashish (Telegram)</button>
    <button class="btn wide" data-a="sh-drank">✅ Ichdim — +${t.p} g oqsil hisobga</button>
    <p class="tiny muted center">Ulashish tugmasi rasm va retseptni birga jo‘natadi — kimga yuborishni o‘zingiz tanlaysiz. Sut yoki yong‘oqqa allergiya bo‘lsa, shu masalliqni almashtiring.</p>
  </div>`;
  const url = await preview(sh, mult);
  const img = document.getElementById('shimg'); if (img) img.src = url;
}

export async function action(a, arg) {
  if (a === 'sh-open') { cur = Number(arg); mult = 1; return ctx.go('shake'); }
  if (a === 'sh-back') return ctx.go('food');
  if (a === 'sh-size') { mult = Number(arg); return ctx.render(); }
  const sh = SHAKES.find(s => s.n === cur) || SHAKES[0];
  if (a === 'sh-share') {
    const url = await preview(sh, mult), text = shareText(sh, mult);
    const ok = await N.shareImage(`kokteyl_${sh.n}.png`, url.split(',')[1], text, sh.name);
    if (!ok) { const l = document.createElement('a'); l.href = url; l.download = `kokteyl_${sh.n}.png`; l.click(); try { await navigator.clipboard.writeText(text); toast('Rasm yuklandi, retsept nusxalandi'); } catch (e) { /* */ } }
    return;
  }
  if (a === 'sh-drank') {
    const t = totals(sh, mult), k = D.dateKey(), db = S.db();
    db.food ||= {}; db.food[k] ||= { items: [], water: 0 };
    db.food[k].items.push({ id: S.nextId(), at: new Date().toISOString(), name: `🥤 ${sh.name} (${num(mult)}×)`, p: t.p, kcal: t.kcal });
    await S.save(); toast(`✅ +${t.p} g oqsil yozildi`); return ctx.go('food');
  }
}
