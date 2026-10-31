// Light / dark / auto theme. Applied before first paint (index.html inline script reads localStorage)
// and kept in the profile so it survives backups. Status bar follows the theme.
import * as S from './store.js';

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const P = name => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;

export const mode = () => (S.db() && S.db().profile.theme) || 'auto';
export const resolved = (m = mode()) => (m === 'auto' ? (mq && !mq.matches ? 'light' : 'dark') : m);

export function apply(m = mode()) {
  const t = resolved(m);
  const root = document.documentElement;
  root.dataset.theme = t;
  root.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'light' ? '#f2f2f7' : '#0b0d10';
  try { localStorage.setItem('theme', m); } catch (e) { /* storage blocked */ }
  const SB = P('StatusBar');
  if (SB) {
    SB.setStyle({ style: t === 'light' ? 'LIGHT' : 'DARK' }).catch(() => {});
    SB.setBackgroundColor && SB.setBackgroundColor({ color: t === 'light' ? '#f2f2f7' : '#0b0d10' }).catch(() => {});
  }
  return t;
}

export async function set(m) {
  S.db().profile.theme = m;
  await S.save();
  document.documentElement.classList.add('theme-anim');
  apply(m);
  setTimeout(() => document.documentElement.classList.remove('theme-anim'), 450);
}

export function init(onChange) {
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (mode() === 'auto') { apply(); onChange && onChange(); } });
}

export const LABELS = [['auto', 'Avto'], ['light', 'Yorug‘'], ['dark', 'Qorong‘i']];
export const segHtml = (action = 'theme') => {
  const m = mode(), i = LABELS.findIndex(l => l[0] === m);
  return `<div class="seg" style="--n:3;--i:${i}"><i></i>${LABELS.map(([k, l]) => `<button class="${k === m ? 'sel' : ''}" data-a="${action}" data-arg="${k}">${l}</button>`).join('')}</div>`;
};
