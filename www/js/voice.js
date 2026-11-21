// 🔊 Voice coach: short spoken cues in the headphones (rest over, next set, warm-up done, workout done).
// Android TTS has no Uzbek voice, so the coach speaks Russian or English (user's choice).
// Speaks only while the app is open; when the phone is locked the notification + watch vibration take over.
import * as S from './store.js';
import * as D from './data.js';

const P = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) || null;
export const LANGS = [['ru-RU', 'Ruscha'], ['en-US', 'Inglizcha']];
export const on = () => !!S.db().profile.voiceOn;
const lang = () => S.db().profile.voiceLang || 'ru-RU';

const RU_NUM = n => String(n);
function kg(w, l) {
  const v = Math.round(w * 10) / 10;
  if (l === 'en-US') return `${v} kilos`;
  const i = Math.floor(v), rest = Math.round((v - i) * 10);
  return rest ? `${i} и ${rest} десятых килограмма` : `${RU_NUM(i)} ${i % 10 === 1 && i % 100 !== 11 ? 'килограмм' : 'килограмм'}`;
}
const T = {
  'ru-RU': {
    restOver: (n, m) => `Отдых окончен. Подход ${n} из ${m}.`,
    load: (w, r, unit) => (unit === 'sec' ? `${r} секунд.` : unit === 'min' ? `${r} минут.` : w ? `${kg(w, 'ru-RU')}, ${r} повторений.` : `${r} повторений.`),
    tenLeft: 'Десять секунд.',
    warmupDone: 'Разминка окончена. Начинаем.',
    next: n => `Следующее упражнение: ${n}.`,
    done: 'Тренировка завершена. Отличная работа!',
    test: 'Голосовой тренер включён.',
  },
  'en-US': {
    restOver: (n, m) => `Rest is over. Set ${n} of ${m}.`,
    load: (w, r, unit) => (unit === 'sec' ? `${r} seconds.` : unit === 'min' ? `${r} minutes.` : w ? `${kg(w, 'en-US')}, ${r} reps.` : `${r} reps.`),
    tenLeft: 'Ten seconds.',
    warmupDone: 'Warm-up done. Let’s go.',
    next: n => `Next exercise: ${n}.`,
    done: 'Workout complete. Great job!',
    test: 'Voice coach is on.',
  },
};
export const t = () => T[lang()] || T['ru-RU'];

let duckFn = null;
export const setDuck = fn => { duckFn = fn; };

export async function say(text, force = false) {
  if (!text || (!on() && !force)) return;
  try { duckFn && duckFn(4000); } catch (e) { /* */ }
  const TTS = P();
  try {
    if (TTS) { await TTS.speak({ text, lang: lang(), rate: 1.0, pitch: 1.0, volume: 1.0, queueStrategy: 0 }); return; }
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text); u.lang = lang(); window.speechSynthesis.speak(u);
    }
  } catch (e) { console.warn('tts', e); }
}

export async function supported() {
  const TTS = P();
  if (!TTS) return !!window.speechSynthesis;
  try { const r = await TTS.isLanguageSupported({ lang: lang() }); return !!r.supported; } catch (e) { return true; }
}
export async function openInstall() { const TTS = P(); if (TTS && TTS.openInstall) try { await TTS.openInstall(); } catch (e) { /* */ } }

// cue helpers used by the workout screen
export function restOver(item, setNo, w, r) {
  const ex = D.EX[item.key], tr = t();
  return say(`${tr.restOver(setNo, item.sets)} ${tr.load(ex.unit === 'reps' ? w : 0, r, ex.unit)}`);
}
export const nextExercise = item => say(lang() === 'en-US' ? t().next(D.EX[item.key].en) : 'Следующее упражнение.');
export const warmupDone = () => say(t().warmupDone);
export const tenLeft = () => say(t().tenLeft);
export const done = () => say(t().done);
