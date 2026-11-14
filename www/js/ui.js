// Small UI helpers: escaping, *bold* markup, modal sheet, confirm dialog, toast.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const md = s => esc(s).replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/(^|[\s(])_(.+?)_(?=[\s.,)!?]|$)/g, '$1<i>$2</i>').replace(/\n/g, '<br>');

let sheetResolve = null;
export function sheet(html, { onClick } = {}) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
  wrap.addEventListener('click', e => {
    if (e.target === wrap) return closeSheet(null);
    const b = e.target.closest('[data-s]');
    if (b && onClick) onClick(b.dataset.s, b, wrap);
  });
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return new Promise(res => { sheetResolve = res; });
}
export function closeSheet(value) {
  const w = document.querySelector('.sheet-wrap');
  if (w) w.remove();
  if (sheetResolve) { const r = sheetResolve; sheetResolve = null; r(value); }
}
export const sheetOpen = () => !!document.querySelector('.sheet-wrap');

export function confirmBox(text, yes = 'Ha', no = 'Yo‘q', danger = false) {
  return sheet(`<p class="sheet-text">${text}</p>
    <div class="row gap"><button class="btn ${danger ? 'danger' : 'primary'} grow" data-s="yes">${esc(yes)}</button>
    <button class="btn grow" data-s="no">${esc(no)}</button></div>`,
  { onClick: v => closeSheet(v === 'yes') });
}
export function choose(title, options) {
  return sheet(`<h3>${esc(title)}</h3><div class="col gap">${options.map(([v, label, sub]) =>
    `<button class="btn left" data-s="${esc(v)}">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('')}
    <button class="btn ghost" data-s="__cancel">Bekor qilish</button></div>`,
  { onClick: v => closeSheet(v === '__cancel' ? null : v) });
}
export function prompt(title, { value = '', type = 'text', hint = '', inputmode = '' } = {}) {
  const p = sheet(`<h3>${esc(title)}</h3>${hint ? `<p class="muted">${esc(hint)}</p>` : ''}
    <input class="input" id="sheet-input" type="${type}" ${inputmode ? `inputmode="${inputmode}"` : ''} value="${esc(value)}">
    <div class="row gap"><button class="btn primary grow" data-s="ok">Saqlash</button><button class="btn grow" data-s="no">Bekor</button></div>`,
  { onClick: v => closeSheet(v === 'ok' ? document.getElementById('sheet-input').value : null) });
  setTimeout(() => { const i = document.getElementById('sheet-input'); if (i) { i.focus(); i.select(); } }, 50);
  return p;
}
let toastT = null;
export function toast(text, ms = 2600) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.innerHTML = text; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
export const mmss = s => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
