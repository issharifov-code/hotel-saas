import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Account, AccountDepartment, AccountType } from './entities/account.entity';
import { JournalEntry, JournalEntrySourceModule } from './entities/journal-entry.entity';
import { JournalEntryLine } from './entities/journal-entry-line.entity';
import { DEFAULT_CHART_OF_ACCOUNTS } from './constants/default-chart-of-accounts';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';

export interface PostJournalEntryLineInput {
  accountId: string;
  debit?: string | number;
  credit?: string | number;
  description?: string | null;
}

export interface PostJournalEntryInput {
  tenantId: string;
  propertyId: string;
  entryDate?: string;
  description: string;
  sourceModule: JournalEntrySourceModule;
  sourceId?: string | null;
  createdByUserId?: string | null;
  lines: PostJournalEntryLineInput[];
  manager?: EntityManager;
}

export interface PostSimpleEntryInput {
  tenantId: string;
  propertyId: string;
  entryDate?: string;
  description: string;
  sourceModule: JournalEntrySourceModule;
  sourceId?: string | null;
  createdByUserId?: string | null;
  debitSystemKey: string;
  creditSystemKey: string;
  amount: string | number;
  manager?: EntityManager;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface IncomeStatementRow {
  accountId: string;
  code: string;
  name: string;
  department: AccountDepartment | null;
  amount: string; // revenue: kredit-debet, expense: debet-kredit (ikkalasi ham musbat = "normal" holat)
}

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(Account) private readonly accountRepo: Repository<Account>,
    @InjectRepository(JournalEntry) private readonly entryRepo: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine) private readonly lineRepo: Repository<JournalEntryLine>,
  ) {}

  // Yangi tenant ro'yxatdan o'tganda (TenantsService) chaqiriladi — RLS tenant
  // konteksti allaqachon o'rnatilgan bo'lishi kerak (register-tenant oqimi hali
  // autentifikatsiyasiz, shu sabab TenantsService buni o'zining tranzaksiyasida,
  // set_config'dan keyin chaqiradi).
  async seedDefaultChartOfAccounts(tenantId: string, manager: EntityManager): Promise<Account[]> {
    const repo = manager.getRepository(Account);
    const accounts = DEFAULT_CHART_OF_ACCOUNTS.map((def) =>
      repo.create({
        tenantId,
        code: def.code,
        name: def.name,
        type: def.type,
        department: def.department,
        normalBalance: def.normalBalance,
        systemKey: def.systemKey,
      }),
    );
    return repo.save(accounts);
  }

  async listAccounts(tenantId: string): Promise<Account[]> {
    return this.accountRepo.find({ where: { tenantId }, order: { code: 'ASC' } });
  }

  async getAccountBySystemKey(tenantId: string, systemKey: string): Promise<Account> {
    const account = await this.accountRepo.findOne({ where: { tenantId, systemKey } });
    if (!account) {
      // Bu holat faqat COA seed jarayonida xatolik bo'lsa yuz beradi (kutilmagan) —
      // foydalanuvchi xatosi emas, shuning uchun 500.
      throw new InternalServerErrorException(
        `Hisoblar rejasida "${systemKey}" tizim hisobi topilmadi — tenant COA to'liq seed qilinmagan bo'lishi mumkin`,
      );
    }
    return account;
  }

  // Umumiy (ko'p qatorli) jurnal yozuvi — debet jami = kredit jami bo'lishi shart.
  async postJournalEntry(input: PostJournalEntryInput): Promise<JournalEntry> {
    if (input.lines.length < 2) {
      throw new BadRequestException('Jurnal yozuvi kamida 2 qatordan iborat bo\'lishi kerak');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const normalizedLines = input.lines.map((line) => {
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);
      if (debit < 0 || credit < 0) {
        throw new BadRequestException('Debet/kredit summasi manfiy bo\'lishi mumkin emas');
      }
      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw new BadRequestException(
          'Har bir jurnal qatori FAQAT debet YOKI FAQAT kredit summasiga ega bo\'lishi kerak',
        );
      }
      totalDebit += debit;
      totalCredit += credit;
      return {
        accountId: line.accountId,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        description: line.description ?? null,
      };
    });

    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new BadRequestException(
        `Jurnal yozuvi balanslanmagan: debet=${totalDebit.toFixed(2)}, kredit=${totalCredit.toFixed(2)}`,
      );
    }

    const doPost = async (manager: EntityManager) => {
      const entryRepo = manager.getRepository(JournalEntry);
      const entry = entryRepo.create({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        entryDate: input.entryDate ?? new Date().toISOString().slice(0, 10),
        description: input.description,
        sourceModule: input.sourceModule,
        sourceId: input.sourceId ?? null,
        createdByUserId: input.createdByUserId ?? null,
        lines: normalizedLines.map((l) => manager.getRepository(JournalEntryLine).create(l)),
      });
      return entryRepo.save(entry);
    };

    // Izoh: avval bu yerda `manager` berilmaganda `this.dataSource.transaction(...)`
    // orqali YANGI, alohida ulanish/tranzaksiya ochilar edi — bu StockService'da
    // topilgan bilan bir xil xato: yangi ulanishda RLS tenant konteksti
    // (`app.tenant_id`) o'rnatilmagan bo'lardi va yozuv RLS siyosati tomonidan
    // bloklanardi. To'g'ri yechim — `entryRepo`/`lineRepo` allaqachon REQUEST-scoped
    // (RlsModule.forFeature orqali) va so'rovning yagona tranzaksiyasi ichida
    // ishlaydi, shuning uchun ularning `.manager`idan to'g'ridan-to'g'ri
    // foydalanish kifoya — qo'shimcha tranzaksiya ochish shart emas.
    return doPost(input.manager ?? this.entryRepo.manager);
  }

  // Eng ko'p ishlatiladigan hol — bitta debet, bitta kredit hisobi. Miqdor 0 (yoki
  // deyarli 0) bo'lsa, hech narsa yozilmaydi (moliyaviy ta'sirsiz operatsiyalar uchun,
  // masalan bepul namunalar yoki 0-narxli inventarizatsiya ortig'i). Miqdor manfiy
  // bo'lsa (masalan narx kamaytirilgan tuzatish), debet/kredit hisoblari almashtiriladi
  // — natijada yozuv har doim to'g'ri iqtisodiy yo'nalishda bo'ladi.
  async postSimpleEntry(input: PostSimpleEntryInput): Promise<JournalEntry | null> {
    const amount = Number(input.amount);
    if (Math.abs(amount) < 0.005) return null;

    const [debitAccount, creditAccount] = await Promise.all([
      this.getAccountBySystemKey(input.tenantId, input.debitSystemKey),
      this.getAccountBySystemKey(input.tenantId, input.creditSystemKey),
    ]);

    const magnitude = Math.abs(amount).toFixed(2);
    const lines: PostJournalEntryLineInput[] =
      amount > 0
        ? [
            { accountId: debitAccount.id, debit: magnitude },
            { accountId: creditAccount.id, credit: magnitude },
          ]
        : [
            // manfiy summa — iqtisodiy yo'nalish teskari (masalan narx kamayishi)
            { accountId: creditAccount.id, debit: magnitude },
            { accountId: debitAccount.id, credit: magnitude },
          ];

    return this.postJournalEntry({
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      entryDate: input.entryDate,
      description: input.description,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      createdByUserId: input.createdByUserId,
      lines,
      manager: input.manager,
    });
  }

  async listJournalEntries(
    tenantId: string,
    propertyId: string,
    filters?: { from?: string; to?: string; sourceModule?: JournalEntrySourceModule },
  ): Promise<JournalEntry[]> {
    const qb = this.entryRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.lines', 'line')
      .leftJoinAndSelect('line.account', 'account')
      .where('entry.tenant_id = :tenantId', { tenantId })
      .andWhere('entry.property_id = :propertyId', { propertyId })
      .orderBy('entry.entry_date', 'DESC')
      .addOrderBy('entry.created_at', 'DESC');

    if (filters?.from) qb.andWhere('entry.entry_date >= :from', { from: filters.from });
    if (filters?.to) qb.andWhere('entry.entry_date <= :to', { to: filters.to });
    if (filters?.sourceModule) qb.andWhere('entry.source_module = :sourceModule', { sourceModule: filters.sourceModule });

    return qb.getMany();
  }

  async createManualEntry(
    tenantId: string,
    propertyId: string,
    userId: string,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntry> {
    return this.postJournalEntry({
      tenantId,
      propertyId,
      entryDate: dto.entryDate,
      description: dto.description,
      sourceModule: 'manual',
      createdByUserId: userId,
      lines: dto.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      })),
    });
  }

  // Barcha hisoblar bo'yicha debet/kredit jami va qoldiq (asOfDate berilsa, shu
  // sanagacha bo'lgan yozuvlar) — buxgalteriya nazorati uchun standart hisobot.
  async getTrialBalance(tenantId: string, propertyId: string, asOfDate?: string): Promise<TrialBalanceRow[]> {
    const qb = this.lineRepo
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'entry')
      .innerJoin('line.account', 'account')
      .select('account.id', 'accountId')
      .addSelect('account.code', 'code')
      .addSelect('account.name', 'name')
      .addSelect('account.type', 'type')
      .addSelect('account.normal_balance', 'normalBalance')
      .addSelect('COALESCE(SUM(line.debit), 0)', 'debit')
      .addSelect('COALESCE(SUM(line.credit), 0)', 'credit')
      .where('entry.tenant_id = :tenantId', { tenantId })
      .andWhere('entry.property_id = :propertyId', { propertyId })
      .groupBy('account.id')
      .addGroupBy('account.code')
      .addGroupBy('account.name')
      .addGroupBy('account.type')
      .addGroupBy('account.normal_balance')
      .orderBy('account.code', 'ASC');

    if (asOfDate) qb.andWhere('entry.entry_date <= :asOfDate', { asOfDate });

    const rows = await qb.getRawMany<{
      accountId: string;
      code: string;
      name: string;
      type: AccountType;
      normalBalance: string;
      debit: string;
      credit: string;
    }>();

    return rows.map((r) => {
      const debit = Number(r.debit);
      const credit = Number(r.credit);
      const balance = r.normalBalance === 'debit' ? debit - credit : credit - debit;
      return { ...r, balance: balance.toFixed(2) };
    });
  }

  // Soddalashtirilgan USALI departamental daromadlar to'g'risida hisobot (Income
  // Statement) — berilgan davr uchun daromad/xarajat hisoblari, departament bo'yicha
  // guruhlangan. Aktiv/passiv/kapital hisoblari kiritilmaydi (faqat P&L).
  async getIncomeStatement(
    tenantId: string,
    propertyId: string,
    from: string,
    to: string,
  ): Promise<{ revenue: IncomeStatementRow[]; expense: IncomeStatementRow[] }> {
    const qb = this.lineRepo
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'entry')
      .innerJoin('line.account', 'account')
      .select('account.id', 'accountId')
      .addSelect('account.code', 'code')
      .addSelect('account.name', 'name')
      .addSelect('account.type', 'type')
      .addSelect('account.department', 'department')
      .addSelect('COALESCE(SUM(line.debit), 0)', 'debit')
      .addSelect('COALESCE(SUM(line.credit), 0)', 'credit')
      .where('entry.tenant_id = :tenantId', { tenantId })
      .andWhere('entry.property_id = :propertyId', { propertyId })
      .andWhere('entry.entry_date BETWEEN :from AND :to', { from, to })
      .andWhere('account.type IN (:...types)', { types: [AccountType.REVENUE, AccountType.EXPENSE] })
      .groupBy('account.id')
      .addGroupBy('account.code')
      .addGroupBy('account.name')
      .addGroupBy('account.type')
      .addGroupBy('account.department')
      .orderBy('account.code', 'ASC');

    const rows = await qb.getRawMany<{
      accountId: string;
      code: string;
      name: string;
      type: AccountType;
      department: AccountDepartment | null;
      debit: string;
      credit: string;
    }>();

    const revenue: IncomeStatementRow[] = [];
    const expense: IncomeStatementRow[] = [];
    for (const r of rows) {
      const debit = Number(r.debit);
      const credit = Number(r.credit);
      const amount = r.type === AccountType.REVENUE ? credit - debit : debit - credit;
      const row: IncomeStatementRow = {
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        department: r.department,
        amount: amount.toFixed(2),
      };
      if (r.type === AccountType.REVENUE) revenue.push(row);
      else expense.push(row);
    }
    return { revenue, expense };
  }
}
