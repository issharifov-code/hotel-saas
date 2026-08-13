import { FindOperator, IsNull } from 'typeorm';

// TypeORM 1.x'da findOneBy/findBy'ga to'g'ridan-to'g'ri `null` berib bo'lmaydi
// (bu xato deb hisoblanadi) — IS NULL shartini ifodalash uchun IsNull() operatoridan
// foydalanish kerak. Bu funksiya shu konversiyani soddalashtiradi:
// nullable(tenantId) -> tenantId qiymati yoki IsNull()
export function nullable<T extends string>(value: T | null): T | FindOperator<T> {
  return value === null ? IsNull() : value;
}
