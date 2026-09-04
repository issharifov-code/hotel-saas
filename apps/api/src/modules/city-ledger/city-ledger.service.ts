import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateAccount } from './entities/corporate-account.entity';
import { Guest, ProfileType } from '../guests/entities/guest.entity';
import { Invoice, InvoiceStatus } from '../invoicing/entities/invoice.entity';
import { CreateCorporateAccountDto } from './dto/create-corporate-account.dto';
import { UpdateCorporateAccountDto } from './dto/update-corporate-account.dto';

export interface CityLedgerStatementLine {
  invoiceId: string;
  bookingId: string;
  guestName: string;
  status: InvoiceStatus;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  issuedAt: Date | null;
  isOverdue: boolean;
}

export interface CityLedgerStatement {
  corporateAccountId: string;
  paymentTermsDays: number;
  creditLimit: string | null;
  invoiceCount: number;
  totalCharged: string;
  totalPaid: string;
  totalBalance: string;
  overdueBalance: string;
  lines: CityLedgerStatementLine[];
}

@Injectable()
export class CityLedgerService {
  constructor(
    @InjectRepository(CorporateAccount)
    private readonly accountRepo: Repository<CorporateAccount>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
      // Kompaniyaning KIM ekani shu yerda (profil) — Agency bilan bir xil
    // naqsh. GuestsModule import qilinmaydi: aylanma bog'liqlik bo'lardi.
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
  ) {}

  // Berilgan profil shu tenantga tegishli va KOMPANIYA ekanini tekshiradi.
  private async assertCompanyProfile(
    tenantId: string,
    profileId: string,
  ): Promise<void> {
    const profile = await this.guestRepo.findOneBy({ id: profileId, tenantId });
    if (!profile) throw new NotFoundException('Profil topilmadi');
    if (profile.profileType !== ProfileType.COMPANY) {
      throw new BadRequestException(
        "Korporativ hisob faqat 'Kompaniya' turidagi profilga bog'lanadi",
      );
    }
  }

  async create(
    tenantId: string,
    propertyId: string,
    dto: CreateCorporateAccountDto,
  ): Promise<CorporateAccount> {
    // `profileId` berilsa mavjud kompaniya profili ulanadi, aks holda
    // nom/aloqadan yangisi ochiladi (AgenciesService bilan bir xil naqsh).
    let profileId = dto.profileId;
    if (profileId) {
      await this.assertCompanyProfile(tenantId, profileId);
    } else {
      const profile = await this.guestRepo.save(
        this.guestRepo.create({
          tenantId,
          profileType: ProfileType.COMPANY,
          fullName: dto.name.trim(),
          phone: dto.contactPhone ?? null,
          email: dto.contactEmail ?? null,
          contactPerson: dto.contactName ?? null,
          taxId: dto.taxId ?? null,
          address: dto.billingAddress ?? null,
        }),
      );
      profileId = profile.id;
    }

    const account = this.accountRepo.create({
      tenantId,
      propertyId,
      profileId,
      // Eski ustunlar hamon to'ldiriladi — mavjud hisob-varaq/hisobotlar
      // buzilmasin. Manba esa PROFIL.
      name: dto.name.trim(),
      taxId: dto.taxId ?? null,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      contactEmail: dto.contactEmail ?? null,
      billingAddress: dto.billingAddress ?? null,
      creditLimit: dto.creditLimit ?? null,
      paymentTermsDays: dto.paymentTermsDays ?? 30,
      notes: dto.notes ?? null,
      isActive: true,
    });
    return this.accountRepo.save(account);
  }

  async listByProperty(
    tenantId: string,
    propertyId: string,
  ): Promise<CorporateAccount[]> {
    return this.accountRepo.find({
      where: { tenantId, propertyId },
      relations: { profile: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<CorporateAccount> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { profile: true },
    });
    if (!account) throw new NotFoundException('Korporativ hisob topilmadi');
    return account;
  }

  async update(
    tenantId: string,
    propertyId: string,
    id: string,
    dto: UpdateCorporateAccountDto,
  ): Promise<CorporateAccount> {
    const account = await this.findById(tenantId, propertyId, id);

    // KIM ekani — profilga (bitta manba).
    const profile = account.profile;
    if (profile) {
      if (dto.name !== undefined) profile.fullName = dto.name.trim();
      if (dto.taxId !== undefined) profile.taxId = dto.taxId;
      if (dto.contactName !== undefined) profile.contactPerson = dto.contactName;
      if (dto.contactPhone !== undefined) profile.phone = dto.contactPhone;
      if (dto.contactEmail !== undefined) profile.email = dto.contactEmail;
      if (dto.billingAddress !== undefined) profile.address = dto.billingAddress;
      await this.guestRepo.save(profile);
    }

    if (dto.name !== undefined) account.name = dto.name.trim();
    if (dto.taxId !== undefined) account.taxId = dto.taxId;
    if (dto.contactName !== undefined) account.contactName = dto.contactName;
    if (dto.contactPhone !== undefined) account.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) account.contactEmail = dto.contactEmail;
    if (dto.billingAddress !== undefined)
      account.billingAddress = dto.billingAddress;
    if (dto.creditLimit !== undefined) account.creditLimit = dto.creditLimit;
    if (dto.paymentTermsDays !== undefined)
      account.paymentTermsDays = dto.paymentTermsDays;
    if (dto.notes !== undefined) account.notes = dto.notes;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;
    return this.accountRepo.save(account);
  }

  // Faqat-o'qish agregatsiya (AgenciesService.getSummary/ReportsService
  // naqshiga o'xshab) — mavjud Invoice/InvoicePayment yozuvlaridan hisoblanadi,
  // hech qanday yangi accounting provodkasi yaratilmaydi. Bekor qilingan
  // hisob-fakturalar hisobga olinmaydi (haqiqiy qarz emas).
  async getStatement(
    tenantId: string,
    propertyId: string,
    corporateAccountId: string,
  ): Promise<CityLedgerStatement> {
    const account = await this.findById(
      tenantId,
      propertyId,
      corporateAccountId,
    );

    const invoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .innerJoin('invoice.booking', 'booking')
      .leftJoinAndSelect('invoice.guest', 'guest')
      .where('invoice.tenantId = :tenantId', { tenantId })
      .andWhere('invoice.propertyId = :propertyId', { propertyId })
      .andWhere('booking.corporateAccountId = :corporateAccountId', {
        corporateAccountId,
      })
      .andWhere('invoice.status != :cancelled', {
        cancelled: InvoiceStatus.CANCELLED,
      })
      .orderBy('invoice.createdAt', 'ASC')
      .getMany();

    const now = Date.now();
    const overdueThresholdMs = account.paymentTermsDays * 24 * 60 * 60 * 1000;

    let totalCharged = 0;
    let totalPaid = 0;
    let overdueBalance = 0;

    const lines: CityLedgerStatementLine[] = invoices.map((invoice) => {
      const total = Number(invoice.totalAmount);
      const paid = Number(invoice.paidAmount);
      const balance = total - paid;
      const isOverdue =
        balance > 0.005 &&
        invoice.issuedAt !== null &&
        now - new Date(invoice.issuedAt).getTime() > overdueThresholdMs;

      totalCharged += total;
      totalPaid += paid;
      if (isOverdue) overdueBalance += balance;

      return {
        invoiceId: invoice.id,
        bookingId: invoice.bookingId,
        guestName: invoice.guest?.fullName ?? '—',
        status: invoice.status,
        totalAmount: total.toFixed(2),
        paidAmount: paid.toFixed(2),
        balance: balance.toFixed(2),
        issuedAt: invoice.issuedAt,
        isOverdue,
      };
    });

    return {
      corporateAccountId,
      paymentTermsDays: account.paymentTermsDays,
      creditLimit: account.creditLimit,
      invoiceCount: invoices.length,
      totalCharged: totalCharged.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalBalance: (totalCharged - totalPaid).toFixed(2),
      overdueBalance: overdueBalance.toFixed(2),
      lines,
    };
  }
}
