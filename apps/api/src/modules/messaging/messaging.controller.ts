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
import { MessagingService } from './messaging.service';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

// Mehmonlarga xabar yuborish (email/SMS, mock provayder orqali) — yangi
// PermissionModule qiymati qo'shilmadi, mavjud GUEST_CRM qayta ishlatildi
// (xabar yuborish ham mehmon bilan aloqa boshqaruvining bir qismi).
@Controller('properties/:propertyId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('message-templates')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  listTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.messagingService.listTemplates(user.tenantId!, propertyId);
  }

  @Get('message-templates/:id')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  findTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ) {
    return this.messagingService.findTemplateById(
      user.tenantId!,
      propertyId,
      id,
    );
  }

  @Post('message-templates')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.CREATE)
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateMessageTemplateDto,
  ) {
    return this.messagingService.createTemplate(
      user.tenantId!,
      propertyId,
      dto,
    );
  }

  @Patch('message-templates/:id')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.EDIT)
  updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMessageTemplateDto,
  ) {
    return this.messagingService.updateTemplate(
      user.tenantId!,
      propertyId,
      id,
      dto,
    );
  }

  @Get('message-logs')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.VIEW)
  listLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('guestId') guestId?: string,
    @Query('bookingId') bookingId?: string,
  ) {
    return this.messagingService.listLogs(user.tenantId!, propertyId, {
      guestId,
      bookingId,
    });
  }

  @Post('messages/send')
  @RequirePermission(PermissionModule.GUEST_CRM, PermissionAction.CREATE)
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(
      user.tenantId!,
      propertyId,
      dto,
      user.userId,
    );
  }
}
