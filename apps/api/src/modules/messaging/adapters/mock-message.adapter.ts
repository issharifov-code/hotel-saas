import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MessageProviderAdapter,
  SendMessageRequest,
  SendMessageResult,
} from '../interfaces/message-provider.interface';

// Mock adapter — haqiqiy email/SMS provayder hali ulanmagan, shuning uchun
// hech qanday tashqi so'rov yubormaydi, faqat har doim "muvaffaqiyatli"
// natija qaytaradi (Payments modulidagi MockPaymentAdapter bilan bir xil
// yondashuv). Kelajakda haqiqiy provayder ulanganda, xuddi shu
// MessageProviderAdapter interfeysini amalga oshiruvchi yangi adapter yozib,
// MessagingModule'ga ro'yxatdan o'tkazish kifoya.
@Injectable()
export class MockMessageAdapter implements MessageProviderAdapter {
  readonly provider = 'mock';

  send(request: SendMessageRequest): Promise<SendMessageResult> {
    void request;
    return Promise.resolve({
      success: true,
      providerRef: `MOCK-MSG-${randomUUID()}`,
    });
  }
}
