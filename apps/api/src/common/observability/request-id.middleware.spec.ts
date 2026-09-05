import {
  normalizeRequestId,
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
} from './request-id.middleware';

describe('normalizeRequestId', () => {
  it("tashqaridan kelgan to'g'ri ID'ni saqlaydi (proksi izi bilan bog'lanish uchun)", () => {
    expect(normalizeRequestId('abc-123_XYZ')).toBe('abc-123_XYZ');
  });

  it('ID berilmasa yangisini yaratadi', () => {
    const id = normalizeRequestId(undefined);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('log injection urinishini rad etadi', () => {
    // Yangi qator belgilari logga soxta qator kiritish imkonini berardi.
    const id = normalizeRequestId('bad\n{"level":"error","msg":"soxta"}');
    expect(id).not.toContain('\n');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("juda uzun yoki noto'g'ri belgili ID'ni rad etadi", () => {
    expect(normalizeRequestId('a'.repeat(65))).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId('id with spaces')).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId(12345)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('RequestIdMiddleware', () => {
  it("so'rovga ID yozadi va javob header'ida qaytaradi", () => {
    const middleware = new RequestIdMiddleware();
    const req = { headers: {} } as never as {
      headers: Record<string, string>;
      requestId?: string;
    };
    const setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(req as never, { setHeader } as never, next);

    expect(req.requestId).toEqual(expect.any(String));
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.requestId);
    expect(next).toHaveBeenCalled();
  });
});
