import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

// 🔬 XONA RAQAMINING TAKRORLANMASLIGI (2026-09-05, mutatsion sinovda
// topilgan bo'shliq — `rooms.service.ts` uchun umuman spec fayli yo'q edi).
//
// Bir mulkda ikkita "101" xona bo'lishi mumkin emas: butun tizim xonani
// RAQAMI bilan tanidi — front-desk taxtasi, housekeeping ro'yxati,
// hisob-faktura qatori. Ikkita bir xil raqam bo'lsa xodim qaysi biriga
// mehmon joylashtirganini bilmaydi.
//
// Bazada `UNIQUE (property_id, room_number)` indeksi ham bor (ya'ni
// poygada ham himoya bor), lekin ilova darajasidagi tekshiruv
// FOYDALANUVCHIGA TUSHUNARLI xabar beradi — busiz 409 "Bu ma'lumot
// allaqachon mavjud" degan umumiy matn chiqardi.
describe('RoomsService.create — xona raqami', () => {
  function createService(existing: Record<string, unknown> | null) {
    const roomRepo = {
      findOneBy: jest.fn().mockResolvedValue(existing),
      create: jest.fn((d: unknown) => d),
      save: jest.fn((r: unknown) => Promise.resolve({ id: 'r1', ...(r as object) })),
      find: jest.fn().mockResolvedValue([]),
    };
    const roomTypesService = {
      findById: jest.fn().mockResolvedValue({ id: 'rt1', basePrice: '500000' }),
    };
    const service = new RoomsService(roomRepo as never, roomTypesService as never);
    return { service, roomRepo, roomTypesService };
  }

  const dto = { roomNumber: '101', roomTypeId: 'rt1' };

  it("bo'sh raqam bilan yangi xona yaratiladi", async () => {
    const { service, roomRepo } = createService(null);

    await service.create('t1', 'p1', dto as never);

    expect(roomRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ roomNumber: '101', propertyId: 'p1' }),
    );
  });

  // 🔴 ASOSIY QOIDA.
  it("shu mulkda bunday raqam bo'lsa yaratilmaydi", async () => {
    const { service, roomRepo } = createService({ id: 'eski', roomNumber: '101' });

    await expect(service.create('t1', 'p1', dto as never)).rejects.toThrow(
      /allaqachon mavjud/,
    );
    expect(roomRepo.save).not.toHaveBeenCalled();
  });

  it('takrorlanish tekshiruvi aynan shu mulk doirasida qilinadi', async () => {
    const { service, roomRepo } = createService(null);

    await service.create('t1', 'p1', dto as never);

    expect(roomRepo.findOneBy).toHaveBeenCalledWith({
      propertyId: 'p1',
      roomNumber: '101',
    });
  });

  // Xona turi tekshiruvi BIRINCHI bo'lishi kerak — mavjud bo'lmagan
  // turga xona yaratib bo'lmaydi.
  it("mavjud bo'lmagan xona turiga xona yaratilmaydi", async () => {
    const { service, roomTypesService, roomRepo } = createService(null);
    roomTypesService.findById.mockRejectedValue(new NotFoundException('Xona turi topilmadi'));

    await expect(service.create('t1', 'p1', dto as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(roomRepo.save).not.toHaveBeenCalled();
  });
});
