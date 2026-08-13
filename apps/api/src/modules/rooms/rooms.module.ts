import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomType } from './entities/room-type.entity';
import { Room } from './entities/room.entity';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [TypeOrmModule.forFeature([RoomType, Room]), RolesModule],
  providers: [RoomTypesService, RoomsService],
  controllers: [RoomsController],
  exports: [RoomTypesService, RoomsService],
})
export class RoomsModule {}
