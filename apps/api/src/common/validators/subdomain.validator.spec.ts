import { checkSubdomain } from './subdomain.validator';

describe('checkSubdomain', () => {
  it('oddiy subdomainni qabul qiladi', () => {
    for (const ok of ['hilton-tashkent', 'anor', 'hotel24', 'my-hotel-1']) {
      expect(checkSubdomain(ok)).toEqual({ ok: true });
    }
  });

  it('band qilingan xizmat nomlarini rad etadi', () => {
    // Ilgari bularning hammasi ochiq ro'yxatdan o'tish orqali
    // egallab olinishi mumkin edi.
    for (const bad of ['www', 'api', 'admin', 'mail', 'staging', 'folioone']) {
      const res = checkSubdomain(bad);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('band qilingan');
    }
  });

  it('formati notogri qiymatlarni rad etadi', () => {
    for (const bad of ['my_hotel', '-hotel', 'hotel-', 'ho tel', 'ho.tel']) {
      expect(checkSubdomain(bad).ok).toBe(false);
    }
  });

  it('katta harfni normallashtirib qabul qiladi', () => {
    // `TenantsService` yozishdan oldin `trim().toLowerCase()` qiladi,
    // shuning uchun validator ham xuddi shu normallashtirilgan qiymatni
    // baholashi kerak — aks holda ikkisi bir-biriga zid bo'lardi.
    expect(checkSubdomain('  Hilton-Tashkent ')).toEqual({ ok: true });
  });

  it('juda qisqa subdomainni rad etadi', () => {
    expect(checkSubdomain('ab').ok).toBe(false);
  });

  it('ketma-ket ikki tireni rad etadi (punycode/homograph)', () => {
    expect(checkSubdomain('xn--80ak6aa92e').ok).toBe(false);
  });

  it('katta harf/probel bilan yozilgan band nomni ham tutadi', () => {
    // Normalizatsiya taqiq tekshiruvidan OLDIN bo'lishi kerak, aks
    // holda ` WWW ` ni yuborib chetlab o'tish mumkin bo'lardi.
    expect(checkSubdomain(' WWW ').ok).toBe(false);
  });

  it("matn bo'lmagan qiymatni rad etadi", () => {
    expect(checkSubdomain(null).ok).toBe(false);
  });
});
