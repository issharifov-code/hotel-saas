import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FunctionSpacesService } from './function-spaces.service';
import { CreateFunctionSpaceBookingDto } from './dto/create-function-space-booking.dto';
import { UpdateFunctionSpaceBookingDto } from './dto/update-function-space-booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Tadbir bronlari — BookingGroupsController'ning BookingsController'dan
// alohida bo'lishiga o'xshab, shu modul ichida FunctionSpacesController'dan
// alohida controller (marshrut prefiksi farqli).
@Controller('properties/:propertyId/function-space-bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FunctionSpaceBookingsController {
  constructor(private readonly functionSpacesService: FunctionSpacesService) {}

  @Get()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('functionSpaceId') functionSpaceId?: string,
  ) {
    return this.functionSpacesService.listBookings(user.tenantId!, propertyId, {
      functionSpaceId,
    });
  }

  @Get(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.functionSpacesService.findBookingById(
      user.tenantId!,
      propertyId,
      id,
    );
  }

  @Post()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateFunctionSpaceBookingDto,
  ) {
    return this.functionSpacesService.createBooking(
      user.tenantId!,
      propertyId,
      dto,
    );
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFunctionSpaceBookingDto,
  ) {
    return this.functionSpacesService.updateBooking(
      user.tenantId!,
      propertyId,
      id,
      dto,
    );
  }
}
