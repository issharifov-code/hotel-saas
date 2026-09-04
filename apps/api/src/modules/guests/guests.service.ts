import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Guest,
  ORGANIZATION_PROFILE_TYPES,
  ProfileType,
} from './entities/guest.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { Invoice } from '../invoicing/entities/invoice.entity';
import { PosOrder } from '../pos/entities/pos-order.entity';
import { LoyaltyService } from './loyalty.service';

// Profil qidiruvi parametrlari — hammasi ixtiyoriy.
export interface GuestSearchFilters {
  search?: string;
  name?: string;
  communication?: string;
  documentNumber?: string;
  nationality?: string;
  // 2026-09-04: profil turi. Berilmasa BARCHA turlar qaytadi (Profillar
  // sahifasining standarti). Bron oynasidagi mehmon tanlagichi esa ataylab
  // `guest` deb yuboradi — kompaniyani mehmon sifatida bronga qo'yib
  // bo'lmasligi kerak.
  profileType?: ProfileType;
}

// Har bir maydon qaysi turlarda ma'noga ega. Bu ro'yxat ikkala tomonga ham
// ishlaydi: tashkilot maydonini mehmonga yozib bo'lmaydi VA mehmon maydonini
// tashkilotga yozib bo'lmaydi. Sababi oddiy — kompaniyaning tug'ilgan sanasi
// yoki mehmonning STIRi bo'lmaydi, va bunday yozuv keyin hisobotlarda
// tushunarsiz chiqadi.
const FIELD_ALLOWED_TYPES: Record<string, ProfileType[]> = {
  taxId: ORGANIZATION_PROFILE_TYPES,
  address: ORGANIZATION_PROFILE_TYPES,
  city: ORGANIZATION_PROFILE_TYPES,
  // Aloqa shaxsi tashkilotda ham, guruhda ham ma'noli (guruh rahbari).
  contactPerson: [...ORGANIZATION_PROFILE_TYPES, ProfileType.GROUP],
  commissionPct: [ProfileType.TRAVEL_AGENT],
  parentProfileId: [ProfileType.CONTACT],
  documentType: [ProfileType.GUEST],
  documentNumber: [ProfileType.GUEST],
  dateOfBirth: [ProfileType.GUEST],
  roomPreference: [ProfileType.GUEST],
  dietaryPreference: [ProfileType.GUEST],
};

const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  [ProfileType.GUEST]: 'Mehmon',
  [ProfileType.COMPANY]: 'Kompaniya',
  [ProfileType.TRAVEL_AGENT]: 'Turagent',
  [ProfileType.SOURCE]: 'Manba',
  [ProfileType.GROUP]: 'Guruh',
  [ProfileType.CONTACT]: 'Kontakt',
};

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    // BookingsModule'ni/InvoicingModule'ni import qilmasdan, to'g'ridan-to'g'ri
    // entity orqali — aylanma modul bog'liqligidan qochish uchun (Bookings va
    // Invoicing allaqachon Guests'ga bog'liq). Faqat mehmonlarni birlashtirish
    // (merge) paytida tegishli yozuvlarni ko'chirish uchun kerak.
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    // POS buyurtmasidagi guest_id shunchaki izoh/kuzatuv uchun (haqiqiy FK
    // munosabati yo'q), lekin merge paytida dangling reference qoldirmaslik
    // uchun baribir ko'chiriladi.
    @InjectRepository(PosOrder)
    private readonly posOrderRepo: Repository<PosOrder>,
    @InjectRepository(LoyaltyTransaction)
    private readonly loyaltyTxRepo: Repository<LoyaltyTransaction>,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // Berilgan maydonlar shu profil turiga mos kelishini tekshiradi. Mos
  // kelmasa aniq xabar bilan 400 qaytaradi — jimgina o'chirib tashlash
  // (silently drop) xavfli: foydalanuvchi kiritgan ma'lumot yo'qolgani
  // bilinmay qolardi.
  private assertFieldsMatchType(
    profileType: ProfileType,
    dto: Record<string, unknown>,
  ): void {
    for (const [field, allowed] of Object.entries(FIELD_ALLOWED_TYPES)) {
      const value = dto[field];
      // `null` — "tozalash" degani, u har doim ruxsat etiladi.
      if (value === undefined || value === null || value === '') continue;
      if (!allowed.includes(profileType)) {
        throw new BadRequestException(
          `"${PROFILE_TYPE_LABELS[profileType]}" profilida bu maydon ishlatilmaydi: ${field}`,
        );
      }
    }
  }

  // Kontakt profilining tashkiloti haqiqatan mavjud va TASHKILOT ekanini
  // tekshiradi — aks holda kontaktni boshqa kontaktga yoki mehmonga bog'lab
  // qo'yish mumkin bo'lardi.
  private async assertParentIsOrganization(
    tenantId: string,
    parentProfileId: string,
  ): Promise<void> {
    const parent = await this.guestRepo.findOneBy({
      id: parentProfileId,
      tenantId,
    });
    if (!parent) throw new NotFoundException('Bog\'langan tashkilot topilmadi');
    if (!ORGANIZATION_PROFILE_TYPES.includes(parent.profileType)) {
      throw new BadRequestException(
        'Kontakt faqat kompaniya, turagent yoki manba profiliga bog\'lanadi',
      );
    }
  }

  async create(tenantId: string, dto: CreateGuestDto): Promise<Guest> {
    const profileType = dto.profileType ?? ProfileType.GUEST;
    this.assertFieldsMatchType(profileType, dto as unknown as Record<string, unknown>);
    if (dto.parentProfileId) {
      await this.assertParentIsOrganization(tenantId, dto.parentProfileId);
    }

    const guest = this.guestRepo.create({
      tenantId,
      profileType,
      fullName: dto.fullName.trim(),
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      nationality: dto.nationality ?? null,
      documentType: dto.documentType ?? null,
      documentNumber: dto.documentNumber ?? null,
      roomPreference: dto.roomPreference ?? null,
      dietaryPreference: dto.dietaryPreference ?? null,
      communicationPreference: dto.communicationPreference ?? undefined,
      taxId: dto.taxId ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      contactPerson: dto.contactPerson ?? null,
      // `numeric` ustun — bazaga va TypeORM'ga string sifatida boradi.
      commissionPct:
        dto.commissionPct === undefined ? null : String(dto.commissionPct),
      parentProfileId: dto.parentProfileId ?? null,
    });
    return this.guestRepo.save(guest);
  }

  // Jonli bron widget'i (Booking Engine) uchun — telefon yoki email bo'yicha
  // mos keluvchi mavjud mehmonni topadi (topilsa o'shani qaytaradi, yozuvni
  // takrorlamaydi), topilmasa yangi mehmon yaratadi. `findDuplicateGroups`dagi
  // bilan bir xil normalizatsiya (bo'shliq/tire/"+" olib tashlanadi, email
  // kichik harfga o'tkaziladi) ishlatiladi — shuning uchun ikkalasi ham bir
  // xil mehmonni "bir xil" deb hisoblaydi.
  async findOrCreateForBooking(
    tenantId: string,
    data: { fullName: string; phone?: string | null; email?: string | null },
  ): Promise<Guest> {
    const normPhone = data.phone ? this.normalizePhone(data.phone) : null;
    const normEmail = data.email ? this.normalizeText(data.email) : null;

    if (normPhone || normEmail) {
      // FAQAT jismoniy mehmon profillari orasidan izlanadi: bron egasi
      // sifatida kompaniya yoki turagent profilini qaytarib yuborish
      // (telefoni bir xil bo'lib qolsa) mutlaqo noto'g'ri bo'lardi.
      const candidates = await this.guestRepo.find({
        where: { tenantId, profileType: ProfileType.GUEST },
      });
      const existing = candidates.find(
        (g) =>
          (normPhone &&
            g.phone &&
            this.normalizePhone(g.phone) === normPhone) ||
          (normEmail && g.email && this.normalizeText(g.email) === normEmail),
      );
      if (existing) return existing;
    }

    return this.create(tenantId, {
      fullName: data.fullName,
      phone: data.phone ?? undefined,
      email: data.email ?? undefined,
    });
  }

  // Profil qidiruvi (2026-09-04, OPERA Cloud "Manage Profile" referensi).
  //
  // `search` — eski umumiy maydon (ism/telefon/email bo'ylab), boshqa
  // parametrlar esa alohida-alohida. Hammasi ixtiyoriy va VA (AND) bilan
  // birlashadi: to'ldirilgan har bir maydon natijani toraytiradi.
  //
  // `communication` ataylab bitta maydon: OPERA'da ham "Email / Fax / Phone /
  // Web" bitta katakcha — reception odatda qaysi kanal ekanini bilmaydi,
  // faqat raqam yoki manzilni biladi.
  async list(tenantId: string, filters: GuestSearchFilters = {}): Promise<Guest[]> {
    const qb = this.guestRepo
      .createQueryBuilder('guest')
      .where('guest.tenant_id = :tenantId', { tenantId })
      .orderBy('guest.created_at', 'DESC');

    const like = (v: string) => `%${v.trim()}%`;

    if (filters.search?.trim()) {
      qb.andWhere(
        '(guest.full_name ILIKE :search OR guest.phone ILIKE :search OR guest.email ILIKE :search)',
        { search: like(filters.search) },
      );
    }
    if (filters.name?.trim()) {
      qb.andWhere('guest.full_name ILIKE :name', { name: like(filters.name) });
    }
    if (filters.communication?.trim()) {
      qb.andWhere('(guest.phone ILIKE :comm OR guest.email ILIKE :comm)', {
        comm: like(filters.communication),
      });
    }
    if (filters.documentNumber?.trim()) {
      qb.andWhere('guest.document_number ILIKE :doc', {
        doc: like(filters.documentNumber),
      });
    }
    if (filters.nationality?.trim()) {
      qb.andWhere('guest.nationality ILIKE :nat', {
        nat: like(filters.nationality),
      });
    }
    if (filters.profileType) {
      qb.andWhere('guest.profile_type = :profileType', {
        profileType: filters.profileType,
      });
    }
    return qb.getMany();
  }

  async findById(tenantId: string, id: string): Promise<Guest> {
    const guest = await this.guestRepo.findOneBy({ id, tenantId });
    if (!guest) throw new NotFoundException('Mehmon topilmadi');
    return guest;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateGuestDto,
  ): Promise<Guest> {
    const guest = await this.findById(tenantId, id);
    this.assertFieldsMatchType(
      guest.profileType,
      dto as unknown as Record<string, unknown>,
    );
    if (dto.parentProfileId) {
      await this.assertParentIsOrganization(tenantId, dto.parentProfileId);
    }
    if (dto.fullName !== undefined) guest.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) guest.phone = dto.phone || null;
    if (dto.email !== undefined) guest.email = dto.email || null;
    if (dto.nationality !== undefined)
      guest.nationality = dto.nationality || null;
    if (dto.documentType !== undefined)
      guest.documentType = dto.documentType || null;
    if (dto.documentNumber !== undefined)
      guest.documentNumber = dto.documentNumber || null;
    if (dto.dateOfBirth !== undefined)
      guest.dateOfBirth = dto.dateOfBirth || null;
    if (dto.notes !== undefined) guest.notes = dto.notes || null;
    if (dto.roomPreference !== undefined)
      guest.roomPreference = dto.roomPreference || null;
    if (dto.dietaryPreference !== undefined)
      guest.dietaryPreference = dto.dietaryPreference || null;
    if (dto.communicationPreference !== undefined)
      guest.communicationPreference = dto.communicationPreference;
    if (dto.taxId !== undefined) guest.taxId = dto.taxId || null;
    if (dto.address !== undefined) guest.address = dto.address || null;
    if (dto.city !== undefined) guest.city = dto.city || null;
    if (dto.contactPerson !== undefined)
      guest.contactPerson = dto.contactPerson || null;
    if (dto.commissionPct !== undefined)
      guest.commissionPct = String(dto.commissionPct);
    if (dto.parentProfileId !== undefined)
      guest.parentProfileId = dto.parentProfileId || null;
    return this.guestRepo.save(guest);
  }

  // CRM uchun mehmonning barcha filiallardagi bronlar tarixi (property/xona bilan birga).
  async getStayHistory(tenantId: string, id: string): Promise<Booking[]> {
    await this.findById(tenantId, id);
    return this.bookingRepo.find({
      where: { tenantId, guestId: id },
      relations: { room: true, property: true },
      order: { checkIn: 'DESC' },
    });
  }

  // Telefon raqamini solishtirish uchun normallashtirish — bo'shliq, tire,
  // qavslar VA boshidagi "+" olib tashlanadi, faqat raqamlar qoladi
  // (masalan "+998 90 123-45-67" va "998901234567" bir xil deb hisoblanadi).
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private normalizeText(value: string): string {
    return value.trim().toLowerCase();
  }

  // Ikkilanma bo'lishi mumkin bo'lgan mehmonlarni topadi — bir xil telefon,
  // email yoki hujjat raqamiga ega mehmonlar guruhlanadi. Union-Find (DSU)
  // yondashuvi orqali tranzitiv bog'lanishlar ham hisobga olinadi (masalan,
  // A va B telefon bo'yicha, B va C email bo'yicha mos kelsa — {A,B,C} bitta
  // guruh sifatida qaytariladi). O(n) — tenant'dagi barcha mehmonlar soni bo'yicha.
  async findDuplicateGroups(tenantId: string): Promise<Guest[][]> {
    const guests = await this.guestRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    const parent = new Map<string, string>();
    const find = (id: string): string => {
      if (!parent.has(id)) parent.set(id, id);
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root) as string;
      let cur = id;
      while (parent.get(cur) !== root) {
        const next = parent.get(cur) as string;
        parent.set(cur, root);
        cur = next;
      }
      return root;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    const keyToFirstGuestId = new Map<string, string>();
    for (const g of guests) {
      find(g.id); // ro'yxatdan o'tkazish
      // Kalitlar profil TURI bilan prefikslanadi: kompaniyaning umumiy
      // telefoni o'sha yerda ishlaydigan mehmonniki bilan bir xil bo'lishi
      // butunlay normal — ularni "ikkilanma" deb ko'rsatish xato bo'lardi.
      const t = g.profileType;
      const keys: string[] = [];
      if (g.phone) keys.push(`${t}:phone:${this.normalizePhone(g.phone)}`);
      if (g.email) keys.push(`${t}:email:${this.normalizeText(g.email)}`);
      if (g.documentNumber)
        keys.push(`${t}:doc:${this.normalizeText(g.documentNumber)}`);

      for (const key of keys) {
        const existing = keyToFirstGuestId.get(key);
        if (existing) union(existing, g.id);
        else keyToFirstGuestId.set(key, g.id);
      }
    }

    const rootToGuests = new Map<string, Guest[]>();
    for (const g of guests) {
      const root = find(g.id);
      const arr = rootToGuests.get(root) ?? [];
      arr.push(g);
      rootToGuests.set(root, arr);
    }

    return [...rootToGuests.values()].filter((group) => group.length > 1);
  }

  // Ikki mehmon yozuvini bittaga birlashtiradi: `duplicateGuestId`ning barcha
  // bronlari, hisob-fakturalari va loyalty tarixi `primaryId`ga ko'chiriladi,
  // loyalty ballari qo'shiladi, bo'sh maydonlar duplikatdan to'ldiriladi, so'ng
  // duplikat o'chiriladi. Bir HTTP so'rov ichida barcha RLS-repository'lar bitta
  // tranzaksiyani ulashadi (RlsContextService), shuning uchun bu amal atomik.
  async mergeGuests(
    tenantId: string,
    primaryId: string,
    duplicateId: string,
  ): Promise<Guest> {
    if (primaryId === duplicateId) {
      throw new BadRequestException(
        "Mehmonni o'zi bilan birlashtirib bo'lmaydi",
      );
    }
    const primary = await this.findById(tenantId, primaryId);
    const duplicate = await this.findById(tenantId, duplicateId);

    // Turli turdagi profillarni birlashtirib bo'lmaydi — kompaniyani mehmonga
    // "quyish" ikkalasining ham ma'lumotini buzardi (maydonlari boshqacha).
    if (primary.profileType !== duplicate.profileType) {
      throw new BadRequestException(
        "Turli turdagi profillarni birlashtirib bo'lmaydi",
      );
    }

    if (!primary.phone && duplicate.phone) primary.phone = duplicate.phone;
    if (!primary.email && duplicate.email) primary.email = duplicate.email;
    if (!primary.nationality && duplicate.nationality)
      primary.nationality = duplicate.nationality;
    if (!primary.documentType && duplicate.documentType)
      primary.documentType = duplicate.documentType;
    if (!primary.documentNumber && duplicate.documentNumber)
      primary.documentNumber = duplicate.documentNumber;
    if (!primary.dateOfBirth && duplicate.dateOfBirth)
      primary.dateOfBirth = duplicate.dateOfBirth;
    if (!primary.roomPreference && duplicate.roomPreference)
      primary.roomPreference = duplicate.roomPreference;
    if (!primary.dietaryPreference && duplicate.dietaryPreference)
      primary.dietaryPreference = duplicate.dietaryPreference;
    if (duplicate.notes) {
      primary.notes = primary.notes
        ? `${primary.notes}\n---\n${duplicate.notes}`
        : duplicate.notes;
    }

    // Loyalty qoldig'i qo'shiladi va daraja shu jamlangan qiymatdan qayta
    // hisoblanadi — audit uchun har ikkala tomonning tarixi (LoyaltyTransaction)
    // pastda alohida ko'chiriladi, shuning uchun bu yerda yangi tranzaksiya
    // yozuvi yaratilmaydi (mavjudlari allaqachon buni tasvirlaydi).
    primary.loyaltyPoints += duplicate.loyaltyPoints;
    primary.lifetimePoints += duplicate.lifetimePoints;
    primary.loyaltyTier = this.loyaltyService.calculateTier(
      primary.lifetimePoints,
    );

    await this.guestRepo.save(primary);

    await this.bookingRepo.update(
      { guestId: duplicateId, tenantId },
      { guestId: primaryId },
    );
    await this.invoiceRepo.update(
      { guestId: duplicateId, tenantId },
      { guestId: primaryId },
    );
    await this.posOrderRepo.update(
      { guestId: duplicateId, tenantId },
      { guestId: primaryId },
    );
    // loyalty_transactions'da tenant_id ustuni yo'q (guest_id orqali tenant'ga
    // bog'liq "farzand" jadval) — filtr faqat guest_id bo'yicha.
    await this.loyaltyTxRepo.update(
      { guestId: duplicateId },
      { guestId: primaryId },
    );

    await this.guestRepo.remove(duplicate);

    return primary;
  }
}
