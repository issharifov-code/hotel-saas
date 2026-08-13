import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingSource, BookingStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RoomsService } from '../rooms/rooms.service';
import { RoomType } from '../rooms/entities/room-type.entity';
import { GuestsService } from '../guests/guests.service';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import { HousekeepingService } from '../housekeeping/housekeeping.service';
import { InvoicingService } from '../invoicing/invoicing.service';

// Booking'ni "band" deb hisoblaydigan holatlar — bekor qilingan yoki checkout
// bo'lgan bronlar yangi bron bilan taqvim to'qnashuvi hisoblanmaydi.
const BLOCKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN];

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomType) private readonly roomTypeRepo: Repository<RoomType>,
    private readonly roomsService: RoomsService,
    private readonly guestsService: GuestsService,
    private readonly housekeepingService: HousekeepingService,
    private readonly invoicingService: InvoicingService,
  ) {}

  async create(tenantId: string, propertyId: string, dto: CreateBookingDto): Promise<Booking> {
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException("check-out sanasi check-in sanasidan keyin bo'lishi kerak");
    }

    const room = await this.roomsService.findById(tenantId, propertyId, dto.roomId);
    await this.guestsService.findById(tenantId, dto.guestId);

    await this.assertRoomAvailable(dto.roomId, dto.checkIn, dto.checkOut);

    const roomType = await this.roomTypeRepo.findOneBy({ id: room.roomTypeId });
    const nights = this.diffNights(dto.checkIn, dto.checkOut);
    const totalAmount =
      dto.totalAmount ?? (Number(roomType!.basePrice) * nights).toFixed(2);

    const booking = this.bookingRepo.create({
      tenantId,
      propertyId,
      roomId: dto.roomId,
      guestId: dto.guestId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      status: BookingStatus.CONFIRMED,
      source: dto.source ?? BookingSource.DIRECT,
      totalAmount,
      currency: dto.currency ?? 'UZS',
      notes: dto.notes ?? null,
    });
    return this.bookingRepo.save(booking);
  }

  async listByProperty(
    tenantId: string,
    propertyId: string,
    from?: string,
    to?: string,
  ): Promise<Booking[]> {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('booking.guest', 'guest')
      .where('booking.tenant_id = :tenantId', { tenantId })
      .andWhere('booking.property_id = :propertyId', { propertyId })
      .orderBy('booking.check_in', 'ASC');

    if (from) qb.andWhere('booking.check_out > :from', { from });
    if (to) qb.andWhere('booking.check_in < :to', { to });

    return qb.getMany();
  }

  async findById(tenantId: string, propertyId: string, id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { room: true, guest: true },
    });
    if (!booking) throw new NotFoundException('Bron topilmadi');
    return booking;
  }

  async checkIn(tenantId: string, propertyId: string, id: string): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        `Faqat "confirmed" holatidagi bronni check-in qilish mumkin (joriy holat: ${booking.status})`,
      );
    }
    // Xona hali tozalanmagan bo'lsa (oxirgi mehmondan keyin) check-in bloklanadi —
    // avval Housekeeping bo'limida "Tozalandi" deb belgilanishi kerak.
    await this.housekeepingService.assertRoomCleanForCheckIn(tenantId, propertyId, booking.roomId);

    booking.status = BookingStatus.CHECKED_IN;
    await this.roomRepo.update({ id: booking.roomId }, { status: RoomStatus.OCCUPIED });
    const saved = await this.bookingRepo.save(booking);
    // Mehmon folio'sini ochadi (xona narxi birinchi qator sifatida qo'shiladi).
    await this.invoicingService.openFolio(tenantId, propertyId, saved);
    return saved;
  }

  async checkOut(tenantId: string, propertyId: string, id: string): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new ConflictException(
        `Faqat "checked_in" holatidagi bronni check-out qilish mumkin (joriy holat: ${booking.status})`,
      );
    }
    booking.status = BookingStatus.CHECKED_OUT;
    await this.roomRepo.update({ id: booking.roomId }, { status: RoomStatus.AVAILABLE });
    // Xonani "iflos" deb belgilaydi va tozalash navbatiga avtomatik qo'shadi.
    await this.housekeepingService.markDirtyAndQueueTask(tenantId, propertyId, booking.roomId);
    const saved = await this.bookingRepo.save(booking);
    // Folio'ni qat'iylashtiradi ("issued") — to'lov holatidan qat'i nazar
    // (biznes qoida — tasdiqlangan), to'lanmagan qoldiq keyin kuzatiladi.
    await this.invoicingService.issueFolio(tenantId, propertyId, saved.id);
    return saved;
  }

  async cancel(tenantId: string, propertyId: string, id: string): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if ([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(booking.status)) {
      throw new ConflictException("Check-in qilingan yoki tugallangan bronni bekor qilib bo'lmaydi");
    }
    booking.status = BookingStatus.CANCELLED;
    return this.bookingRepo.save(booking);
  }

  private async assertRoomAvailable(roomId: string, checkIn: string, checkOut: string): Promise<void> {
    // Sana oralig'i to'qnashuvi: mavjud.checkIn < yangi.checkOut VA mavjud.checkOut > yangi.checkIn
    const conflict = await this.bookingRepo
      .createQueryBuilder('booking')
      .where('booking.room_id = :roomId', { roomId })
      .andWhere('booking.status IN (:...statuses)', { statuses: BLOCKING_STATUSES })
      .andWhere('booking.check_in < :checkOut', { checkOut })
      .andWhere('booking.check_out > :checkIn', { checkIn })
      .getOne();

    if (conflict) {
      throw new ConflictException(
        `Xona shu sana oralig'ida band (mavjud bron: ${conflict.checkIn} — ${conflict.checkOut})`,
      );
    }
  }

  private diffNights(checkIn: string, checkOut: string): number {
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  }
}
