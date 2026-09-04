import { Module } from '@nestjs/common';
import { Property } from './entities/property.entity';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { RlsModule } from '../../common/rls/rls.module';
// PermissionsGuard RolesService'ga bog'liq (logotip route'lari uchun
// TENANT_SETTINGS ruxsati tekshiriladi).
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [RlsModule.forFeature([Property]), RolesModule],
  providers: [PropertiesService],
  controllers: [PropertiesController],
  exports: [PropertiesService],
})
export class PropertiesModule {}
