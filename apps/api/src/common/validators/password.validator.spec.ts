import {
  checkPasswordStrength,
  MIN_PASSWORD_LENGTH,
} from './password.validator';

describe('checkPasswordStrength', () => {
  it('kuchli parolni qabul qiladi', () => {
    for (const ok of [
      'Toshkent2026hotel',
      'qora-choy-42-idish',
      'M3hmonxona!Folio',
      'a1b2c3d4e5f6',
    ]) {
      expect(checkPasswordStrength(ok)).toEqual({ ok: true });
    }
  });

  it(`${MIN_PASSWORD_LENGTH} belgidan qisqa parolni rad etadi`, () => {
    // Eski siyosat (@MinLength(8)) aynan shuni o'tkazib yuborardi.
    const res = checkPasswordStrength('Abc12345');
    expect(res.ok).toBe(false);
    expect(res.message).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('faqat harfdan yoki faqat raqamdan iborat parolni rad etadi', () => {
    expect(checkPasswordStrength('abcdefghijkl').ok).toBe(false);
    expect(checkPasswordStrength('758392017465').ok).toBe(false);
  });

  it('eng ommabop parollarni rad etadi', () => {
    for (const bad of ['password123', 'parol1234', 'admin1234', 'welcome123']) {
      expect(checkPasswordStrength(bad).ok).toBe(false);
    }
  });

  it("taqiqlangan asosga raqam qo'shilgan variantni ham rad etadi", () => {
    expect(checkPasswordStrength('password2026').ok).toBe(false);
    expect(checkPasswordStrength('folioone999').ok).toBe(false);
  });

  it('klaviatura ketma-ketligini rad etadi', () => {
    expect(checkPasswordStrength('qwertyuiop12').ok).toBe(false);
    expect(checkPasswordStrength('abc123456789').ok).toBe(false);
    expect(checkPasswordStrength('poiuytrewq99').ok).toBe(false);
  });

  it('bir xil belgi takroridan iborat parolni rad etadi', () => {
    expect(checkPasswordStrength('aaaaaaaaaaaa').ok).toBe(false);
  });

  it("chetlarida bo'sh joyi bor parolni rad etadi", () => {
    expect(checkPasswordStrength(' Toshkent2026 ').ok).toBe(false);
  });

  it('juda uzun parolni rad etadi (bcrypt DoS)', () => {
    expect(checkPasswordStrength('a1'.repeat(200)).ok).toBe(false);
  });

  it("matn bo'lmagan qiymatni rad etadi", () => {
    expect(checkPasswordStrength(undefined).ok).toBe(false);
    expect(checkPasswordStrength(12345678901).ok).toBe(false);
  });
});
