import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Booking,
  BookingSource,
  BookingStatus,
  MarketSegment,
} from './entities/booking.entity';
import { BookingGroup } from './entities/booking-group.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { UpdateBookingDatesDto } from './dto/update-booking-dates.dto';
import { CreateBookingGroupDto } from './dto/create-booking-group.dto';
import { AddGroupRoomDto } from './dto/add-group-room.dto';
import { RoomsService } from '../rooms/rooms.service';
import { RoomType } from '../rooms/entities/room-type.entity';
import { RatePlansService } from '../rooms/rate-plans.service';
import { RatePlan } from '../rooms/entities/rate-plan.entity';
import { GuestsService } from '../guests/guests.service';
import { Room, RoomStatus } from '../rooms/entities/room.entity';
import { HousekeepingService } from '../housekeeping/housekeeping.service';
import { InvoicingService } from '../invoicing/invoicing.service';

// Booking'ni "band" deb hisoblaydigan holatlar — bekor qilingan yoki checkout
// bo'lgan bronlar yangi bron bilan taqvim to'qnashuvi hisoblanmaydi.
const BLOCKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomType)
    private readonly roomTypeRepo: Repository<RoomType>,
    private readonly roomsService: RoomsService,
    private readonly ratePlansService: RatePlansService,
    private readonly guestsService: GuestsService,
    private readonly housekeepingService: HousekeepingService,
    private readonly invoicingService: InvoicingService,
    @InjectRepository(BookingGroup)
    private readonly bookingGroupRepo: Repository<BookingGroup>,
  ) {}

  async create(
    tenantId: string,
    propertyId: string,
    dto: CreateBookingDto,
  ): Promise<Booking> {
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException(
        "check-out sanasi check-in sanasidan keyin bo'lishi kerak",
      );
    }

    const room = await this.roomsService.findById(
      tenantId,
      propertyId,
      dto.roomId,
    );
    await this.guestsService.findById(tenantId, dto.guestId);

    await this.assertRoomAvailable(dto.roomId, dto.checkIn, dto.checkOut);

    let ratePlan: RatePlan | null = null;
    if (dto.ratePlanId) {
      ratePlan = await this.ratePlansService.findById(
        tenantId,
        propertyId,
        dto.ratePlanId,
      );
      if (ratePlan.roomTypeId !== room.roomTypeId) {
        throw new BadRequestException(
          'Tanlangan narx rejasi shu xona turiga tegishli emas',
        );
      }
    }

    const nights = this.diffNights(dto.checkIn, dto.checkOut);
    const totalAmount =
      dto.totalAmount ??
      (await this.calcNightlyTotal(room.roomTypeId, ratePlan, nights));

    const booking = this.bookingRepo.create({
      tenantId,
      propertyId,
      roomId: dto.roomId,
      guestId: dto.guestId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      status: BookingStatus.CONFIRMED,
      source: dto.source ?? BookingSource.DIRECT,
      marketSegment: dto.marketSegment ?? MarketSegment.OTHER,
      ratePlanId: ratePlan?.id ?? null,
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

  async findById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { room: true, guest: true },
    });
    if (!booking) throw new NotFoundException('Bron topilmadi');
    return booking;
  }

  async checkIn(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        `Faqat "confirmed" holatidagi bronni check-in qilish mumkin (joriy holat: ${booking.status})`,
      );
    }
    // Xona hali tozalanmagan bo'lsa (oxirgi mehmondan keyin) check-in bloklanadi —
    // avval Housekeeping bo'limida "Tozalandi" deb belgilanishi kerak.
    await this.housekeepingService.assertRoomCleanForCheckIn(
      tenantId,
      propertyId,
      booking.roomId,
    );

    booking.status = BookingStatus.CHECKED_IN;
    await this.roomRepo.update(
      { id: booking.roomId },
      { status: RoomStatus.OCCUPIED },
    );
    const saved = await this.bookingRepo.save(booking);
    // Mehmon folio'sini ochadi (xona narxi birinchi qator sifatida qo'shiladi).
    await this.invoicingService.openFolio(tenantId, propertyId, saved);
    return saved;
  }

  async checkOut(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new ConflictException(
        `Faqat "checked_in" holatidagi bronni check-out qilish mumkin (joriy holat: ${booking.status})`,
      );
    }
    booking.status = BookingStatus.CHECKED_OUT;
    await this.roomRepo.update(
      { id: booking.roomId },
      { status: RoomStatus.AVAILABLE },
    );
    // Xonani "iflos" deb belgilaydi va tozalash navbatiga avtomatik qo'shadi.
    await this.housekeepingService.markDirtyAndQueueTask(
      tenantId,
      propertyId,
      booking.roomId,
    );
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
  async changeRoom(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: ChangeRoomDto,
  ): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (
      ![BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(
        booking.status,
      )
    ) {
      throw new ConflictException(
        `Faqat "confirmed" yoki "checked_in" holatidagi bronda xona almashtirish mumkin (joriy holat: ${booking.status})`,
      );
    }
    if (dto.roomId === booking.roomId) {
      throw new BadRequestException('Bron allaqachon shu xonada');
    }

    const newRoom = await this.roomsService.findById(
      tenantId,
      propertyId,
      dto.roomId,
    );
    await this.assertRoomAvailable(
      dto.roomId,
      booking.checkIn,
      booking.checkOut,
      booking.id,
    );

    const wasCheckedIn = booking.status === BookingStatus.CHECKED_IN;
    if (wasCheckedIn) {
      // Yangi xona ham tozalanmagan bo'lsa o'tkazib bo'lmaydi — check-in bilan bir xil qoida.
      await this.housekeepingService.assertRoomCleanForCheckIn(
        tenantId,
        propertyId,
        dto.roomId,
      );
    }

    // Agar bronda narx rejasi tanlangan bo'lsa-yu, yangi xona boshqa xona
    // turiga tegishli bo'lsa — o'sha reja endi mos kelmaydi, shuning uchun
    // avtomatik bekor qilinadi (null) va bazaviy narxga qaytiladi.
    const currentRatePlan = booking.ratePlanId
      ? await this.ratePlansService.findById(
          tenantId,
          propertyId,
          booking.ratePlanId,
        )
      : null;
    const stillMatchesRatePlan =
      currentRatePlan?.roomTypeId === newRoom.roomTypeId;
    const nextRatePlan = stillMatchesRatePlan ? currentRatePlan : null;

    const nights = this.diffNights(booking.checkIn, booking.checkOut);
    const newTotal = await this.calcNightlyTotal(
      newRoom.roomTypeId,
      nextRatePlan,
      nights,
    );
    const diff = (Number(newTotal) - Number(booking.totalAmount)).toFixed(2);
    const oldRoomId = booking.roomId;
    const oldRoomNumber = booking.room?.roomNumber ?? oldRoomId;

    // e'tibor: `update()` ishlatiladi (`save()` emas) — Booking entity'sida
    // bir xil `room_id` ustuniga ham `roomId` plain column, ham `room`
    // ManyToOne relation borligi sababli, agar entity `room` relation'i bilan
    // yuklangan (findById shuni qiladi) bo'lsa, `save()` eski `room` obyektini
    // ko'rib roomId'ni orqaga qaytarib qo'yishi mumkin.
    await this.bookingRepo.update(
      { id: booking.id },
      {
        roomId: dto.roomId,
        totalAmount: newTotal,
        ratePlanId: nextRatePlan?.id ?? null,
      },
    );

    if (wasCheckedIn) {
      await this.roomRepo.update(
        { id: oldRoomId },
        { status: RoomStatus.AVAILABLE },
      );
      await this.roomRepo.update(
        { id: dto.roomId },
        { status: RoomStatus.OCCUPIED },
      );
      // Eski xona endi bo'shadi — tozalash navbatiga qo'shiladi.
      await this.housekeepingService.markDirtyAndQueueTask(
        tenantId,
        propertyId,
        oldRoomId,
      );
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
  async updateDates(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: UpdateBookingDatesDto,
  ): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (
      ![BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(
        booking.status,
      )
    ) {
      throw new ConflictException(
        `Faqat "confirmed" yoki "checked_in" holatidagi bronda sanani o'zgartirish mumkin (joriy holat: ${booking.status})`,
      );
    }
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException(
        "check-out sanasi check-in sanasidan keyin bo'lishi kerak",
      );
    }

    await this.assertRoomAvailable(
      booking.roomId,
      dto.checkIn,
      dto.checkOut,
      booking.id,
    );

    // Xona (va shu bilan xona turi) o'zgarmaydi — narx rejasi bo'lsa, o'sha
    // saqlanib qoladi, faqat tunlar soni asosida summa qayta hisoblanadi.
    const ratePlan = booking.ratePlanId
      ? await this.ratePlansService.findById(
          tenantId,
          propertyId,
          booking.ratePlanId,
        )
      : null;
    const roomTypeId = booking.room?.roomTypeId;
    const nights = this.diffNights(dto.checkIn, dto.checkOut);
    const newTotal = await this.calcNightlyTotal(roomTypeId, ratePlan, nights);
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

  async cancel(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (
      [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(
        booking.status,
      )
    ) {
      throw new ConflictException(
        "Check-in qilingan yoki tugallangan bronni bekor qilib bo'lmaydi",
      );
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
    const conflict = await this.findConflictingBooking(
      roomId,
      checkIn,
      checkOut,
      excludeBookingId,
    );
    if (conflict) {
      throw new ConflictException(
        `Xona shu sana oralig'ida band (mavjud bron: ${conflict.checkIn} — ${conflict.checkOut})`,
      );
    }
  }

  private async findConflictingBooking(
    roomId: string,
    checkIn: string,
    checkOut: string,
    excludeBookingId?: string,
  ): Promise<Booking | null> {
    // Sana oralig'i to'qnashuvi: mavjud.checkIn < yangi.checkOut VA mavjud.checkOut > yangi.checkIn
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .where('booking.room_id = :roomId', { roomId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: BLOCKING_STATUSES,
      })
      .andWhere('booking.check_in < :checkOut', { checkOut })
      .andWhere('booking.check_out > :checkIn', { checkIn });

    if (excludeBookingId) {
      qb.andWhere('booking.id != :excludeBookingId', { excludeBookingId });
    }

    return qb.getOne();
  }

  // Berilgan xona turidagi, sana oralig'ida bo'sh (band bo'lmagan) xonalarni
  // qaytaradi. "out_of_order" (butunlay ishlamaydigan) xonalar hech qachon
  // taklif qilinmaydi — boshqa holatlar (masalan "maintenance") esa faqat
  // joriy vaziyatni bildiradi va kelajakdagi bandlikka to'sqinlik qilmaydi
  // (xuddi mavjud assertRoomAvailable mantig'i kabi, faqat bron to'qnashuvi tekshiriladi).
  private async listAvailableRoomsOfType(
    tenantId: string,
    propertyId: string,
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<Room[]> {
    const rooms = await this.roomRepo.find({
      where: { tenantId, propertyId, roomTypeId },
      order: { roomNumber: 'ASC' },
    });
    const candidates = rooms.filter(
      (r) => r.status !== RoomStatus.OUT_OF_ORDER,
    );
    const free: Room[] = [];
    for (const room of candidates) {
      const conflict = await this.findConflictingBooking(
        room.id,
        checkIn,
        checkOut,
      );
      if (!conflict) free.push(room);
    }
    return free;
  }

  // Jonli bron widget'i uchun — mavjud bo'sh xonalar sonini qaytaradi
  // (haqiqiy xona identifikatorlarini oshkor qilmasdan, faqat sonini).
  async countAvailableRoomsOfType(
    tenantId: string,
    propertyId: string,
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<number> {
    if (new Date(checkOut) <= new Date(checkIn)) return 0;
    const rooms = await this.listAvailableRoomsOfType(
      tenantId,
      propertyId,
      roomTypeId,
      checkIn,
      checkOut,
    );
    return rooms.length;
  }

  // Jonli (autentifikatsiyasiz) bron widget'idan kelgan bronni yaratadi —
  // mehmon ANIQ xonani emas, faqat XONA TURINI tanlaydi; birinchi bo'sh xona
  // avtomatik tayinlanadi. Xodim tomonidan keyinchalik ko'rib chiqilishi
  // (tasdiqlanishi) uchun holat har doim PENDING, manba esa WEBSITE bo'ladi
  // (`confirm()` orqali xodim CONFIRMED holatiga o'tkazadi).
  async createFromWebsite(
    tenantId: string,
    propertyId: string,
    dto: {
      roomTypeId: string;
      ratePlanId?: string;
      checkIn: string;
      checkOut: string;
      guestId: string;
      currency?: string;
      notes?: string;
    },
  ): Promise<Booking> {
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException(
        "check-out sanasi check-in sanasidan keyin bo'lishi kerak",
      );
    }

    const availableRooms = await this.listAvailableRoomsOfType(
      tenantId,
      propertyId,
      dto.roomTypeId,
      dto.checkIn,
      dto.checkOut,
    );
    if (availableRooms.length === 0) {
      throw new ConflictException(
        "Tanlangan sana oralig'ida shu turdagi bo'sh xona yo'q",
      );
    }
    const room = availableRooms[0];

    let ratePlan: RatePlan | null = null;
    if (dto.ratePlanId) {
      ratePlan = await this.ratePlansService.findById(
        tenantId,
        propertyId,
        dto.ratePlanId,
      );
      if (ratePlan.roomTypeId !== dto.roomTypeId) {
        throw new BadRequestException(
          'Tanlangan narx rejasi shu xona turiga tegishli emas',
        );
      }
      if (!ratePlan.isActive) {
        throw new BadRequestException('Tanlangan narx rejasi endi faol emas');
      }
    }

    const nights = this.diffNights(dto.checkIn, dto.checkOut);
    const totalAmount = await this.calcNightlyTotal(
      dto.roomTypeId,
      ratePlan,
      nights,
    );

    const booking = this.bookingRepo.create({
      tenantId,
      propertyId,
      roomId: room.id,
      guestId: dto.guestId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      status: BookingStatus.PENDING,
      source: BookingSource.WEBSITE,
      marketSegment: MarketSegment.OTHER,
      ratePlanId: ratePlan?.id ?? null,
      totalAmount,
      currency: dto.currency ?? 'UZS',
      notes: dto.notes ?? null,
    });
    return this.bookingRepo.save(booking);
  }

  // Front Desk: veb-saytdan kelgan "pending" bronni ko'rib chiqib tasdiqlaydi
  // (xonani va sanalarni tekshirgach). Faqat PENDING holatidan CONFIRMED'ga o'tadi.
  async confirm(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<Booking> {
    const booking = await this.findById(tenantId, propertyId, id);
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException(
        `Faqat "pending" holatidagi bronni tasdiqlash mumkin (joriy holat: ${booking.status})`,
      );
    }
    booking.status = BookingStatus.CONFIRMED;
    return this.bookingRepo.save(booking);
  }

  // Guruh/blok bron — korporativ mijoz yoki turizm agentligi bir vaqtning
  // o'zida bir nechta xonani bitta "guruh" ostida bron qiladi. Har bir qator
  // uchun oddiy bron yaratish mantig'i (`createRoomForGroup`) qayta
  // ishlatiladi — mehmon aniq xonani emas, faqat xona TURINI tanlaydi
  // (Booking Engine'dagi `createFromWebsite` bilan bir xil naqsh), birinchi
  // bo'sh xona avtomatik tayinlanadi. Butun so'rov RLS interceptor tomonidan
  // bitta HTTP-tranzaksiyaga o'ralgani uchun, agar biror qatorda xatolik
  // chiqsa (masalan bo'sh xona qolmasa), butun guruh yaratish operatsiyasi
  // avtomatik ravishda orqaga qaytariladi (rollback) — qisman yaratilgan
  // guruh saqlanib qolmaydi.
  async createGroup(
    tenantId: string,
    propertyId: string,
    userId: string,
    dto: CreateBookingGroupDto,
  ): Promise<BookingGroup> {
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException(
        "check-out sanasi check-in sanasidan keyin bo'lishi kerak",
      );
    }

    const group = await this.bookingGroupRepo.save(
      this.bookingGroupRepo.create({
        tenantId,
        propertyId,
        groupName: dto.groupName,
        companyName: dto.companyName ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        contactEmail: dto.contactEmail ?? null,
        notes: dto.notes ?? null,
        createdByUserId: userId,
      }),
    );

    for (const room of dto.rooms) {
      await this.createRoomForGroup(tenantId, propertyId, group.id, {
        roomTypeId: room.roomTypeId,
        guestId: room.guestId,
        ratePlanId: room.ratePlanId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
      });
    }

    return group;
  }

  async listGroups(
    tenantId: string,
    propertyId: string,
  ): Promise<BookingGroup[]> {
    return this.bookingGroupRepo.find({
      where: { tenantId, propertyId },
      relations: { bookings: { room: true, guest: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findGroupById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<BookingGroup> {
    const group = await this.bookingGroupRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { bookings: { room: true, guest: true } },
    });
    if (!group) throw new NotFoundException('Guruh bron topilmadi');
    return group;
  }

  // Mavjud guruhga qo'shimcha xona (rooming list qatori) qo'shadi.
  async addRoomToGroup(
    tenantId: string,
    propertyId: string,
    groupId: string,
    dto: AddGroupRoomDto,
  ): Promise<Booking> {
    // Guruh haqiqatan mavjudligini va shu tenant/property'ga tegishliligini
    // tekshiradi (topilmasa NotFoundException tashlaydi).
    const group = await this.bookingGroupRepo.findOne({
      where: { id: groupId, tenantId, propertyId },
    });
    if (!group) throw new NotFoundException('Guruh bron topilmadi');
    return this.createRoomForGroup(tenantId, propertyId, groupId, dto);
  }

  // `create()`/`createFromWebsite()` bilan bir xil "xona turi tanlanadi,
  // birinchi bo'sh xona avtomatik tayinlanadi" naqshi — faqat qo'shimcha
  // ravishda `groupId` va `marketSegment: GROUP` bilan.
  private async createRoomForGroup(
    tenantId: string,
    propertyId: string,
    groupId: string,
    dto: {
      roomTypeId: string;
      guestId: string;
      ratePlanId?: string;
      checkIn: string;
      checkOut: string;
    },
  ): Promise<Booking> {
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException(
        "check-out sanasi check-in sanasidan keyin bo'lishi kerak",
      );
    }
    await this.guestsService.findById(tenantId, dto.guestId);

    const availableRooms = await this.listAvailableRoomsOfType(
      tenantId,
      propertyId,
      dto.roomTypeId,
      dto.checkIn,
      dto.checkOut,
    );
    if (availableRooms.length === 0) {
      throw new ConflictException(
        "Tanlangan sana oralig'ida shu turdagi bo'sh xona yo'q",
      );
    }
    const room = availableRooms[0];

    let ratePlan: RatePlan | null = null;
    if (dto.ratePlanId) {
      ratePlan = await this.ratePlansService.findById(
        tenantId,
        propertyId,
        dto.ratePlanId,
      );
      if (ratePlan.roomTypeId !== dto.roomTypeId) {
        throw new BadRequestException(
          'Tanlangan narx rejasi shu xona turiga tegishli emas',
        );
      }
      if (!ratePlan.isActive) {
        throw new BadRequestException('Tanlangan narx rejasi endi faol emas');
      }
    }

    const nights = this.diffNights(dto.checkIn, dto.checkOut);
    const totalAmount = await this.calcNightlyTotal(
      dto.roomTypeId,
      ratePlan,
      nights,
    );

    const booking = this.bookingRepo.create({
      tenantId,
      propertyId,
      roomId: room.id,
      guestId: dto.guestId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.DIRECT,
      marketSegment: MarketSegment.GROUP,
      ratePlanId: ratePlan?.id ?? null,
      totalAmount,
      currency: 'UZS',
      groupId,
    });
    return this.bookingRepo.save(booking);
  }

  private diffNights(checkIn: string, checkOut: string): number {
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  }

  // Narx rejasi berilgan bo'lsa shu rejaning kechalik narxidan, aks holda
  // xona turining bazaviy narxidan (RoomType.basePrice) jami summani hisoblaydi.
  private async calcNightlyTotal(
    roomTypeId: string,
    ratePlan: RatePlan | null,
    nights: number,
  ): Promise<string> {
    if (ratePlan) {
      return (Number(ratePlan.nightlyPrice) * nights).toFixed(2);
    }
    const roomType = await this.roomTypeRepo.findOneBy({ id: roomTypeId });
    return (Number(roomType!.basePrice) * nights).toFixed(2);
  }
}
