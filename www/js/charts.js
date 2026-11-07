// Lightweight SVG charts (no libraries → fast, offline). Colour comes from a CSS variable
// (`color` option, e.g. 'var(--c-strength)') via currentColor, so charts follow the light/dark theme.
const f1 = v => (Math.round(v * 10) / 10).toString();
let uid = 0;

// smooth path through points (Catmull-Rom → cubic Bézier), tension kept low so peaks stay honest
function smooth(pts) {
  if (pts.length < 3) return 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function line(values, { labels = [], h = 150, unit = '', avg = null, color = 'var(--accent)', goal = null } = {}) {
  const W = 340, H = h, L = 34, R = 10, T = 14, B = 22;
  if (values.length < 2) return '<p class="muted tiny chart-empty">Grafik uchun kamida 2 ta yozuv kerak.</p>';
  const id = 'g' + (++uid);
  const all = values.concat(avg ? avg.filter(v => v != null) : [], goal != null ? [goal] : []);
  let min = Math.min(...all), max = Math.max(...all);
  if (max - min < 1) { min -= 1; max += 1; }
  const pad = (max - min) * 0.14; min -= pad; max += pad;
  const x = i => L + i / (values.length - 1) * (W - L - R);
  const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const d = smooth(pts);
  const grid = [0, 0.5, 1].map(p => { const v = min + (max - min) * p; return `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/><text x="${L - 5}" y="${(y(v) + 3).toFixed(1)}" class="axis" text-anchor="end">${f1(v)}</text>`; }).join('');
  const lab = labels.length ? [...new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1])].map(i => `<text x="${x(i).toFixed(1)}" y="${H - 5}" class="axis" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}">${labels[i]}</text>`).join('') : '';
  const last = values.length - 1, avgPts = avg ? avg.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean) : null;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="grafik" style="color:${color}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".32"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    ${grid}${lab}
    ${goal != null ? `<line x1="${L}" x2="${W - R}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" class="goal"/>` : ''}
    <path d="${d} L${x(last).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z" fill="url(#${id})" class="area"/>
    <path d="${d}" class="line draw"/>
    ${avgPts && avgPts.length > 1 ? `<path d="${smooth(avgPts)}" class="line2"/>` : ''}
    <circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="9" class="halo"/>
    <circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="4.5" class="dot"/>
    <text x="${Math.min(x(last), W - R - 2).toFixed(1)}" y="${(y(values[last]) - 12).toFixed(1)}" class="val" text-anchor="end">${f1(values[last])}${unit}</text></svg>`;
}

export function bars(values, { labels = [], h = 140, unit = '', goal = null, color = 'var(--accent)', highlightLast = true } = {}) {
  const W = 340, H = h, L = 6, R = 6, T = 18, B = 22;
  if (!values.length || values.every(v => !v)) return '<p class="muted tiny chart-empty">Hali ma’lumot yo‘q.</p>';
  const id = 'b' + (++uid);
  const max = Math.max(...values, goal || 0) * 1.12 || 1;
  const bw = (W - L - R) / values.length;
  const y = v => T + (1 - v / max) * (H - T - B);
  const last = values.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="ustunli grafik" style="color:${color}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity=".55"/></linearGradient></defs>
    ${goal ? `<line x1="${L}" x2="${W - R}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" class="goal"/><text x="${W - R}" y="${(y(goal) - 4).toFixed(1)}" class="axis goal-t" text-anchor="end">maqsad</text>` : ''}
    ${values.map((v, i) => { const hgt = Math.max(v ? 3 : 0, H - B - y(v)); const on = (goal && v >= goal) || (highlightLast && i === last); return `<rect x="${(L + i * bw + bw * 0.17).toFixed(1)}" y="${(H - B - hgt).toFixed(1)}" width="${(bw * 0.66).toFixed(1)}" height="${hgt.toFixed(1)}" rx="${Math.min(6, bw * 0.22).toFixed(1)}" class="bar ${on ? 'hit' : ''}" style="animation-delay:${i * 28}ms${on ? `;fill:url(#${id})` : ''}"/>`; }).join('')}
    ${labels.map((l, i) => (labels.length <= 8 || i % 2 === last % 2) ? `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 5}" class="axis" text-anchor="middle">${l}</text>` : '').join('')}
    <text x="${L}" y="11" class="axis">max ${Math.round(Math.max(...values)).toLocaleString('ru')}${unit}</text></svg>`;
}

// Apple-style activity rings: [{ value 0..n, color, label }] outer → inner
export function rings(items, size = 128) {
  const sw = size * 0.105, gap = sw * 0.32, c = size / 2;
  return `<svg class="rings" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="halqalar">${items.map((it, i) => {
    const r = c - sw / 2 - i * (sw + gap), C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, it.value || 0));
    return `<g style="color:${it.color}"><circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" class="rtrack" stroke-width="${sw.toFixed(2)}"/>
      <circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" class="rval" stroke-width="${sw.toFixed(2)}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - p)).toFixed(2)}" style="--C:${C.toFixed(2)};animation-delay:${i * 120}ms" transform="rotate(-90 ${c} ${c})"/></g>`;
  }).join('')}</svg>`;
}

// single progress ring with a number in the middle
export function gauge(p, { size = 76, color = 'var(--accent)', label = '', value = '' } = {}) {
  const sw = size * 0.11, r = size / 2 - sw / 2, C = 2 * Math.PI * r, q = Math.max(0, Math.min(1, p || 0));
  return `<div class="gauge" style="width:${size}px;height:${size}px;color:${color}"><svg viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(2)}" class="rtrack" stroke-width="${sw.toFixed(2)}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(2)}" class="rval" stroke-width="${sw.toFixed(2)}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - q)).toFixed(2)}" style="--C:${C.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <span><b>${value}</b>${label ? `<small>${label}</small>` : ''}</span></div>`;
}

// tiny trend line for tiles
export function spark(values, color = 'var(--accent)') {
  const v = values.filter(x => x != null);
  if (v.length < 2) return '';
  const W = 100, H = 28, min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((x, i) => [i / (v.length - 1) * W, H - 3 - (x - min) / span * (H - 6)]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="color:${color}"><path d="${smooth(pts)}"/></svg>`;
}
