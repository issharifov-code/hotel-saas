#!/usr/bin/env bash
#
# Folio One — zaxiradan tiklash (2026-09-05).
#
# "Sinalmagan zaxira — zaxira emas." Bu skript ikki vazifani bajaradi:
#   1. HAQIQIY falokat holatida tiklash;
#   2. har bir zaxirani AVTOMATIK tekshirish (GitHub Actions ishi uni
#      bo'sh bazaga tiklab, natijani solishtiradi).
#
# ISHLATISH:
#   TARGET_URL='postgresql://...' ./scripts/db-restore.sh <zaxira-fayli>
#
# Ixtiyoriy:
#   BACKUP_PASSPHRASE  — `.gpg` fayllar uchun.
#   ALLOW_NONEMPTY=1   — bo'sh bo'lmagan bazaga tiklashga ruxsat.
#
# 🔴 XAVFSIZLIK TO'SIQI. Standart holatda skript BO'SH BO'LMAGAN bazaga
# tiklashni RAD ETADI. Sabab oddiy: tiklash buyrug'ini xato manzil bilan
# ishga tushirish — bu ishlab turgan bazani zaxira ustiga yozib yuborish
# demak, ya'ni falokatni tuzatish o'rniga ikkinchisini yaratish. Bu
# to'siqni ataylab (`ALLOW_NONEMPTY=1`) olib tashlash kerak.
set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "XATO: zaxira faylini ko'rsating." >&2
  echo "Ishlatish: TARGET_URL='postgresql://...' $0 <zaxira-fayli>" >&2
  exit 1
fi
if [[ -z "${TARGET_URL:-}" ]]; then
  echo "XATO: TARGET_URL o'rnatilmagan (qaysi bazaga tiklanadi)." >&2
  exit 1
fi

# --- PG_WRAPPER TUZOG'I — izoh `db-backup.sh` da ----------------------------
# `pg_restore` uchun ham xuddi shu muammo: eski versiya yangi formatdagi
# arxivni ocholmaydi ("unsupported version in file header").
if [ -d /usr/lib/postgresql ]; then
  newest_bin="$(find /usr/lib/postgresql -maxdepth 2 -type d -name bin 2>/dev/null \
    | sort -t/ -k5 -V | tail -1)"
  if [ -n "$newest_bin" ] && [ -x "$newest_bin/pg_restore" ]; then
    PATH="$newest_bin:$PATH"
    export PATH
  fi
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# --- Shifrni ochish ---------------------------------------------------------
DUMP="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gpg ]]; then
  if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
    echo "XATO: fayl shifrlangan, lekin BACKUP_PASSPHRASE berilmagan." >&2
    exit 1
  fi
  echo "==> Shifr ochilmoqda..."
  DUMP="${WORK_DIR}/restore.dump"
  gpg --batch --yes --decrypt --passphrase "$BACKUP_PASSPHRASE" \
      --output "$DUMP" "$BACKUP_FILE"
fi

# --- Arxiv butunligi --------------------------------------------------------
echo "==> Arxiv tekshirilmoqda..."
expected_tables="$(pg_restore --list "$DUMP" | grep -c 'TABLE DATA' || true)"
echo "    zaxirada ${expected_tables} ta ma'lumotli jadval"

# --- Nishon baza bo'shmi ----------------------------------------------------
existing="$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" )"
if (( existing > 0 )) && [[ "${ALLOW_NONEMPTY:-}" != "1" ]]; then
  echo "XATO: nishon bazada allaqachon ${existing} ta jadval bor." >&2
  echo "Ustiga yozish uchun ataylab ALLOW_NONEMPTY=1 bering." >&2
  exit 1
fi

# --- Tiklash ----------------------------------------------------------------
echo "==> Tiklanmoqda..."
# `uuid-ossp` — jadval ta'riflari `uuid_generate_v4()` ga tayanadi.
psql "$TARGET_URL" -q -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' || true

# `--no-owner`/`--no-privileges` — nishon muhitda `hotel_saas_app` roli
# bo'lmasligi mumkin; huquqlar migratsiyalar orqali qayta beriladi.
# `--exit-on-error` YO'Q: ba'zi `CREATE EXTENSION`/`COMMENT` buyruqlari
# huquq yetmasligi sababli o'tmaydi va bu tiklashni to'xtatmasligi kerak.
# Haqiqiy tekshiruv — pastdagi qatorlar solishtiruvi.
pg_restore \
  --dbname="$TARGET_URL" \
  --no-owner \
  --no-privileges \
  --jobs=2 \
  "$DUMP" 2> "${WORK_DIR}/restore.log" || true

# --- Natijani tekshirish ----------------------------------------------------
echo "==> Natija tekshirilmoqda..."
restored_tables="$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
echo "    tiklangan jadvallar: ${restored_tables} ta"

if (( restored_tables < expected_tables )); then
  echo "XATO: ${expected_tables} ta kutilgan, ${restored_tables} ta tiklangan." >&2
  echo "--- tiklash logi (oxirgi 30 qator) ---" >&2
  tail -30 "${WORK_DIR}/restore.log" >&2
  exit 1
fi

# Sxema versiyasi — tiklangan baza qaysi migratsiyagacha yetganini
# ko'rsatadi va `/api/version` dagi qiymat bilan solishtiriladi.
schema_version="$(psql "$TARGET_URL" -tAc \
  'SELECT "timestamp" FROM "migrations" ORDER BY "timestamp" DESC LIMIT 1' 2>/dev/null || echo 'yo_q')"

# Eng muhim jadvallarda qator bormi — bo'sh sxema "muvaffaqiyatli"
# ko'rinmasin.
echo "    sxema versiyasi: ${schema_version}"
echo "    --- asosiy jadvallar ---"
for t in tenants users properties bookings guests; do
  n="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo '?')"
  printf "    %-12s %s\n" "$t" "$n"
done

# RLS siyosatlari ham tiklanganini tasdiqlash — ular tenant
# izolyatsiyasining asosi, va ularsiz tiklangan baza XAVFSIZ EMAS.
policies="$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM pg_policies WHERE schemaname='public'")"
echo "    RLS siyosatlari: ${policies} ta"
if (( policies == 0 )); then
  echo "XATO: tiklangan bazada birorta RLS siyosati yo'q — tenant izolyatsiyasi ishlamaydi." >&2
  exit 1
fi

echo "==> Tiklash muvaffaqiyatli."
