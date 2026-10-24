// Scheduled phone notifications (mirrored to the Huawei watch): training-day reminders,
// Sunday weekly summary, weigh-in every ~2 weeks, weekly backup reminder.
// Re-scheduled every time the app opens or a workout finishes, so the texts stay current.
import * as S from './store.js';
import * as C from './coach.js';
import * as D from './data.js';
import { stats } from './records.js';

const P = name => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
const at = (d, hm) => { const [h, m] = hm.split(':').map(Number); const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

export function weeklyText() {
  const db = S.db(), ws = new Date(); ws.setHours(0, 0, 0, 0); ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
  const fin = D.finishedSessions().filter(s => Date.parse(s.finishedAt) >= ws.getTime());
  const core = fin.filter(s => !s.bonus).length, bonus = fin.length - core;
  const ids = new Set(fin.map(s => s.id));
  const sets = db.sets.filter(x => ids.has(x.sid));
  const vol = sets.filter(x => D.EX[x.key].unit === 'reps').reduce((a, x) => a + x.w * x.r, 0);
  const st = stats();
  return `Bu hafta: ${core}/3 mashg‘ulot${bonus ? ` + ${bonus} bonus` : ''} · ${sets.length} set · ${Math.round(vol).toLocaleString('ru')} kg · ${st.km7.toFixed(1)} km yurildi. ` +
    (core >= 3 ? 'Zo‘r hafta! 💪' : 'Keyingi hafta 3 tasini bajaramiz!') +
    (db.nextSession <= D.TOTAL() ? ` Keyingisi: ${D.PRG.sessions[db.nextSession - 1].title}.` : '');
}

export async function reschedule() {
  const LN = P('LocalNotifications');
  if (!LN) return;
  const db = S.db(), p = db.profile;
  try {
    const pending = await LN.getPending();
    const mine = pending.notifications.filter(n => n.id >= 5000 && n.id < 6000).map(n => ({ id: n.id }));
    if (mine.length) await LN.cancel({ notifications: mine });
    const list = [], now = Date.now();
    if (p.remindOn !== false && db.nextSession <= D.TOTAL()) {
      D.schedule(10).forEach(({ d, no, role }, i) => {
        const when = at(d, p.remindTime || '08:00');
        if (when.getTime() <= now + 60000 || i >= 14) return;
        if (role === 'bonus') { list.push({ id: 5000 + i, channelId: 'remind', title: '➕ Bugun bonus kun', body: 'Yengil: yelka, qo‘l, kor + 20 daq kardio. Bormasangiz ham bo‘ladi.', schedule: { at: when, allowWhileIdle: true } }); return; }
        const s = D.PRG.sessions[no - 1];
        list.push({ id: 5000 + i, channelId: 'remind', title: '🏋️ Bugun mashg‘ulot kuni', body: `#${no} ${s.title} · ~${s.minutes.normal} daqiqa${s.deload ? ' · yengil hafta' : ''}`, schedule: { at: when, allowWhileIdle: true } });
      });
    }
    if (p.weeklyOn !== false) {
      const sun = new Date(); sun.setDate(sun.getDate() + ((7 - ((sun.getDay() + 6) % 7) - 1 + 7) % 7));
      let when = at(sun, '20:00');
      if (when.getTime() <= now) when = new Date(when.getTime() + 7 * 86400000);
      list.push({ id: 5100, channelId: 'remind', title: '📊 Haftalik xulosa', body: weeklyText(), largeBody: weeklyText(), extra: { open: 'weekly' }, schedule: { at: when, allowWhileIdle: true } });
    }
    const body = [...db.body].sort((a, b) => a.date.localeCompare(b.date));
    const last = body[body.length - 1];
    let wDue = last ? new Date(Date.parse(last.date) + 13 * 86400000) : new Date(now + 86400000);
    if (wDue.getTime() < now) wDue = new Date(now + 86400000);
    list.push({ id: 5200, channelId: 'remind', title: '⚖️ Vaznni kiritish vaqti', body: 'Ertalab och qoringa torting va ilovaga kiriting (har 1–2 haftada).', extra: { open: 'weight' }, schedule: { at: at(wDue, '08:30') } });
    if (db.sessions.some(s => s.finishedAt)) {
      let bDue = db.lastBackup ? new Date(Date.parse(db.lastBackup) + 7 * 86400000) : new Date(now + 2 * 86400000);
      if (bDue.getTime() < now) bDue = new Date(now + 86400000);
      list.push({ id: 5300, channelId: 'remind', title: '💾 Zaxira vaqti', body: 'Ma’lumotlaringizni Google Drive’ga yuboring — 10 soniya.', extra: { open: 'backup' }, schedule: { at: at(bDue, '20:10') } });
    }
    if (p.morningOn && p.morningTime && p.morningTime !== 'off') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const when = at(d, p.morningTime);
        if (when.getTime() <= now + 60000 || (db.morning || {})[D.dateKey(d)]) continue;
        list.push({ id: 5500 + i, channelId: 'remind', title: '🌅 Ertalabki 3 daqiqa', body: 'Kun boshidagi qisqa mashq — bosing va boshlang.', extra: { open: 'morning' }, schedule: { at: when, allowWhileIdle: true } });
      }
    }
    const ph = await S.listPhotos().catch(() => []);
    if (db.sessions.some(s => s.finishedAt)) {
      const lastPh = ph.length ? Date.parse(ph[ph.length - 1].date) : Date.parse(db.profile.startedAt || db.createdAt);
      let due = new Date(lastPh + 30 * 86400000);
      if (due.getTime() < now) due = new Date(now + 86400000);
      list.push({ id: 5400, channelId: 'remind', title: '📸 Progress rasmi vaqti', body: 'Oyiga 1 marta: old, yon, orqa. Rasmlar faqat ilovada saqlanadi.', extra: { open: 'photos' }, schedule: { at: at(due, '09:00') } });
    }
    const hs = db.health;
    if (hs && hs.labs && hs.labs.length) {
      const last = Math.max(...hs.labs.map(l => Date.parse(l.date)));
      let due = new Date(last + 182 * 86400000);
      if (due.getTime() < now) due = new Date(now + 86400000);
      list.push({ id: 5600, channelId: 'remind', title: '🧪 6 oylik tahlil vaqti', body: 'Ertalab och qoringa; 2–3 kun oldin og‘ir mashg‘ulot qilmang. Tayyorgarlik ro‘yxati — ilovada.', extra: { open: 'health' }, schedule: { at: at(due, '08:00') } });
    }
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.warn('reschedule', e); }
}

export function onTap(fn) {
  const LN = P('LocalNotifications');
  if (LN) LN.addListener('localNotificationActionPerformed', ev => fn((ev.notification.extra || {}).open));
}
