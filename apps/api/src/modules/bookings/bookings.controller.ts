import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { UpdateBookingDatesDto } from './dto/update-booking-dates.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

@Controller('properties/:propertyId/bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.listByProperty(user.tenantId!, propertyId, from, to);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.bookingsService.findById(user.tenantId!, propertyId, id);
  }

  @Post()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(user.tenantId!, propertyId, dto);
  }

  @Post(':id/cancel')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.bookingsService.cancel(user.tenantId!, propertyId, id);
  }

  // Front Desk (kengaytirilgan): xona almashtirish / sanani o'zgartirish.
  @Post(':id/change-room')
  @RequirePermission(PermissionModule.FRONT_DESK, PermissionAction.EDIT)
  changeRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: ChangeRoomDto,
  ) {
    return this.bookingsService.changeRoom(user.tenantId!, propertyId, id, dto);
  }

  @Post(':id/update-dates')
  @RequirePermission(PermissionModule.FRONT_DESK, PermissionAction.EDIT)
  updateDates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDatesDto,
  ) {
    return this.bookingsService.updateDates(user.tenantId!, propertyId, id, dto);
  }

  // Check-in/check-out — Front Desk modulining vazifasi (permission matritsasiga mos).
  @Post(':id/check-in')
  @RequirePermission(PermissionModule.FRONT_DESK, PermissionAction.APPROVE)
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.bookingsService.checkIn(user.tenantId!, propertyId, id);
  }

  @Post(':id/check-out')
  @RequirePermission(PermissionModule.FRONT_DESK, PermissionAction.APPROVE)
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.bookingsService.checkOut(user.tenantId!, propertyId, id);
  }
}
