// Exercise library: search, technique page (photos, GIF, steps…), online demo links and the user's
// own unlimited videos (camera or gallery), stored offline on the phone.
import * as YT from './yt.js';
import * as S from './store.js';
import * as D from './data.js';
import * as N from './native.js';
import { ic } from './icons.js';
import { esc, choose, confirmBox, toast } from './ui.js';

let ctx = null, query = '', counts = { by: {}, bytes: 0, total: 0 };
const urls = [];
export const init = c => { ctx = c; };

const GROUPS = [['all', 'Hammasi'], ['prehab', '🛡 Himoya'], ['legs', 'Oyoq'], ['chest', 'Ko‘krak'], ['back', 'Orqa'], ['shoulders', 'Yelka'],
  ['arms', 'Qo‘l'], ['core', 'Qorin'], ['cardio', 'Kardio']];
const G = { legs: ['squat', 'goblet', 'rdl', 'db_rdl', 'leg_press', 'seated_leg_curl', 'leg_curl', 'split_squat', 'hip_thrust', 'calf', 'leg_ext', 'back_ext'],
  chest: ['bench', 'db_bench', 'incline_db', 'machine_chest', 'pec_deck', 'pushups'],
  back: ['pulldown', 'cable_row', 'db_row', 'bb_row', 'assisted_pullup', 'back_ext'],
  shoulders: ['ohp_db', 'ohp_bb', 'lateral', 'rear_delt_fly', 'face_pull'],
  arms: ['db_curl', 'incline_curl', 'hammer', 'pushdown', 'oh_tri', 'db_oh_tri'],
  core: ['plank', 'dead_bug', 'cable_crunch', 'knee_raise'], cardio: ['treadmill'] };
let group = 'all';

export async function renderList(root) {
  counts = await S.countVideos().catch(() => counts);
  const q = query.toLowerCase();
  const keys = Object.keys(D.EX).filter(k => (group === 'all' || (group === 'prehab' ? D.EX[k].prehab : (G[group] || []).includes(k))) &&
    (!q || (D.EX[k].name + ' ' + D.EX[k].muscles).toLowerCase().includes(q)));
  root.innerHTML = `<div class="page">
    <h1 class="h1">Mashqlar</h1>
    <input class="input search" id="exq" placeholder="🔍 Qidirish…" value="${esc(query)}" autocomplete="off">
    <div class="chips">${GROUPS.map(([k, l]) => `<button class="chipbtn ${k === group ? 'sel' : ''}" data-a="lib-group" data-arg="${k}">${l}</button>`).join('')}</div>
    <div class="exlist">${keys.map(k => {
      const ex = D.EX[k], img = ex.media.photos[1] || ex.media.photos[0];
      return `<button class="exrow" data-a="ex-open" data-arg="${k}">
        <span class="thumb">${img ? `<img src="${img.src}" alt="" loading="lazy">` : '🏋️'}</span>
        <span class="exrow-t"><b>${esc(ex.short)}</b><small>${esc(ex.en)} · ${esc(ex.muscles.split(',')[0])}</small></span>
        ${D.EX[k].prehab ? '<span class="pill green">🛡</span>' : ''}${counts.by[k] ? `<span class="pill">🎥 ${counts.by[k]}</span>` : ''}</button>`;
    }).join('') || '<p class="muted">Hech narsa topilmadi.</p>'}</div>
    <p class="tiny muted">Rasmlar: ${esc(D.TX.photoSource.name)} — ${esc(D.TX.photoSource.license)}. Videolarim: ${counts.total} ta, ${(counts.bytes / 1048576).toFixed(0)} MB.</p></div>`;
  const inp = document.getElementById('exq');
  inp.addEventListener('input', () => { query = inp.value; const pos = inp.selectionStart; renderList(root).then(() => { const i = document.getElementById('exq'); i.focus(); i.setSelectionRange(pos, pos); }); });
}

const list = (arr, ordered = false) => arr.length ? `<${ordered ? 'ol' : 'ul'} class="tl">${arr.map(t => `<li>${esc(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>` : '';

export async function renderDetail(root, key, focusVideos = false) {
  const ex = D.EX[key], m = ex.media;
  urls.splice(0).forEach(u => URL.revokeObjectURL(u));
  const vids = await S.listVideos(key).catch(() => []);
  const vidHtml = vids.map(v => {
    const u = URL.createObjectURL(v.blob); urls.push(u);
    return `<div class="vid"><video src="${u}" controls playsinline preload="metadata"></video>
      <div class="row between"><span class="pill">${esc(v.label)}</span><small class="muted">${new Date(v.date).toLocaleDateString('ru')} · ${(v.size / 1048576).toFixed(1)} MB</small>
      <span><button class="icon" data-a="vid-label" data-arg="${v.id}" aria-label="Belgi">🏷</button><button class="icon" data-a="vid-del" data-arg="${v.id}" aria-label="O‘chirish">🗑</button></span></div></div>`;
  }).join('');
  root.innerHTML = `<div class="page detail">
    <div class="topbar"><button class="icon" data-a="back" aria-label="Orqaga">${ic('back')}</button><b>${esc(ex.short)}</b><span></span></div>
    <div class="gallery">
      ${m.gif ? `<figure><img src="${m.gif}" alt=""><figcaption>Harakat (GIF)</figcaption></figure>` : ''}
      ${m.photos.map(p => `<figure><img src="${p.src}" alt="" loading="lazy"><figcaption>${esc(p.label)}</figcaption></figure>`).join('')}
      ${!m.gif && !m.photos.length ? `<div class="fallback-card">🖼 ${esc(ex.fallback)}</div>` : ''}
    </div>
    <h1 class="h1">${esc(ex.short)}</h1><p class="muted">${esc(ex.en)}</p>
    <div class="card"><p>🎯 <b>Mushaklar:</b> ${esc(ex.muscles)}</p><p>🧰 <b>Jihoz:</b> ${esc(ex.equipment)}</p>
      ${ex.prehab ? `<p>📦 <b>Doza:</b> ${esc(ex.dose)}</p><p class="note">🛡 <b>Nega kerak:</b> ${esc(ex.why)}</p>` : ''}</div>
    <div class="card"><h3>🎬 Video dars</h3>
      ${YT.cardHtml(ex, m.video) || '<p class="tiny muted">Bu mashq uchun video biriktirilmagan.</p>'}
      ${m.demo ? `<button class="btn wide" data-a="open-url" data-arg="${esc(m.demo.url)}">🎥 Real demo — erkak model, old + yon</button>` : ''}
      <button class="btn ghost wide" data-a="open-url" data-arg="${esc(m.search)}">🔎 Boshqa videolar</button>
      <p class="tiny muted">${esc(ex.attribution)}</p></div>
    <section class="card" id="vids"><div class="row between"><h3>🎥 Mening videolarim</h3><span class="muted">${vids.length}</span></div>
      <p class="tiny muted">Cheksiz: trener namunasi, o‘z texnikangiz, sanasi bilan. Faqat telefoningizda saqlanadi.</p>
      <label class="btn primary wide">➕ Video qo‘shish (kamera yoki galereya)<input type="file" accept="video/*" hidden data-vidkey="${key}"></label>
      ${vids.length >= 2 ? `<button class="btn wide" data-a="vid-compare" data-arg="${key}">🔀 Texnikani solishtirish (yonma-yon, sekinlashtirib)</button>` : ''}
      ${vidHtml}</section>
    <div class="card"><h3>🛠 Tayyorlanish</h3>${list(ex.setup)}<h3>▶️ Bajarish</h3>${list(ex.steps, true)}
      <p>🌬 <b>Nafas:</b> ${esc(ex.breathing)}</p><p>⏱ <b>Temp:</b> ${esc(ex.tempo)}</p>
      <h3>💬 Eslatmalar</h3>${list(ex.cues)}<h3>❌ Xatolar</h3>${list(ex.mistakes)}
      ${ex.safety ? `<p class="warn">⛑ ${esc(ex.safety)}</p>` : ''}
      <h3>✅ Texnika cheklisti</h3><p class="tiny muted">O‘zingizni yon tomondan videoga oling va solishtiring.</p>${list(ex.checklist)}
      <p class="tiny">🏁 Boshlash: ${esc(ex.start)}</p></div>
</div>`;
  root.querySelector('input[data-vidkey]').addEventListener('change', e => addVideo(key, e.target.files[0]));
  if (focusVideos) document.getElementById('vids').scrollIntoView({ block: 'start' });
}

async function addVideo(key, file) {
  if (!file) return;
  const label = await choose('Bu qanday video?', [['Namuna', '🎓 Namuna (trener / to‘g‘ri texnika)'], ['Mening texnikam', '🙋 Mening texnikam'], ['Boshqa', '📁 Boshqa']]) || 'Boshqa';
  try {
    toast('⏳ Saqlanmoqda…', 6000);
    await S.addVideo(key, file, label);
    toast(`✅ Video saqlandi (${(file.size / 1048576).toFixed(1)} MB)`);
  } catch (e) {
    toast('❌ Saqlab bo‘lmadi: telefonda joy yetarli emasdir.', 5000);
  }
  ctx.render();
}

async function compare(key) {
  const vids = await S.listVideos(key);
  const pickDefault = () => {
    const ref = vids.find(v => v.label === 'Namuna') || vids[vids.length - 1];
    const mine = vids.find(v => v.label === 'Mening texnikam' && v.id !== ref.id) || vids.find(v => v.id !== ref.id);
    return [ref, mine];
  };
  let [a, b] = pickDefault();
  const u = new Map(vids.map(v => [v.id, URL.createObjectURL(v.blob)]));
  const opts = sel => vids.map(v => `<option value="${v.id}" ${v.id === sel.id ? 'selected' : ''}>${esc(v.label)} · ${new Date(v.date).toLocaleDateString('ru')}</option>`).join('');
  let rate = 1;
  const html = () => `<h3>🔀 Solishtirish</h3>
    <div class="cmp"><div><select class="input" id="cmpA">${opts(a)}</select><video id="vA" src="${u.get(a.id)}" playsinline muted preload="auto"></video></div>
      <div><select class="input" id="cmpB">${opts(b)}</select><video id="vB" src="${u.get(b.id)}" playsinline muted preload="auto"></video></div></div>
    <div class="row gap"><button class="btn grow primary" data-s="play">▶︎ / ⏸</button><button class="btn" data-s="back">−0.2s</button><button class="btn" data-s="fwd">+0.2s</button><button class="btn" data-s="rate">${rate}×</button></div>
    <button class="btn ghost wide" data-s="restart">⏮ Boshidan</button><button class="btn wide" data-s="x">Yopish</button>`;
  const both = f => ['vA', 'vB'].forEach(id => { const v = document.getElementById(id); if (v) f(v); });
  const p = sheet(html(), { onClick: (v, btnEl, wrap) => {
    if (v === 'x') return closeSheet();
    if (v === 'play') { const A = document.getElementById('vA'); if (A.paused) both(x => x.play()); else both(x => x.pause()); }
    if (v === 'back' || v === 'fwd') both(x => { x.pause(); x.currentTime = Math.max(0, x.currentTime + (v === 'fwd' ? 0.2 : -0.2)); });
    if (v === 'restart') both(x => { x.currentTime = 0; });
    if (v === 'rate') { rate = rate === 1 ? 0.5 : rate === 0.5 ? 0.25 : 1; both(x => { x.playbackRate = rate; }); btnEl.textContent = rate + '×'; }
  } });
  const wire = () => {
    const sa = document.getElementById('cmpA'), sb = document.getElementById('cmpB');
    if (!sa) return;
    sa.onchange = () => { a = vids.find(v => v.id === Number(sa.value)); document.getElementById('vA').src = u.get(a.id); };
    sb.onchange = () => { b = vids.find(v => v.id === Number(sb.value)); document.getElementById('vB').src = u.get(b.id); };
  };
  setTimeout(wire, 50);
  await p;
  u.forEach(x => URL.revokeObjectURL(x));
}

export async function action(a, arg) {
  if (a === 'vid-compare') return compare(arg);
  if (a === 'lib-group') { group = arg; return ctx.render(); }
  if (a === 'open-url') return N.openUrl(arg);
  if (a === 'yt-play') return YT.play(document.querySelector(`.ytcard[data-arg="${arg}"]`), arg);
  if (a === 'vid-del') {
    if (await confirmBox('Bu videoni o‘chiraymi?', 'O‘chirish', 'Yo‘q', true)) { await S.deleteVideo(Number(arg)); ctx.render(); }
  }
  if (a === 'vid-label') {
    const l = await choose('Belgi', [['Namuna', '🎓 Namuna'], ['Mening texnikam', '🙋 Mening texnikam'], ['Boshqa', '📁 Boshqa']]);
    if (l) { await S.relabelVideo(Number(arg), l); ctx.render(); }
  }
}
