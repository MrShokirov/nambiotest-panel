// Runs after `npx cap add android` (in GitHub Actions): permissions, icons, splash, version.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const res = path.join(root, 'android/app/src/main/res');
const manifest = path.join(root, 'android/app/src/main/AndroidManifest.xml');

// 1) permissions: exact timers (rest/warm-up), notifications, vibration, keep reminders after reboot
let m = fs.readFileSync(manifest, 'utf8');
const perms = ['android.permission.POST_NOTIFICATIONS', 'android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK', 'android.permission.RECEIVE_BOOT_COMPLETED'];
for (const p of perms) if (!m.includes(`"${p}"`)) m = m.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
fs.writeFileSync(manifest, m);

// 2) launcher icons (adaptive foreground + legacy), notification icon
const src = path.join(root, 'resources/android');
for (const dir of fs.readdirSync(src)) {
  const from = path.join(src, dir);
  if (!fs.statSync(from).isDirectory()) continue;
  const to = path.join(res, dir);
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
}
const bgXml = path.join(res, 'values/ic_launcher_background.xml');
fs.writeFileSync(bgXml, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0C1522</color>\n</resources>\n');

// 3) splash images (dark, logo in the middle)
for (const dir of fs.readdirSync(res)) {
  const f = path.join(res, dir, 'splash.png');
  if (fs.existsSync(f)) fs.copyFileSync(path.join(src, dir.includes('land') ? 'splash_land.png' : 'splash_port.png'), f);
}

// 3b) Health Connect needs Android 8.0+ (API 26)
const vars = path.join(root, 'android/variables.gradle');
if (fs.existsSync(vars)) fs.writeFileSync(vars, fs.readFileSync(vars, 'utf8').replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26'));

// 4) version: versionCode must grow so updates install over the old app (data is kept)
const gradle = path.join(root, 'android/app/build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
const ver = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
g = g.replace(/versionCode\s+\d+/, `versionCode ${run}`).replace(/versionName\s+"[^"]*"/, `versionName "${ver}.${run}"`);
if (!g.includes('checkReleaseBuilds')) g += '\nandroid {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n}\n';
fs.writeFileSync(gradle, g);
console.log('patched: permissions, icons, splash, version', ver + '.' + run);
