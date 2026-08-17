import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ChargeRequest,
  ChargeResult,
  PaymentGatewayAdapter,
} from '../interfaces/payment-gateway.interface';

// Mock adapter — haqiqiy to'lov shlyuzi (Payme/Click) hali ulanmagan, shuning
// uchun bu adapter har doim "muvaffaqiyatli" natija qaytaradi (real karta
// ma'lumotlari hech qachon so'ralmaydi yoki saqlanmaydi). Bu SaaS Billing
// modulida qabul qilingan "mock/qo'lda tasdiqlash" yondashuvi bilan izchil.
//
// Kelajakda Payme/Click ulanganda, xuddi shu PaymentGatewayAdapter
// interfeysini amalga oshiruvchi yangi adapter yozib, PaymentsModule'ga
// ro'yxatdan o'tkazish kifoya — PaymentsService yoki chaqiruvchi kod
// o'zgarishga muhtoj emas.
@Injectable()
export class MockPaymentAdapter implements PaymentGatewayAdapter {
  readonly provider = 'mock';

  charge(request: ChargeRequest): Promise<ChargeResult> {
    void request;
    return Promise.resolve({
      success: true,
      providerRef: `MOCK-${randomUUID()}`,
    });
  }
}
