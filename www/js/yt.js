// Inline YouTube player: a poster card (our own exercise photo — works offline, no tracking) that turns into
// the official YouTube embed on tap. Nothing is downloaded; the video streams from YouTube when online.
import { esc, toast } from './ui.js';

export const ytId = url => { const m = String(url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : null; };

export function cardHtml(ex, video) {
  const id = ytId(video && video.url);
  if (!id) return '';
  const m = ex.media || {}, poster = (m.photos && (m.photos[1] || m.photos[0]) || {}).src || m.gif || '';
  return `<div class="ytwrap"><button class="ytcard" data-a="yt-play" data-arg="${id}" aria-label="Videoni ko‘rish">
      ${poster ? `<img src="${poster}" alt="" loading="lazy">` : ''}<span class="yt-shade"></span>
      <span class="yt-brand">▶ YouTube${video.channel ? ' · ' + esc(video.channel) : ''}</span>
      <span class="yt-play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>
      <b class="yt-title">${esc(ex.short)} — to‘g‘ri texnika</b></button>
    <button class="yt-ext" data-a="open-url" data-arg="${esc(video.url)}">YouTube ilovasida ochish ↗</button></div>`;
}

export function play(btn, id) {
  if (navigator.onLine === false) return toast('📶 Video uchun internet kerak');
  const frame = document.createElement('iframe');
  frame.className = 'ytframe';
  frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.setAttribute('allowfullscreen', '');
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.title = 'YouTube video';
  btn.replaceWith(frame);
}
