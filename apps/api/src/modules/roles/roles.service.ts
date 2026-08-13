import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { Permission } from './entities/permission.entity';
import { PermissionsService } from './permissions.service';
import { SYSTEM_ROLE_DEFINITIONS } from '../../common/constants/role-permission-matrix';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';
import { nullable } from '../../common/utils/typeorm.util';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    private readonly permissionsService: PermissionsService,
  ) {}

  // Yangi tenant ro'yxatdan o'tganda chaqiriladi: 6 ta standart rolni
  // (Egasi, Buxgalter, Front Desk, Housekeeping, Ombor mudiri, POS) avtomatik yaratadi.
  async seedSystemRolesForTenant(tenantId: string): Promise<Role[]> {
    const allPermissions = await this.permissionsService.ensureAllPermissionsExist();
    const permissionKey = (m: PermissionModule, a: PermissionAction) => `${m}:${a}`;
    const permissionMap = new Map<string, Permission>(
      allPermissions.map((p) => [permissionKey(p.module, p.action), p]),
    );

    const createdRoles: Role[] = [];
    for (const def of SYSTEM_ROLE_DEFINITIONS) {
      const permissions: Permission[] = [];
      for (const group of def.permissions) {
        for (const action of group.actions) {
          const perm = permissionMap.get(permissionKey(group.module, action));
          if (perm) permissions.push(perm);
        }
      }
      const role = this.roleRepo.create({
        tenantId,
        name: def.name,
        systemKey: def.key,
        isSystem: true,
        permissions,
      });
      createdRoles.push(await this.roleRepo.save(role));
    }
    return createdRoles;
  }

  async listRolesForTenant(tenantId: string): Promise<Role[]> {
    return this.roleRepo.find({
      where: { tenantId },
      relations: { permissions: true },
      order: { createdAt: 'ASC' },
    });
  }

  async createCustomRole(
    tenantId: string,
    name: string,
    permissionIds: string[],
  ): Promise<Role> {
    if (!name?.trim()) {
      throw new BadRequestException("Rol nomi bo'sh bo'lishi mumkin emas");
    }
    const permissions = await this.permissionsService.findAll();
    const selected = permissions.filter((p) => permissionIds.includes(p.id));
    const role = this.roleRepo.create({
      tenantId,
      name: name.trim(),
      isSystem: false,
      permissions: selected,
    });
    return this.roleRepo.save(role);
  }

  async updateRolePermissions(
    tenantId: string,
    roleId: string,
    permissionIds: string[],
  ): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, tenantId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Rol topilmadi');

    const permissions = await this.permissionsService.findAll();
    role.permissions = permissions.filter((p) => permissionIds.includes(p.id));
    return this.roleRepo.save(role);
  }

  async assignRoleToUser(
    tenantId: string,
    userId: string,
    roleId: string,
    propertyId: string | null = null,
  ): Promise<UserRole> {
    const role = await this.roleRepo.findOneBy({ id: roleId, tenantId });
    if (!role) throw new NotFoundException('Rol topilmadi');

    const existing = await this.userRoleRepo.findOneBy({
      tenantId,
      userId,
      roleId,
      propertyId: nullable(propertyId),
    });
    if (existing) return existing;

    const userRole = this.userRoleRepo.create({ tenantId, userId, roleId, propertyId });
    return this.userRoleRepo.save(userRole);
  }

  async removeRoleFromUser(tenantId: string, userId: string, roleId: string): Promise<void> {
    await this.userRoleRepo.delete({ tenantId, userId, roleId });
  }

  // Foydalanuvchining barcha rollari orqali erishadigan ruxsatlar to'plami (union).
  // propertyId berilsa: tenant-darajasidagi (propertyId=null) rollar + shu mulkka
  // tegishli rollar hisobga olinadi.
  async getEffectivePermissions(
    tenantId: string,
    userId: string,
    propertyId?: string,
  ): Promise<Set<string>> {
    const userRoles = await this.userRoleRepo.find({
      where: { tenantId, userId },
      relations: { role: { permissions: true } },
    });

    const relevant = userRoles.filter(
      (ur) => ur.propertyId === null || !propertyId || ur.propertyId === propertyId,
    );

    const result = new Set<string>();
    for (const ur of relevant) {
      for (const perm of ur.role.permissions) {
        result.add(`${perm.module}:${perm.action}`);
      }
    }
    return result;
  }

  async getRoleById(tenantId: string, roleId: string): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, tenantId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Rol topilmadi');
    return role;
  }

  async findRolesByIds(tenantId: string, ids: string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    return this.roleRepo.find({ where: { tenantId, id: In(ids) } });
  }
}
