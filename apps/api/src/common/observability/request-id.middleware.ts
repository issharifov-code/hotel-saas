import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

// 📊 KUZATUV (2026-09-05). Ilgari production'da xato yuz berganda uni
// izlashning yagona yo'li Render loglarini vaqt bo'yicha ko'z bilan
// aralashtirish edi: bir necha so'rov bir vaqtda ishlaydi, ularning
// loglari aralashib ketadi, va foydalanuvchi "soat 3 larda xato chiqdi"
// deganda qaysi qatorlar aynan o'sha so'rovga tegishli ekanini aniqlash
// mumkin emasdi.
//
// So'rov ID — shu muammoning standart yechimi. Har bir so'rov o'z
// identifikatorini oladi; u LOGGA, XATO JAVOBIGA va `error_events`
// jadvaliga tushadi. Natijada foydalanuvchi ekrandagi qisqa kodni aytsa
// (yoki skrinshot yuborsa), o'sha so'rovning butun izi topiladi.
//
// Tashqaridan kelgan `x-request-id` ATAYLAB saqlanadi: Render yoki
// oldinda turgan boshqa proksi o'z ID'sini bersa, ikkala tomonning izi
// bir xil kalit bilan bog'lanadi. Lekin qiymat ISHONCHSIZ — uni mijoz
// ham yuborishi mumkin — shuning uchun formati qat'iy tekshiriladi
// (aks holda log qatorlariga yolg'on ID yoki yangi qator belgilari
// (log injection) kiritilishi mumkin edi).

export const REQUEST_ID_HEADER = 'x-request-id';

// Faqat harf, raqam, tire va pastki chiziq; ko'pi bilan 64 belgi.
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface RequestWithId extends Request {
  requestId?: string;
}

export function normalizeRequestId(raw: unknown): string {
  if (typeof raw === 'string' && SAFE_REQUEST_ID.test(raw)) return raw;
  return randomUUID();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const id = normalizeRequestId(req.headers[REQUEST_ID_HEADER]);
    req.requestId = id;
    // Javobga ham qo'shiladi — brauzer DevTools'da yoki `curl -i` bilan
    // ko'rinadi, ya'ni xato javob tanasi bo'lmagan holatlarda ham
    // (masalan 502) izni ushlab qolish mumkin.
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
