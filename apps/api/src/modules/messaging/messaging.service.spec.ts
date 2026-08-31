import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import {
  MessageChannel,
  MessageTriggerType,
} from './entities/message-template.entity';
import { MessageStatus } from './entities/message-log.entity';
import { CommunicationPreference } from '../guests/entities/guest.entity';

// MessagingService'ning eng muhim qoidalarini sinaydi: shablon render qilish
// (merge-fieldlar), kanal tanlash (Guest.communicationPreference'dan yoki
// override'dan), aloqa ma'lumoti yo'q bo'lsa xato, va mock adapter orqali
// muvaffaqiyatli/muvaffaqiyatsiz yuborishning log'ga to'g'ri yozilishi.
describe('MessagingService', () => {
  function createService(opts?: {
    guest?: Partial<{
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      communicationPreference: CommunicationPreference;
    }>;
    sendResult?: unknown;
  }) {
    const guest = {
      id: 'g1',
      fullName: 'Aziz Karimov',
      email: 'aziz@example.com',
      phone: '+998901234567',
      communicationPreference: CommunicationPreference.EMAIL,
      ...opts?.guest,
    };
    const templateRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 'tpl-1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    const logRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((x: unknown) =>
        Promise.resolve({ id: 'log-1', ...(x as object) }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };
    const guestRepo = { findOneBy: jest.fn().mockResolvedValue(guest) };
    const bookingRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    const roomRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    const propertyRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'p1', name: 'Test Hotel' }),
    };
    const mockAdapter = {
      provider: 'mock',
      send: jest
        .fn()
        .mockResolvedValue(
          opts?.sendResult ?? { success: true, providerRef: 'MOCK-MSG-abc' },
        ),
    };
    const service = new MessagingService(
      templateRepo as never,
      logRepo as never,
      guestRepo as never,
      bookingRepo as never,
      roomRepo as never,
      propertyRepo as never,
      [mockAdapter],
    );
    return {
      service,
      templateRepo,
      logRepo,
      guestRepo,
      bookingRepo,
      roomRepo,
      propertyRepo,
      mockAdapter,
      guest,
    };
  }

  it('templateId berilmasa va body ham berilmasa BadRequestException tashlaydi', async () => {
    const { service } = createService();
    await expect(
      service.sendMessage('t1', 'p1', { guestId: 'g1' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('mehmon topilmasa NotFoundException tashlaydi', async () => {
    const { service, guestRepo } = createService();
    guestRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.sendMessage('t1', 'p1', { guestId: 'g1', body: 'Salom' }, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it("ad-hoc xabar (templateId'siz) email kanali orqali muvaffaqiyatli yuboriladi va log yoziladi", async () => {
    const { service, logRepo, mockAdapter } = createService();
    const log = await service.sendMessage(
      't1',
      'p1',
      { guestId: 'g1', body: 'Xush kelibsiz!', subject: 'Salom' },
      'u1',
    );
    expect(mockAdapter.send).toHaveBeenCalledWith({
      channel: MessageChannel.EMAIL,
      to: 'aziz@example.com',
      subject: 'Salom',
      body: 'Xush kelibsiz!',
    });
    expect(logRepo.save).toHaveBeenCalled();
    expect(log.status).toBe(MessageStatus.SENT);
  });

  it("mehmon aloqa afzalligi PHONE bo'lsa va channel override berilmasa BadRequestException tashlaydi", async () => {
    const { service } = createService({
      guest: { communicationPreference: CommunicationPreference.PHONE },
    });
    await expect(
      service.sendMessage('t1', 'p1', { guestId: 'g1', body: 'Salom' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it("channel override (SMS) berilsa, mehmon afzalligidan qat'i nazar shu kanal ishlatiladi", async () => {
    const { service, mockAdapter } = createService({
      guest: { communicationPreference: CommunicationPreference.EMAIL },
    });
    await service.sendMessage(
      't1',
      'p1',
      { guestId: 'g1', body: 'Salom', channel: MessageChannel.SMS },
      'u1',
    );
    expect(mockAdapter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: MessageChannel.SMS,
        to: '+998901234567',
      }),
    );
  });

  it("SMS kanali tanlansa-yu, mehmonning telefon raqami bo'lmasa BadRequestException tashlaydi", async () => {
    const { service } = createService({ guest: { phone: null } });
    await expect(
      service.sendMessage(
        't1',
        'p1',
        { guestId: 'g1', body: 'Salom', channel: MessageChannel.SMS },
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("shablon berilsa, {{guestName}}/{{propertyName}} to'g'ri almashtiriladi", async () => {
    const { service, templateRepo, mockAdapter } = createService();
    templateRepo.findOneBy.mockResolvedValue({
      id: 'tpl-1',
      tenantId: 't1',
      propertyId: 'p1',
      name: 'Xush kelibsiz',
      triggerType: MessageTriggerType.CUSTOM,
      channel: MessageChannel.EMAIL,
      subject: 'Salom, {{guestName}}!',
      bodyTemplate: '{{propertyName}}ga xush kelibsiz, {{guestName}}!',
      isActive: true,
    });
    await service.sendMessage(
      't1',
      'p1',
      { guestId: 'g1', templateId: 'tpl-1' },
      'u1',
    );
    expect(mockAdapter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Salom, Aziz Karimov!',
        body: 'Test Hotelga xush kelibsiz, Aziz Karimov!',
      }),
    );
  });

  it('shlyuz muvaffaqiyatsiz javob qaytarsa, log FAILED holatida saqlanadi (xato tashlanmaydi)', async () => {
    const { service, logRepo } = createService({
      sendResult: {
        success: false,
        providerRef: '',
        failureReason: 'email yuborilmadi',
      },
    });
    const log = await service.sendMessage(
      't1',
      'p1',
      { guestId: 'g1', body: 'Salom' },
      'u1',
    );
    expect(log.status).toBe(MessageStatus.FAILED);
    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MessageStatus.FAILED,
        failureReason: 'email yuborilmadi',
      }),
    );
  });
});
