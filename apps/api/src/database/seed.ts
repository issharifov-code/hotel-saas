import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { IsNull, Not } from 'typeorm';
import { AppDataSource } from './data-source';
import { User, UserStatus } from '../modules/users/entities/user.entity';
import { Permission } from '../modules/roles/entities/permission.entity';
import { PermissionAction, PermissionModule } from '../common/enums/permission.enum';
import {
  readPlatformAdminCredentials,
  planPlatformAdminUpdate,
  type PlatformAdminCredentials,
} from './platform-admin-credentials';

// (1) barcha Permission qatorlarini oldindan yaratadi,
// (2) platforma super-admin foydalanuvchisini muhit o'zgaruvchilaridan yaratadi.
// Ishlatish: pnpm seed
//
// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Critical). Ilgari bu fayl:
//
//     const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@sizningsaas.uz';
//     const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeMe123!';
//
// deb yozardi va natijani parol bilan birga log qilardi. Seed Render'da
// `buildCommand` ichida HAR DEPLOY'da ishlaydi, o'zgaruvchilar esa
// `sync: false` — ya'ni dashboard'da qo'lda kiritilmagan bo'lsa, repo'da
// turgan MA'LUM parol bilan `is_platform_admin = true` hisob yaratilgan
// bo'lardi. Seed idempotent bo'lgani uchun bunday hisob keyin ham
// o'chmasdi. Login subdomainsiz ishlaydi, ya'ni repo'ni ko'rgan har kim
// barcha tenantlarga kira olardi.
//
// Endi:
//   * standart qiymat YO'Q — o'zgaruvchi bo'lmasa production'da qattiq
//     yiqiladi (JWT_SECRET bilan bir xil naqsh, `main.ts`);
//   * parol HECH QACHON log qilinmaydi (build loglari uzoq saqlanadi va
//     dashboard kirgan har kimga ko'rinadi);
//   * eski `admin@sizningsaas.uz` hisobi o'chiriladi — lekin FAQAT
//     boshqa platforma admini mavjud bo'lsa (o'zini qulflab qo'ymaslik uchun).
const LEGACY_ADMIN_EMAIL = 'admin@sizningsaas.uz';

async function seedPermissions(): Promise<void> {
  const permissionRepo = AppDataSource.getRepository(Permission);
  const existing = await permissionRepo.find();
  const existingKeys = new Set(existing.map((p) => `${p.module}:${p.action}`));
  const toCreate: Permission[] = [];
  for (const module of Object.values(PermissionModule)) {
    for (const action of Object.values(PermissionAction)) {
      const key = `${module}:${action}`;
      if (!existingKeys.has(key)) {
        toCreate.push(permissionRepo.create({ module, action }));
      }
    }
  }
  if (toCreate.length > 0) {
    await permissionRepo.save(toCreate);
    console.log(`${toCreate.length} ta permission yaratildi.`);
  } else {
    console.log('Permissionlar allaqachon mavjud.');
  }
}

async function seedPlatformAdmin(
  credentials: PlatformAdminCredentials,
): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  const existingAdmin = await userRepo.findOneBy({
    tenantId: IsNull(),
    email: credentials.email,
  });

  // 🔴 2026-09-05, ishlab chiqarishda aniqlangan. Ilgari bu yerda
  // shunchaki `return` bor edi: hisob mavjud bo'lsa seed hech narsa
  // qilmasdan o'tib ketardi. Natijada `PLATFORM_ADMIN_PASSWORD` ni
  // Render'da almashtirish HECH QANDAY ta'sir qilmasdi — administrator
  // parolni rotatsiya qildim deb o'ylardi, aslida eski parol (aynan
  // build loglariga sizib chiqqani) ishlayverardi.
  //
  // Bu ayniqsa muhim, chunki platforma adminining parolini boshqa
  // yo'l bilan almashtirib bo'lmaydi: `PATCH /users/:id/reset-password`
  // tenant kontekstini talab qiladi, platforma adminida esa
  // `tenant_id IS NULL`.
  //
  // Shuning uchun qoida sodda: `PLATFORM_ADMIN_PASSWORD` — shu hisob
  // paroli uchun YAGONA HAQIQAT MANBAI. Har deploy'da baza shu qiymatga
  // moslashtiriladi.
  if (existingAdmin) {
    const plan = planPlatformAdminUpdate({
      passwordMatches: await bcrypt.compare(
        credentials.password,
        existingAdmin.passwordHash,
      ),
      isPlatformAdmin: existingAdmin.isPlatformAdmin,
      isActive: existingAdmin.status === UserStatus.ACTIVE,
    });

    if (!plan.needsWrite) {
      console.log(
        `Platforma super-admin allaqachon mavjud va mos: ${credentials.email}`,
      );
      return;
    }

    if (plan.rotatePassword) {
      existingAdmin.passwordHash = await bcrypt.hash(credentials.password, 12);
    }
    if (plan.bumpTokenVersion) {
      // Parol o'zgargani uchun eski sessiyalar ham uzilishi SHART —
      // aks holda rotatsiya o'z ma'nosini yo'qotadi (eski token 8 soat
      // ishlayverardi).
      existingAdmin.tokenVersion += 1;
    }
    existingAdmin.isPlatformAdmin = true;
    existingAdmin.status = UserStatus.ACTIVE;
    await userRepo.save(existingAdmin);

    console.log(
      `Platforma super-admin yangilandi: ${credentials.email}` +
        (plan.rotatePassword
          ? " (parol va sessiyalar yangilandi)"
          : ' (huquqlar)'),
    );
    return;
  }

  const passwordHash = await bcrypt.hash(credentials.password, 12);
  await userRepo.save(
    userRepo.create({
      tenantId: null,
      email: credentials.email,
      passwordHash,
      fullName: 'Platform Super Admin',
      status: UserStatus.ACTIVE,
      isPlatformAdmin: true,
      tokenVersion: 0,
    }),
  );
  // Parol ATAYLAB chop etilmaydi — yuqoridagi izohga qarang.
  console.log(`Platforma super-admin yaratildi: ${credentials.email}`);
}

// Eski standart hisobni olib tashlaydi. Himoya: o'zidan boshqa platforma
// admini qolmasa, O'CHIRMAYDI — aks holda bitta noto'g'ri deploy platforma
// paneliga kirishni butunlay yo'qotardi.
async function removeLegacyAdmin(): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  const legacy = await userRepo.findOneBy({
    tenantId: IsNull(),
    email: LEGACY_ADMIN_EMAIL,
    isPlatformAdmin: true,
  });
  if (!legacy) return;

  const otherAdmins = await userRepo.count({
    where: {
      tenantId: IsNull(),
      isPlatformAdmin: true,
      status: UserStatus.ACTIVE,
      id: Not(legacy.id),
    },
  });

  if (otherAdmins === 0) {
    console.warn(
      `DIQQAT: ${LEGACY_ADMIN_EMAIL} o'chirilmadi — u yagona faol platforma admini. ` +
        "PLATFORM_ADMIN_EMAIL ni o'rnating, keyingi deploy'da o'chiriladi.",
    );
    return;
  }

  await userRepo.remove(legacy);
  console.log(
    `Eski standart platforma admini o'chirildi: ${LEGACY_ADMIN_EMAIL} ` +
      `(${otherAdmins} ta boshqa admin qoldi).`,
  );
}

async function run() {
  // Kredensiallar bazaga tegishdan OLDIN tekshiriladi: noto'g'ri sozlangan
  // deploy hech narsa o'zgartirmasdan yiqilsin.
  const credentials = readPlatformAdminCredentials();
  if (!credentials) {
    console.log(
      "PLATFORM_ADMIN_* o'rnatilmagan — platforma admini yaratilmadi (dev muhiti).",
    );
  }

  await AppDataSource.initialize();
  try {
    await seedPermissions();
    if (credentials) {
      await seedPlatformAdmin(credentials);
      await removeLegacyAdmin();
    }
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((err) => {
  console.error('Seed xatolik bilan tugadi:', err);
  process.exit(1);
});
