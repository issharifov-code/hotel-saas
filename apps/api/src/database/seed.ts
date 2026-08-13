import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { IsNull } from 'typeorm';
import { AppDataSource } from './data-source';
import { User, UserStatus } from '../modules/users/entities/user.entity';
import { Permission } from '../modules/roles/entities/permission.entity';
import { PermissionAction, PermissionModule } from '../common/enums/permission.enum';

// Dev/staging uchun: (1) barcha Permission qatorlarini oldindan yaratadi,
// (2) platforma super-admin foydalanuvchisini (agar mavjud bo'lmasa) yaratadi.
// Ishlatish: pnpm seed
async function run() {
  await AppDataSource.initialize();

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

  const userRepo = AppDataSource.getRepository(User);
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@sizningsaas.uz';
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeMe123!';

  const existingAdmin = await userRepo.findOneBy({ tenantId: IsNull(), email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await userRepo.save(
      userRepo.create({
        tenantId: null,
        email: adminEmail,
        passwordHash,
        fullName: 'Platform Super Admin',
        status: UserStatus.ACTIVE,
        isPlatformAdmin: true,
      }),
    );
    console.log(`Platforma super-admin yaratildi: ${adminEmail} / ${adminPassword}`);
    console.log('MUHIM: production muhitida parolni darhol o\'zgartiring.');
  } else {
    console.log('Platforma super-admin allaqachon mavjud.');
  }

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error('Seed xatolik bilan tugadi:', err);
  process.exit(1);
});
