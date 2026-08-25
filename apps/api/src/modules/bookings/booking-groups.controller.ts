import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingGroupDto } from './dto/create-booking-group.dto';
import { AddGroupRoomDto } from './dto/add-group-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Guruh/blok bron — mavjud `booking` permission moduli qayta ishlatiladi
// (bronlar taqvimi bilan bir xil ruxsat matritsasi ostida), yangi
// PermissionModule qiymati qo'shilmadi.
@Controller('properties/:propertyId/booking-groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingGroupsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.bookingsService.listGroups(user.tenantId!, propertyId);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.bookingsService.findGroupById(user.tenantId!, propertyId, id);
  }

  @Post()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateBookingGroupDto,
  ) {
    return this.bookingsService.createGroup(
      user.tenantId!,
      propertyId,
      user.userId,
      dto,
    );
  }

  @Post(':id/rooms')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  addRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: AddGroupRoomDto,
  ) {
    return this.bookingsService.addRoomToGroup(
      user.tenantId!,
      propertyId,
      id,
      dto,
    );
  }
}
