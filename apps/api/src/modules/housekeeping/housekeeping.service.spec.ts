import { ConflictException, NotFoundException } from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingTaskStatus } from './entities/housekeeping-task.entity';
import { HousekeepingStatus } from '../rooms/entities/room.entity';

// 🔬 HOUSEKEEPING (2026-09-05).
//
// NIMA UCHUN AYNAN BU FAYL. Qoplama o'lchovida u eng past edi —
// 13.6% (57 ta qoplanmagan qator). Bu mehmonxonaning kundalik
// operatsion o'zagi: xona qachon "toza", qachon "iflos", va kim
// qachon check-in qila oladi.
//
// MANTIQNING QIMMATI. Bu yerdagi har bir metod IKKI JADVALNI birga
// o'zgartiradi: vazifa holati (`housekeeping_tasks`) va xonaning
// tozalik holati (`rooms.housekeeping_status`). Ular bir-biriga mos
// qolishi shart:
//
//   * vazifa "yakunlandi", xona esa hamon "iflos" bo'lib qolsa —
//     check-in bloklanadi va mehmon kutib qoladi;
//   * teskarisi (xona "toza", vazifa hali ochiq) — xona ikki marta
//     tozalanadi yoki tozalanmagan xonaga mehmon kiritiladi.
//
// Holat o'tishlari ham qat'iy: pending -> in_progress -> done ->
// inspected. Har bir o'tishda faqat kutilgan oldingi holat qabul
// qilinadi — aks holda ikki xodim bir vazifani ikki marta "boshlab"
// yuborardi.

interface FakeTask {
  id: string;
  roomId: string;
  status: HousekeepingTaskStatus;
  assignedToUserId: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  inspectedAt?: Date | null;
  inspectedByUserId?: string | null;
  notes?: string | null;
}

const TENANT = 't1';
const PROPERTY = 'p1';

function createService(opts: { task?: FakeTask | null; room?: unknown } = {}) {
  const taskRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(opts.task ?? null),
    findOneBy: jest.fn().mockResolvedValue(opts.task ?? null),
    create: jest.fn((data: unknown) => ({ id: 'yangi', ...(data as object) })),
    save: jest.fn((t: unknown) => Promise.resolve(t)),
  };
  const roomRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(
      opts.room === undefined ? { id: 'r1', housekeepingStatus: HousekeepingStatus.CLEAN } : opts.room,
    ),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const service = new HousekeepingService(taskRepo as never, roomRepo as never);
  return { service, taskRepo, roomRepo };
}

function task(status: HousekeepingTaskStatus, extra: Partial<FakeTask> = {}): FakeTask {
  return { id: 'task-1', roomId: 'r1', status, assignedToUserId: null, ...extra };
}

describe('HousekeepingService — vazifa yaratish', () => {
  it("mavjud bo'lmagan xonaga vazifa ochilmaydi", async () => {
    const { service } = createService({ room: null });
    await expect(
      service.createTask(TENANT, PROPERTY, { roomId: 'yoq' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // 🔴 TAKROR VAZIFA BO'LMASLIGI KERAK. Aks holda bitta xona ro'yxatda
  // ikki marta chiqadi va ikki farrosh bir xonaga yuboriladi.
  it('bir xona uchun ikkinchi kutilayotgan vazifa ochilmaydi', async () => {
    const { service, taskRepo } = createService();
    taskRepo.findOne.mockResolvedValue(task(HousekeepingTaskStatus.PENDING));

    await expect(
      service.createTask(TENANT, PROPERTY, { roomId: 'r1' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(taskRepo.save).not.toHaveBeenCalled();
  });

  it('ochiq vazifa yo\'q bo\'lsa yangisi yaratiladi', async () => {
    const { service, taskRepo } = createService();
    taskRepo.findOne.mockResolvedValue(null);

    await service.createTask(TENANT, PROPERTY, {
      roomId: 'r1',
      assignedToUserId: 'u9',
      notes: 'shoshilinch',
    } as never);

    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r1',
        status: HousekeepingTaskStatus.PENDING,
        assignedToUserId: 'u9',
        notes: 'shoshilinch',
      }),
    );
  });
});

describe('HousekeepingService — holat o\'tishlari', () => {
  it("boshlanganda xona ham \"tozalanmoqda\" bo'ladi", async () => {
    const { service, taskRepo, roomRepo } = createService({ task: task(HousekeepingTaskStatus.PENDING) });

    const result = (await service.start(TENANT, PROPERTY, 'task-1', 'u5')) as unknown as FakeTask;

    expect(result.status).toBe(HousekeepingTaskStatus.IN_PROGRESS);
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(roomRepo.update).toHaveBeenCalledWith(
      { id: 'r1' },
      { housekeepingStatus: HousekeepingStatus.IN_PROGRESS },
    );
    expect(taskRepo.save).toHaveBeenCalled();
  });

  // Vazifa hech kimga biriktirilmagan bo'lsa, uni boshlagan xodim
  // avtomatik mas'ul bo'ladi — kim tozalaganini keyin bilish uchun.
  it("biriktirilmagan vazifani boshlagan xodim mas'ul bo'ladi", async () => {
    const { service } = createService({ task: task(HousekeepingTaskStatus.PENDING) });
    const result = (await service.start(TENANT, PROPERTY, 'task-1', 'u5')) as unknown as FakeTask;
    expect(result.assignedToUserId).toBe('u5');
  });

  it("allaqachon biriktirilgan mas'ul o'zgarmaydi", async () => {
    const { service } = createService({
      task: task(HousekeepingTaskStatus.PENDING, { assignedToUserId: 'u1' }),
    });
    const result = (await service.start(TENANT, PROPERTY, 'task-1', 'u5')) as unknown as FakeTask;
    expect(result.assignedToUserId).toBe('u1');
  });

  // 🔴 IKKI MARTA BOSHLASH MUMKIN EMAS. Ikki xodim bir ro'yxatdan
  // ishlayotganda bu oddiy holat.
  it("boshlangan vazifani qayta boshlab bo'lmaydi", async () => {
    const { service, roomRepo } = createService({ task: task(HousekeepingTaskStatus.IN_PROGRESS) });
    await expect(service.start(TENANT, PROPERTY, 'task-1', 'u5')).rejects.toBeInstanceOf(
      ConflictException,
    );
    // Muhimi: rad etilganda xona holati ham TEGILMAYDI.
    expect(roomRepo.update).not.toHaveBeenCalled();
  });

  it("yakunlanganda xona \"toza\" bo'ladi", async () => {
    const { service, roomRepo } = createService({ task: task(HousekeepingTaskStatus.IN_PROGRESS) });

    const result = (await service.complete(TENANT, PROPERTY, 'task-1')) as unknown as FakeTask;

    expect(result.status).toBe(HousekeepingTaskStatus.DONE);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(roomRepo.update).toHaveBeenCalledWith(
      { id: 'r1' },
      { housekeepingStatus: HousekeepingStatus.CLEAN },
    );
  });

  it("boshlanmagan vazifani yakunlab bo'lmaydi", async () => {
    const { service, roomRepo } = createService({ task: task(HousekeepingTaskStatus.PENDING) });
    await expect(service.complete(TENANT, PROPERTY, 'task-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(roomRepo.update).not.toHaveBeenCalled();
  });

  it("tekshirilganda xona \"tekshirilgan\" bo'ladi va tekshiruvchi yoziladi", async () => {
    const { service, roomRepo } = createService({ task: task(HousekeepingTaskStatus.DONE) });

    const result = (await service.inspect(TENANT, PROPERTY, 'task-1', 'boss')) as unknown as FakeTask;

    expect(result.status).toBe(HousekeepingTaskStatus.INSPECTED);
    expect(result.inspectedByUserId).toBe('boss');
    expect(result.inspectedAt).toBeInstanceOf(Date);
    expect(roomRepo.update).toHaveBeenCalledWith(
      { id: 'r1' },
      { housekeepingStatus: HousekeepingStatus.INSPECTED },
    );
  });

  it("yakunlanmagan vazifani tekshirib bo'lmaydi", async () => {
    const { service } = createService({ task: task(HousekeepingTaskStatus.IN_PROGRESS) });
    await expect(
      service.inspect(TENANT, PROPERTY, 'task-1', 'boss'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ochiq vazifani bekor qilish mumkin', async () => {
    for (const status of [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS]) {
      const { service } = createService({ task: task(status) });
      const result = (await service.cancel(TENANT, PROPERTY, 'task-1')) as unknown as FakeTask;
      expect(result.status).toBe(HousekeepingTaskStatus.CANCELLED);
    }
  });

  // 🔴 YAKUNLANGAN ISHNI BEKOR QILIB BO'LMAYDI. Aks holda xona
  // "toza" bo'lib qolgani holda vazifa "bekor qilingan" bo'lardi —
  // ikkalasi bir-biriga zid.
  it("yakunlangan yoki tekshirilgan vazifani bekor qilib bo'lmaydi", async () => {
    for (const status of [HousekeepingTaskStatus.DONE, HousekeepingTaskStatus.INSPECTED]) {
      const { service } = createService({ task: task(status) });
      await expect(service.cancel(TENANT, PROPERTY, 'task-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    }
  });

  it("mavjud bo'lmagan vazifa uchun aniq xato beriladi", async () => {
    const { service, taskRepo } = createService();
    taskRepo.findOne.mockResolvedValue(null);
    await expect(
      service.findTaskById(TENANT, PROPERTY, 'yoq'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HousekeepingService — check-out va check-in bilan bog\'liqlik', () => {
  // Check-out'dan keyin xona avtomatik "iflos" bo'ladi va tozalash
  // navbatga qo'yiladi — farroshlar ro'yxati o'zi to'ladi.
  it("check-out'dan keyin xona iflos bo'lib, vazifa navbatga qo'yiladi", async () => {
    const { service, taskRepo, roomRepo } = createService();
    taskRepo.findOne.mockResolvedValue(null);

    await service.markDirtyAndQueueTask(TENANT, PROPERTY, 'r1');

    expect(roomRepo.update).toHaveBeenCalledWith(
      { id: 'r1', tenantId: TENANT, propertyId: PROPERTY },
      { housekeepingStatus: HousekeepingStatus.DIRTY },
    );
    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'r1', status: HousekeepingTaskStatus.PENDING }),
    );
  });

  // 🔴 XONA BARIBIR IFLOS BO'LISHI KERAK. Ochiq vazifa bo'lsa
  // IKKINCHISI yaratilmaydi, lekin xona holati baribir yangilanadi —
  // aks holda check-out qilingan xona "toza" bo'lib qolardi.
  it('ochiq vazifa bor bo\'lsa ikkinchisi yaratilmaydi, lekin xona iflos bo\'ladi', async () => {
    const { service, taskRepo, roomRepo } = createService();
    taskRepo.findOne.mockResolvedValue(task(HousekeepingTaskStatus.PENDING));

    await service.markDirtyAndQueueTask(TENANT, PROPERTY, 'r1');

    expect(roomRepo.update).toHaveBeenCalled();
    expect(taskRepo.save).not.toHaveBeenCalled();
  });

  // 🔴 TOZALANMAGAN XONAGA CHECK-IN BLOKLANADI. Bu mehmon ko'radigan
  // eng yomon xatolardan biri: eshikni ochib, oldingi mehmonning
  // izlarini ko'rish.
  it.each([
    [HousekeepingStatus.DIRTY],
    [HousekeepingStatus.IN_PROGRESS],
  ])("%s holatidagi xonaga check-in bloklanadi", async (status) => {
    const { service } = createService({ room: { id: 'r1', housekeepingStatus: status } });
    await expect(
      service.assertRoomCleanForCheckIn(TENANT, PROPERTY, 'r1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    [HousekeepingStatus.CLEAN],
    [HousekeepingStatus.INSPECTED],
  ])('%s holatidagi xonaga check-in ruxsat etiladi', async (status) => {
    const { service } = createService({ room: { id: 'r1', housekeepingStatus: status } });
    await expect(
      service.assertRoomCleanForCheckIn(TENANT, PROPERTY, 'r1'),
    ).resolves.toBeUndefined();
  });

  // Xona topilmasa bu metod jim o'tadi: xona borligini tekshirish
  // uning vazifasi emas (BookingsService allaqachon tekshirgan), va
  // bu yerda xato tashlash check-in'ni ikki marta bloklab qo'yardi.
  it("xona topilmasa check-in'ni bloklamaydi", async () => {
    const { service } = createService({ room: null });
    await expect(
      service.assertRoomCleanForCheckIn(TENANT, PROPERTY, 'yoq'),
    ).resolves.toBeUndefined();
  });
});
