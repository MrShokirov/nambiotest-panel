// Thin wrappers over Capacitor plugins with browser fallbacks (so the app also runs in a browser).
const cap = () => window.Capacitor;
const P = name => (cap() && cap().Plugins && cap().Plugins[name]) || null;
export const isNative = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());

const TIMER_ID = 4242;
let audioCtx = null;

export async function initNotifications() {
  const LN = P('LocalNotifications');
  if (!LN) return false;
  try {
    await LN.createChannel({ id: 'timer', name: 'Taymer', description: 'Dam olish va qizish taymeri',
                             importance: 5, visibility: 1, vibration: true });
    await LN.createChannel({ id: 'remind', name: 'Eslatmalar', description: 'Mashg‘ulot eslatmalari',
                             importance: 4, visibility: 1, vibration: true });
    const p = await LN.checkPermissions();
    if (p.display !== 'granted') await LN.requestPermissions();
    return true;
  } catch (e) { console.warn('notif init', e); return false; }
}
export async function exactAlarmStatus() {
  const LN = P('LocalNotifications');
  try { return LN && LN.checkExactNotificationSetting ? (await LN.checkExactNotificationSetting()).exact_alarm : 'granted'; }
  catch (e) { return 'unknown'; }
}
export async function openExactAlarmSettings() {
  const LN = P('LocalNotifications');
  try { if (LN && LN.changeExactNotificationSetting) await LN.changeExactNotificationSetting(); } catch (e) { /* */ }
}

// Fires at the end of a rest / warm-up timer — also when the phone is locked.
// Huawei Health mirrors this notification to the watch → the watch vibrates.
export async function scheduleTimer(atMs, title, body) {
  const LN = P('LocalNotifications');
  if (!LN) return;
  try {
    await LN.cancel({ notifications: [{ id: TIMER_ID }] });
    await LN.schedule({ notifications: [{ id: TIMER_ID, title, body, channelId: 'timer',
      schedule: { at: new Date(atMs), allowWhileIdle: true } }] });
  } catch (e) { console.warn('schedule', e); }
}
export async function cancelTimer() {
  const LN = P('LocalNotifications');
  if (!LN) return;
  try { await LN.cancel({ notifications: [{ id: TIMER_ID }] }); } catch (e) { /* */ }
}
export async function notifyNow(title, body) {
  const LN = P('LocalNotifications');
  if (LN) {
    try { await LN.schedule({ notifications: [{ id: 4343, title, body, channelId: 'timer', schedule: { at: new Date(Date.now() + 1500) } }] }); return true; }
    catch (e) { return false; }
  }
  if ('Notification' in window) {
    if (Notification.permission !== 'granted') await Notification.requestPermission();
    if (Notification.permission === 'granted') { new Notification(title, { body }); return true; }
  }
  return false;
}

export async function buzz(pattern = 'end') {
  const H = P('Haptics');
  try {
    if (H) {
      if (pattern === 'tap') return H.impact({ style: 'LIGHT' });
      await H.vibrate({ duration: 400 });
      setTimeout(() => H.vibrate({ duration: 400 }), 600);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(pattern === 'tap' ? 20 : [400, 200, 400]);
  } catch (e) { /* */ }
}
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    [0, 0.35, 0.7].forEach(dt => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.4, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.25);
      o.start(t0 + dt); o.stop(t0 + dt + 0.3);
    });
  } catch (e) { /* */ }
}
export async function keepAwake(on) {
  const K = P('KeepAwake');
  try { if (K) await (on ? K.keepAwake() : K.allowSleep()); } catch (e) { /* */ }
}

// Save a text file and open the share sheet (Google Drive, Telegram, …). Browser: download.
export async function shareFile(name, text, title = 'Zaxira') {
  const FS = P('Filesystem'), SH = P('Share');
  if (FS && SH) {
    const r = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await SH.share({ title, files: [r.uri], dialogTitle: 'Qayerga saqlaymiz?' });
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return true;
}
// Binary file (base64) → share sheet. Returns false in the browser (caller downloads instead).
export async function shareBinary(name, base64, mime = 'application/pdf', title = 'Fayl') {
  const FS = P('Filesystem'), SH = P('Share');
  if (!(FS && SH)) return false;
  const r = await FS.writeFile({ path: name, data: base64, directory: 'CACHE' });
  await SH.share({ title, files: [r.uri], dialogTitle: 'Qayerga yuboramiz?' });
  return true;
}
// Image (base64 PNG) + text in one share (Telegram uses the text as the photo caption).
export async function shareImage(name, base64, text, title = 'Ulashish') {
  const FS = P('Filesystem'), SH = P('Share');
  if (!(FS && SH)) return false;
  const r = await FS.writeFile({ path: name, data: base64, directory: 'CACHE' });
  await SH.share({ title, text, files: [r.uri], dialogTitle: 'Kimga yuboramiz?' });
  return true;
}
// Silent automatic copy inside the app's private storage (kept until the app is uninstalled).
export async function writePrivate(name, text) {
  const FS = P('Filesystem');
  if (!FS) return false;
  try {
    await FS.writeFile({ path: 'backups/' + name, data: text, directory: 'DATA', encoding: 'utf8', recursive: true });
    const list = await FS.readdir({ path: 'backups', directory: 'DATA' });
    const files = list.files.map(f => f.name || f).filter(n => n.endsWith('.json')).sort();
    for (const old of files.slice(0, -8)) await FS.deleteFile({ path: 'backups/' + old, directory: 'DATA' });
    return true;
  } catch (e) { console.warn('private backup', e); return false; }
}
export function openUrl(url) {
  const B = P('Browser');
  if (B) return B.open({ url });
  window.open(url, '_blank', 'noopener');
}
export function onAppResume(fn) {
  const A = P('App');
  if (A) A.addListener('appStateChange', s => { if (s.isActive) fn(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); });
}
export function onBackButton(fn) {
  const A = P('App');
  if (A) A.addListener('backButton', fn);
}
export function exitApp() { const A = P('App'); if (A) A.exitApp(); }
