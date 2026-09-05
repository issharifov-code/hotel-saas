# Zaxira va tiklash qo'llanmasi

> Bu hujjat falokat kunida o'qiladi. Shuning uchun u qisqa, aniq va
> "nima qilaman?" degan savolga to'g'ridan-to'g'ri javob beradi.
> Oxirgi yangilanish: 2026-09-05.

## Bir qarashda

| Savol | Javob |
|---|---|
| Zaxira qayerda? | GitHub Actions artefaktlari — repozitoriy → **Actions** → "Bazaning kunlik zaxirasi" → kerakli ish → **Artifacts** |
| Qanchalik eski? | Har kuni 02:00 UTC (Toshkent 07:00). **30 kun** saqlanadi |
| Render'ning o'z tiklashi? | Point-in-Time Recovery, **atigi 3 kun** (Hobby tarifi) |
| Shifrlanganmi? | Ha, AES256. Parol — `BACKUP_PASSPHRASE` siri |
| Tiklash sinalganmi? | **Ha, har kuni.** Har bir zaxira o'sha ishning o'zida bo'sh bazaga tiklab tekshiriladi |
| Qancha vaqt oladi? | Hozirgi hajmda ~1-2 daqiqa |

---

## 1. Birinchi marta sozlash (bir marta bajariladi)

Zaxira ishi ikkita sirsiz ishlamaydi. Repozitoriy →
**Settings → Secrets and variables → Actions → New repository secret**:

### `DATABASE_URL`
Render → `hotel-saas-db` → **Connect** → **External Database URL**
(Internal EMAS — GitHub Render tarmog'idan tashqarida turadi).

### `BACKUP_PASSPHRASE`
O'zingiz o'ylab topgan uzun parol (kamida 20 belgi).

> 🔴 **Bu parolni yo'qotsangiz, zaxiralarni ochib bo'lmaydi.**
> Uni parol menejeringizda alohida yozuv sifatida saqlang. Zaxira bilan
> bir joyda saqlamang — aks holda shifrlashning ma'nosi qolmaydi.

### Tarmoq ruxsati
Render → `hotel-saas-db` → **Info** → **Inbound IP Rules**. GitHub
runner'lari aylanib turadigan IP'lardan keladi, shuning uchun
`0.0.0.0/0` kerak bo'ladi. Ulanish TLS bilan va baza paroli bilan
himoyalangan.

### Tekshirish
Actions → "Bazaning kunlik zaxirasi" → **Run workflow**. Ish yashil
bo'lsa va Artifacts bo'limida fayl paydo bo'lsa — sozlash tugadi.

---

## 2. Falokat holatida tiklash

### 2.1. Avval to'xtang va aniqlang

Nima bo'ldi?

* **Baza ishlamayapti, lekin ma'lumot joyida** (Render uzilishi) —
  tiklash KERAK EMAS. Render statusini kuting.
* **Ma'lumot o'chib ketgan yoki buzilgan** (noto'g'ri migratsiya,
  tasodifiy `DELETE`) — tiklash kerak.
* **Render hisobi to'xtatilgan** — avval to'lovni hal qiling; baza
  qaytishi mumkin. Qaytmasa — yangi baza yaratib, quyidagicha tiklang.

> Eng muhim qoida: **ishlab turgan baza ustiga shoshib tiklamang.**
> Avval nusxa oling (hozirgi holatning o'zi ham dalil bo'lishi mumkin),
> keyin tiklang.

### 2.2. Zaxirani olish

1. GitHub → **Actions** → "Bazaning kunlik zaxirasi"
2. Kerakli sanadagi **muvaffaqiyatli (yashil)** ishni oching
3. **Artifacts** → `db-backup-...` ni yuklab oling
4. ZIP ichida `folioone-<sana>.dump.gpg` fayli bo'ladi

### 2.3. Kompyuteringizda tayyorgarlik

PostgreSQL 18 mijozi kerak (Render'da server 18):

```bash
# macOS
brew install postgresql@18

# Ubuntu/Debian
sudo apt-get install -y postgresql-client-18
```

> **Ubuntu/Debian'dagi tuzoq.** Paket o'rnatilgani yetarli emas:
> `/usr/bin/pg_dump` — haqiqiy dastur emas, `pg_wrapper` degan
> vositachi, va bir nechta versiya bo'lsa u **eskisini** tanlaydi.
> Tekshirish: `pg_dump --version` 18 dan kichik chiqsa, muammo shu.
> Skriptlar buni o'zi hal qiladi (`/usr/lib/postgresql/<eng-yangi>/bin`
> ni PATH boshiga qo'yadi), lekin qo'lda buyruq berayotgan bo'lsangiz
> to'liq yo'lni yozing: `/usr/lib/postgresql/18/bin/pg_restore`.

Repozitoriyni klonlang (skriptlar shu yerda):

```bash
git clone https://github.com/issharifov-code/hotel-saas.git
cd hotel-saas
```

### 2.4. Tiklash

**Har doim avval BO'SH bazaga tiklang va tekshiring.** Skript bo'sh
bo'lmagan bazaga tiklashni ataylab rad etadi.

```bash
export BACKUP_PASSPHRASE='<parol menejeringizdagi qiymat>'
export TARGET_URL='postgresql://user:parol@host:5432/yangi_baza'

bash ./scripts/db-restore.sh folioone-20260905T020000Z.dump.gpg
```

Skript o'zi tekshiradi va quyidagilarni chiqaradi:

```
    tiklangan jadvallar: 56 ta
    sxema versiyasi: 1789800000000
    --- asosiy jadvallar ---
    tenants      13
    users        13
    properties   12
    bookings     49
    guests       44
    RLS siyosatlari: 54 ta
==> Tiklash muvaffaqiyatli.
```

**Nimaga qarash kerak:**

* `RLS siyosatlari` noldan katta bo'lishi SHART — ularsiz tenantlar
  bir-birining ma'lumotini ko'radi. Skript nol bo'lsa yiqiladi.
* `sxema versiyasi` — `https://usali.uz/api/version` dagi
  `schemaVersion` bilan solishtiring. Zaxiradagisi kichikroq bo'lsa,
  tiklashdan keyin migratsiyalarni ishlatish kerak.
* Jadvallardagi qatorlar soni oqilonami.

### 2.5. Ilovani yangi bazaga ulash

1. Render → `hotel-saas-api` → **Environment** → `DB_*` o'zgaruvchilarni
   yangi bazaga yo'naltiring.
2. `hotel_saas_app` roli yangi bazada bo'lishi kerak. Migratsiyalar uni
   yaratadi; qo'lda tekshirish:
   ```sql
   SELECT rolname FROM pg_roles WHERE rolname = 'hotel_saas_app';
   ```
3. Deploy qiling. `preDeployCommand` migratsiyalarni ishlatadi.
4. `https://usali.uz/api/version` — `schemaVersion` kutilgan qiymatmi?
5. Tizimga kirib, bir nechta bronni ko'zdan kechiring.

> **RLS roli haqida ogohlantirish.** Ilova jadval EGASI BO'LMAGAN rol
> bilan ulanishi shart — PostgreSQL egaga RLS qo'llamaydi. `main.ts`
> ishga tushishda buni tekshiradi va noto'g'ri bo'lsa ilova
> KO'TARILMAYDI. Bu ataylab: jimgina izolyatsiyasiz ishlagandan ko'ra
> shovqinli to'xtagan yaxshi.

---

## 3. Zaxira dizayni haqida (nima uchun shunday)

**Nega GitHub, Render emas.** Zaxiraning butun ma'nosi — nusxa asosiy
tizimdan tashqarida turishi. Render'ning o'z cron ishi ham, 3 kunlik
tiklash oynasi ham bitta hisobga bog'liq: hisob to'xtatilsa yoki
o'chirilsa, baza bilan birga zaxira ham ketadi.

**Nega har bir zaxira tiklab tekshiriladi.** "Sinalmagan zaxira —
zaxira emas" degan qoida odatda bir martalik qo'lda mashqqa aylanadi va
keyin unutiladi. Shuning uchun tekshiruv ishning o'ziga kiritilgan:
zaxira olinadi va darhol bo'sh PostgreSQL 18'ga tiklanadi, jadvallar,
sxema versiyasi va RLS siyosatlari solishtiriladi. Zaxira tiklanmasa —
ish qizil bo'ladi va buni **o'sha kuni** bilasiz, falokat kunida emas.

**Nega shifrlanadi.** Zaxirada mehmonlarning ismi, telefoni va hujjat
ma'lumoti bor. U GitHub artefaktida yotadi — repozitoriyga kirish
huquqi bo'lgan har kim uni yuklab olishi mumkin. Shifr esa parolni
bilmasdan foydasiz qiladi.

**Nega `--format=custom`.** `pg_restore` bilan tanlab tiklash (masalan
faqat bitta jadval) va parallel tiklash imkonini beradi; o'zi siqilgan.

**Nega `--no-owner`/`--no-privileges`.** Tiklanadigan muhitda rol
nomlari boshqacha bo'lishi mumkin va bu tiklashni to'xtatib qo'ymasligi
kerak. RLS siyosatlari dump ichida qoladi (yuqorida tekshiriladi),
huquqlar esa migratsiyalar orqali qayta beriladi.

---

## 4. Nima sinalgan

2026-09-05 da haqiqiy PostgreSQL bilan tekshirilgan:

| Holat | Kutilgan | Natija |
|---|---|---|
| To'liq sikl: zaxira → shifrlash → shifrni ochish → tiklash | 56 jadval, 54 RLS siyosati tiklanadi | ✓ |
| Bo'sh bo'lmagan bazaga tiklash | Rad etiladi | ✓ |
| Noto'g'ri parol | Rad etiladi | ✓ |
| Bo'sh bazadan zaxira olish | Rad etiladi (jimgina bo'sh zaxira bo'lmasin) | ✓ |
| Buzilgan zaxira fayli | Tiklashda aniqlanadi | ✓ |
| RLS siyosatlarisiz zaxira | Rad etiladi | ✓ |

---

## 5. Hali qilinmagan (ochiq savollar)

* ~~**Ogohlantirish.**~~ ✅ 2026-09-05 da yopildi: zaxira ishi yiqilsa
  Telegram'ga darhol xabar ketadi. Sozlash — `docs/ogohlantirish.md`.
  (Sirlar berilmagan bo'lsa qadam jimgina o'tadi va zaxirani to'smaydi.)
* **Uzoq muddatli arxiv.** 30 kundan eski zaxira qolmaydi. Oylik
  arxiv kerak bo'lsa, alohida saqlagich (masalan S3-mos xizmat) kerak.
* **Fayl yuklamalari.** Mehmonxona logotipi bazada `data:` URL sifatida
  saqlanadi, ya'ni zaxiraga kiradi. Kelajakda fayllar alohida
  saqlagichga o'tsa, ular uchun ham zaxira kerak bo'ladi.
