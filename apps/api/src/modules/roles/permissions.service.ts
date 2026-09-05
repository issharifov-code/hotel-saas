import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  /**
   * Barcha (module, action) juftliklarini idempotent tarzda bazaga
   * kiritadi va katalogni qaytaradi.
   *
   * 🔴 2026-09-05 — INTEGRATSION TESTDA TOPILGAN NUQSON.
   * Bu metod ishlashi uchun ilova roli `permissions` jadvaliga
   * `INSERT` huquqiga EGA BO'LISHI SHART. Bir muddat u yo'q edi:
   * `EnableRowLevelSecurityBilling` (1789600000000) migratsiyasi uni
   * eng kam huquq tamoyili bo'yicha olib tashlagan, lekin katalogni
   * to'ldiradigan boshqa hech narsa yo'q edi. Natijada bo'sh bazada
   * birinchi tenant ro'yxatdan o'ta olmasdi ("permission denied for
   * table permissions"), va enum'ga yangi qiymat qo'shilganda ham ayni
   * xato chiqardi. Huquq `GrantPermissionCatalogueInsert`
   * (1789900000000) bilan qaytarildi — FAQAT `INSERT`, ya'ni mavjud
   * ruxsatlarni o'zgartirib yoki o'chirib bo'lmaydi.
   *
   * Yozish `ON CONFLICT DO NOTHING` orqali: bir vaqtda ikkita tenant
   * ro'yxatdan o'tsa ikkalasi ham yozishga urinishi mumkin va
   * (module, action) noyoblik cheklovi ikkinchisini yiqitardi.
   */
  async ensureAllPermissionsExist(): Promise<Permission[]> {
    const existing = await this.permissionRepo.find();
    const existingKeys = new Set(existing.map((p) => `${p.module}:${p.action}`));

    const toCreate: { module: PermissionModule; action: PermissionAction }[] =
      [];
    for (const module of Object.values(PermissionModule)) {
      for (const action of Object.values(PermissionAction)) {
        if (!existingKeys.has(`${module}:${action}`)) {
          toCreate.push({ module, action });
        }
      }
    }

    if (toCreate.length > 0) {
      await this.permissionRepo
        .createQueryBuilder()
        .insert()
        .into(Permission)
        .values(toCreate)
        .orIgnore()
        .execute();
      return this.permissionRepo.find();
    }

    return existing;
  }

  async findByModuleAction(module: PermissionModule, action: PermissionAction): Promise<Permission | null> {
    return this.permissionRepo.findOneBy({ module, action });
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionRepo.find();
  }
}
