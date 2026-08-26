import { ConflictException, NotFoundException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import {
  MaintenanceTicketPriority,
  MaintenanceTicketStatus,
} from './entities/maintenance-ticket.entity';
import { RoomStatus } from '../rooms/entities/room.entity';

// MaintenanceService'ning eng muhim qoidalarini sinaydi: so'rov ochilganda
// AVAILABLE xonani MAINTENANCE'ga o'tkazishi (lekin OCCUPIED/OUT_OF_ORDER
// xonaga tegmasligi), holat o'tishlarini validatsiya qilishi, va
// hal/bekor qilingach — boshqa ochiq so'rov qolmasa — xonani AVAILABLE'ga
// qaytarishi (Housekeeping'dagi start/complete naqshiga o'xshab).
describe('MaintenanceService', () => {
  function createService(
    room: unknown = { id: 'r1', status: RoomStatus.AVAILABLE },
  ) {
    const ticketRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 't1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const roomRepo = {
      findOneBy: jest.fn().mockResolvedValue(room),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MaintenanceService(
      ticketRepo as never,
      roomRepo as never,
    );
    return { service, ticketRepo, roomRepo };
  }

  const baseDto = { roomId: 'r1', title: 'Konditsioner ishlamayapti' };

  it("so'rov yaratishda default priority MEDIUM, status OPEN qo'yiladi", async () => {
    const { service, ticketRepo } = createService();
    await service.createTicket('t1', 'p1', baseDto, 'u1');
    const createdArg = ticketRepo.create.mock.calls[0][0];
    expect(createdArg.priority).toBe(MaintenanceTicketPriority.MEDIUM);
    expect(createdArg.status).toBe(MaintenanceTicketStatus.OPEN);
    expect(createdArg.reportedByUserId).toBe('u1');
  });

  it("mavjud bo'lmagan xona uchun NotFoundException tashlaydi", async () => {
    const { service, roomRepo } = createService();
    roomRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.createTicket('t1', 'p1', baseDto, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it("so'rov ochilganda AVAILABLE xonani MAINTENANCE'ga o'tkazadi", async () => {
    const { service, roomRepo } = createService({
      id: 'r1',
      status: RoomStatus.AVAILABLE,
    });
    await service.createTicket('t1', 'p1', baseDto, 'u1');
    expect(roomRepo.update).toHaveBeenCalledWith(
      { id: 'r1' },
      { status: RoomStatus.MAINTENANCE },
    );
  });

  it("so'rov ochilganda band (OCCUPIED) xonaning holatiga tegmaydi", async () => {
    const { service, roomRepo } = createService({
      id: 'r1',
      status: RoomStatus.OCCUPIED,
    });
    await service.createTicket('t1', 'p1', baseDto, 'u1');
    expect(roomRepo.update).not.toHaveBeenCalled();
  });

  it("topilmagan so'rov uchun NotFoundException tashlaydi", async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValue(null);
    await expect(
      service.findTicketById('t1', 'p1', 'no-such-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it("faqat OPEN holatidagi so'rovni boshlash mumkin", async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValue({
      id: 't1',
      status: MaintenanceTicketStatus.RESOLVED,
    });
    await expect(service.start('t1', 'p1', 't1', 'u1')).rejects.toThrow(
      ConflictException,
    );
  });

  it("boshlashda assignedToUserId bo'sh bo'lsa, boshlagan xodimga tayinlanadi", async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValue({
      id: 't1',
      status: MaintenanceTicketStatus.OPEN,
      assignedToUserId: null,
    });
    const result = await service.start('t1', 'p1', 't1', 'u1');
    expect(result.assignedToUserId).toBe('u1');
    expect(result.status).toBe(MaintenanceTicketStatus.IN_PROGRESS);
  });

  it("OPEN yoki IN_PROGRESS holatidagi so'rovni hal qilish mumkin", async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValue({
      id: 't1',
      roomId: 'r1',
      status: MaintenanceTicketStatus.IN_PROGRESS,
    });
    const result = await service.resolve('t1', 'p1', 't1', {
      resolutionNotes: "Ta'mirlandi",
    });
    expect(result.status).toBe(MaintenanceTicketStatus.RESOLVED);
    expect(result.resolutionNotes).toBe("Ta'mirlandi");
  });

  it("hal qilingandan so'ng, boshqa ochiq so'rov qolmasa va xona MAINTENANCE bo'lsa, AVAILABLE'ga qaytaradi", async () => {
    const { service, ticketRepo, roomRepo } = createService({
      id: 'r1',
      status: RoomStatus.MAINTENANCE,
    });
    ticketRepo.findOne
      .mockResolvedValueOnce({
        id: 't1',
        roomId: 'r1',
        status: MaintenanceTicketStatus.OPEN,
      }) // findTicketById
      .mockResolvedValueOnce(null); // reopenRoomIfClear — boshqa ochiq so'rov yo'q
    await service.resolve('t1', 'p1', 't1', {});
    expect(roomRepo.update).toHaveBeenCalledWith(
      { id: 'r1' },
      { status: RoomStatus.AVAILABLE },
    );
  });

  it("hal qilingandan so'ng, boshqa ochiq so'rov qolgan bo'lsa xonani qaytarmaydi", async () => {
    const { service, ticketRepo, roomRepo } = createService({
      id: 'r1',
      status: RoomStatus.MAINTENANCE,
    });
    ticketRepo.findOne
      .mockResolvedValueOnce({
        id: 't1',
        roomId: 'r1',
        status: MaintenanceTicketStatus.OPEN,
      })
      .mockResolvedValueOnce({
        id: 't2',
        roomId: 'r1',
        status: MaintenanceTicketStatus.OPEN,
      }); // boshqa ochiq so'rov bor
    await service.resolve('t1', 'p1', 't1', {});
    expect(roomRepo.update).not.toHaveBeenCalled();
  });

  it("RESOLVED holatidagi so'rovni yakunlab bo'lmaydi", async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValue({
      id: 't1',
      roomId: 'r1',
      status: MaintenanceTicketStatus.RESOLVED,
    });
    await expect(service.resolve('t1', 'p1', 't1', {})).rejects.toThrow(
      ConflictException,
    );
  });

  it("OPEN yoki IN_PROGRESS holatidagi so'rovni bekor qilish mumkin", async () => {
    const { service, ticketRepo } = createService({
      id: 'r1',
      status: RoomStatus.AVAILABLE,
    });
    ticketRepo.findOne
      .mockResolvedValueOnce({
        id: 't1',
        roomId: 'r1',
        status: MaintenanceTicketStatus.OPEN,
      })
      .mockResolvedValueOnce(null);
    const result = await service.cancel('t1', 'p1', 't1');
    expect(result.status).toBe(MaintenanceTicketStatus.CANCELLED);
  });

  it("CANCELLED holatidagi so'rovni qayta bekor qilib bo'lmaydi", async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValue({
      id: 't1',
      roomId: 'r1',
      status: MaintenanceTicketStatus.CANCELLED,
    });
    await expect(service.cancel('t1', 'p1', 't1')).rejects.toThrow(
      ConflictException,
    );
  });
});
