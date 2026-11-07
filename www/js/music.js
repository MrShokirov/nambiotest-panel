// Offline music: the user's own audio files stored on the phone + a small player.
// Timer signals briefly lower ("duck") the music instead of stopping it.
import * as S from './store.js';
import { esc, confirmBox, toast } from './ui.js';
import { ic } from './icons.js';

let ctx = null, audio = null, tracks = [], cur = null, url = null, playing = false;
export const init = c => { ctx = c; };

function el() {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', () => next());
    audio.addEventListener('play', () => { playing = true; paintMini(); });
    audio.addEventListener('pause', () => { playing = false; paintMini(); });
  }
  return audio;
}
export async function refresh() {
  tracks = await S.listTracks().catch(() => []);
  const order = S.db().music.order.filter(id => tracks.some(t => t.id === id));
  for (const t of tracks) if (!order.includes(t.id)) order.push(t.id);
  S.db().music.order = order;
  return tracks;
}
const byId = id => tracks.find(t => t.id === id);

export async function play(id) {
  if (!tracks.length) await refresh();
  if (id == null) id = cur ?? S.db().music.order[0];
  if (id == null) return toast('🎵 Avval Musiqa bo‘limiga qo‘shiq qo‘shing');
  const rec = await S.getTrack(id);
  if (!rec) return;
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(rec.blob);
  cur = id;
  const a = el();
  a.src = url; a.volume = S.db().music.volume ?? 0.8;
  try { await a.play(); } catch (e) { toast('Ijro etib bo‘lmadi: ' + esc(e.message)); }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: rec.name, artist: 'Sokhibjon GYM' });
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('play', () => el().play());
    navigator.mediaSession.setActionHandler('pause', () => el().pause());
  }
  paintMini();
}
export function toggle() { if (!audio || cur == null) return play(); audio.paused ? audio.play() : audio.pause(); }
function order() {
  const o = S.db().music.order;
  return o.length ? o : tracks.map(t => t.id);
}
export function next() {
  const o = order();
  if (!o.length) return;
  if (S.db().music.shuffle && o.length > 1) { let n; do { n = o[Math.floor(Math.random() * o.length)]; } while (n === cur); return play(n); }
  const i = o.indexOf(cur);
  return play(o[(i + 1) % o.length]);
}
export function prev() {
  const o = order();
  if (!o.length) return;
  if (audio && audio.currentTime > 5) { audio.currentTime = 0; return; }
  const i = o.indexOf(cur);
  return play(o[(i - 1 + o.length) % o.length]);
}
export function duck(ms = 1600) {
  if (!audio || audio.paused || !S.db().music.duck) return;
  const v = S.db().music.volume ?? 0.8;
  audio.volume = Math.min(v, 0.15);
  setTimeout(() => { if (audio) audio.volume = v; }, ms);
}
export const isPlaying = () => playing;

export function miniHtml() {
  if (cur == null && !tracks.length) return '';
  const t = byId(cur);
  return `<div class="mini" id="mini"><span class="mini-t">${ic('music')}<span>${esc(t ? t.name : 'Musiqa')}</span></span>
    <button class="icon" data-a="mu-prev" aria-label="Oldingi">${ic('prev')}</button>
    <button class="icon big" data-a="mu-toggle" aria-label="Ijro">${ic(playing ? 'pause' : 'play')}</button>
    <button class="icon" data-a="mu-next" aria-label="Keyingi">${ic('next')}</button></div>`;
}
function paintMini() {
  const m = document.getElementById('mini');
  if (m) m.outerHTML = miniHtml();
  document.querySelectorAll('[data-track]').forEach(b => b.classList.toggle('playing', Number(b.dataset.track) === cur && playing));
}

export async function render(root) {
  await refresh();
  const m = S.db().music;
  const total = tracks.reduce((a, t) => a + (t.size || 0), 0);
  const list = order().map(id => byId(id)).filter(Boolean);
  root.innerHTML = `<div class="page"><h1 class="h1">🎵 Musiqa</h1>
    <p class="muted">O‘z qo‘shiqlaringiz (MP3, M4A…) — internetsiz, quloqchinda. Taymer signalida musiqa bir soniyaga pasayadi.</p>
    <label class="btn primary wide">➕ Qo‘shiq qo‘shish<input type="file" accept="audio/*" multiple hidden id="mu-add"></label>
    <div class="row gap"><button class="toggle ${m.shuffle ? 'on' : ''} grow" data-a="mu-shuffle"><span><b>🔀 Aralash</b></span><i></i></button>
      <button class="toggle ${m.duck ? 'on' : ''} grow" data-a="mu-duck"><span><b>🔉 Signalda pasaytirish</b></span><i></i></button></div>
    <label class="field">Ovoz balandligi<input type="range" min="0" max="1" step="0.05" value="${m.volume ?? 0.8}" id="mu-vol"></label>
    <div class="tracks">${list.map(t => `<div class="track"><button class="trk ${t.id === cur && playing ? 'playing' : ''}" data-a="mu-play" data-arg="${t.id}" data-track="${t.id}">
      <span class="eq"><i></i><i></i><i></i></span><span><b>${esc(t.name)}</b><small>${(t.size / 1048576).toFixed(1)} MB</small></span></button>
      <button class="icon" data-a="mu-del" data-arg="${t.id}" aria-label="O‘chirish">🗑</button></div>`).join('') || '<p class="muted">Hali qo‘shiq yo‘q.</p>'}</div>
    <p class="tiny muted">${tracks.length} ta qo‘shiq · ${(total / 1048576).toFixed(0)} MB. Fayllar faqat shu telefonda saqlanadi.</p>
    ${miniHtml()}</div>`;
  document.getElementById('mu-add').addEventListener('change', async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    toast(`⏳ ${files.length} ta fayl saqlanmoqda…`, 8000);
    let ok = 0;
    for (const f of files) { try { await S.addTrack(f); ok++; } catch (err) { /* storage full */ } }
    await refresh(); await S.save();
    toast(ok === files.length ? `✅ ${ok} ta qo‘shiq qo‘shildi` : `⚠️ ${ok}/${files.length} saqlandi (joy yetmadi)`);
    ctx.render();
  });
  document.getElementById('mu-vol').addEventListener('input', e => { m.volume = Number(e.target.value); if (audio) audio.volume = m.volume; S.save(); });
}

export async function action(a, arg) {
  if (a === 'mu-play') { const id = Number(arg); if (id === cur && audio) return toggle(); return play(id); }
  if (a === 'mu-toggle') return toggle();
  if (a === 'mu-next') return next();
  if (a === 'mu-prev') return prev();
  if (a === 'mu-shuffle') { S.db().music.shuffle = !S.db().music.shuffle; await S.save(); return ctx.render(); }
  if (a === 'mu-duck') { S.db().music.duck = !S.db().music.duck; await S.save(); return ctx.render(); }
  if (a === 'mu-del') {
    if (!(await confirmBox('Bu qo‘shiqni o‘chiraymi?', 'O‘chirish', 'Yo‘q', true))) return;
    const id = Number(arg);
    if (id === cur && audio) { audio.pause(); cur = null; }
    await S.deleteTrack(id); await refresh(); await S.save(); ctx.render();
  }
}
