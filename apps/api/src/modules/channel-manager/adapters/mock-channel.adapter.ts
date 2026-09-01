import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ChannelAdapter,
  PushAvailabilityRequest,
  PushAvailabilityResult,
} from '../interfaces/channel-adapter.interface';

// Mock adapter — haqiqiy OTA API hali ulanmagan, shuning uchun hech qanday
// tashqi so'rov yubormaydi, faqat har doim "muvaffaqiyatli" natija qaytaradi
// (Payments/Messaging modullaridagi mock adapter bilan bir xil yondashuv).
@Injectable()
export class MockChannelAdapter implements ChannelAdapter {
  readonly provider = 'mock';

  pushAvailability(
    request: PushAvailabilityRequest,
  ): Promise<PushAvailabilityResult> {
    void request;
    return Promise.resolve({
      success: true,
      providerRef: `MOCK-SYNC-${randomUUID()}`,
    });
  }
}
