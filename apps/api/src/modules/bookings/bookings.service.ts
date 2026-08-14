import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingSource, BookingStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { UpdateBookingDatesDto } from './dto/update-booking-dates.dto';
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

  // Front Desk: mehmonni boshqa xonaga o'tkazish (masalan texnik nosozlik yoki
  // mehmon iltimosi bilan). Faqat hali tugallanmagan bronlarda mumkin. Narx farqi
  // (yangi xona bazaviy narxi asosida) avtomatik hisoblanadi va, agar mehmon
  // hozir joylashgan bo'lsa, ochiq folio'ga tuzatish qatori sifatida yoziladi
  // (biznes qoida — tasdiqlangan).
  async changeRoom(tenantId: string, propertyId: string, id: string, dto: ChangeRoomDto): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (![BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(booking.status)) {
      throw new ConflictException(
        `Faqat "confirmed" yoki "checked_in" holatidagi bronda xona almashtirish mumkin (joriy holat: ${booking.status})`,
      );
    }
    if (dto.roomId === booking.roomId) {
      throw new BadRequestException('Bron allaqachon shu xonada');
    }

    const newRoom = await this.roomsService.findById(tenantId, propertyId, dto.roomId);
    await this.assertRoomAvailable(dto.roomId, booking.checkIn, booking.checkOut, booking.id);

    const wasCheckedIn = booking.status === BookingStatus.CHECKED_IN;
    if (wasCheckedIn) {
      // Yangi xona ham tozalanmagan bo'lsa o'tkazib bo'lmaydi — check-in bilan bir xil qoida.
      await this.housekeepingService.assertRoomCleanForCheckIn(tenantId, propertyId, dto.roomId);
    }

    const newRoomType = await this.roomTypeRepo.findOneBy({ id: newRoom.roomTypeId });
    const nights = this.diffNights(booking.checkIn, booking.checkOut);
    const newTotal = (Number(newRoomType!.basePrice) * nights).toFixed(2);
    const diff = (Number(newTotal) - Number(booking.totalAmount)).toFixed(2);
    const oldRoomId = booking.roomId;
    const oldRoomNumber = booking.room?.roomNumber ?? oldRoomId;

    // e'tibor: `update()` ishlatiladi (`save()` emas) — Booking entity'sida
    // bir xil `room_id` ustuniga ham `roomId` plain column, ham `room`
    // ManyToOne relation borligi sababli, agar entity `room` relation'i bilan
    // yuklangan (findById shuni qiladi) bo'lsa, `save()` eski `room` obyektini
    // ko'rib roomId'ni orqaga qaytarib qo'yishi mumkin.
    await this.bookingRepo.update({ id: booking.id }, { roomId: dto.roomId, totalAmount: newTotal });

    if (wasCheckedIn) {
      await this.roomRepo.update({ id: oldRoomId }, { status: RoomStatus.AVAILABLE });
      await this.roomRepo.update({ id: dto.roomId }, { status: RoomStatus.OCCUPIED });
      // Eski xona endi bo'shadi — tozalash navbatiga qo'shiladi.
      await this.housekeepingService.markDirtyAndQueueTask(tenantId, propertyId, oldRoomId);
      if (Number(diff) !== 0) {
        await this.invoicingService.addAdjustmentLine(
          tenantId,
          propertyId,
          booking.id,
          `Xona almashtirish: № ${oldRoomNumber} → № ${newRoom.roomNumber}`,
          diff,
        );
      }
    }

    return this.findById(tenantId, propertyId, booking.id);
  }

  // Front Desk: turish muddatini uzaytirish yoki qisqartirish. Narx farqi yangi
  // tunlar soni asosida qayta hisoblanadi va (mehmon hozir joylashgan bo'lsa)
  // ochiq folio'ga tuzatish qatori sifatida avtomatik yoziladi.
  async updateDates(tenantId: string, propertyId: string, id: string, dto: UpdateBookingDatesDto): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (![BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(booking.status)) {
      throw new ConflictException(
        `Faqat "confirmed" yoki "checked_in" holatidagi bronda sanani o'zgartirish mumkin (joriy holat: ${booking.status})`,
      );
    }
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException("check-out sanasi check-in sanasidan keyin bo'lishi kerak");
    }

    await this.assertRoomAvailable(booking.roomId, dto.checkIn, dto.checkOut, booking.id);

    const roomType = await this.roomTypeRepo.findOneBy({ id: booking.room?.roomTypeId ?? undefined });
    const nights = this.diffNights(dto.checkIn, dto.checkOut);
    const newTotal = (Number(roomType!.basePrice) * nights).toFixed(2);
    const diff = (Number(newTotal) - Number(booking.totalAmount)).toFixed(2);
    const oldCheckIn = booking.checkIn;
    const oldCheckOut = booking.checkOut;

    // `update()` ishlatiladi — changeRoom'dagi kabi, entity `room`/`guest`
    // relation'lari bilan yuklangan bo'lsa `save()` kutilmagan qo'shimcha
    // yozuvlarga olib kelishi mumkin (bookings.service.ts'dagi izohga qarang).
    await this.bookingRepo.update(
      { id: booking.id },
      { checkIn: dto.checkIn, checkOut: dto.checkOut, totalAmount: newTotal },
    );

    if (booking.status === BookingStatus.CHECKED_IN && Number(diff) !== 0) {
      await this.invoicingService.addAdjustmentLine(
        tenantId,
        propertyId,
        booking.id,
        `Sana o'zgartirish: ${oldCheckIn} — ${oldCheckOut} → ${dto.checkIn} — ${dto.checkOut}`,
        diff,
      );
    }

    return this.findById(tenantId, propertyId, booking.id);
  }

  async cancel(tenantId: string, propertyId: string, id: string): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if ([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(booking.status)) {
      throw new ConflictException("Check-in qilingan yoki tugallangan bronni bekor qilib bo'lmaydi");
    }
    booking.status = BookingStatus.CANCELLED;
    return this.bookingRepo.save(booking);
  }

  private async assertRoomAvailable(
    roomId: string,
    checkIn: string,
    checkOut: string,
    excludeBookingId?: string,
  ): Promise<void> {
    // Sana oralig'i to'qnashuvi: mavjud.checkIn < yangi.checkOut VA mavjud.checkOut > yangi.checkIn
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .where('booking.room_id = :roomId', { roomId })
      .andWhere('booking.status IN (:...statuses)', { statuses: BLOCKING_STATUSES })
      .andWhere('booking.check_in < :checkOut', { checkOut })
      .andWhere('booking.check_out > :checkIn', { checkIn });

    if (excludeBookingId) {
      qb.andWhere('booking.id != :excludeBookingId', { excludeBookingId });
    }

    const conflict = await qb.getOne();

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
