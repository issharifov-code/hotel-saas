import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';
import { RatePlansService } from './rate-plans.service';
import { RatePlanRestrictionsService } from './rate-plan-restrictions.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from './dto/update-rate-plan.dto';
import { UpsertRatePlanRestrictionDto } from './dto/upsert-rate-plan-restriction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Barcha route'lar /properties/:propertyId/... ostida — PermissionsGuard shu
// propertyId'ni request.params'dan o'qib, faqat shu mulkka tegishli rolga ega
// foydalanuvchilarga ruxsat beradi (multi-property tenant'lar uchun).
@Controller('properties/:propertyId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoomsController {
  constructor(
    private readonly roomTypesService: RoomTypesService,
    private readonly roomsService: RoomsService,
    private readonly ratePlansService: RatePlansService,
    private readonly ratePlanRestrictionsService: RatePlanRestrictionsService,
  ) {}

  @Get('room-types')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listRoomTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
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
  listRooms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
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

  // Narx rejalari (Rate Plans) — bitta xona turi ostida bir nechta narx
  // variantini (Rack Rate, Korporativ, Online, va h.k.) belgilash uchun.
  @Get('rate-plans')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listRatePlans(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return this.ratePlansService.listByProperty(
      user.tenantId!,
      propertyId,
      roomTypeId,
    );
  }

  @Post('rate-plans')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.CREATE)
  createRatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateRatePlanDto,
  ) {
    return this.ratePlansService.create(user.tenantId!, propertyId, dto);
  }

  @Patch('rate-plans/:id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  updateRatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRatePlanDto,
  ) {
    return this.ratePlansService.update(user.tenantId!, propertyId, id, dto);
  }

  // Narx rejasi cheklovlari (Rate Restrictions) — sana bo'yicha Closed to
  // Arrival/Departure, Min/Max Length of Stay va Stop Sell qoidalarini
  // belgilash uchun (revenue-management asosiy funksiyasi).
  @Get('rate-plans/:ratePlanId/restrictions')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  listRestrictions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('ratePlanId') ratePlanId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ratePlanRestrictionsService.listForRatePlan(
      user.tenantId!,
      propertyId,
      ratePlanId,
      from,
      to,
    );
  }

  @Put('rate-plans/:ratePlanId/restrictions/:date')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.EDIT)
  upsertRestriction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('ratePlanId') ratePlanId: string,
    @Param('date') date: string,
    @Body() dto: UpsertRatePlanRestrictionDto,
  ) {
    return this.ratePlanRestrictionsService.upsert(
      user.tenantId!,
      propertyId,
      ratePlanId,
      date,
      dto,
    );
  }
}
