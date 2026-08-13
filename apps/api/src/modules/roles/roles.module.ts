import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, UserRole])],
  providers: [RolesService, PermissionsService],
  controllers: [RolesController],
  exports: [RolesService, PermissionsService],
})
export class RolesModule {}
