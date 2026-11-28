// Health tracking — pure logic (no DOM, no storage): BMI, waist-to-height ratio, blood pressure,
// and lab tests every ~6 months with unit conversion and a simple ✅/🟡/🔴 status.
// Ranges are GENERAL adult-male reference values for orientation only. The range printed on the
// lab's own report always prevails, and only a doctor interprets results. Nothing here is a diagnosis.

// status: 'ok' ✅ | 'mid' 🟡 | 'bad' 🔴
export const ICON = { ok: '✅', mid: '🟡', bad: '🔴', none: '⚪' };

// bands: ascending [upperBoundExclusive (in base unit), status, short text]
export const LABS = [
  { key: 'tc', group: 'lip', name: 'Umumiy xolesterin', units: [['mmol/L', 1], ['mg/dL', 38.67]], dec: 1, plaus: [1.5, 20],
    bands: [[5.2, 'ok', 'me’yorda'], [6.2, 'mid', 'chegarada'], [Infinity, 'bad', 'yuqori']],
    info: 'Qondagi barcha xolesterin. Alohida emas, LDL va HDL bilan birga baholanadi.' },
  { key: 'ldl', group: 'lip', name: 'LDL («yomon» xolesterin)', units: [['mmol/L', 1], ['mg/dL', 38.67]], dec: 1, plaus: [0.3, 15],
    bands: [[3.0, 'ok', 'me’yorda'], [4.1, 'mid', 'chegarada'], [Infinity, 'bad', 'yuqori']],
    info: 'Tomirlarda blyashka hosil bo‘lishi bilan bog‘liq asosiy ko‘rsatkich. Maqsadli daraja yurak-qon tomir xavfingizga bog‘liq — buni shifokor belgilaydi.' },
  { key: 'hdl', group: 'lip', name: 'HDL («yaxshi» xolesterin)', units: [['mmol/L', 1], ['mg/dL', 38.67]], dec: 2, plaus: [0.2, 5], higherBetter: true,
    bands: [[1.0, 'bad', 'past'], [Infinity, 'ok', 'me’yorda']],
    info: 'Ortiqcha xolesterinni jigarga qaytaradi. Erkaklarda 1.0 mmol/L dan past bo‘lishi xavf omili.' },
  { key: 'tg', group: 'lip', name: 'Triglitseridlar', units: [['mmol/L', 1], ['mg/dL', 88.57]], dec: 2, plaus: [0.2, 30],
    bands: [[1.7, 'ok', 'me’yorda'], [2.3, 'mid', 'chegarada'], [Infinity, 'bad', 'yuqori']],
    info: 'Qondagi yog‘lar. Kechki yog‘li ovqat va spirtli ichimlik natijani oshiradi — och qoringa topshiring.' },
  { key: 'glu', group: 'sug', name: 'Qand (glyukoza), och qoringa', units: [['mmol/L', 1], ['mg/dL', 18.016]], dec: 1, plaus: [1.5, 35],
    bands: [[3.9, 'mid', 'past'], [5.6, 'ok', 'me’yorda'], [7.0, 'mid', 'chegarada'], [Infinity, 'bad', 'yuqori']],
    info: '8–12 soat och qoringa o‘lchanadi. Bitta natija bilan xulosa qilinmaydi.' },
  { key: 'hba1c', group: 'sug', name: 'HbA1c (3 oylik o‘rtacha qand)', units: [['%', 1], ['mmol/mol', null]], dec: 1, plaus: [3, 18],
    bands: [[5.7, 'ok', 'me’yorda'], [6.5, 'mid', 'chegarada'], [Infinity, 'bad', 'yuqori']],
    info: 'So‘nggi 2–3 oydagi o‘rtacha qand darajasini ko‘rsatadi; och qoringa bo‘lishi shart emas.' },
  { key: 'testo', group: 'horm', name: 'Testosteron (umumiy)', units: [['nmol/L', 1], ['ng/dL', 28.84], ['ng/mL', 0.2884]], dec: 1, plaus: [0.3, 80],
    bands: [[8, 'bad', 'past'], [12, 'mid', 'chegarada'], [35, 'ok', 'me’yorda'], [Infinity, 'mid', 'odatdagidan yuqori']],
    info: 'Ertalab soat 7–10 da topshiriladi (kun davomida pasayadi). Past chiqsa, xulosa uchun boshqa kuni ertalab qayta topshiriladi va shifokor baholaydi.' },
  { key: 'tsh', group: 'horm', name: 'TTG / TSH (qalqonsimon bez)', units: [['mIU/L', 1]], dec: 2, plaus: [0.005, 100],
    bands: [[0.1, 'bad', 'juda past'], [0.4, 'mid', 'past'], [4.0, 'ok', 'me’yorda'], [10, 'mid', 'yuqori'], [Infinity, 'bad', 'ancha yuqori']],
    info: 'Qalqonsimon bez faoliyatining asosiy skrining ko‘rsatkichi. Biotin qo‘shimchasi natijani buzishi mumkin.' },
  { key: 'vitd', group: 'vit', name: 'Vitamin D (25-OH)', units: [['ng/mL', 1], ['nmol/L', 2.496]], dec: 0, plaus: [2, 200], higherBetter: true,
    bands: [[20, 'bad', 'yetishmovchilik'], [30, 'mid', 'kamroq'], [100, 'ok', 'yetarli'], [Infinity, 'mid', 'yuqori']],
    info: 'Suyak, mushak va immunitet uchun muhim. Qish-bahorda ko‘pincha pasayadi.' },
  { key: 'ferritin', group: 'vit', name: 'Ferritin (temir zaxirasi)', units: [['ng/mL', 1], ['µg/L', 1]], dec: 0, plaus: [1, 3000],
    bands: [[15, 'bad', 'past'], [30, 'mid', 'kamroq'], [400, 'ok', 'me’yorda'], [1000, 'mid', 'yuqori'], [Infinity, 'bad', 'ancha yuqori']],
    info: 'Organizmdagi temir zaxirasi. Yallig‘lanish va kasallik paytida sun’iy ravishda oshishi mumkin.' },
  { key: 'hb', group: 'vit', name: 'Gemoglobin', units: [['g/L', 1], ['g/dL', 0.1]], dec: 0, plaus: [50, 250],
    bands: [[110, 'bad', 'past'], [130, 'mid', 'biroz past'], [175, 'ok', 'me’yorda'], [185, 'mid', 'biroz yuqori'], [Infinity, 'bad', 'yuqori']],
    info: 'Qonning kislorod tashish qobiliyati. Erkaklarda 130 g/L dan past bo‘lsa — kamqonlik belgisi bo‘lishi mumkin.' },
  { key: 'alt', group: 'liv', name: 'ALT (ALaT)', units: [['U/L', 1]], dec: 0, plaus: [2, 3000],
    bands: [[41, 'ok', 'me’yorda'], [121, 'mid', 'yuqori'], [Infinity, 'bad', 'ancha yuqori']],
    info: 'Jigar fermenti. Og‘ir mashg‘ulotdan keyin 2–3 kun oshib turishi mumkin — tahlildan oldin 48–72 soat og‘ir yuk bermang.' },
  { key: 'ast', group: 'liv', name: 'AST (AsAT)', units: [['U/L', 1]], dec: 0, plaus: [2, 3000],
    bands: [[41, 'ok', 'me’yorda'], [121, 'mid', 'yuqori'], [Infinity, 'bad', 'ancha yuqori']],
    info: 'Jigar va mushak fermenti. Kuch mashg‘ulotidan keyin mushakdan chiqib, vaqtincha oshadi.' },
  { key: 'creat', group: 'liv', name: 'Kreatinin (buyrak)', units: [['µmol/L', 1], ['mg/dL', 1 / 88.4]], dec: 0, plaus: [15, 1500],
    bands: [[45, 'mid', 'past'], [116, 'ok', 'me’yorda'], [134, 'mid', 'biroz yuqori'], [Infinity, 'bad', 'yuqori']],
    info: 'Buyrak filtratsiyasining ko‘rsatkichi. Mushak massasi ko‘p bo‘lsa, kreatin qo‘shimchasi va og‘ir mashg‘ulotdan keyin biroz yuqori chiqadi — laborantga ayting.' },
];
export const GROUPS = { lip: '🫀 Lipidlar (xolesterin)', sug: '🍬 Qand', horm: '⚙️ Gormonlar', vit: '🩸 Qon, temir, vitamin D', liv: '🧪 Jigar va buyrak' };
export const LAB = Object.fromEntries(LABS.map(l => [l.key, l]));

// unit conversion — values are stored in the base unit (index 0)
export function toBase(key, v, ui = 0) {
  const l = LAB[key];
  if (ui === 0) return v;
  if (key === 'hba1c') return v / 10.929 + 2.15;          // IFCC mmol/mol → NGSP %
  return v / l.units[ui][1];
}
export function fromBase(key, v, ui = 0) {
  const l = LAB[key];
  if (ui === 0) return v;
  if (key === 'hba1c') return (v - 2.15) * 10.929;
  return v * l.units[ui][1];
}
export function fmt(key, v, ui = 0) {
  const x = fromBase(key, v, ui), l = LAB[key];
  const d = ui === 0 ? l.dec : x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return String(Math.round(x * 10 ** d) / 10 ** d);
}
export function labStatus(key, v) {
  const l = LAB[key];
  if (v == null || !l) return { s: 'none', text: '—' };
  const b = l.bands.find(([max]) => v < max) || l.bands[l.bands.length - 1];
  return { s: b[1], text: b[2] };
}
export const plausible = (key, v) => { const p = LAB[key].plaus; return v >= p[0] && v <= p[1]; };

// Direction of change between the last two results: better / worse / same (relative to the healthy band).
export function okRange(key) {
  const l = LAB[key], i = l.bands.findIndex(b => b[1] === 'ok');
  return [i > 0 ? l.bands[i - 1][0] : 0, l.bands[i][0]];
}
const RANK = { ok: 0, mid: 1, bad: 2 };
export function labTrend(key, prev, cur) {
  if (prev == null || cur == null) return null;
  const up = cur > prev, arrow = up ? '↑' : '↓';
  if (Math.abs(cur - prev) / Math.max(Math.abs(prev), 1e-9) < 0.03) return { dir: 'same', arrow: '→', text: 'o‘zgarmadi' };
  const rp = RANK[labStatus(key, prev).s], rc = RANK[labStatus(key, cur).s];
  if (rc < rp) return { dir: 'better', arrow, text: 'yaxshilandi' };
  if (rc > rp) return { dir: 'worse', arrow, text: 'yomonlashdi' };
  const [lo, hi] = okRange(key);
  if (rc === 0) return LAB[key].higherBetter ? { dir: up ? 'better' : 'same', arrow, text: up ? 'yaxshilandi' : 'me’yor ichida' } : { dir: 'same', arrow, text: 'me’yor ichida' };
  const better = cur >= hi ? !up : cur < lo ? up : false;
  return { dir: better ? 'better' : 'worse', arrow, text: better ? 'yaxshilanmoqda' : 'yomonlashdi' };
}

// ── BMI (WHO) and waist-to-height ratio ──
export function bmi(weight, heightCm) {
  if (!(weight > 0 && heightCm > 0)) return null;
  const v = Math.round(weight / (heightCm / 100) ** 2 * 10) / 10;
  const c = v < 18.5 ? ['mid', 'Kam vazn'] : v < 25 ? ['ok', 'Me’yoriy vazn'] : v < 30 ? ['mid', 'Ortiqcha vazn'] : v < 35 ? ['bad', 'Semizlik, I daraja'] : v < 40 ? ['bad', 'Semizlik, II daraja'] : ['bad', 'Semizlik, III daraja'];
  const healthy = [Math.round(18.5 * (heightCm / 100) ** 2), Math.round(24.9 * (heightCm / 100) ** 2)];
  return { v, s: c[0], cat: c[1], healthy };
}
export function waistHeight(waist, heightCm) {
  if (!(waist > 0 && heightCm > 0)) return null;
  const v = Math.round(waist / heightCm * 100) / 100;
  return { v, s: v < 0.5 ? 'ok' : v < 0.6 ? 'mid' : 'bad', text: v < 0.5 ? 'me’yorda' : v < 0.6 ? 'qorin yog‘i ko‘proq' : 'qorin yog‘i ko‘p' };
}
// One plain sentence: BMI can mislead in muscular people, so it is read together with the waist.
export function bmiNote(b, wh) {
  if (!b) return 'Bo‘y va vazn kiritilsa, tana massasi indeksi hisoblanadi.';
  if (b.v >= 25 && wh && wh.s === 'ok') return 'TMI yuqori, lekin bel/bo‘y nisbati me’yorda — bu ko‘pincha mushak massasi hisobiga. Bel o‘lchami muhimroq.';
  if (b.v >= 25 && !wh) return 'Mushakli odamlarda TMI vaznni ortiqcha ko‘rsatishi mumkin — bel o‘lchamini kiriting, aniqroq bo‘ladi.';
  if (b.s === 'ok' && wh && wh.s !== 'ok') return 'Vazn me’yorda, lekin bel/bo‘y nisbati yuqori — qorin yog‘ini kamaytirish foydali.';
  return b.s === 'ok' ? 'Vazn bo‘yingizga mos me’yorda ✅' : `Bo‘yingiz uchun me’yoriy vazn: ${b.healthy[0]}–${b.healthy[1]} kg.`;
}

// ── Blood pressure (resting, seated, 2 readings) ──
export function bpStatus(sys, dia) {
  if (!(sys > 0 && dia > 0)) return { s: 'none', text: '—' };
  if (sys >= 180 || dia >= 120) return { s: 'bad', text: 'juda yuqori', urgent: true };
  if (sys >= 140 || dia >= 90) return { s: 'bad', text: 'yuqori' };
  if (sys >= 130 || dia >= 85) return { s: 'mid', text: 'yuqori-me’yor' };
  if (sys >= 120 || dia >= 80) return { s: 'mid', text: 'biroz yuqori' };
  if (sys < 90 || dia < 60) return { s: 'mid', text: 'past' };
  return { s: 'ok', text: 'me’yorda' };
}
export const bpPlausible = (sys, dia, pulse) => sys >= 70 && sys <= 260 && dia >= 40 && dia <= 160 && sys > dia && (pulse == null || (pulse >= 30 && pulse <= 220));

// ── schedule: labs every ~6 months ──
export const LAB_EVERY_DAYS = 182;
export function nextLabDue(labs, now = Date.now()) {
  if (!labs.length) return { due: null, days: null, overdue: true };
  const last = Math.max(...labs.map(l => Date.parse(l.date)));
  const due = last + LAB_EVERY_DAYS * 86400000;
  const days = Math.ceil((due - now) / 86400000);
  return { due: new Date(due), days, overdue: days <= 0 };
}
// Latest value + previous value of each test across all lab entries.
export function latest(labs) {
  const out = {};
  const sorted = [...labs].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted) for (const [k, v] of Object.entries(e.values || {})) {
    if (v == null || !LAB[k]) continue;
    out[k] = { v, date: e.date, prev: out[k] ? out[k].v : null, prevDate: out[k] ? out[k].date : null };
  }
  return out;
}
export function series(labs, key) {
  return [...labs].sort((a, b) => a.date.localeCompare(b.date)).filter(e => e.values && e.values[key] != null).map(e => ({ date: e.date, v: e.values[key] }));
}
export function summary(labs) {
  const L = latest(labs), c = { ok: 0, mid: 0, bad: 0 };
  for (const [k, x] of Object.entries(L)) c[labStatus(k, x.v).s]++;
  return { ...c, total: Object.keys(L).length };
}
