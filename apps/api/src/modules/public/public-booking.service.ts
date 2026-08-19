import { BadRequestException, Injectable } from '@nestjs/common';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypesService } from '../rooms/room-types.service';
import { RatePlansService } from '../rooms/rate-plans.service';
import { BookingsService } from '../bookings/bookings.service';
import { GuestsService } from '../guests/guests.service';
import { PublicCreateBookingDto } from './dto/public-create-booking.dto';

// OTA komissiyasisiz to'g'ridan-to'g'ri (direct) bron — Mews-uslubidagi
// "Hotel Operating System" strategiyasining asosiy elementlaridan biri
// (arxitektura hujjatidagi "Arxitektura strategiyasi" bo'limiga qarang).
// Bu servis faqat mavjud modullarni (RoomTypes/RatePlans/Bookings/Guests)
// birlashtiradi — yangi jadval/entity kerak emas.
@Injectable()
export class PublicBookingService {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly roomTypesService: RoomTypesService,
    private readonly ratePlansService: RatePlansService,
    private readonly bookingsService: BookingsService,
    private readonly guestsService: GuestsService,
  ) {}

  async listProperties(tenantId: string) {
    const properties = await this.propertiesService.listByTenant(tenantId);
    return properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      currency: p.currency,
    }));
  }

  async getAvailability(
    tenantId: string,
    propertyId: string,
    checkIn: string,
    checkOut: string,
  ) {
    if (!checkIn || !checkOut) {
      throw new BadRequestException('checkIn va checkOut sanalari kerak');
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      throw new BadRequestException(
        "check-out sanasi check-in sanasidan keyin bo'lishi kerak",
      );
    }
    // Property tenant'ga tegishli ekanini tekshiradi (mos kelmasa 404 otadi).
    await this.propertiesService.findById(tenantId, propertyId);

    const roomTypes = await this.roomTypesService.listByProperty(
      tenantId,
      propertyId,
    );

    const results: Array<{
      roomTypeId: string;
      name: string;
      description: string | null;
      maxOccupancy: number;
      availableCount: number;
      nightlyPriceFrom: number;
      ratePlans: Array<{
        id: string;
        name: string;
        nightlyPrice: string;
        isRefundable: boolean;
      }>;
    }> = [];
    for (const roomType of roomTypes) {
      const availableCount =
        await this.bookingsService.countAvailableRoomsOfType(
          tenantId,
          propertyId,
          roomType.id,
          checkIn,
          checkOut,
        );
      if (availableCount === 0) continue;

      const activeRatePlans = (
        await this.ratePlansService.listByProperty(
          tenantId,
          propertyId,
          roomType.id,
        )
      ).filter((rp) => rp.isActive);

      const prices = [
        Number(roomType.basePrice),
        ...activeRatePlans.map((rp) => Number(rp.nightlyPrice)),
      ];
      const nightlyPriceFrom = Math.min(...prices);

      results.push({
        roomTypeId: roomType.id,
        name: roomType.name,
        description: roomType.description,
        maxOccupancy: roomType.maxOccupancy,
        availableCount,
        nightlyPriceFrom,
        ratePlans: activeRatePlans.map((rp) => ({
          id: rp.id,
          name: rp.name,
          nightlyPrice: rp.nightlyPrice,
          isRefundable: rp.isRefundable,
        })),
      });
    }
    return results;
  }

  async createBooking(
    tenantId: string,
    propertyId: string,
    dto: PublicCreateBookingDto,
  ) {
    if (!dto.guestPhone && !dto.guestEmail) {
      throw new BadRequestException(
        'Telefon raqami yoki email manzilidan kamida bittasi kiritilishi shart',
      );
    }

    const property = await this.propertiesService.findById(
      tenantId,
      propertyId,
    );

    const guest = await this.guestsService.findOrCreateForBooking(tenantId, {
      fullName: dto.guestFullName,
      phone: dto.guestPhone ?? null,
      email: dto.guestEmail ?? null,
    });

    const booking = await this.bookingsService.createFromWebsite(
      tenantId,
      propertyId,
      {
        roomTypeId: dto.roomTypeId,
        ratePlanId: dto.ratePlanId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        guestId: guest.id,
        currency: property.currency,
        notes: dto.notes,
      },
    );

    return {
      id: booking.id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      status: booking.status,
    };
  }
}
