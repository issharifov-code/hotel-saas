import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { RoomType } from '../rooms/entities/room-type.entity';
import { Room, RoomStatus, HousekeepingStatus } from '../rooms/entities/room.entity';
import { RatePlan } from '../rooms/entities/rate-plan.entity';
import { Guest, CommunicationPreference } from '../guests/entities/guest.entity';
import {
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from '../guests/entities/loyalty-transaction.entity';
import { calculateLoyaltyTier, pointsForPayment } from '../guests/loyalty-formula.util';
import { Booking, BookingStatus, BookingSource, MarketSegment } from '../bookings/entities/booking.entity';
import { Invoice, InvoiceStatus } from '../invoicing/entities/invoice.entity';
import { InvoiceLine, InvoiceLineSource } from '../invoicing/entities/invoice-line.entity';
import { InvoicePayment, InvoicePaymentMethod } from '../invoicing/entities/invoice-payment.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Supplier } from '../warehouse/entities/supplier.entity';
import { StockItem } from '../warehouse/entities/stock-item.entity';
import { StockLot } from '../warehouse/entities/stock-lot.entity';
import { StockTransaction, StockTransactionType } from '../warehouse/entities/stock-transaction.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '../warehouse/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../warehouse/entities/purchase-order-item.entity';
import { PosOutlet } from '../pos/entities/pos-outlet.entity';
import { MenuItem } from '../pos/entities/menu-item.entity';
import { PosOrder, PosOrderStatus, PosPaymentMethod } from '../pos/entities/pos-order.entity';
import { PosOrderItem } from '../pos/entities/pos-order-item.entity';
import {
  HousekeepingTask,
  HousekeepingTaskStatus,
} from '../housekeeping/entities/housekeeping-task.entity';

// Yangi ro'yxatdan o'tgan HAR BIR tenant uchun avtomatik ravishda to'ldiriladigan
// namunaviy (demo) ma'lumotlar — foydalanuvchi bo'sh tizimga emas, balki jonli
// misol bilan tanishadi (xonalar, mehmonlar, bronlar turli holatda, ombor,
// POS, hisob-fakturalar). `Tenant.hasSampleData=true` bo'lganda front-end
// "Namunaviy ma'lumotlarni o'chirish" bannerini ko'rsatadi (SampleDataController).
//
// Barcha yozuvlar TO'G'RIDAN-TO'G'RI EntityManager orqali, bitta tranzaksiya
// ichida yaratiladi — TenantsService.createTenantWithDefaultProperty'dagi
// bootstrap naqshiga o'xshab (RLS-himoyalangan repository'lar REQUEST-scope
// bo'lgani va bu yerda haqiqiy HTTP so'rov konteksti bo'lmagani uchun oddiy
// `@InjectRepository` ishlatib bo'lmaydi — buning o'rniga `set_config` bilan
// tranzaksiya boshida `app.tenant_id`ni qo'lda o'rnatamiz).
@Injectable()
export class SampleDataService {
  private readonly logger = new Logger(SampleDataService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async seedForTenant(params: {
    tenantId: string;
    propertyId: string;
    ownerUserId: string;
    currency: string;
  }): Promise<void> {
    const { tenantId, propertyId, ownerUserId, currency } = params;

    await this.dataSource.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);

      const now = new Date();
      const daysFromNow = (n: number): Date => {
        const d = new Date(now);
        d.setDate(d.getDate() + n);
        return d;
      };
      const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

      // --- Xona turlari ---
      const roomTypeRepo = manager.getRepository(RoomType);
      const standard = await roomTypeRepo.save(
        roomTypeRepo.create({
          tenantId,
          propertyId,
          name: 'Standart',
          basePrice: '350000',
          maxOccupancy: 2,
          description: '1-2 kishi uchun qulay, ixcham xona.',
        }),
      );
      const deluxe = await roomTypeRepo.save(
        roomTypeRepo.create({
          tenantId,
          propertyId,
          name: 'Delux',
          basePrice: '550000',
          maxOccupancy: 2,
          description: "Kengroq maydon, shahar manzarasiga qaraydigan darcha.",
        }),
      );
      const suite = await roomTypeRepo.save(
        roomTypeRepo.create({
          tenantId,
          propertyId,
          name: 'Suite',
          basePrice: '950000',
          maxOccupancy: 3,
          description: "Alohida mehmon xonasi, premium jihozlar.",
        }),
      );

      // --- Narx rejalari (bitta xona turiga bitta Rack Rate) ---
      const ratePlanRepo = manager.getRepository(RatePlan);
      const standardRatePlan = await ratePlanRepo.save(
        ratePlanRepo.create({
          tenantId,
          propertyId,
          roomTypeId: standard.id,
          name: 'Rack Rate',
          nightlyPrice: standard.basePrice,
          isRefundable: true,
          isActive: true,
          description: 'Standart, bekor qilinadigan tarif.',
        }),
      );
      const deluxeRatePlan = await ratePlanRepo.save(
        ratePlanRepo.create({
          tenantId,
          propertyId,
          roomTypeId: deluxe.id,
          name: 'Rack Rate',
          nightlyPrice: deluxe.basePrice,
          isRefundable: true,
          isActive: true,
          description: null,
        }),
      );

      // --- Xonalar ---
      const roomRepo = manager.getRepository(Room);
      const room101 = await roomRepo.save(
        roomRepo.create({
          tenantId,
          propertyId,
          roomTypeId: standard.id,
          roomNumber: '101',
          floor: 1,
          status: RoomStatus.OCCUPIED,
          housekeepingStatus: HousekeepingStatus.CLEAN,
        }),
      );
      const room102 = await roomRepo.save(
        roomRepo.create({
          tenantId,
          propertyId,
          roomTypeId: standard.id,
          roomNumber: '102',
          floor: 1,
          status: RoomStatus.AVAILABLE,
          housekeepingStatus: HousekeepingStatus.DIRTY,
        }),
      );
      const room103 = await roomRepo.save(
        roomRepo.create({
          tenantId,
          propertyId,
          roomTypeId: standard.id,
          roomNumber: '103',
          floor: 1,
          status: RoomStatus.AVAILABLE,
          housekeepingStatus: HousekeepingStatus.CLEAN,
        }),
      );
      const room201 = await roomRepo.save(
        roomRepo.create({
          tenantId,
          propertyId,
          roomTypeId: deluxe.id,
          roomNumber: '201',
          floor: 2,
          status: RoomStatus.AVAILABLE,
          housekeepingStatus: HousekeepingStatus.INSPECTED,
        }),
      );
      const room202 = await roomRepo.save(
        roomRepo.create({
          tenantId,
          propertyId,
          roomTypeId: deluxe.id,
          roomNumber: '202',
          floor: 2,
          status: RoomStatus.AVAILABLE,
          housekeepingStatus: HousekeepingStatus.CLEAN,
        }),
      );
      const room301 = await roomRepo.save(
        roomRepo.create({
          tenantId,
          propertyId,
          roomTypeId: suite.id,
          roomNumber: '301',
          floor: 3,
          status: RoomStatus.AVAILABLE,
          housekeepingStatus: HousekeepingStatus.CLEAN,
        }),
      );

      // --- Mehmonlar ---
      const guestRepo = manager.getRepository(Guest);
      const aziz = await guestRepo.save(
        guestRepo.create({
          tenantId,
          fullName: 'Aziz Karimov',
          phone: '+998901234567',
          email: 'aziz.karimov@example.com',
          nationality: "O'zbekiston",
          documentType: 'passport',
          documentNumber: 'AB1234567',
          communicationPreference: CommunicationPreference.EMAIL,
        }),
      );
      const malika = await guestRepo.save(
        guestRepo.create({
          tenantId,
          fullName: 'Malika Yusupova',
          phone: '+998907654321',
          email: 'malika.yusupova@example.com',
          nationality: "O'zbekiston",
          documentType: 'passport',
          documentNumber: 'AC7654321',
          roomPreference: 'Yuqori qavat, tinch xona',
          dietaryPreference: 'Vegetarian',
          communicationPreference: CommunicationPreference.EMAIL,
        }),
      );
      const john = await guestRepo.save(
        guestRepo.create({
          tenantId,
          fullName: 'John Smith',
          phone: '+14155550132',
          email: 'john.smith@example.com',
          nationality: 'USA',
          documentType: 'passport',
          documentNumber: 'US9988776',
          communicationPreference: CommunicationPreference.EMAIL,
        }),
      );
      const elyor = await guestRepo.save(
        guestRepo.create({
          tenantId,
          fullName: 'Elyor Rahimov',
          phone: '+998933451122',
          communicationPreference: CommunicationPreference.SMS,
        }),
      );
      const nodira = await guestRepo.save(
        guestRepo.create({
          tenantId,
          fullName: 'Nodira Aliyeva',
          phone: '+998971122334',
          email: 'nodira.aliyeva@example.com',
          communicationPreference: CommunicationPreference.EMAIL,
        }),
      );

      // --- Bronlar (turli holat/manba — Aziz qaytar mehmon: B (o'tgan) + A (hozir turibdi)) ---
      const bookingRepo = manager.getRepository(Booking);
      const bookingA = await bookingRepo.save(
        bookingRepo.create({
          tenantId,
          propertyId,
          roomId: room101.id,
          guestId: aziz.id,
          checkIn: dateOnly(daysFromNow(-1)),
          checkOut: dateOnly(daysFromNow(2)),
          status: BookingStatus.CHECKED_IN,
          source: BookingSource.DIRECT,
          marketSegment: MarketSegment.CORPORATE,
          ratePlanId: standardRatePlan.id,
          totalAmount: '1050000',
          currency,
        }),
      );
      const bookingB = await bookingRepo.save(
        bookingRepo.create({
          tenantId,
          propertyId,
          roomId: room102.id,
          guestId: aziz.id,
          checkIn: dateOnly(daysFromNow(-6)),
          checkOut: dateOnly(daysFromNow(-4)),
          status: BookingStatus.CHECKED_OUT,
          source: BookingSource.DIRECT,
          marketSegment: MarketSegment.WALK_IN,
          ratePlanId: standardRatePlan.id,
          totalAmount: '700000',
          currency,
        }),
      );
      await bookingRepo.save(
        bookingRepo.create({
          tenantId,
          propertyId,
          roomId: room103.id,
          guestId: nodira.id,
          checkIn: dateOnly(daysFromNow(10)),
          checkOut: dateOnly(daysFromNow(12)),
          status: BookingStatus.CANCELLED,
          source: BookingSource.OTA,
          marketSegment: MarketSegment.OTA,
          totalAmount: '700000',
          currency,
          notes: 'Mehmon bekor qildi (namunaviy yozuv).',
        }),
      );
      const bookingD = await bookingRepo.save(
        bookingRepo.create({
          tenantId,
          propertyId,
          roomId: room201.id,
          guestId: malika.id,
          checkIn: dateOnly(daysFromNow(-10)),
          checkOut: dateOnly(daysFromNow(-8)),
          status: BookingStatus.CHECKED_OUT,
          source: BookingSource.OTA,
          marketSegment: MarketSegment.TRAVEL_AGENT,
          ratePlanId: deluxeRatePlan.id,
          totalAmount: '1155000',
          currency,
        }),
      );
      await bookingRepo.save(
        bookingRepo.create({
          tenantId,
          propertyId,
          roomId: room202.id,
          guestId: john.id,
          checkIn: dateOnly(daysFromNow(3)),
          checkOut: dateOnly(daysFromNow(5)),
          status: BookingStatus.CONFIRMED,
          source: BookingSource.WEBSITE,
          marketSegment: MarketSegment.OTHER,
          totalAmount: '1100000',
          currency,
        }),
      );
      await bookingRepo.save(
        bookingRepo.create({
          tenantId,
          propertyId,
          roomId: room301.id,
          guestId: elyor.id,
          checkIn: dateOnly(daysFromNow(7)),
          checkOut: dateOnly(daysFromNow(9)),
          status: BookingStatus.PENDING,
          source: BookingSource.WEBSITE,
          marketSegment: MarketSegment.OTHER,
          totalAmount: '1900000',
          currency,
          notes: "Jonli bron widget'i orqali kelgan (namunaviy).",
        }),
      );

      // --- Ombor: ombor nuqtasi, ta'minotchi, tovarlar, xarid buyurtmasi, FIFO partiyalar ---
      const warehouseRepo = manager.getRepository(Warehouse);
      const warehouse = await warehouseRepo.save(
        warehouseRepo.create({ tenantId, propertyId, name: 'Asosiy ombor', isDefault: true }),
      );

      const supplierRepo = manager.getRepository(Supplier);
      const supplier = await supplierRepo.save(
        supplierRepo.create({
          tenantId,
          name: "Tashkent Agro Ta'minot MChJ",
          contactPerson: 'Sardor Aliyev',
          phone: '+998712001122',
          email: 'info@tashagro.example.uz',
          address: 'Toshkent sh., Chilonzor tumani',
        }),
      );

      const stockItemRepo = manager.getRepository(StockItem);
      const towel = await stockItemRepo.save(
        stockItemRepo.create({
          tenantId,
          sku: 'LINEN-001',
          name: 'Sochiq (hammom)',
          unit: 'dona',
          category: 'Housekeeping',
          reorderPoint: '20',
        }),
      );
      const water = await stockItemRepo.save(
        stockItemRepo.create({
          tenantId,
          sku: 'BEV-001',
          name: 'Mineral suv 0.5L',
          unit: 'dona',
          category: 'F&B',
          reorderPoint: '50',
        }),
      );
      const rice = await stockItemRepo.save(
        stockItemRepo.create({
          tenantId,
          sku: 'FOOD-001',
          name: 'Osh guruchi',
          unit: 'kg',
          category: 'F&B',
          reorderPoint: '30',
        }),
      );

      const purchaseOrderRepo = manager.getRepository(PurchaseOrder);
      const po = await purchaseOrderRepo.save(
        purchaseOrderRepo.create({
          tenantId,
          propertyId,
          warehouseId: warehouse.id,
          supplierId: supplier.id,
          status: PurchaseOrderStatus.RECEIVED,
          totalAmount: '3850000',
          currency,
          createdByUserId: ownerUserId,
          approvedByUserId: ownerUserId,
          approvedAt: daysFromNow(-5),
        }),
      );
      const purchaseOrderItemRepo = manager.getRepository(PurchaseOrderItem);
      await purchaseOrderItemRepo.save([
        purchaseOrderItemRepo.create({
          purchaseOrderId: po.id,
          stockItemId: towel.id,
          quantityOrdered: '100',
          quantityReceived: '100',
          unitCost: '25000',
        }),
        purchaseOrderItemRepo.create({
          purchaseOrderId: po.id,
          stockItemId: water.id,
          quantityOrdered: '200',
          quantityReceived: '200',
          unitCost: '3000',
        }),
        purchaseOrderItemRepo.create({
          purchaseOrderId: po.id,
          stockItemId: rice.id,
          quantityOrdered: '50',
          quantityReceived: '50',
          unitCost: '15000',
        }),
      ]);

      // FIFO partiyalar — birozi allaqachon "iste'mol qilingan" (qolgan miqdor
      // ba'zilarida reorder point'dan past, kam zaxira ogohlantirishini ko'rsatish uchun).
      const stockLotRepo = manager.getRepository(StockLot);
      await stockLotRepo.save([
        stockLotRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: towel.id,
          purchaseOrderId: po.id,
          quantityReceived: '100',
          quantityRemaining: '15',
          unitCost: '25000',
          receivedAt: daysFromNow(-5),
        }),
        stockLotRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: water.id,
          purchaseOrderId: po.id,
          quantityReceived: '200',
          quantityRemaining: '40',
          unitCost: '3000',
          receivedAt: daysFromNow(-5),
        }),
        stockLotRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: rice.id,
          purchaseOrderId: po.id,
          quantityReceived: '50',
          quantityRemaining: '30',
          unitCost: '15000',
          receivedAt: daysFromNow(-5),
        }),
      ]);

      const stockTxRepo = manager.getRepository(StockTransaction);
      await stockTxRepo.save([
        stockTxRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: towel.id,
          type: StockTransactionType.RECEIPT,
          quantity: '100',
          unitCost: '25000',
          totalCost: '2500000',
          referenceType: 'purchase_order',
          referenceId: po.id,
          createdByUserId: ownerUserId,
        }),
        stockTxRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: water.id,
          type: StockTransactionType.RECEIPT,
          quantity: '200',
          unitCost: '3000',
          totalCost: '600000',
          referenceType: 'purchase_order',
          referenceId: po.id,
          createdByUserId: ownerUserId,
        }),
        stockTxRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: rice.id,
          type: StockTransactionType.RECEIPT,
          quantity: '50',
          unitCost: '15000',
          totalCost: '750000',
          referenceType: 'purchase_order',
          referenceId: po.id,
          createdByUserId: ownerUserId,
        }),
        stockTxRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: towel.id,
          type: StockTransactionType.ISSUE,
          quantity: '85',
          unitCost: '25000',
          totalCost: '2125000',
          referenceType: 'demo',
          createdByUserId: ownerUserId,
          notes: "Namunaviy iste'mol yozuvi.",
        }),
        stockTxRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: water.id,
          type: StockTransactionType.ISSUE,
          quantity: '160',
          unitCost: '3000',
          totalCost: '480000',
          referenceType: 'demo',
          createdByUserId: ownerUserId,
          notes: "Namunaviy iste'mol yozuvi.",
        }),
        stockTxRepo.create({
          tenantId,
          warehouseId: warehouse.id,
          stockItemId: rice.id,
          type: StockTransactionType.ISSUE,
          quantity: '20',
          unitCost: '15000',
          totalCost: '300000',
          referenceType: 'demo',
          createdByUserId: ownerUserId,
          notes: "Namunaviy iste'mol yozuvi.",
        }),
      ]);

      // --- POS: Restoran, menyu, ikkita buyurtma (biri "xona hisobiga") ---
      const posOutletRepo = manager.getRepository(PosOutlet);
      const outlet = await posOutletRepo.save(
        posOutletRepo.create({ tenantId, propertyId, name: 'Restoran', isDefault: true }),
      );

      const menuItemRepo = manager.getRepository(MenuItem);
      const osh = await menuItemRepo.save(
        menuItemRepo.create({ tenantId, name: 'Osh', category: 'Taom', price: '45000' }),
      );
      const choy = await menuItemRepo.save(
        menuItemRepo.create({ tenantId, name: 'Choy (choynak)', category: 'Ichimlik', price: '10000' }),
      );
      const shashlik = await menuItemRepo.save(
        menuItemRepo.create({ tenantId, name: 'Shashlik', category: 'Taom', price: '60000' }),
      );
      const cola = await menuItemRepo.save(
        menuItemRepo.create({ tenantId, name: 'Coca-Cola', category: 'Ichimlik', price: '12000' }),
      );

      const posOrderRepo = manager.getRepository(PosOrder);
      const roomServiceOrder = await posOrderRepo.save(
        posOrderRepo.create({
          tenantId,
          propertyId,
          outletId: outlet.id,
          status: PosOrderStatus.PAID,
          guestId: malika.id,
          bookingId: bookingD.id,
          paymentMethod: PosPaymentMethod.ROOM_ACCOUNT,
          totalAmount: '55000',
          currency,
          createdByUserId: ownerUserId,
          paidAt: daysFromNow(-9),
        }),
      );
      const walkInOrder = await posOrderRepo.save(
        posOrderRepo.create({
          tenantId,
          propertyId,
          outletId: outlet.id,
          status: PosOrderStatus.PAID,
          tableNumber: '4',
          paymentMethod: PosPaymentMethod.CARD,
          totalAmount: '144000',
          currency,
          createdByUserId: ownerUserId,
          paidAt: daysFromNow(-1),
        }),
      );

      const posOrderItemRepo = manager.getRepository(PosOrderItem);
      await posOrderItemRepo.save([
        posOrderItemRepo.create({ orderId: roomServiceOrder.id, menuItemId: osh.id, quantity: 1, unitPrice: '45000' }),
        posOrderItemRepo.create({ orderId: roomServiceOrder.id, menuItemId: choy.id, quantity: 1, unitPrice: '10000' }),
        posOrderItemRepo.create({ orderId: walkInOrder.id, menuItemId: shashlik.id, quantity: 2, unitPrice: '60000' }),
        posOrderItemRepo.create({ orderId: walkInOrder.id, menuItemId: cola.id, quantity: 2, unitPrice: '12000' }),
      ]);

      // --- Hisob-fakturalar (faqat check-in bo'lgan bronlarda — check-in'siz haqiqiy oqim ham shunday) ---
      const invoiceRepo = manager.getRepository(Invoice);
      const invoiceLineRepo = manager.getRepository(InvoiceLine);
      const invoicePaymentRepo = manager.getRepository(InvoicePayment);

      const invoiceA = await invoiceRepo.save(
        invoiceRepo.create({
          tenantId,
          propertyId,
          bookingId: bookingA.id,
          guestId: aziz.id,
          status: InvoiceStatus.OPEN,
          totalAmount: '1050000',
          paidAmount: '0',
          currency,
        }),
      );
      await invoiceLineRepo.save(
        invoiceLineRepo.create({
          invoiceId: invoiceA.id,
          description: 'Xona 101 — 3 kecha',
          source: InvoiceLineSource.ROOM_CHARGE,
          quantity: '3',
          unitPrice: '350000',
          amount: '1050000',
        }),
      );

      const invoiceB = await invoiceRepo.save(
        invoiceRepo.create({
          tenantId,
          propertyId,
          bookingId: bookingB.id,
          guestId: aziz.id,
          status: InvoiceStatus.PAID,
          totalAmount: '700000',
          paidAmount: '700000',
          currency,
          issuedAt: daysFromNow(-4),
        }),
      );
      await invoiceLineRepo.save(
        invoiceLineRepo.create({
          invoiceId: invoiceB.id,
          description: 'Xona 102 — 2 kecha',
          source: InvoiceLineSource.ROOM_CHARGE,
          quantity: '2',
          unitPrice: '350000',
          amount: '700000',
        }),
      );
      await invoicePaymentRepo.save(
        invoicePaymentRepo.create({
          invoiceId: invoiceB.id,
          amount: '700000',
          method: InvoicePaymentMethod.CASH,
          receivedByUserId: ownerUserId,
        }),
      );

      const invoiceD = await invoiceRepo.save(
        invoiceRepo.create({
          tenantId,
          propertyId,
          bookingId: bookingD.id,
          guestId: malika.id,
          status: InvoiceStatus.PAID,
          totalAmount: '1155000',
          paidAmount: '1155000',
          currency,
          issuedAt: daysFromNow(-8),
        }),
      );
      await invoiceLineRepo.save([
        invoiceLineRepo.create({
          invoiceId: invoiceD.id,
          description: 'Xona 201 — 2 kecha',
          source: InvoiceLineSource.ROOM_CHARGE,
          quantity: '2',
          unitPrice: '550000',
          amount: '1100000',
        }),
        invoiceLineRepo.create({
          invoiceId: invoiceD.id,
          description: 'Restoran buyurtmasi (xona hisobiga)',
          source: InvoiceLineSource.POS_ORDER,
          sourceId: roomServiceOrder.id,
          quantity: '1',
          unitPrice: '55000',
          amount: '55000',
        }),
      ]);
      await invoicePaymentRepo.save(
        invoicePaymentRepo.create({
          invoiceId: invoiceD.id,
          amount: '1155000',
          method: InvoicePaymentMethod.CARD,
          receivedByUserId: ownerUserId,
        }),
      );

      // --- Housekeeping: bittasi tozalash kutmoqda, bittasi tekshirilgan ---
      const housekeepingRepo = manager.getRepository(HousekeepingTask);
      await housekeepingRepo.save(
        housekeepingRepo.create({
          tenantId,
          propertyId,
          roomId: room102.id,
          status: HousekeepingTaskStatus.PENDING,
          notes: "Check-out'dan keyin tozalash kutilmoqda.",
        }),
      );
      await housekeepingRepo.save(
        housekeepingRepo.create({
          tenantId,
          propertyId,
          roomId: room201.id,
          status: HousekeepingTaskStatus.INSPECTED,
          assignedToUserId: ownerUserId,
          startedAt: daysFromNow(-8),
          completedAt: daysFromNow(-8),
          inspectedAt: daysFromNow(-8),
          inspectedByUserId: ownerUserId,
        }),
      );

      // --- Loyalty: faqat haqiqatan to'lov qilingan hisob-fakturalar uchun (real formula) ---
      const loyaltyTxRepo = manager.getRepository(LoyaltyTransaction);
      const awardPoints = async (guest: Guest, invoice: Invoice) => {
        const points = pointsForPayment(invoice.paidAmount);
        if (points <= 0) return;
        guest.loyaltyPoints += points;
        guest.lifetimePoints += points;
        guest.loyaltyTier = calculateLoyaltyTier(guest.lifetimePoints);
        await guestRepo.save(guest);
        await loyaltyTxRepo.save(
          loyaltyTxRepo.create({
            guestId: guest.id,
            type: LoyaltyTransactionType.EARN,
            points,
            reason: "To'lov uchun ballar",
            relatedInvoiceId: invoice.id,
          }),
        );
      };
      await awardPoints(aziz, invoiceB);
      await awardPoints(malika, invoiceD);

      await manager.update(Tenant, { id: tenantId }, { hasSampleData: true });
    });

    this.logger.log(`Namunaviy ma'lumotlar yaratildi: tenant ${tenantId}`);
  }

  // "Remove Sample Data" — barcha tranzaksion ma'lumotlarni (bronlar, mehmonlar,
  // hisob-fakturalar, ombor, POS, narx rejalari, loyalty) FK bog'liqligiga mos
  // tartibda o'chiradi, lekin XONA TURLARI/XONALAR TUZILMASINI saqlab qoladi
  // (foydalanuvchi ularni tahrirlashi mumkin — noldan qayta yaratishga hojat yo'q).
  // DIQQAT: bu faqat SampleDataService yaratgan yozuvlar bilan cheklanmaydi — tenant
  // uchun HOZIRDA mavjud BARCHA shu turdagi yozuvlarni o'chiradi (frontend'da foydalanuvchiga
  // aniq ogohlantirish ko'rsatilishi kerak).
  async removeSampleData(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepo.findOneBy({ id: tenantId });
    if (!tenant) throw new NotFoundException('Tenant topilmadi');

    await this.dataSource.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);

      await manager.query(
        `DELETE FROM loyalty_transactions WHERE guest_id IN (SELECT id FROM guests WHERE tenant_id = $1)`,
        [tenantId],
      );
      await manager.query(
        `DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = $1)`,
        [tenantId],
      );
      await manager.query(
        `DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = $1)`,
        [tenantId],
      );
      await manager.query(`DELETE FROM invoices WHERE tenant_id = $1`, [tenantId]);
      await manager.query(
        `DELETE FROM pos_order_items WHERE order_id IN (SELECT id FROM pos_orders WHERE tenant_id = $1)`,
        [tenantId],
      );
      await manager.query(`DELETE FROM pos_orders WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM bookings WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM rate_plans WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM guests WHERE tenant_id = $1`, [tenantId]);
      await manager.query(
        `DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE tenant_id = $1)`,
        [tenantId],
      );
      await manager.query(`DELETE FROM purchase_orders WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM stock_transactions WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM stock_lots WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM stock_items WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM suppliers WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM warehouses WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM pos_outlets WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM menu_items WHERE tenant_id = $1`, [tenantId]);
      await manager.query(`DELETE FROM housekeeping_tasks WHERE tenant_id = $1`, [tenantId]);

      // Xona turlari/xonalar SAQLANADI — faqat bandlik/tozalik holati bo'shatiladi.
      await manager.query(
        `UPDATE rooms SET status = 'available', housekeeping_status = 'clean' WHERE tenant_id = $1`,
        [tenantId],
      );

      await manager.update(Tenant, { id: tenantId }, { hasSampleData: false });
    });

    this.logger.log(`Namunaviy ma'lumotlar o'chirildi: tenant ${tenantId}`);
  }
}
