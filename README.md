# Hotel SaaS

Mehmonxonalarga xos, bulutli, multi-tenant ERP+PMS platformasi. To'liq texnik
arxitektura va yo'nalish uchun loyihaning Claude Project'idagi
`erp-tizimi-texnik-arxitektura.md` va yuborilgan `.docx` hujjatlarga qarang.

## Monorepo tuzilishi

```
apps/
  api/   — NestJS backend (TypeORM + PostgreSQL)
  web/   — React + Vite + TypeScript frontend
docker-compose.yml  — lokal Postgres + Redis
```

## Hozirgi holat (0/1-bosqich)

- [x] Monorepo skeleton (pnpm workspaces)
- [x] Auth: tenant ro'yxatdan o'tish (self-service onboarding), login (JWT)
- [x] Role Management: standart rollar (Egasi, Buxgalter, Front Desk, Housekeeping,
      Ombor mudiri, POS), custom rol yaratish, modul+amal darajasidagi ruxsatlar,
      property-scoped rol biriktirish
- [x] Tenant Management: platforma super-admin uchun asosiy API
- [x] Frontend: login, ro'yxatdan o'tish, dashboard (rollar/ruxsatlar ko'rinishi,
      ruxsatga qarab modul kartalari), umumiy `AppLayout` (sidebar navigatsiya)
- [x] Bron / Xona boshqaruvi moduli: Room Type, Room (holat: available/occupied/
      maintenance/out_of_order), Guest (mehmon CRUD), Booking (yaratish, avtomatik
      narx hisoblash, sana to'qnashuvi tekshiruvi, check-in/check-out, cancel) —
      backend to'liq. **Frontend qo'shildi:** "tape chart" uslubidagi bron
      kalendari (xonalar × 14 kunlik oyna, ko'p kunlik bronlar bitta yaxlit
      panel sifatida chiziladi, bo'sh katak bosilganda xona+sana oldindan
      to'ldirilgan holda bron yaratish oynasi ochiladi), mehmon qidiruv/tanlash
      (`GuestPicker` — debounce'langan qidiruv), Xonalar bo'limi (xona turlari +
      xonalar ro'yxati, holat belgilari), Mehmonlar bo'limi (qidiruv + yaratish)
- [x] Warehouse (Ombor) moduli: tovarlar katalogi, ta'minotchilar, xarid buyurtmasi
      (tasdiqlash workflow: pending_approval → approved/rejected, qisman/to'liq
      qabul qilish), FIFO baholash (StockLot/StockTransaction), chiqim va
      inventarizatsiya tuzatishlari, reorder point hisoboti — backend to'liq.
      **Frontend qo'shildi:** tabli interfeys (Zaxira / Tovarlar / Ta'minotchilar /
      Xarid buyurtmalari), zaxira jadvali (reorder point'dan past qoldiqlar
      belgilanadi), xarid buyurtmasi yaratish (ko'p bandli), tasdiqlash/rad
      etish/bekor qilish/qabul qilish (qisman qabul qo'llab-quvvatlanadi),
      tezkor chiqim va inventarizatsiya tuzatish oynasi
- [x] POS (Restoran/Bar) moduli: menyu katalogi, savdo nuqtasi (auto-create),
      buyurtma (ochish → taom qo'shish → to'lash/bekor qilish), naqd/karta/
      **xona hisobiga** (room account — Invoicing moduliga yoziladi) to'lovi —
      backend to'liq. **Frontend qo'shildi:** menyu katalogi boshqaruvi,
      buyurtmalar kartochkalar ko'rinishida (holat bo'yicha rangli belgi),
      buyurtma detali (taom qo'shish, to'lash — naqd/karta/xona hisobiga,
      bekor qilish)
- [x] Housekeeping (Tozalash) moduli: xonaning band-bandlik holatidan (RoomStatus)
      mustaqil tozalik holati (`HousekeepingStatus`: clean/dirty/in_progress/
      inspected). Check-out'dan keyin xona avtomatik "dirty" bo'ladi va tozalash
      vazifasi (`HousekeepingTask`) navbatga avtomatik qo'shiladi; xona
      "clean"/"inspected" bo'lmaguncha o'sha xonaga **check-in bloklanadi**
      (biznes qoida — tasdiqlangan). Vazifa oqimi: pending → in_progress →
      done → inspected (yoki cancelled), qo'lda vazifa yaratish ham mumkin.
      Frontend: Xonalar holati (rangli belgilar) va Vazifalar bo'limlari.
- [x] Invoicing (Hisob-faktura) moduli: har bir bron uchun mehmon "folio"si
      (`Invoice`) check-in paytida avtomatik ochiladi (xona narxi birinchi
      qator sifatida qo'shiladi). Turish davomida POS'dan "xona hisobiga"
      to'lovlari va xodim qo'lda qo'shgan qo'shimcha xarajatlar (minibar,
      xizmatlar) shu folio'ga yoziladi. Check-out paytida folio "issued"
      holatiga o'tib qat'iylashadi — **check-out to'lov holatidan mustaqil**
      (biznes qoida — tasdiqlangan): to'lanmagan qoldiq check-out'ni
      bloklamaydi, keyin alohida to'lov qabul qilinadi (naqd/karta/bank
      o'tkazmasi). To'liq to'langanda holat avtomatik "paid"ga o'tadi.
      Frontend: hisob-fakturalar ro'yxati (holat, jami/to'langan/qoldiq),
      detal oynasi (qatorlar, qo'shimcha xarajat qo'shish, to'lov qabul
      qilish, bekor qilish).
- [x] Front Desk (kengaytirilgan): mavjud bronni **xona almashtirish** yoki
      **sanani uzaytirish/qisqartirish** orqali tahrirlash (faqat "tasdiqlangan"
      yoki "joylashtirilgan" holatlarda mumkin). Narx farqi yangi xona/tunlar
      soni asosida avtomatik qayta hisoblanadi; agar mehmon hozir joylashgan
      bo'lsa (folio ochiq), farq hisob-fakturaga tuzatish qatori sifatida
      avtomatik yoziladi (biznes qoida — tasdiqlangan). Xona almashtirishda
      yangi xona "toza"/"tekshirilgan" bo'lishi shart (check-in bilan bir xil
      qoida); eski xona avtomatik "iflos" deb belgilanib tozalash navbatiga
      qo'shiladi. Xona/sana to'qnashuvi (band bo'lgan xona/sana) 409 xato
      bilan bloklanadi. Frontend: Bron kalendaridagi bron detali oynasida
      "Xona almashtirish" va "Sanani o'zgartirish" tugmalari.
- [x] Accounting (USALI COA): rasmiy **USALI 12th Revised Edition** (HFTP/STR/
      CoStar, 2024) nashriga to'liq mos hisoblar rejasi — har bir yangi tenant
      ro'yxatdan o'tganda **368 ta** standart hisob (`Account`) avtomatik "seed"
      qilinadi (Aktiv/Passiv/Kapital + 12 ta USALI departamenti: Rooms, Food &
      Beverage, Other Operated, Miscellaneous Income, Administrative & General,
      Information & Telecom Systems, Sales & Marketing, Property Operation &
      Maintenance, Energy/Water/Waste, Payroll-Related Expenses, Management
      Fees, Nonoperating Income & Expenses). Manba: rasmiy 12th Edition "Part I
      — Operating Statements" va "Part VI — Revenue and Expense Guide"
      jadvallari (Schedule 1,2,4,5,6,7,8,9,10,11,14). Qamrovdan ataylab
      soddalashtirilgan/chiqarilgan qismlar (operatsion modul yo'qligi yoki
      niche xususiyati sababli): Schedule 3 (Other Operated Departments —
      Golf/Spa/Parking) faqat bitta umumiy hisob bilan cheklangan; Schedule
      1-1 (Executive Lounge) va 12-13 (House Laundry, Staff Dining) kiritilmagan
      (allocation/net-recovery mexanizmiga asoslangan); Schedule 6 "System
      Expenses" (IT xarajatlarini departament bo'yicha taqsimlash)
      soddalashtirilgan; Compensation rol bo'yicha ajratilgan lekin
      Mgmt/Nonmgmt darajasiga bo'linmagan (payroll moduli yo'qligi sababli);
      Payroll-Related Expenses (Schedule 14) tafsiloti departamentlar bo'yicha
      TAKRORLANMAGAN — rasmiy manbaning o'zida ham bu alohida, property
      darajasidagi umumiy schedule sifatida beriladi. Ikki tomonlama yozuv
      (double-entry) — har bir `JournalEntry` bir nechta `JournalEntryLine`
      (debet YOKI kredit, ikkalasi emas) dan iborat, debet jami = kredit
      jami tekshiriladi. Yozuvlar **o'zgarmas** (immutable) — tuzatish faqat
      yangi teskari (reversing) yozuv orqali. **Avtomatik provodka**
      (auto-posting) mavjud modullardan: check-in/qo'shimcha xarajat/tuzatish
      → Debitorlik (Guest Ledger) / Daromad; to'lov → Kassa yoki Karta
      kliringi / Debitorlik; POS to'g'ridan-to'g'ri naqd/karta savdosi →
      Kassa yoki Karta kliringi / F&B daromadi (xona hisobiga yozilgan POS
      buyurtmalari Invoicing orqali allaqachon provodka qilingani uchun
      qo'shimcha yozilmaydi — ikki marta hisoblanmaslik uchun); Ombor: xarid
      buyurtmasi qabul qilinganda → Ombor zaxirasi / Kreditorlik qarz; chiqim
      → F&B tannarxi yoki umumiy xarajat (tovar kategoriyasiga qarab) /
      Ombor zaxirasi; manfiy inventarizatsiya tuzatishi → Ombor tanqisligi
      xarajati / Ombor zaxirasi. Hisob-faktura bekor qilinganda (agar hali
      to'lov qilinmagan bo'lsa) tegishli yozuvlar avtomatik teskari
      qaytariladi. Hisobotlar: Hisoblar rejasi ro'yxati, Jurnal yozuvlari
      (filtr bilan), Aylanma-saldo (Trial Balance), Daromadlar to'g'risida
      hisobot (Income Statement, departament bo'yicha). Ruxsatlar:
      `PermissionModule.ACCOUNTING` — Buxgalter (Accountant) rolida to'liq,
      Ombor menejerida faqat ko'rish huquqi.
      **Muhim texnik tuzatish (shu bosqichda topildi):** `StockService`va
      `PurchaseOrdersService`da avval `@InjectDataSource().transaction()`
      orqali YANGI, alohida DB ulanishi ochilar edi — bu ulanishda RLS
      tenant konteksti (`app.tenant_id`) o'rnatilmagani uchun yozuvlar RLS
      siyosati tomonidan bloklanardi (yoki xato tashlardi). Tuzatildi: bu
      metodlar endi so'rovning o'zining REQUEST-scoped (`RlsModule.forFeature`
      orqali in'ektsiya qilingan) repository'laridan foydalanadi — bularning
      barchasi allaqachon bitta so'rov-tranzaksiyasi ichida ishlaydi, shuning
      uchun qo'shimcha tranzaksiya ochish shart emas (aksincha xato edi). Xuddi
      shu naqsh `AccountingService.postJournalEntry()`da ham topilib
      tuzatildi.
- [x] PostgreSQL Row-Level Security (RLS): 23 ta operatsion/biznes jadval
      (properties, guests, room_types, rooms, bookings, warehouses,
      suppliers, stock_items, stock_lots, stock_transactions,
      purchase_orders, purchase_order_items, pos_outlets, menu_items,
      pos_orders, pos_order_items, housekeeping_tasks, invoices,
      invoice_lines, invoice_payments, accounts, journal_entries,
      journal_entry_lines) endi PostgreSQL darajasida
      `tenant_id` bo'yicha izolyatsiya qilingan — hatto ilova kodida xatolik
      bo'lsa ham (masalan `tenantId` filtri unutilsa), boshqa tenant
      ma'lumotlari ko'rinmaydi/yozilmaydi. `tenants`, `users`, `roles`,
      `user_roles`, `permissions` jadvallari QASDDAN chetlab o'tilgan —
      login/ro'yxatdan o'tish oqimlari tenant kontekstidan OLDIN shu
      jadvallarga kirishi kerak (masalan subdomain bo'yicha tenant qidirish).
      Amalga oshirish: ilova endi ega (owner) bo'lmagan alohida
      `hotel_saas_app` roli orqali ulanadi (`FORCE ROW LEVEL SECURITY`ga
      hojat yo'q); har bir HTTP so'rov boshida `RlsTransactionInterceptor`
      (`APP_INTERCEPTOR`) joriy foydalanuvchining `tenantId`sini PostgreSQL
      sessiyasiga (`SELECT set_config('app.tenant_id', ..., true)`) yozadi,
      shu orqali siyosatlar (`USING tenant_id = current_setting(...)::uuid`)
      ishlaydi. Migratsiya/seed skriptlari hamon jadval egasi (`hotel_saas`)
      orqali ishlaydi. Ro'yxatdan o'tish oqimi (`register-tenant`) hali
      autentifikatsiyasiz bo'lgani uchun standart property yozuvi alohida
      tranzaksiyada, tenant ID'ni qo'lda `set_config` qilib yaratiladi.
      To'liq tenant-o'zaro (cross-tenant) salbiy test HTTP darajasida
      o'tkazildi: boshqa tenant ma'lumotlarini ro'yxatlash, ID bo'yicha
      to'g'ridan-to'g'ri o'qish va yozishga urinish — barchasi bloklandi.
- [x] Migration-based DB flow: `synchronize` butunlay o'chirildi (dev'da ham) —
      sxema endi faqat `typeorm migration:generate`/`migration:run` orqali
      boshqariladi (`apps/api/src/database/data-source.ts` +
      `src/database/migrations/`). Hozirgi to'liq sxemani qamrab oluvchi
      `Baseline` migratsiyasi yaratildi va bo'sh bazada sinovdan o'tkazildi
      (barcha jadval/enum/FK to'g'ri yaratiladi). Mavjud (synchronize orqali
      qurilgan) dev bazasi uchun `Baseline` "allaqachon qo'llanilgan" deb
      qo'lda belgilandi — ma'lumotlar yo'qolmadi. Yangi sxema o'zgarishi kerak
      bo'lganda: entity'ni o'zgartirish → `pnpm migration:generate
      src/database/migrations/<Nomi>` → `pnpm migration:run`.

## Ishga tushirish (lokal)

### 1. Ma'lumotlar bazasi

Docker mavjud bo'lsa:

```bash
docker compose up -d postgres redis
```

Yoki lokal PostgreSQL 16 xizmatidan foydalaning — `apps/api/.env.example`dagi
ma'lumotlar bilan mos keladigan `hotel_saas` foydalanuvchisi va
`hotel_saas_dev` bazasini yarating. `hotel_saas` roliga `CREATEROLE`
huquqini bering (`ALTER ROLE hotel_saas CREATEROLE;`) — Row-Level Security
migratsiyasi ilova uchun alohida, kamroq huquqli `hotel_saas_app` rolini
o'zi yaratadi (parol `.env`dagi `DB_APP_PASSWORD` bilan mos bo'lishi kerak).

### 2. Backend

```bash
cd apps/api
cp .env.example .env
pnpm install
pnpm run build            # migratsiya fayllarini ham kompilyatsiya qiladi
pnpm migration:run         # sxemani yaratadi (bir marta, yangi migratsiyalar chiqqanda ham)
pnpm start:dev            # http://localhost:3000/api
pnpm seed                  # platforma super-admin yaratadi (bir marta)
```

### 3. Frontend

```bash
cd apps/web
pnpm install
pnpm dev                 # http://localhost:5173 (backend'ga proxy qiladi)
```

## Asosiy API endpointlar

| Method | Path | Tavsif |
|---|---|---|
| POST | `/api/auth/register-tenant` | Yangi mehmonxona + Owner foydalanuvchi yaratish |
| POST | `/api/auth/login` | Kirish (tenant xodimlari uchun `subdomain` kerak) |
| GET | `/api/auth/me` | Joriy foydalanuvchi |
| GET | `/api/roles` | Tenant rollari ro'yxati |
| POST | `/api/roles` | Custom rol yaratish |
| POST | `/api/user-roles` | Foydalanuvchiga rol biriktirish |
| GET | `/api/me/permissions` | Joriy foydalanuvchining barcha ruxsatlari |
| GET | `/api/properties` | Joriy tenant'ning mehmonxona property'lari ro'yxati |
| GET | `/api/admin/tenants` | (super-admin) Barcha tenant'lar |
| GET/POST | `/api/guests` | Mehmonlar ro'yxati / yaratish |
| GET/POST | `/api/properties/:propertyId/room-types` | Xona turlari |
| GET/POST | `/api/properties/:propertyId/rooms` | Xonalar |
| GET/POST | `/api/properties/:propertyId/bookings` | Bronlar ro'yxati (from/to filtrlar bilan) / yaratish |
| POST | `/api/properties/:propertyId/bookings/:id/check-in` | Mehmonni joylashtirish |
| POST | `/api/properties/:propertyId/bookings/:id/check-out` | Mehmonni chiqarish |
| POST | `/api/properties/:propertyId/bookings/:id/cancel` | Bronni bekor qilish |
| POST | `/api/properties/:propertyId/bookings/:id/change-room` | Xona almashtirish (Front Desk) |
| POST | `/api/properties/:propertyId/bookings/:id/update-dates` | Sanani uzaytirish/qisqartirish (Front Desk) |
| GET/POST | `/api/suppliers` | Ta'minotchilar |
| GET/POST | `/api/stock-items` | Ombor tovarlar katalogi |
| GET | `/api/properties/:propertyId/warehouses` | Omborlar ro'yxati (avtomatik yaratiladi) |
| GET | `/api/properties/:propertyId/warehouses/:warehouseId/stock-levels` | Joriy qoldiqlar (reorder point bilan) |
| GET | `/api/properties/:propertyId/warehouses/:warehouseId/transactions` | Ombor harakatlari audit-trail |
| POST | `/api/properties/:propertyId/warehouses/:warehouseId/issue` | Tovar chiqimi (FIFO) |
| POST | `/api/properties/:propertyId/warehouses/:warehouseId/adjust` | Inventarizatsiya tuzatishi |
| GET/POST | `/api/properties/:propertyId/purchase-orders` | Xarid buyurtmalari |
| POST | `/api/properties/:propertyId/purchase-orders/:id/approve` | PO tasdiqlash |
| POST | `/api/properties/:propertyId/purchase-orders/:id/reject` | PO rad etish |
| POST | `/api/properties/:propertyId/purchase-orders/:id/receive` | Tovarni qabul qilish (qisman/to'liq) |
| POST | `/api/properties/:propertyId/purchase-orders/:id/cancel` | PO bekor qilish |
| GET/POST | `/api/menu-items` | POS menyu katalogi |
| GET | `/api/properties/:propertyId/pos-outlets` | Savdo nuqtalari (avtomatik yaratiladi) |
| GET/POST | `/api/properties/:propertyId/pos-orders` | Buyurtmalar ro'yxati / yangi buyurtma ochish |
| POST | `/api/properties/:propertyId/pos-orders/:id/items` | Ochiq buyurtmaga taom qo'shish |
| POST | `/api/properties/:propertyId/pos-orders/:id/pay` | To'lash (naqd/karta/xona hisobiga) |
| POST | `/api/properties/:propertyId/pos-orders/:id/cancel` | Buyurtmani bekor qilish |
| GET | `/api/properties/:propertyId/housekeeping/rooms` | Xonalar va ularning tozalik holati |
| GET/POST | `/api/properties/:propertyId/housekeeping/tasks` | Tozalash vazifalari ro'yxati / yaratish |
| POST | `/api/properties/:propertyId/housekeeping/tasks/:id/start` | Tozalashni boshlash |
| POST | `/api/properties/:propertyId/housekeeping/tasks/:id/complete` | Tozalashni yakunlash |
| POST | `/api/properties/:propertyId/housekeeping/tasks/:id/inspect` | Tozalikni tekshirish (nazoratchi) |
| POST | `/api/properties/:propertyId/housekeeping/tasks/:id/cancel` | Vazifani bekor qilish |
| GET | `/api/properties/:propertyId/invoices` | Hisob-fakturalar ro'yxati (status filtri bilan) |
| GET | `/api/properties/:propertyId/invoices/:id` | Hisob-faktura detali (qatorlar + to'lovlar) |
| GET | `/api/properties/:propertyId/bookings/:bookingId/invoice` | Bron bo'yicha folio'ni topish |
| POST | `/api/properties/:propertyId/invoices/:id/lines` | Qo'shimcha xarajat qatori qo'shish |
| POST | `/api/properties/:propertyId/invoices/:id/payments` | To'lov qabul qilish (naqd/karta/bank o'tkazmasi) |
| POST | `/api/properties/:propertyId/invoices/:id/cancel` | Hisob-fakturani bekor qilish |
| GET | `/api/properties/:propertyId/accounting/accounts` | Hisoblar rejasi (Chart of Accounts) ro'yxati |
| GET | `/api/properties/:propertyId/accounting/journal-entries` | Jurnal yozuvlari ro'yxati (from/to/sourceModule filtri) |
| POST | `/api/properties/:propertyId/accounting/journal-entries` | Qo'lda jurnal yozuvi yaratish |
| GET | `/api/properties/:propertyId/accounting/trial-balance` | Aylanma-saldo hisoboti (asOfDate ixtiyoriy) |
| GET | `/api/properties/:propertyId/accounting/income-statement` | Daromadlar to'g'risida hisobot (from/to majburiy) |

## Texnik qarorlar

- **Backend**: NestJS + TypeORM 1.x + PostgreSQL. Prisma emas — bu muhitda
  Prisma binary engine yuklab olish tarmoq cheklovi tufayli ishlamadi.
- **Multi-tenancy**: application-level `tenant_id` filtrlash (har bir service
  metodi `tenantId`ni aniq talab qiladi) + PostgreSQL Row-Level Security
  ikkinchi qatlam sifatida (yuqoridagi roadmap bo'limiga qarang).
- **Production eslatma**: `DB_APP_PASSWORD` (RLS'siz ishlaydigan
  `hotel_saas_app` roli paroli) hozircha `.env`da oddiy matn — production'da
  bu sirni maxsus sir-menejer (masalan Vault, AWS Secrets Manager) orqali
  boshqarish kerak.
- **Auth**: JWT (`@nestjs/passport` + `passport-jwt`). Tenant xodimlari uchun
  login'da `subdomain` talab qilinadi (bir xil email turli tenant'larda
  bo'lishi mumkin).
