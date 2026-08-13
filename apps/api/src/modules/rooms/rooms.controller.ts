import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

// Barcha route'lar /properties/:propertyId/... ostida — PermissionsGuard shu
// propertyId'ni request.params'dan o'qib, faqat shu mulkka tegishli rolga ega
// foydalanuvchilarga ruxsat beradi (multi-property tenant'lar uchun).
@Controller('properties/:propertyId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoomsController {
  constructor(
    private readonly roomTypesService: RoomTypesService,
    private readonly roomsService: RoomsService,
  ) {}

  @Get('room-types')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listRoomTypes(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.roomTypesService.listByProperty(user.tenantId!, propertyId);
  }

  @Post('room-types')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  createRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.roomTypesService.create(user.tenantId!, propertyId, dto);
  }

  @Get('rooms')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listRooms(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.roomsService.listByProperty(user.tenantId!, propertyId);
  }

  @Post('rooms')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  createRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.create(user.tenantId!, propertyId, dto);
  }
}
