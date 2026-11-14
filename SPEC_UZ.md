# Sokhibjon GYM APP — kelishilgan talablar (2026-10-20)

## Tamoyillar
- Offline birinchi o‘rinda; ma’lumot faqat telefonda; o‘zbek tili (mashq nomlari inglizcha qavsda); qorong‘i dizayn, katta tugmalar.
- Aqlli murabbiy har qarorini bir gap bilan tushuntiradi.

## Kelishilgan qarorlar
| Mavzu | Qaror |
|---|---|
| Set yozish | 1 bosish (tavsiya tayyor) + har setdan keyin 😌 Yengil / 💪 Me’yorida / 🥵 Og‘ir → keyingi set moslashadi |
| Dastur | Tayyor 12 oylik (156 mashg‘ulot) + mashqni doimiy almashtirish; konstruktor — keyinroq |
| Ovqat | Oqsil + suv tez hisob, taxminiy kaloriya, vazn trendiga qarab moslashuvchan maqsad, 4 kokteyl (v2) |
| Huawei GT 6 Pro | Taymer/eslatma soatda (bildirishnoma) — v1; qadamlar, puls, uyqu — Health Connect orqali (v3, kafolatsiz qism: puls/uyqu) |
| Video | Har mashqqa cheksiz o‘z videolari (kamera yoki galereya), belgi: Namuna / Mening texnikam / Boshqa |
| Himoya | Kirish himoyasi yo‘q (telefon qulfi yetadi) |
| Nomi | Sokhibjon GYM APP |
| Telegram bot | v3 tayyor bo‘lguncha zaxira sifatida ishlaydi, keyin tarix import qilinib o‘chiriladi |

## Bosqichlar
- **v1:** onboarding, Bugun, bosqichma-bosqich mashg‘ulot (qizish/dam olish taymerlari + bildirishnoma), algoritm (progressiya, Yengil/Og‘ir, plato, charchoq, tanaffus, og‘riq/texnika qoidasi), 12 oylik dastur + kalendar + doimiy almashtirish, mashqlar kutubxonasi + cheksiz video, tarix va rekordlar, zaxira eksport/import.
- **v2:** natijalar paneli (grafiklar, haftalik hajm), vazn/bel/o‘lchovlar, progress rasmlar, ovqat va kokteyllar.
- **v3:** Huawei qadam/puls/uyqu (Health Sync → Health Connect), moslashuvchan kaloriya, bot tarixini import.

## Yetkazish
- APK GitHub Actions'da avtomatik yig‘iladi va Release sifatida chiqadi; doimiy imzo kaliti (yangilashda ma’lumot saqlanadi).

## Qo‘shimcha kelishuvlar (2026-10-20, kechqurun)
- **Minimal kiritish:** standart rejim — mashq bo‘yicha (set tugadi tugmasi kiritishsiz, oxirida 1 baho); «✅ Bajardim» — butun mashg‘ulot 1 bosishda; batafsil rejim ixtiyoriy.
- **Grafiklar oddiy:** har grafik ustida bitta tushunarli gap, murakkab atamalarsiz.
- **Himoya bloki (prehab):** qizishdan keyin 2–4 yengil mashq (rotator manjet: teres minor/infraspinatus, kurak, dumba, adduktorlar, to‘piq, bilak); og‘riq joyiga moslashadi.
- **Zalimdagi jihozlar:** yo‘q jihozlar belgilanadi → mashqlar avtomatik muqobilga almashadi (dastur, kalendar, himoya bloki).
- **Vaqt:** «Bugun X daqiqam bor» → supersetlar va qisqartirish, asosiy mashqlar saqlanadi.
- **v1.1:** + texnikani video bilan solishtirish, progress rasmlari, disklar rasmi.
- **v1.2:** ovozli murabbiy, qulflangan ekranda taymer, oylik PDF, ovqat bo‘limi.
- **v1.3:** telefon vidjeti, Huawei qadam/puls/uyqu (Health Connect).

## Qo‘shimcha kelishuvlar (2026-10-20, kech)
- **Ertalabki tos tubi mashqi (ixtiyoriy):** 2–4 daqiqa yo‘naltirilgan taymer, avtomatik yoziladi, seriya va daraja.
- **Salomatlik:** TMI (JSST toifalari) + bel/bo‘y nisbati; qon bosimi; 6 oyda 1 marta tahlillar — umumiy xolesterin, LDL, HDL, triglitseridlar, glyukoza, HbA1c, testosteron, TSH, vitamin D, ferritin, gemoglobin, ALT, AST, kreatinin. Birlik almashtirish (mmol/L ↔ mg/dL va h.k.), ✅/🟡/🔴 holat, o‘zgarish trendi, 6 oylik eslatma, tayyorgarlik ro‘yxati. Tashxis emas — blankadagi me’yor va shifokor xulosasi ustun.
- **3 yoki 4 kun:** 4 kun tanlansa (3 kun ketma-ket emas) — haftaning dastlabki 3 mashg‘uloti asosiy (dastur oldinga siljiydi), 4-si **bonus**: kam ishlangan mushaklar (kechagidan teskari yo‘nalish), yelka, qo‘l, kor + 20 daqiqa zona-2 kardio. Bonus o‘tkazilsa — qarz yo‘q. Kalendar va eslatmalarda bonus kunlar alohida belgilanadi.

## v1.1 (2026-10-21)
- **Dizayn:** yorug‘ / qorong‘i / avto mavzu; Inter (matn) + Newsreader (sarlavha) shriftlari offline; har bo‘lim o‘z rangi; Apple uslubidagi faollik halqalari; silliq gradient grafiklar.
- **Ovqatlanish:** oqsil/kaloriya/suv halqalari, 16 ta tez qo‘shish (o‘zbek porsiyalari, taxminiy), 7 kunlik oqsil grafigi, maqsadni o‘zgartirish.
- **Oylik PDF hisobot:** kuch, haftalik mashg‘ulotlar, vazn/tana, uyqu/puls, ovqat, odatlar, salomatlik — ulashish orqali.
- **Ovozli murabbiy:** rus/ingliz tilida («Dam tugadi, 2-set…», 10 soniya ogohlantirish, qizish tugadi, mashg‘ulot tugadi).
- **Health Connect:** qadam, uyqu, tinch puls, vazn (Huawei → Health Sync → Health Connect); uyqu va tinch puls tayyorlik indeksiga qo‘shildi. Faqat o‘qish.
- **Kokteyllar (botdan ko‘chirildi):** 4 ta tiklovchi kokteyl, 0,5–2× porsiya, chizilgan retsept-karta (PNG), «Ulashish» — rasm + retsept birga (Telegram), «Ichdim» → oqsil hisobiga. Telegram bot endi kerak emas.
- **YouTube video dars:** mashq sahifasida ilova ichida o‘ynaydigan karta (rasmiy embed, internet kerak).
