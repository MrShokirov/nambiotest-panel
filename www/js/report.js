// 📄 Monthly PDF: collects the month's data and shares a PDF (Telegram, Drive, …). Nothing is sent automatically.
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import * as R from './records.js';
import * as N from './native.js';
import * as H from './health-core.js';
import { draw } from './report-pdf.js';
import { choose, toast } from './ui.js';

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const fmt = d => d.toLocaleDateString('ru');

export function period(kind) {
  const now = new Date();
  if (kind === 'prev') { const a = new Date(now.getFullYear(), now.getMonth() - 1, 1), b = new Date(now.getFullYear(), now.getMonth(), 1); return { a, b, label: `${a.getFullYear()}-yil ${MONTHS[a.getMonth()]}` }; }
  if (kind === 'month') { const a = new Date(now.getFullYear(), now.getMonth(), 1); return { a, b: now, label: `${a.getFullYear()}-yil ${MONTHS[a.getMonth()]} (${fmt(a)} – ${fmt(now)})` }; }
  const a = new Date(now); a.setDate(a.getDate() - 30); a.setHours(0, 0, 0, 0);
  return { a, b: now, label: `So‘nggi 30 kun (${fmt(a)} – ${fmt(now)})` };
}

export function collect(kind = '30') {
  const db = S.db(), p = db.profile, { a, b, label } = period(kind);
  const inP = t => { const x = Date.parse(t); return x >= a.getTime() && x < b.getTime() + 1; };
  const fin = D.finishedSessions().filter(s => inP(s.finishedAt)).reverse();
  const ids = new Set(fin.map(s => s.id));
  const sets = db.sets.filter(x => ids.has(x.sid));
  const volume = sets.filter(x => D.EX[x.key] && D.EX[x.key].unit === 'reps' && !D.EX[x.key].assist).reduce((s, x) => s + x.w * x.r, 0);
  const minutes = fin.reduce((s, x) => s + Math.max(0, Math.round((Date.parse(x.finishedAt) - Date.parse(x.startedAt)) / 60000)), 0);
  const days = Math.max(1, Math.round((b - a) / 86400000));
  let stepsSum = 0, stepsDays = 0, stepsMax = 0;
  for (let i = 0; i < days; i++) { const d = new Date(a); d.setDate(d.getDate() + i); const v = db.steps[D.dateKey(d)]; if (v) { stepsSum += v; stepsDays++; stepsMax = Math.max(stepsMax, v); } }
  const planned = Math.round(days / 7 * 3);
  // strength: best e1RM in the first and the last session of the period per lift
  const per = {};
  for (const s of fin) {
    if (s.deload) continue;
    for (const x of sets.filter(z => z.sid === s.id)) {
      const ex = D.EX[x.key]; if (!ex || ex.unit !== 'reps' || ex.assist || !x.w) continue;
      const e = C.e1rm(x.w, x.r) || 0; (per[x.key] ||= []); const arr = per[x.key];
      if (!arr.length || arr[arr.length - 1].sid !== s.id) arr.push({ sid: s.id, e }); else arr[arr.length - 1].e = Math.max(arr[arr.length - 1].e, e);
    }
  }
  const lifts = Object.entries(per).filter(([, v]) => v.length).sort((x, y) => y[1].length - x[1].length || y[1][y[1].length - 1].e - x[1][x[1].length - 1].e).slice(0, 8)
    .map(([k, v]) => ({ name: D.EX[k].short, start: Math.round(v[0].e), end: Math.round(v[v.length - 1].e) }));
  // weeks (last 6 calendar weeks ending at b)
  const weeks = [];
  for (let i = 5; i >= 0; i--) { const ws = R.weekStart(b); ws.setDate(ws.getDate() - 7 * i); const we = new Date(ws); we.setDate(we.getDate() + 7);
    weeks.push({ n: D.finishedSessions().filter(s => { const t = Date.parse(s.finishedAt); return t >= ws && t < we; }).length, label: `${ws.getDate()}.${String(ws.getMonth() + 1).padStart(2, '0')}` }); }
  // body
  const body = [...db.body].sort((x, y) => x.date.localeCompare(y.date));
  const bodyP = body.filter(x => inP(x.date + 'T12:00:00'));
  const ms = [...(db.measures || [])].filter(m => m.waist).sort((x, y) => x.date.localeCompare(y.date));
  const msP = ms.filter(x => inP(x.date + 'T12:00:00'));
  const lastW = body.length ? body[body.length - 1].weight : p.weight, lastM = ms[ms.length - 1];
  // nutrition
  let fd = 0, fp = 0, fk = 0, fw = 0;
  for (let i = 0; i < days; i++) { const d = new Date(a); d.setDate(d.getDate() + i); const f = (db.food || {})[D.dateKey(d)]; if (f && (f.items.length || f.water)) { fd++; fp += f.items.reduce((s, x) => s + x.p, 0); fk += f.items.reduce((s, x) => s + x.kcal, 0); fw += f.water || 0; } }
  // watch
  let sl = [], hr = [];
  for (let i = 0; i < days; i++) { const d = new Date(a); d.setDate(d.getDate() + i); const k = D.dateKey(d); if ((db.sleep || {})[k]) sl.push(db.sleep[k]); if (((db.hr || {})[k] || {}).rest) hr.push(db.hr[k].rest); }
  const avg = v => (v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null);
  // health
  const hs = db.health || { labs: [], bp: [] }, L = H.latest(hs.labs || []), units = hs.units || {};
  const lastLab = [...(hs.labs || [])].sort((x, y) => x.date.localeCompare(y.date)).pop();
  const bp = [...(hs.bp || [])].sort((x, y) => x.date.localeCompare(y.date)).pop();
  const pos = Math.min(db.nextSession, D.TOTAL());
  return {
    name: p.name, periodLabel: label, generated: new Date().toLocaleString('ru'),
    kpi: { workouts: fin.length, bonus: fin.filter(s => s.bonus).length, planPct: planned ? Math.min(100, Math.round(fin.filter(s => !s.bonus).length / planned * 100)) : 0,
      sets: sets.length, minutes, volume, km: R.stepsKm(stepsSum), stepsAvg: stepsDays ? Math.round(stepsSum / stepsDays) : 0 },
    lifts, weeks,
    body: { wStart: bodyP.length ? bodyP[0].weight : null, wEnd: bodyP.length ? bodyP[bodyP.length - 1].weight : null,
      waistStart: msP.length ? msP[0].waist : null, waistEnd: msP.length ? msP[msP.length - 1].waist : null,
      bmi: H.bmi(lastW, p.height), bf: lastM ? C.navyBodyfat(lastM.waist, lastM.neck, p.height) : null,
      series: bodyP.map(x => ({ v: x.weight, label: x.date.slice(5).split('-').reverse().join('.') })) },
    watch: sl.length || hr.length ? { sleepAvg: avg(sl), hrAvg: avg(hr) ? Math.round(avg(hr)) : null, stepsMax } : null,
    food: { days: fd, p: fd ? Math.round(fp / fd) : 0, kcal: fd ? Math.round(fk / fd) : 0, water: fd ? Math.round(fw / fd) : 0, goal: C.targets(p).protein },
    habits: { morning: Object.keys(db.morning || {}).filter(k => inP(k + 'T12:00:00')).length,
      prehab: fin.filter(s => s.prehab && s.prehab.done && s.prehab.done.length).length, pos, total: D.TOTAL(), phase: D.PRG.sessions[pos - 1].phase },
    health: { bp: bp ? { ...bp, text: H.bpStatus(bp.sys, bp.dia).text } : null, labDate: lastLab ? lastLab.date.split('-').reverse().join('.') : '',
      labs: Object.entries(L).map(([k, x]) => { const st = H.labStatus(k, x.v), ui = units[k] || 0; return { name: H.LAB[k].name, value: H.fmt(k, x.v, ui), unit: H.LAB[k].units[ui][0], s: st.s, text: st.text }; }) },
  };
}

let loading = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  return (loading ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/jspdf.umd.min.js';
    s.onload = () => res(window.jspdf.jsPDF); s.onerror = () => rej(new Error('jsPDF yuklanmadi')); document.head.appendChild(s);
  }));
}

export async function make() {
  const kind = await choose('📄 Qaysi davr uchun hisobot?', [['month', 'Shu oy'], ['prev', 'O‘tgan oy'], ['30', 'So‘nggi 30 kun']]);
  if (!kind) return;
  toast('⏳ PDF tayyorlanmoqda…');
  try {
    const jsPDF = await loadJsPDF();
    const doc = draw(jsPDF, collect(kind));
    const name = `SokhibjonGYM_hisobot_${D.dateKey()}.pdf`;
    const b64 = doc.output('datauristring').split(',')[1];
    const ok = await N.shareBinary(name, b64, 'application/pdf', 'Oylik hisobot');
    if (!ok) doc.save(name);
    toast('✅ Hisobot tayyor');
  } catch (e) { console.warn(e); toast('PDF xatosi: ' + (e.message || e)); }
}
