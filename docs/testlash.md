# Testlash qo'llanmasi

> Bu hujjat qanday test yozish haqida. Uni 2026-09-05 kechasi
> o'tkazilgan mutatsion tekshiruv natijasida yozdik: 120 ta mutatsiya
> ishlatilganda 18 ta shart hech qanday test bilan qo'riqlanmagani
> aniqlandi — va ularning aksariyati "qoplangan" ko'rinardi.

## Bir qarashda

| Qatlam | Nima uchun | Nechta | Qayerda |
|---|---|---|---|
| API unit | Mantiq, chegaralar, qo'riqchilar | ~1090 | `apps/api/src/**/*.spec.ts` |
| API integratsion | Haqiqiy PostgreSQL: RLS, cheklovlar, poyga | 37 | `apps/api/test/integration/*.int-spec.ts` |
| Web | Ruxsatga qarab ko'rinish, token, chegaralar | 86 | `apps/web/src/**/*.test.{ts,tsx}` |

```bash
pnpm --filter api test          # unit
pnpm --filter api test:int      # integratsion (PostgreSQL kerak)
pnpm --filter web test          # web
```

---

## 🔴 Eng muhim qoida: xatoning TURI emas, MATNI

Bu tunda bir xil xato **to'rt marta** topildi, shuning uchun u birinchi
o'rinda turadi.

```ts
// ❌ YOMON — bu test qo'riqchini emas, "biror xato bo'ldi" ni tekshiradi
await expect(service.postJournalEntry(bitta_qator))
  .rejects.toThrow(BadRequestException);

// ✅ YAXSHI
await expect(service.postJournalEntry(bitta_qator))
  .rejects.toThrow(/kamida 2 qatordan/);
```

**Nima uchun.** Metodlarda odatda bir nechta qo'riqchi ketma-ket turadi
va ular bir xil turdagi xatoni tashlaydi. Yuqoridagi misolda "kamida 2
qator" sharti butunlay olib tashlansa ham, bitta qatorli yozuv pastdagi
**balans** tekshiruvidan o'ta olmaydi va o'sha turdagi xato baribir
tashlanadi — test yashil qolaveradi.

Haqiqiy misollar (hammasi shu tunda topilgan):

- `auth` — "bloklangan xodim kira olmaydi" sharti olib tashlansa,
  keyingi qator (`status !== ACTIVE`) uni ushlab, xuddi shu 401 ni
  qaytarardi. Ya'ni **xavfsizlik kafolati tekshirilmagan edi**.
- `accounting` — uchala validatsiya sharti (2 qator, manfiy summa,
  faqat debet YOKI kredit) balans tekshiruvi orqasida yashiringan edi.
- `stock.adjust` — nol miqdor sharti pastdagi `issue()` xatosi bilan
  niqoblangan edi.

---

## Mutatsion tekshiruv — testni test qiladigan usul

Yangi test yozgandan keyin **qo'riqlanayotgan shartni qo'lda buzing** va
testning yiqilishiga ishonch hosil qiling:

```ts
if (amount > balance + TOLERANCE) {   // asl
if (false) {                           // mutatsiya
```

Test yiqilmasa — u hech narsani qo'riqlamayapti. Bu ish har bir yangi
test uchun bir daqiqa oladi va aynan shu tunda 18 ta bo'sh joyni ochdi.

Butun kod bo'ylab avtomatik o'tkazish uchun `if (...) throw` naqshini
`if (false)` ga almashtiruvchi qisqa skript yetarli (har mutatsiyada
to'plamni qayta ishga tushirish ~50 soniya).

### Tirik qolgan mutatsiyani baholash

Har bir tirik mutatsiya nuqson emas. Uch xil sabab bo'ladi:

1. **Test kamchiligi** — qo'riqchi haqiqatan tekshirilmagan. Tuzatiladi.
2. **O'lik kod** — shart hech qachon bajarilmaydi (masalan
   `Pagination` dagi `Math.max(1, ...)`: undan yuqorida `return null`
   turibdi). Kod izohida qayd etiladi, test qo'shilmaydi.
3. **Yuzaga keltirib bo'lmaydigan shox** — masalan modul sozlanmagan
   holat (`if (!adapter)`). Qoldiriladi.

---

## "Yashil, lekin bo'sh" testning boshqa ko'rinishlari

### Bo'sh ro'yxat ustidan yurish

```ts
// ❌ `failed` bo'sh bo'lsa, sikl umuman ishlamaydi va test o'tadi
const failed = results.filter((r) => r.status >= 400);
for (const r of failed) expect(r.status).toBe(409);

// ✅ avval sonini talab qiling
expect(results.filter((r) => r.status === 201)).toHaveLength(1);
```

Haqiqiy misol: bir vaqtda 5 ta davomat yozuvi yuborilganda **hammasi
200** qaytardi (unikal indeks xato bermaydi — u so'rovlarni navbatga
soladi), ya'ni 409 ni tekshiradigan sikl hech qachon ishlamagan.

### Bajarilmagan sharoit

Payroll testida uchala so'rov ham 400 qaytdi ("maoshi belgilangan xodim
yo'q") — ya'ni payroll umuman yaratilmagan, lekin test "ikkinchisi
yaratilmadi" deb yashil bo'lgan. Sharoitni avval **tayyorlang**, keyin
tekshiring.

### `undefined ?? 0`

```ts
// API `balance` maydonini umuman qaytarmaydi — test hech narsani tekshirmaydi
expect(Number(body.balance ?? 0)).toBe(0);
```

---

## Qaysi qatlamda yozish kerak

**Unit** — mantiq, chegaralar, holat o'tishlari, qo'riqchilar. Repozitoriy
mock qilinadi. Eng arzon va eng tez.

**Integratsion (haqiqiy PostgreSQL)** — faqat baza haqiqatan
ishtirok etadigan narsalar:

- **RLS** — tenant izolyatsiyasi. Xizmat qatlami ham `tenant_id` bo'yicha
  filtrlaydi, shuning uchun HTTP testlari RLS o'chirilganini **sezmaydi**;
  buni faqat to'g'ridan-to'g'ri bazaga murojaat qiladigan test tutadi.
- **Cheklovlar** — unikal indekslar, `EXCLUDE` (bron kesishuvi),
  `CHECK`. Ular ilova yo'lida ko'pincha "otilmaydi" (navbat hosil
  qiladi), shuning uchun indeksning o'zini ikkita xom `INSERT` bilan
  alohida tekshirish kerak.
- **Poyga holatlari** — `Promise.all` bilan bir vaqtda kelgan so'rovlar.

**Web** — ruxsatga qarab nima ko'rinishi, token qayerda saqlanishi,
xato xabari. `jsdom` haqiqiy brauzer emas: CSS, joylashuv va
`window.location` u yerda yo'q (oxirgisini mock qilib, o'sha bilan
birga tekshirib ham olish mumkin).

---

## Muhitlar orasidagi farq — nuqsonni yashiradi

Bu saboq loyihada besh marta takrorlandi:

| Farq | Qanday ochildi |
|---|---|
| `pg_wrapper` lokal muhitda | Integratsion test CI'da yiqildi |
| `CREATEROLE` huquqi | Toza CI bazasida rol yaratib bo'lmadi |
| `INSERT ... RETURNING` + RLS | Faqat haqiqiy RLS ostida ko'rindi |
| jsdom 30 va Node 20 | Lokalda Node 22 — yashil, CI'da yiqildi |
| Bir tenantli sinov bazasi | Indeks foydasi faqat hajm bilan ko'rindi |

Xulosa: **lokalda yashil bo'lishi yetarli emas**. CI production'ga
yaqinroq (PostgreSQL 18, Node 20), va aynan shu farqlar nuqsonni ochadi.

---

## Testni qanday yozish (uslub)

Loyihadagi mavjud testlar naqshiga eriging:

- **Izoh nima uchun kerakligini aytadi**, nima qilayotganini emas.
  "🔴" belgisi — buzilsa oqibati og'ir bo'lgan joy.
- **Nomlar o'zbekcha va aniq**: `"bo'sh buyurtmani to'lab bo'lmaydi"`.
- **Oqibatni yozing**: "bronsiz xona hisobiga yozish — taom berilgan,
  lekin puli hech kimning folio'siga tushmagan".
- **Rad etilganda yon ta'sir yo'qligini ham tekshiring**:
  `expect(repo.save).not.toHaveBeenCalled()`.
