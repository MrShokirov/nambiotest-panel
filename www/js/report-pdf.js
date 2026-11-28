// Monthly PDF report — pure drawing (works in the browser and in Node tests).
// data: see collect() in report.js. Standard PDF fonts (Helvetica) → text is sanitised to Windows-1252.

const CP1252 = new Set('‘’“”–—•…«»×·€™°±²³µ¼½¾'.split(''));
export function clean(s) {
  return String(s ?? '')
    .replace(/[ʻʼ`]/g, '‘').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/→/g, '->').replace(/↑/g, '+').replace(/↓/g, '-')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .split('').filter(c => c.charCodeAt(0) < 256 || CP1252.has(c)).join('').replace(/\s+/g, ' ').trim();
}
const RGB = { teal: [15, 158, 144], blue: [0, 113, 227], orange: [228, 122, 0], red: [224, 36, 75], green: [34, 164, 71], purple: [88, 86, 214],
  coral: [232, 87, 42], ink: [28, 28, 30], muted: [108, 108, 114], line: [228, 228, 234], soft: [246, 246, 249] };
const ST = { ok: RGB.green, mid: RGB.orange, bad: RGB.red, none: RGB.muted };

export function draw(jsPDF, d) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = 0;
  const fill = c => doc.setFillColor(...c), stroke = c => doc.setDrawColor(...c), color = c => doc.setTextColor(...c);
  const text = (s, x, yy, o = {}) => doc.text(clean(s), x, yy, o);
  const font = (size, style = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const need = h => { if (y + h > 282) { footer(); doc.addPage(); y = 16; } };
  let page = 1;
  function footer() {
    font(7.5); color(RGB.muted);
    text('Sokhibjon GYM · shaxsiy hisobot · tibbiy hujjat emas — tahlil natijalarini shifokor bilan muhokama qiling.', M, 290);
    text(`${page++}`, W - M, 290, { align: 'right' });
  }
  function section(title, c = RGB.teal) {
    need(16); y += 4;
    fill(c); doc.roundedRect(M, y - 4.2, 2.2, 6, 1, 1, 'F');
    font(13, 'bold'); color(RGB.ink); text(title, M + 5, y);
    y += 6;
  }

  // header band
  fill(RGB.teal); doc.rect(0, 0, W, 34, 'F');
  fill(RGB.blue); doc.triangle(W - 70, 0, W, 0, W, 34, 'F');
  font(20, 'bold'); color([255, 255, 255]); text('Sokhibjon GYM — oylik hisobot', M, 15);
  font(10.5); text(`${d.name ? d.name + ' · ' : ''}${d.periodLabel}`, M, 23);
  font(8.5); text(`Tuzilgan: ${d.generated}`, M, 29);
  y = 44;

  // KPI tiles
  const k = d.kpi, tiles = [['Mashg‘ulotlar', `${k.workouts}`, k.bonus ? `shundan ${k.bonus} bonus` : `rejadan ${k.planPct}%`, RGB.teal],
    ['Setlar', `${k.sets}`, `${k.minutes} daqiqa`, RGB.orange], ['Ko‘tarilgan', k.volume >= 1000 ? `${(k.volume / 1000).toFixed(1)} t` : `${Math.round(k.volume)} kg`, 'jami hajm', RGB.purple],
    ['Yurildi', `${k.km.toFixed(1)} km`, k.stepsAvg ? `${k.stepsAvg.toLocaleString('ru')} qadam/kun` : 'qadam yo‘q', RGB.green]];
  const tw = (W - 2 * M - 9) / 4;
  tiles.forEach(([l, v, s, c], i) => {
    const x = M + i * (tw + 3);
    fill(RGB.soft); doc.roundedRect(x, y, tw, 24, 3, 3, 'F');
    fill(c); doc.roundedRect(x, y, tw, 1.6, 0.8, 0.8, 'F');
    font(8); color(RGB.muted); text(l, x + 4, y + 7);
    font(16, 'bold'); color(RGB.ink); text(v, x + 4, y + 15.5);
    font(7.5); color(RGB.muted); text(s, x + 4, y + 20.5);
  });
  y += 32;

  // strength
  section('Kuch ko‘rsatkichi (taxminiy 1 takrorlik maksimum)', RGB.orange);
  if (d.lifts.length) {
    font(8.5, 'bold'); color(RGB.muted);
    text('Mashq', M, y); text('Boshida', 120, y, { align: 'right' }); text('Oxirida', 150, y, { align: 'right' }); text('O‘zgarish', W - M, y, { align: 'right' });
    y += 2; stroke(RGB.line); doc.line(M, y, W - M, y); y += 5;
    for (const l of d.lifts) {
      need(7);
      font(9.5); color(RGB.ink); text(l.name, M, y);
      text(`${l.start} kg`, 120, y, { align: 'right' }); font(9.5, 'bold'); text(`${l.end} kg`, 150, y, { align: 'right' });
      const pct = l.start ? (l.end - l.start) / l.start * 100 : 0;
      color(pct > 0.5 ? RGB.green : pct < -1 ? RGB.red : RGB.muted); text(`${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, W - M, y, { align: 'right' });
      y += 6.2;
    }
  } else { font(9.5); color(RGB.muted); text('Bu davrda kuch mashqlari yozilmagan.', M, y); y += 6; }

  // weekly workouts chart
  section('Haftalik mashg‘ulotlar', RGB.teal);
  barChart(d.weeks.map(w => w.n), d.weeks.map(w => w.label), 3, RGB.teal, 30);

  // body
  section('Vazn va tana', RGB.blue);
  font(9.5); color(RGB.ink);
  const b = d.body;
  const rows = [['Vazn', b.wStart != null ? `${b.wStart} -> ${b.wEnd} kg (${b.wEnd - b.wStart >= 0 ? '+' : ''}${(b.wEnd - b.wStart).toFixed(1)} kg)` : 'yozuv yo‘q'],
    ['Bel', b.waistStart != null ? `${b.waistStart} -> ${b.waistEnd} sm` : 'yozuv yo‘q'], ['TMI', b.bmi ? `${b.bmi.v.toFixed(1)} — ${b.bmi.cat}` : '—'],
    ['Tana yog‘i (taxminiy)', b.bf ? `${b.bf}%` : '—']];
  kv(rows);
  if (b.series.length >= 2) lineChart(b.series, RGB.blue, 28);

  // recovery & activity
  if (d.watch) {
    section('Tiklanish (soatdan)', RGB.purple);
    kv([['O‘rtacha uyqu', d.watch.sleepAvg ? `${d.watch.sleepAvg} soat` : '—'], ['Tinch puls', d.watch.hrAvg ? `${d.watch.hrAvg} zarba/daq` : '—'],
      ['Eng ko‘p qadam', d.watch.stepsMax ? `${d.watch.stepsMax.toLocaleString('ru')}` : '—']]);
  }
  // nutrition
  section('Ovqatlanish', RGB.coral);
  kv([['Yozilgan kunlar', `${d.food.days}`], ['O‘rtacha oqsil', d.food.days ? `${d.food.p} g / maqsad ${d.food.goal} g` : '—'],
    ['O‘rtacha kaloriya', d.food.days ? `${d.food.kcal} kkal` : '—'], ['O‘rtacha suv', d.food.days ? `${(d.food.water / 1000).toFixed(1)} L` : '—']]);
  // habits
  section('Odatlar', RGB.green);
  kv([['Ertalabki mashq', `${d.habits.morning} kun`], ['Himoya bloki', `${d.habits.prehab} marta`], ['Dastur', `#${d.habits.pos} / ${d.habits.total} (${d.habits.phase}-bosqich)`]]);
  // health
  section('Salomatlik', RGB.red);
  kv([['Qon bosimi', d.health.bp ? `${d.health.bp.sys}/${d.health.bp.dia} — ${d.health.bp.text}` : '—']]);
  if (d.health.labs.length) {
    font(8.5); color(RGB.muted); text(`Oxirgi tahlillar (${d.health.labDate}). Oraliqlar umumiy — blankadagi me’yor ustun.`, M, y); y += 5.5;
    for (const l of d.health.labs) {
      need(6);
      fill(ST[l.s] || RGB.muted); doc.circle(M + 1.5, y - 1.2, 1.3, 'F');
      font(9.5); color(RGB.ink); text(l.name, M + 5, y); font(9.5, 'bold'); text(`${l.value} ${l.unit}`, 150, y, { align: 'right' });
      font(9); color(ST[l.s] || RGB.muted); text(l.text, W - M, y, { align: 'right' }); y += 5.8;
    }
  } else { font(9.5); color(RGB.muted); text('Tahlil natijalari kiritilmagan.', M, y); y += 6; }
  footer();
  return doc;

  function kv(list) {
    for (const [a, v] of list) {
      need(6.5);
      font(9.5); color(RGB.muted); text(a, M, y); color(RGB.ink); font(9.5, 'bold'); text(v, W - M, y, { align: 'right' });
      stroke(RGB.line); doc.setLineWidth(0.15); doc.line(M, y + 2, W - M, y + 2); y += 6.5;
    }
  }
  function barChart(vals, labels, goal, c, h) {
    need(h + 10);
    const x0 = M, w = W - 2 * M, max = Math.max(goal || 0, ...vals, 1) * 1.15, bw = w / vals.length;
    const yb = y + h;
    if (goal) { stroke(c); doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.3); doc.line(x0, yb - goal / max * h, x0 + w, yb - goal / max * h); doc.setLineDashPattern([], 0); }
    vals.forEach((v, i) => {
      const bh = v / max * h; fill(v >= (goal || Infinity) ? c : [190, 230, 225]);
      if (bh > 0) doc.roundedRect(x0 + i * bw + bw * 0.2, yb - bh, bw * 0.6, bh, 1, 1, 'F');
      font(7.5); color(RGB.muted); text(labels[i], x0 + i * bw + bw / 2, yb + 4, { align: 'center' });
      if (v) { font(8, 'bold'); color(RGB.ink); text(String(v), x0 + i * bw + bw / 2, yb - bh - 1.5, { align: 'center' }); }
    });
    y = yb + 9;
  }
  function lineChart(series, c, h) {
    need(h + 10);
    const x0 = M + 8, w = W - 2 * M - 8, vals = series.map(s => s.v);
    let mn = Math.min(...vals), mx = Math.max(...vals); if (mx - mn < 1) { mn -= 0.5; mx += 0.5; }
    const X = i => x0 + i / (vals.length - 1) * w, Y = v => y + h - (v - mn) / (mx - mn) * h;
    stroke(RGB.line); doc.setLineWidth(0.15); [mn, (mn + mx) / 2, mx].forEach(v => { doc.line(x0, Y(v), x0 + w, Y(v)); font(7); color(RGB.muted); text(v.toFixed(1), M, Y(v) + 1); });
    stroke(c); doc.setLineWidth(0.7);
    for (let i = 1; i < vals.length; i++) doc.line(X(i - 1), Y(vals[i - 1]), X(i), Y(vals[i]));
    fill(c); vals.forEach((v, i) => doc.circle(X(i), Y(v), 0.9, 'F'));
    font(7); color(RGB.muted); text(series[0].label, x0, y + h + 4); text(series[series.length - 1].label, x0 + w, y + h + 4, { align: 'right' });
    y += h + 9;
  }
}
