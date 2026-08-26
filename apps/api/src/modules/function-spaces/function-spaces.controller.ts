import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FunctionSpacesService } from './function-spaces.service';
import { CreateFunctionSpaceDto } from './dto/create-function-space.dto';
import { UpdateFunctionSpaceDto } from './dto/update-function-space.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Function Space / Events (banket zali, konferensiya xonasi) — Agencies/Night
// Audit/Group Booking'dagi kabi, yangi PermissionModule qiymati qo'shilmadi:
// mavjud BOOKING moduli qayta ishlatiladi (tadbir zali ham bron/joy
// boshqaruvining bir turi).
@Controller('properties/:propertyId/function-spaces')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FunctionSpacesController {
  constructor(private readonly functionSpacesService: FunctionSpacesService) {}

  @Get()
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.functionSpacesService.listSpaces(user.tenantId!, propertyId);
  }

  @Get(':id')
  @RequirePermission(PermissionModule.BOOKING, PermissionAction.VIEW)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.functionSpacesService.findSpaceById(
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
    @Body() dto: CreateFunctionSpaceDto,
  ) {
    return this.functionSpacesService.createSpace(
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
    @Body() dto: UpdateFunctionSpaceDto,
  ) {
    return this.functionSpacesService.updateSpace(
      user.tenantId!,
      propertyId,
      id,
      dto,
    );
  }
}
