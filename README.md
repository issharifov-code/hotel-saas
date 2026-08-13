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
- [x] Frontend: login, ro'yxatdan o'tish, dashboard (rollar/ruxsatlar ko'rinishi)
- [x] Bron / Xona boshqaruvi moduli: Room Type, Room (holat: available/occupied/
      maintenance/out_of_order), Guest (mehmon CRUD), Booking (yaratish, avtomatik
      narx hisoblash, sana to'qnashuvi tekshiruvi, check-in/check-out, cancel) —
      backend to'liq, frontend hali qo'shilmagan
- [x] Warehouse (Ombor) moduli: tovarlar katalogi, ta'minotchilar, xarid buyurtmasi
      (tasdiqlash workflow: pending_approval → approved/rejected, qisman/to'liq
      qabul qilish), FIFO baholash (StockLot/StockTransaction), chiqim va
      inventarizatsiya tuzatishlari, reorder point hisoboti — backend to'liq,
      frontend hali qo'shilmagan
- [x] POS (Restoran/Bar) moduli: menyu katalogi, savdo nuqtasi (auto-create),
      buyurtma (ochish → taom qo'shish → to'lash/bekor qilish), naqd/karta to'lovi
      (xona hisobiga yozish keyingi bosqichda) — backend to'liq, frontend hali
      qo'shilmagan
- [ ] Front Desk (kengaytirilgan), Housekeeping, Invoicing, Accounting (USALI COA)
- [ ] PostgreSQL Row-Level Security (hozircha tenant_id application-level filtrlanadi)
- [ ] Migration-based DB flow (hozircha `synchronize: true`, faqat dev uchun)

## Ishga tushirish (lokal)

### 1. Ma'lumotlar bazasi

Docker mavjud bo'lsa:

```bash
docker compose up -d postgres redis
```

Yoki lokal PostgreSQL 16 xizmatidan foydalaning — `apps/api/.env.example`dagi
ma'lumotlar bilan mos keladigan `hotel_saas` foydalanuvchisi va
`hotel_saas_dev` bazasini yarating.

### 2. Backend

```bash
cd apps/api
cp .env.example .env
pnpm install
pnpm start:dev          # http://localhost:3000/api
pnpm seed                # platforma super-admin yaratadi (bir marta)
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
| GET | `/api/admin/tenants` | (super-admin) Barcha tenant'lar |
| GET/POST | `/api/guests` | Mehmonlar ro'yxati / yaratish |
| GET/POST | `/api/properties/:propertyId/room-types` | Xona turlari |
| GET/POST | `/api/properties/:propertyId/rooms` | Xonalar |
| GET/POST | `/api/properties/:propertyId/bookings` | Bronlar ro'yxati (from/to filtrlar bilan) / yaratish |
| POST | `/api/properties/:propertyId/bookings/:id/check-in` | Mehmonni joylashtirish |
| POST | `/api/properties/:propertyId/bookings/:id/check-out` | Mehmonni chiqarish |
| POST | `/api/properties/:propertyId/bookings/:id/cancel` | Bronni bekor qilish |
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
| POST | `/api/properties/:propertyId/pos-orders/:id/pay` | To'lash (naqd/karta) |
| POST | `/api/properties/:propertyId/pos-orders/:id/cancel` | Buyurtmani bekor qilish |

## Texnik qarorlar

- **Backend**: NestJS + TypeORM 1.x + PostgreSQL. Prisma emas — bu muhitda
  Prisma binary engine yuklab olish tarmoq cheklovi tufayli ishlamadi.
- **Multi-tenancy**: hozircha application-level `tenant_id` filtrlash (har bir
  service metodi `tenantId`ni aniq talab qiladi). PostgreSQL RLS keyingi
  bosqichda qo'shiladi (texnik arxitektura hujjatidagi 3-bo'lim).
- **Auth**: JWT (`@nestjs/passport` + `passport-jwt`). Tenant xodimlari uchun
  login'da `subdomain` talab qilinadi (bir xil email turli tenant'larda
  bo'lishi mumkin).
