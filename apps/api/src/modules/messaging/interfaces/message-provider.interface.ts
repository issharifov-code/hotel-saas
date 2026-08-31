import { MessageChannel } from '../entities/message-template.entity';

// Xabar yetkazish provayder adapteri — PaymentGatewayAdapter naqshiga o'xshab
// (adapter pattern). Kelajakda haqiqiy email (masalan SMTP/SendGrid) yoki SMS
// (masalan Eskiz.uz SMS API) provayderi shu interfeysni amalga oshiradi —
// MessagingService provayder tafsilotlaridan mustaqil ishlaydi.
export interface SendMessageRequest {
  channel: MessageChannel;
  to: string; // email manzili yoki telefon raqami
  subject: string | null;
  body: string;
}

export interface SendMessageResult {
  success: boolean;
  providerRef: string;
  failureReason?: string;
}

export interface MessageProviderAdapter {
  readonly provider: string;
  send(request: SendMessageRequest): Promise<SendMessageResult>;
}

// NestJS DI token — MessagingModule shu tokenga ro'yxatdan o'tgan
// adapterlar massivini bog'laydi.
export const MESSAGE_ADAPTERS = 'MESSAGE_ADAPTERS';
