# Ogohlantirish (Telegram) qo'llanmasi

> Bu hujjat sozlash uchun. Sozlash ~10 daqiqa oladi va bir marta
> bajariladi. Oxirgi yangilanish: 2026-09-05.

## Nima uchun bu kerak edi

Xato jurnali (`error_events`) 2026-09-05 da qo'shilgan: har bir 5xx xato
bazaga yoziladi va admin sahifasida guruhlangan holda ko'rinadi.

Lekin uni **ko'rish uchun kimdir o'sha sahifani ochishi kerak edi**.
Ya'ni production'da bir endpoint yiqilsa, buni faqat mehmonxona
qo'ng'iroq qilganda bilardik. Kuzatuvning halqasi shu yerda uzilgan edi:
yozamiz, lekin hech kimga aytmaymiz.

Endi halqa yopiq: yangi xato → Telegram → telefon.

## Bir qarashda

| Savol | Javob |
|---|---|
| Nima haqda xabar keladi? | (1) production'da yangi 5xx xato, (2) kunlik zaxira yiqilishi, (3) `main` da testlar yiqilishi |
| Qanchalik tez? | Bir necha soniya |
| Sozlanmagan bo'lsa? | Hech narsa buzilmaydi — xizmat jimgina o'chiq turadi |
| Takroriy xato spam qiladimi? | Yo'q. Bir xil xato uchun **soatiga bitta** xabar, va umumiy chegara **soatiga 15 ta** |
| Mehmon ma'lumoti chiqadimi? | Yo'q — xabardagi barcha raqam va id'lar `<n>`/`<id>` ga almashtiriladi |
| Pul ketadimi? | Yo'q, Telegram bot API bepul |

---

## 1. Telegram botini ochish

Bot — bu sizga xabar yuboradigan "robot hisob". U sizning shaxsiy
hisobingizga tegmaydi.

1. Telegram'da **@BotFather** ni oching (rasmiy bot, ko'k tasdiq belgisi bilan).
2. `/newbot` deb yozing.
3. Bot uchun **nomi** so'raladi — masalan `Folio One Ogohlantirish`.
4. Keyin **username** so'raladi. U `bot` bilan tugashi shart va band
   bo'lmasligi kerak — masalan `folioone_alerts_bot`.
5. BotFather javobida uzun **token** beradi, shunday ko'rinishda:
   `1234567890:AAH...` (raqamlar, ikki nuqta, keyin harflar).

> 🔴 **Bu token — parol.** Uni bilgan har kim sizning botingiz nomidan
> xabar yubora oladi. Hech kimga bermang va hech qayerga (jumladan
> menga) yozmang. Uni to'g'ridan-to'g'ri Render'ga qo'yasiz.

## 2. Bot bilan suhbatni boshlash

**Bu qadam majburiy va uni o'tkazib yuborish eng ko'p uchraydigan xato.**
Telegram botga o'zi birinchi bo'lib xabar yozishga ruxsat bermaydi —
avval siz unga yozishingiz kerak.

1. Botingizni qidiruvda toping (`@folioone_alerts_bot` — o'zingiz
   tanlagan username).
2. Suhbatni oching va **Start** tugmasini bosing (yoki `/start` deb yozing).

## 3. `chat_id` ni topish

Bu — xabar qaysi suhbatga borishini bildiruvchi raqam.

1. Brauzerda quyidagi manzilni oching (`<TOKEN>` o'rniga o'z tokeningizni
   qo'ying):

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

2. Ochilgan matnda `"chat":{"id":123456789,` degan qismni toping. O'sha
   raqam — sizning `chat_id`ingiz.

> **Bo'sh natija (`{"ok":true,"result":[]}`) chiqsa** — 2-qadam
> bajarilmagan. Botga `/start` yozing va sahifani yangilang.

> **Guruhga yuborish.** Xabar shaxsiy emas, ish guruhiga tushishini
> istasangiz: botni guruhga qo'shing, guruhda biror xabar yozing va
> yuqoridagi manzilni yana oching. Guruh `chat_id`si **manfiy** bo'ladi
> (masalan `-1001234567890`) — minus belgisi ham kerak.

## 4. Render'ga qo'yish (ilova xatolari uchun)

Render → `hotel-saas-api` → **Environment** → **Add Environment Variable**:

| Nomi | Qiymati |
|---|---|
| `TELEGRAM_BOT_TOKEN` | 1-qadamdagi token |
| `TELEGRAM_CHAT_ID` | 3-qadamdagi raqam |

**Save changes** → Render ilovani qayta ishga tushiradi (~2-3 daqiqa).

> Ikkalasi ham bo'lishi shart. Faqat bittasi berilsa xizmat o'chiq
> qoladi va Render logida ogohlantirish chiqadi — bu ataylab, chunki
> yarim sozlangan holat eng aldamchisi.

## 5. GitHub'ga qo'yish (zaxira va CI uchun)

Repozitoriy → **Settings → Secrets and variables → Actions →
New repository secret**. O'sha ikki qiymatni **xuddi shu nomlar bilan**
qo'shing:

* `TELEGRAM_BOT_TOKEN`
* `TELEGRAM_CHAT_ID`

Buni qilmasangiz ham ish yiqilmaydi — workflow qadami sirlar yo'qligini
ko'rib jimgina o'tib ketadi.

## 6. Tekshirish

Sozlash to'g'ri bajarilganini bilishning yagona ishonchli yo'li —
**haqiqiy xabar yuborib ko'rish**. Ikkita mustaqil yo'l bor va
**ikkalasini ham** sinash kerak: biri Render'dagi o'zgaruvchilarni,
ikkinchisi GitHub Secrets'ni tekshiradi.

### 6.1. Ilova tomoni (Render o'zgaruvchilari)

1. `https://usali.uz/admin` → **Xatolar** bo'limi.
2. Yuqorida "Telegram ogohlantirishi yoqilgan" deb turishi kerak.
   Sariq "Ogohlantirish o'chiq" desa — nom xato yozilgan yoki
   qiymatda ortiqcha bo'shliq bor.
3. **Sinov xabari** tugmasini bosing.

### 6.2. GitHub tomoni (Secrets)

GitHub → **Actions** → **"Ogohlantirishni sinash"** → **Run workflow**.

Bu ish faqat qo'lda ishga tushadi va boshqa hech narsa qilmaydi —
o'sha `curl` buyrug'ini yuboradi, xolos.

> **Nega bu alohida ish bor.** Zaxira va CI ogohlantirishlari faqat
> nosozlik kunida ishlaydi, ya'ni o'sha yo'l hech qachon sinalmaydi.
> Sirlar noto'g'ri qo'yilganini aynan eng yomon kuni bilib olardik.
> Bu ish o'sha bo'shliqni yopadi va uni istalgan vaqtda qayta
> ishlatish mumkin (masalan tokenni almashtirgandan keyin).

> **Nega bu ish sirsiz QIZIL bo'ladi**, zaxira qadami esa jimgina
> o'tadi. Farq maqsadda: zaxirada ogohlantirish — qo'shimcha qatlam
> va u zaxiraning o'zini to'sib qo'ymasligi kerak; bu yerda esa
> sirlarning yo'qligi — aynan sinovning muvaffaqiyatsizligi.

**6.1 dagi xabar kelmasa:** Render → `hotel-saas-api` → **Logs**, va
`NotificationsService` qatorlarini qidiring. Eng ko'p uchraydigan ikki
sabab:

| Log xabari | Ma'nosi |
|---|---|
| `chat not found` | `chat_id` xato, yoki 2-qadam (botga `/start`) bajarilmagan |
| `bot was blocked by the user` | Botni bloklagansiz — suhbatni ochib blokdan chiqaring |

**6.2 dagi ish qizil bo'lsa** — log to'g'ridan-to'g'ri sababni yozadi:
sirlar topilmadi, yoki Telegram qaysi HTTP kodi bilan rad etgani.
(Log'da token yo'q: u faqat manzilda edi, javob tanasida emas.)

> 🔴 **Tokenni almashtirgan bo'lsangiz** — uni **ikkala joyda** ham
> yangilash kerak: Render Environment VA GitHub Secrets. Faqat
> bittasini yangilash eng aldamchi holat: admin sahifasidagi sinov
> ishlaydi, zaxira ogohlantirishi esa jimgina o'lik qoladi.

---

## Xabar qanday ko'rinadi

```
🔴 Yangi xato — Folio One

QueryFailedError
duplicate key value violates unique constraint "<...>"

POST /api/bookings/:id/check-in → 500
So'rov: a1b2c3d4

To'liq jurnal: https://usali.uz/admin
```

`So'rov` raqami — foydalanuvchi ekranida ko'ringan raqam bilan **bir
xil** (`So'rov raqami: a1b2c3d4`). Ya'ni mehmonxona qo'ng'iroq qilib
raqamni aytsa, siz aynan o'sha so'rovni topa olasiz.

---

## Nima uchun shunday qilingan

**Nega bir xil xato uchun soatiga bitta xabar.** Yiqilgan endpoint
daqiqasiga o'nlab so'rov oladi. Har biri uchun xabar yuborilsa, telefon
uzluksiz jiringlaydi va odam birinchi kuni bildirishnomani butunlay
o'chirib qo'yadi — ya'ni ogohlantirish **o'z-o'zini yo'q qiladi**. Bir
soat — "hali ham buzuq" degan xabar foydali bo'ladigan eng qisqa
oraliq.

**Nega umumiy chegara ham bor (soatiga 15 ta).** Baza uzilganda har bir
endpoint o'z xatosini beradi — ya'ni o'nlab **turli** guruh, va
yuqoridagi chegara ularni ushlab qololmaydi. Chegaraga yetganda oxirgi
bitta "ogohlantirish bostirildi" xabari yuboriladi: jimgina to'xtash
eng yomoni bo'lardi, chunki odam hammasi joyida deb o'ylardi.

**Nega xabar matni "normallashtirilgan".** Xato matnida mehmon
ma'lumoti bo'lishi mumkin — masalan PostgreSQL noyoblik xatosi qiymatni
o'z ichiga oladi (`Key (phone)=(+998...) already exists`). Telegram —
uchinchi tomon serveri, ya'ni bu ma'lumot tashqariga chiqadi. Shuning
uchun xabarga `fingerprint` uchun ishlatiladigan o'sha normallashtirish
qo'llanadi: barcha raqamlar `<n>` ga, id'lar `<id>` ga almashadi, matn
200 belgigacha kesiladi. Telefon, pasport raqami, narx va sana shu
bilan yo'qoladi. To'liq matn kerak bo'lsa — admin sahifasidagi xato
jurnali (u bazada, o'z RLS himoyasi ostida).

**Nega ogohlantirish `await` qilinmaydi.** U xato yo'lida chaqiriladi.
Telegram sekin javob bersa, foydalanuvchi xato javobini shuncha vaqt
kutib turardi. Shuning uchun xabar fon rejimida ketadi va uning
natijasi so'rovga ta'sir qilmaydi.

**Nega PR'lar uchun CI xabari yo'q.** Pull request'dagi qizil ish —
normal ish jarayoni. U haqda xabar shovqin bo'lardi va keyin haqiqiy
xabar ham e'tibordan qolardi. `main` dagi qizil ish esa boshqa gap:
Render o'sha kommitni allaqachon deploy qilyapti.

---

## Hali qilinmagan

* **Ilova butunlay yiqilsa xabar yo'q.** Ogohlantirishni ilovaning o'zi
  yuboradi — u ko'tarilmasa, xabar ham chiqmaydi. Buni yopish uchun
  tashqi tekshiruvchi kerak (masalan har 5 daqiqada `/api/version` ni
  so'raydigan alohida GitHub Actions ishi yoki uptime xizmati).
* **Kunlik xulosa yo'q.** Faqat yangi xato haqida xabar keladi; "bugun
  jami 40 ta xato bo'ldi" degan hisobot yo'q.
* **Xatoni "yopish" imkoni yo'q.** Bir xato bilan tanish bo'lsangiz ham
  u har soatda xabar beraveradi (agar takrorlanayotgan bo'lsa).
