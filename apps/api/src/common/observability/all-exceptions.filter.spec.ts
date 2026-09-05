import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  function createHost(overrides: Record<string, unknown> = {}) {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = {
      requestId: 'req-abc-123',
      method: 'POST',
      originalUrl: '/api/bookings',
      user: { userId: 'u1', tenantId: 't1', isPlatformAdmin: false },
      ...overrides,
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status }),
      }),
    };
    return { host, status, json };
  }

  function createFilter() {
    const errorEvents = { record: jest.fn().mockResolvedValue('e1') };
    return {
      filter: new AllExceptionsFilter(errorEvents as never),
      errorEvents,
    };
  }

  it("4xx xabarini o'zgartirmaydi (u foydalanuvchiga mo'ljallangan)", () => {
    const { filter } = createFilter();
    const { host, status, json } = createHost();

    filter.catch(new BadRequestException("Sana noto'g'ri"), host as never);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Sana noto'g'ri",
        requestId: 'req-abc-123',
      }),
    );
  });

  it('4xx ni bazaga YOZMAYDI — ular kutilgan holat', () => {
    const { filter, errorEvents } = createFilter();
    const { host } = createHost();

    filter.catch(new ForbiddenException("Ruxsat yo'q"), host as never);
    filter.catch(new NotFoundException('Topilmadi'), host as never);

    expect(errorEvents.record).not.toHaveBeenCalled();
  });

  it('5xx da ichki xabarni mijozga OSHKOR QILMAYDI', () => {
    const { filter } = createFilter();
    const { host, status, json } = createHost();

    filter.catch(
      new Error('relation "bookings" does not exist at line 42'),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(500);
    const body = (json.mock.calls as unknown[][])[0][0] as {
      message: string;
    };
    // Jadval nomi, SQL matni yoki fayl yo'li chiqmasligi SHART.
    expect(body.message).not.toContain('bookings');
    expect(body.message).not.toContain('relation');
    expect(body.message).toContain("so'rov raqamini");
  });

  it("5xx da so'rov ID javobda qaytadi (foydalanuvchi aytishi uchun)", () => {
    const { filter } = createFilter();
    const { host, json } = createHost();

    filter.catch(new Error('ichki xato'), host as never);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-abc-123' }),
    );
  });

  it("5xx ni to'liq kontekst bilan bazaga yozadi", () => {
    const { filter, errorEvents } = createFilter();
    const { host } = createHost();

    filter.catch(new TypeError('x is undefined'), host as never);

    expect(errorEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-abc-123',
        statusCode: 500,
        method: 'POST',
        path: '/api/bookings',
        tenantId: 't1',
        userId: 'u1',
        name: 'TypeError',
        message: 'x is undefined',
      }),
    );
  });

  it("autentifikatsiyasiz so'rovda ham ishlaydi (user yo'q)", () => {
    const { filter, errorEvents } = createFilter();
    const { host, status } = createHost({ user: undefined });

    filter.catch(new Error('ichki xato'), host as never);

    expect(status).toHaveBeenCalledWith(500);
    expect(errorEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: null, userId: null }),
    );
  });

  it('500 qaytaradigan HttpException ham ichki tafsilotni yashiradi', () => {
    const { filter } = createFilter();
    const { host, json } = createHost();

    // Ba'zi kutubxonalar 5xx HttpException uloqtiradi — ularning
    // xabari ham mijozga mo'ljallanmagan.
    filter.catch(
      new (class extends Error {
        getStatus() {
          return 503;
        }
      })(),
      host as never,
    );

    const body = (json.mock.calls as unknown[][])[0][0] as {
      message: string;
    };
    expect(body.message).toContain("so'rov raqamini");
  });
});
