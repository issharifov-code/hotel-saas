#!/usr/bin/env bash
#
# Folio One — bazaning to'liq mantiqiy zaxirasi (2026-09-05).
#
# NIMA UCHUN BU KERAK. Render'ning o'z tiklash oynasi Hobby tarifida
# atigi 3 KUN, va bugungi holatda hech qachon eksport olinmagan
# (Recovery sahifasida "0 files"). Ya'ni mehmonxonalar ma'lumotining
# YAGONA nusxasi Render hisobida turibdi: hisob to'xtatilsa yoki baza
# buzilsa, qaytarib bo'lmaydi. Bu skript nusxani RENDER'DAN TASHQARIDA
# saqlash imkonini beradi.
#
# ISHLATISH:
#   DATABASE_URL='postgresql://...' ./scripts/db-backup.sh [chiqish-papkasi]
#
# Ixtiyoriy:
#   BACKUP_PASSPHRASE   — berilsa, zaxira AES256 bilan shifrlanadi.
#                         Zaxirada mehmonlarning ismi, telefoni va
#                         pasport ma'lumoti bor — u ochiq holda hech
#                         qayerda yotmasligi kerak.
#
# DIQQAT — PG VERSIYASI. Render'da PostgreSQL 18 ishlaydi. `pg_dump`
# serverdan ESKI bo'lsa ishlamaydi ("server version mismatch"), shuning
# uchun skript avval versiyani tekshiradi va aniq xato beradi.
set -euo pipefail

OUT_DIR="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="folioone-${STAMP}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "XATO: DATABASE_URL o'rnatilmagan." >&2
  echo "Render dashboard -> hotel-saas-db -> Connect -> External Database URL" >&2
  exit 1
fi

command -v pg_dump >/dev/null || { echo "XATO: pg_dump topilmadi." >&2; exit 1; }

# --- Versiya tekshiruvi -----------------------------------------------------
server_version="$(psql "$DATABASE_URL" -tAc 'SHOW server_version_num' 2>/dev/null || true)"
if [[ -z "$server_version" ]]; then
  echo "XATO: bazaga ulanib bo'lmadi. DATABASE_URL to'g'rimi?" >&2
  exit 1
fi
client_version="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
server_major=$(( server_version / 10000 ))
if (( client_version < server_major )); then
  echo "XATO: pg_dump ${client_version}, server esa PostgreSQL ${server_major}." >&2
  echo "pg_dump server bilan bir xil yoki yangiroq bo'lishi SHART." >&2
  echo "Ubuntu: PGDG repozitoriysidan postgresql-client-${server_major} o'rnating." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
DUMP="${OUT_DIR}/${BASENAME}.dump"

echo "==> Zaxira olinmoqda (PostgreSQL ${server_major})..."
# `--format=custom` — `pg_restore` bilan tanlab tiklash va parallel
# tiklash imkonini beradi; o'zi siqilgan (gzip shart emas).
# `--no-owner`/`--no-privileges` — tiklashda rol nomlari boshqacha
# bo'lishi mumkin (masalan sinov muhitida), ular tiklashni to'xtatib
# qo'ymasin. RLS SIYOSATLARI baribir dump ichida qoladi.
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$DUMP"

# --- Tekshiruv: zaxira bo'sh yoki nuqsonli bo'lmasin ------------------------
if [[ ! -s "$DUMP" ]]; then
  echo "XATO: zaxira fayli bo'sh." >&2
  exit 1
fi

# `pg_restore --list` faylni to'liq o'qiydi — buzilgan arxiv shu yerda
# aniqlanadi, tiklash paytida emas.
table_count="$(pg_restore --list "$DUMP" | grep -c 'TABLE DATA' || true)"
size_bytes="$(stat -c %s "$DUMP")"

echo "    fayl:     $DUMP"
echo "    o'lcham:  $(( size_bytes / 1024 )) KB"
echo "    jadval:   ${table_count} ta (ma'lumotli)"

# Bo'sh baza ham texnik jihatdan "muvaffaqiyatli" zaxira beradi —
# aynan shunday jimgina nosozlikni tutish uchun eng kam chegara.
MIN_TABLES="${MIN_EXPECTED_TABLES:-20}"
if (( table_count < MIN_TABLES )); then
  echo "XATO: zaxirada atigi ${table_count} ta jadval bor (kutilgani >= ${MIN_TABLES})." >&2
  echo "Bu bo'sh yoki noto'g'ri bazaga ulanganidan darak beradi." >&2
  exit 1
fi

# --- Shifrlash --------------------------------------------------------------
FINAL="$DUMP"
if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "==> Shifrlanmoqda (AES256)..."
  gpg --batch --yes --symmetric --cipher-algo AES256 \
      --passphrase "$BACKUP_PASSPHRASE" \
      --output "${DUMP}.gpg" "$DUMP"
  rm -f "$DUMP"
  FINAL="${DUMP}.gpg"
  echo "    fayl: $FINAL"
else
  echo "OGOHLANTIRISH: BACKUP_PASSPHRASE berilmagan — zaxira SHIFRLANMAGAN." >&2
  echo "Unda mehmonlarning ismi, telefoni va hujjat ma'lumoti bor." >&2
fi

echo "==> Tayyor: $FINAL"
echo "$FINAL"
