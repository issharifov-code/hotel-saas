import { Module } from '@nestjs/common';
import { Property } from './entities/property.entity';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [RlsModule.forFeature([Property])],
  providers: [PropertiesService],
  controllers: [PropertiesController],
  exports: [PropertiesService],
})
export class PropertiesModule {}
