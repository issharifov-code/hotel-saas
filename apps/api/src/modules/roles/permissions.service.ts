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

  // Barcha (module, action) juftliklarini idempotent tarzda bazaga kiritadi.
  // Seed skripti va e2e testlar shu metoddan foydalanadi.
  async ensureAllPermissionsExist(): Promise<Permission[]> {
    const existing = await this.permissionRepo.find();
    const existingKeys = new Set(existing.map((p) => `${p.module}:${p.action}`));

    const toCreate: Permission[] = [];
    for (const module of Object.values(PermissionModule)) {
      for (const action of Object.values(PermissionAction)) {
        const key = `${module}:${action}`;
        if (!existingKeys.has(key)) {
          toCreate.push(this.permissionRepo.create({ module, action }));
        }
      }
    }

    if (toCreate.length > 0) {
      await this.permissionRepo.save(toCreate);
    }

    return this.permissionRepo.find();
  }

  async findByModuleAction(module: PermissionModule, action: PermissionAction): Promise<Permission | null> {
    return this.permissionRepo.findOneBy({ module, action });
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionRepo.find();
  }
}
