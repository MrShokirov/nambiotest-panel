# Sokhibjon GYM APP — o‘rnatish yo‘riqnomasi

Offline shaxsiy murabbiy ilova (Android). APK'ni GitHub o‘zi yig‘adi — kompyuteringizga hech narsa o‘rnatish shart emas.

## 1. GitHub'da yangi repozitoriy (1 marta)
1. github.com → yuqori o‘ngda **+** → **New repository**.
2. Name: `gymapp` · **Private** ni tanlang · **Create repository**.

## 2. Fayllarni yuklash
1. Finder'da **Documents → gymapp** papkasini oching.
2. Yashirin fayllarni ko‘rsatish uchun **Cmd + Shift + .** (nuqta) bosing — `.github` papkasi ko‘rinadi.
3. Repozitoriy sahifasida **uploading an existing file** havolasini bosing.
4. Finder'da **Cmd + A** → hammasini brauzerga sudrab tashlang → **Commit changes**.
5. Tekshiring: ro‘yxatda `.github` papkasi bo‘lishi kerak. Bo‘lmasa: **Add file → Create new file**, nomiga
   `.github/workflows/build-apk.yml` yozing, `Documents/gymapp/.github/workflows/build-apk.yml` faylining matnini nusxalab qo‘ying → **Commit changes**.

## 3. Imzo kalitini kiritish (1 marta, MAXFIY)
Repozitoriy → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Secret (qiymat) |
|---|---|
| `KEYSTORE_BASE64` | `Documents/gymapp_KALIT/KEYSTORE_BASE64.txt` ichidagi butun matn (TextEdit → Cmd+A → Cmd+C) |
| `KEYSTORE_PASSWORD` | `Documents/gymapp_KALIT/KEYSTORE_PASSWORD.txt` ichidagi matn |

Bu qiymatlarni hech kimga yubormang (chatga ham).

## 4. APK'ni yig‘ish
1. Repozitoriy → **Actions** → chapda **APK yig‘ish (Sokhibjon GYM)** → **Run workflow** → **Run workflow**.
2. 8–15 daqiqa kuting (yashil ✅ bo‘ladi). Qizil ❌ bo‘lsa — sahifa skrinshotini yuboring.
3. Repozitoriy bosh sahifasida o‘ngda **Releases** → eng yangisi → **SokhibjonGYM.apk**.

## 5. Telefonga o‘rnatish (Honor)
1. APK'ni yuklab oling: telefonda github.com'ga kirib (o‘sha akkaunt) Releases'dan, yoki Mac'da yuklab Telegram «Saqlangan xabarlar»ga yuboring.
2. Faylni oching → «Noma’lum manbalardan o‘rnatish»ga ruxsat bering → **O‘rnatish**.
3. Birinchi ochilishda: profil savollari → bildirishnomalarga **Ruxsat**.
4. **Sozlamalar → ⌚ Huawei Watch** bo‘limidagi 4 qadamni bajaring (Huawei Health bildirishnomalari, batareya «Cheklovsiz», «Soatni sinash»).

## Yangilash
Yangi kod yuklangach, GitHub avtomatik yangi APK chiqaradi. Uni eski ilova ustidan o‘rnating — ma’lumotlar saqlanadi (imzo bir xil).
Har haftada **Sozlamalar → 💾 Zaxira** bilan Google Drive'ga zaxira yuboring.

## Tuzilishi (dasturchi uchun)
- `www/` — ilova (HTML/CSS/JS, kutubxonasiz), `www/data/*.json` — 156 mashg‘ulot, 39 mashq (bot ma’lumotlaridan `tools/export_data.py` bilan).
- `www/js/engine.js` — mashg‘ulot holat mashinasi; `coach.js` — progressiya, tayyorlik indeksi, moslashtirish, kompensatsiya, 3/4 kunlik hafta va bonus mashg‘ulot, vazn trendi.
- `www/js/nutrition.js` — ovqatlanish; `report.js` + `report-pdf.js` — oylik PDF (jsPDF, `www/vendor`); `voice.js` — ovozli murabbiy; `hc.js` — Health Connect; `theme.js` — yorug‘/qorong‘i mavzu. Shriftlar: `www/fonts` (Inter, Newsreader — SIL OFL).
- `www/js/health-core.js` — TMI, qon bosimi, tahlillar (birliklar, oraliqlar, trend); `health.js` — Salomatlik sahifasi.
- `media-pack.zip` — rasmlar/GIF (free-exercise-db, public domain); CI'da ochiladi.
- Testlar: `node tests/logic.test.mjs`.
