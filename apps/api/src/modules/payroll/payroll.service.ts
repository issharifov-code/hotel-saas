import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollRun, PayrollRunStatus } from './entities/payroll-run.entity';
import { PayslipEntry } from './entities/payslip-entry.entity';
import { SalaryType } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AccountingService } from '../accounting/accounting.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayslipEntryDto } from './dto/update-payslip-entry.dto';

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(PayslipEntry)
    private readonly entryRepo: Repository<PayslipEntry>,
    private readonly usersService: UsersService,
    private readonly accountingService: AccountingService,
    private readonly attendanceService: AttendanceService,
  ) {}

  async listRuns(tenantId: string, propertyId: string): Promise<PayrollRun[]> {
    return this.runRepo.find({
      where: { tenantId, propertyId },
      order: { periodYear: 'DESC', periodMonth: 'DESC' },
    });
  }

  async getRun(
    tenantId: string,
    propertyId: string,
    id: string,
  ): Promise<PayrollRun> {
    const run = await this.runRepo.findOne({
      where: { id, tenantId, propertyId },
      relations: { entries: true },
    });
    if (!run) throw new NotFoundException('Payroll topilmadi');
    run.entries.sort((a, b) =>
      a.employeeNameSnapshot.localeCompare(b.employeeNameSnapshot),
    );
    return run;
  }

  // Shu tenant/property uchun berilgan davrda payroll hali yaratilmagan
  // bo'lsa, faol va maoshi belgilangan har bir xodim uchun avtomatik
  // PayslipEntry qatorini hosil qilib, DRAFT holatida yaratadi. MONTHLY
  // xodim uchun summasi darhol to'liq hisoblanadi; HOURLY xodim uchun
  // (hali soat kiritilmagani sababli) 0'dan boshlanadi —
  // updateEntry(hoursWorked) orqali to'ldiriladi.
  async createRun(
    tenantId: string,
    propertyId: string,
    userId: string,
    dto: CreatePayrollRunDto,
  ): Promise<PayrollRun> {
    const existing = await this.runRepo.findOneBy({
      propertyId,
      periodYear: dto.periodYear,
      periodMonth: dto.periodMonth,
    });
    if (existing) {
      throw new ConflictException(
        `${dto.periodYear}-${String(dto.periodMonth).padStart(2, '0')} davri uchun payroll allaqachon mavjud`,
      );
    }

    const employees = await this.usersService.listActiveWithSalary(tenantId);
    if (employees.length === 0) {
      throw new BadRequestException(
        'Maoshi belgilangan faol xodim topilmadi — avval Xodimlar sahifasida xodimga maosh belgilang',
      );
    }

    const run = await this.runRepo.save(
      this.runRepo.create({
        tenantId,
        propertyId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        status: PayrollRunStatus.DRAFT,
        totalAmount: '0.00',
        runByUserId: userId,
      }),
    );

    let total = 0;
    const entries: PayslipEntry[] = [];
    for (const emp of employees) {
      const rate = Number(emp.salaryAmount);
      const isHourly = emp.salaryType === SalaryType.HOURLY;
      // HOURLY: Attendance moduli shu davr uchun qayd etilgan soatlar
      // yig'indisini avtomatik taklif qiladi (agar hali qayd etilmagan bo'lsa
      // — 0, xuddi avvalgidek qo'lda kiritiladi). Ikkala holatda ham
      // updateEntry() orqali keyinroq qo'lda tuzatish mumkinligicha qoladi.
      const hours = isHourly
        ? await this.attendanceService.getMonthlyHours(
            tenantId,
            propertyId,
            emp.id,
            dto.periodYear,
            dto.periodMonth,
          )
        : 0;
      const gross = isHourly ? hours * rate : rate;
      total += gross;
      entries.push(
        this.entryRepo.create({
          payrollRunId: run.id,
          userId: emp.id,
          employeeNameSnapshot: emp.fullName,
          salaryType: emp.salaryType!,
          rateSnapshot: rate.toFixed(2),
          hoursWorked: isHourly ? hours.toFixed(2) : null,
          grossAmount: gross.toFixed(2),
          adjustmentAmount: '0.00',
          adjustmentNote: null,
          netAmount: gross.toFixed(2),
        }),
      );
    }
    await this.entryRepo.save(entries);

    run.totalAmount = total.toFixed(2);
    return this.runRepo.save(run);
  }

  private async getEditableEntry(
    tenantId: string,
    propertyId: string,
    runId: string,
    entryId: string,
  ): Promise<{ run: PayrollRun; entry: PayslipEntry }> {
    const run = await this.getRun(tenantId, propertyId, runId);
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new ConflictException(
        'Faqat qoralama (draft) holatidagi payrollni tahrirlash mumkin',
      );
    }
    const entry = run.entries.find((e) => e.id === entryId);
    if (!entry) throw new NotFoundException('Payslip topilmadi');
    return { run, entry };
  }

  async updateEntry(
    tenantId: string,
    propertyId: string,
    runId: string,
    entryId: string,
    dto: UpdatePayslipEntryDto,
  ): Promise<PayslipEntry> {
    const { entry } = await this.getEditableEntry(
      tenantId,
      propertyId,
      runId,
      entryId,
    );

    if (dto.hoursWorked !== undefined) {
      if (entry.salaryType !== SalaryType.HOURLY) {
        throw new BadRequestException(
          'Faqat soatlik (hourly) xodim uchun ishlagan soatlarni kiritish mumkin',
        );
      }
      entry.hoursWorked = dto.hoursWorked.toFixed(2);
      entry.grossAmount = (
        dto.hoursWorked * Number(entry.rateSnapshot)
      ).toFixed(2);
    }
    if (dto.adjustmentAmount !== undefined) {
      entry.adjustmentAmount = dto.adjustmentAmount.toFixed(2);
    }
    if (dto.adjustmentNote !== undefined) {
      entry.adjustmentNote = dto.adjustmentNote.trim() || null;
    }
    entry.netAmount = Math.max(
      0,
      Number(entry.grossAmount) + Number(entry.adjustmentAmount),
    ).toFixed(2);
    const saved = await this.entryRepo.save(entry);

    await this.recomputeTotal(runId);
    return saved;
  }

  private async recomputeTotal(runId: string): Promise<void> {
    const entries = await this.entryRepo.find({
      where: { payrollRunId: runId },
    });
    const total = entries.reduce((sum, e) => sum + Number(e.netAmount), 0);
    await this.runRepo.update({ id: runId }, { totalAmount: total.toFixed(2) });
  }

  // Run qatorini joriy so'rov tranzaksiyasi ichida bloklab (pessimistic_write)
  // qayta o'qiydi — bu ikkita bir vaqtdagi finalize/mark-paid so'rovi (masalan
  // ikki marta bosilgan tugma yoki ikkita xodim sessiyasi) bir-birini
  // "ko'rmasdan" ikkalasi ham eski (hali DRAFT/FINALIZED) holatni tekshirib
  // o'tib, ikkalasi ham buxgalteriya provodkasini qo'shib yuborishi (TOCTOU
  // race, InvoicingService.persistPayment'da avval tuzatilgan bir xil naqsh)
  // xavfini yopadi.
  private async lockRun(
    tenantId: string,
    propertyId: string,
    runId: string,
  ): Promise<PayrollRun> {
    const locked = await this.runRepo
      .createQueryBuilder('run')
      .setLock('pessimistic_write')
      .where('run.id = :id', { id: runId })
      .andWhere('run.tenant_id = :tenantId', { tenantId })
      .andWhere('run.property_id = :propertyId', { propertyId })
      .getOne();
    if (!locked) throw new NotFoundException('Payroll topilmadi');
    return locked;
  }

  // Yakunlash: qoralama endi tahrirlanmaydigan bo'ladi, va bitta jamlangan
  // xarajat+majburiyat provodkasi yoziladi (Debet 6109 Payroll-Related
  // Expenses / Kredit 2300 Xodimlarga to'lanadigan ish haqi). Har bir xodim
  // uchun alohida qator YOZILMAYDI — jami summa bitta yozuvda (payslip
  // tafsilotlari o'zi audit-trail vazifasini bajaradi, buxgalteriya
  // jurnalida esa umumiy ko'rinish kifoya, xuddi Night Audit'ning bitta
  // kunlik KPI yozuvi kabi).
  async finalizeRun(
    tenantId: string,
    propertyId: string,
    runId: string,
    userId: string,
  ): Promise<PayrollRun> {
    const run = await this.lockRun(tenantId, propertyId, runId);
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new ConflictException('Payroll allaqachon yakunlangan');
    }

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description: `Ish haqi — ${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`,
      sourceModule: 'payroll',
      sourceId: run.id,
      createdByUserId: userId,
      debitSystemKey: 'payroll_expense',
      creditSystemKey: 'payroll_liability',
      amount: run.totalAmount,
    });

    run.status = PayrollRunStatus.FINALIZED;
    run.finalizedByUserId = userId;
    run.finalizedAt = new Date();
    return this.runRepo.save(run);
  }

  // To'lash: majburiyat (2300) kassadan (1000) yopiladi. Faqat FINALIZED
  // holatidan mumkin.
  async markPaid(
    tenantId: string,
    propertyId: string,
    runId: string,
    userId: string,
  ): Promise<PayrollRun> {
    const run = await this.lockRun(tenantId, propertyId, runId);
    if (run.status !== PayrollRunStatus.FINALIZED) {
      throw new ConflictException(
        "Faqat yakunlangan (finalized) payrollni to'langan deb belgilash mumkin",
      );
    }

    await this.accountingService.postSimpleEntry({
      tenantId,
      propertyId,
      description: `Ish haqi to'lovi — ${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`,
      sourceModule: 'payroll',
      sourceId: run.id,
      createdByUserId: userId,
      debitSystemKey: 'payroll_liability',
      creditSystemKey: 'cash',
      amount: run.totalAmount,
    });

    run.status = PayrollRunStatus.PAID;
    run.paidAt = new Date();
    return this.runRepo.save(run);
  }
}
