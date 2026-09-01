import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessageTemplate,
  MessageChannel,
} from './entities/message-template.entity';
import { MessageLog, MessageStatus } from './entities/message-log.entity';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  Guest,
  CommunicationPreference,
} from '../guests/entities/guest.entity';
import {
  PaginatedResult,
  PaginationParams,
} from '../../common/utils/pagination.util';
import { Booking } from '../bookings/entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';
import { Property } from '../properties/entities/property.entity';
import {
  MESSAGE_ADAPTERS,
  MessageProviderAdapter,
} from './interfaces/message-provider.interface';

@Injectable()
export class MessagingService {
  private readonly adaptersByProvider: Map<string, MessageProviderAdapter>;

  constructor(
    @InjectRepository(MessageTemplate)
    private readonly templateRepo: Repository<MessageTemplate>,
    @InjectRepository(MessageLog)
    private readonly logRepo: Repository<MessageLog>,
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @Inject(MESSAGE_ADAPTERS) adapters: MessageProviderAdapter[],
  ) {
    this.adaptersByProvider = new Map(adapters.map((a) => [a.provider, a]));
  }

  // ---------- Shablonlar ----------

  async createTemplate(
    tenantId: string,
    propertyId: string,
    dto: CreateMessageTemplateDto,
  ): Promise<MessageTemplate> {
    const template = this.templateRepo.create({
      tenantId,
      propertyId,
      name: dto.name.trim(),
      triggerType: dto.triggerType,
      channel: dto.channel,
      subject: dto.subject ?? null,
      bodyTemplate: dto.bodyTemplate,
      isActive: true,
    });
    return this.templateRepo.save(template);
  }

  async listTemplates(
    tenantId: string,
    propertyId: string,
  ): Promise<MessageTemplate[]> {
    return this.templateRepo.find({
      where: { tenantId, propertyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findTemplateById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<MessageTemplate> {
    const template = await this.templateRepo.findOneBy({
      id,
      tenantId,
      propertyId,
    });
    if (!template) throw new NotFoundException('Xabar shabloni topilmadi');
    return template;
  }

  async updateTemplate(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: UpdateMessageTemplateDto,
  ): Promise<MessageTemplate> {
    const template = await this.findTemplateById(tenantId, propertyId, id);
    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.triggerType !== undefined) template.triggerType = dto.triggerType;
    if (dto.channel !== undefined) template.channel = dto.channel;
    if (dto.subject !== undefined) template.subject = dto.subject;
    if (dto.bodyTemplate !== undefined)
      template.bodyTemplate = dto.bodyTemplate;
    if (dto.isActive !== undefined) template.isActive = dto.isActive;
    return this.templateRepo.save(template);
  }

  // ---------- Xabar yuborish ----------

  async sendMessage(
    tenantId: string,
    propertyId: string,
    dto: SendMessageDto,
    sentByUserId: string,
  ): Promise<MessageLog> {
    const guest = await this.guestRepo.findOneBy({ id: dto.guestId, tenantId });
    if (!guest) throw new NotFoundException('Mehmon topilmadi');

    let booking: Booking | null = null;
    if (dto.bookingId) {
      booking = await this.bookingRepo.findOneBy({
        id: dto.bookingId,
        tenantId,
        propertyId,
      });
      if (!booking) throw new NotFoundException('Bron topilmadi');
    }

    let template: MessageTemplate | null = null;
    let subject: string | null;
    let body: string;
    if (dto.templateId) {
      template = await this.findTemplateById(
        tenantId,
        propertyId,
        dto.templateId,
      );
      const context = await this.buildMergeContext(
        tenantId,
        propertyId,
        guest,
        booking,
      );
      subject = template.subject
        ? this.render(template.subject, context)
        : null;
      body = this.render(template.bodyTemplate, context);
    } else {
      if (!dto.body) {
        throw new BadRequestException(
          "Xabar matni (body) yoki shablon (templateId) ko'rsatilishi shart",
        );
      }
      subject = dto.subject ?? null;
      body = dto.body;
    }

    const channel = this.resolveChannel(guest, dto.channel, template);
    const to = channel === MessageChannel.EMAIL ? guest.email : guest.phone;
    if (!to) {
      throw new BadRequestException(
        channel === MessageChannel.EMAIL
          ? 'Mehmonning email manzili kiritilmagan'
          : 'Mehmonning telefon raqami kiritilmagan',
      );
    }

    const adapter = this.adaptersByProvider.get('mock');
    if (!adapter) {
      throw new BadRequestException('Xabar yetkazish provayderi topilmadi');
    }
    const result = await adapter.send({ channel, to, subject, body });

    const log = this.logRepo.create({
      tenantId,
      propertyId,
      guestId: guest.id,
      bookingId: booking?.id ?? null,
      templateId: template?.id ?? null,
      channel,
      subject,
      body,
      status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
      provider: adapter.provider,
      providerRef: result.success ? result.providerRef : null,
      failureReason: result.success
        ? null
        : (result.failureReason ?? "Noma'lum xato"),
      sentByUserId,
    });
    return this.logRepo.save(log);
  }

  async listLogs(
    tenantId: string,
    propertyId: string,
    filters: { guestId?: string; bookingId?: string } = {},
    pagination: PaginationParams,
  ): Promise<PaginatedResult<MessageLog>> {
    const [items, total] = await this.logRepo.findAndCount({
      where: {
        tenantId,
        propertyId,
        ...(filters.guestId ? { guestId: filters.guestId } : {}),
        ...(filters.bookingId ? { bookingId: filters.bookingId } : {}),
      },
      relations: { guest: true },
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  // ---------- Yordamchi metodlar ----------

  // Guest.communicationPreference'dan boshlanadi (endi bu maydon nihoyat
  // "iste'mol qilinmoqda" — avval shu maydon "hozircha faqat saqlanadi" deb
  // izohlangan edi). PHONE (qo'ng'iroq) va NONE xabar yuborish uchun mos
  // emas — bunday holatda dto.channel yoki shablonning channel'i aniq
  // ko'rsatilishi SHART, aks holda xato tashlanadi.
  private resolveChannel(
    guest: Guest,
    override: MessageChannel | undefined,
    template: MessageTemplate | null,
  ): MessageChannel {
    if (override) return override;
    if (template) return template.channel;
    if (guest.communicationPreference === CommunicationPreference.EMAIL) {
      return MessageChannel.EMAIL;
    }
    if (guest.communicationPreference === CommunicationPreference.SMS) {
      return MessageChannel.SMS;
    }
    throw new BadRequestException(
      `Mehmonning aloqa afzalligi ("${guest.communicationPreference}") xabar yuborish uchun mos emas — kanalni (email/sms) aniq ko'rsating`,
    );
  }

  private async buildMergeContext(
    tenantId: string,
    propertyId: string,
    guest: Guest,
    booking: Booking | null,
  ): Promise<Record<string, string>> {
    const property = await this.propertyRepo.findOneBy({
      id: propertyId,
      tenantId,
    });
    const context: Record<string, string> = {
      guestName: guest.fullName,
      propertyName: property?.name ?? '',
      checkIn: '',
      checkOut: '',
      roomNumber: '',
    };
    if (booking) {
      context.checkIn = booking.checkIn;
      context.checkOut = booking.checkOut;
      const room = await this.roomRepo.findOneBy({
        id: booking.roomId,
        tenantId,
      });
      context.roomNumber = room?.roomNumber ?? '';
    }
    return context;
  }

  // Oddiy `{{key}}` o'rin-bosar almashtirish — tashqi shablon dvigateli
  // (masalan Handlebars) kerak emas, chunki maydonlar soni kichik va sobit.
  private render(template: string, context: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
      key in context ? context[key] : match,
    );
  }
}
