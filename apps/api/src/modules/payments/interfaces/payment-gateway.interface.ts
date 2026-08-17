// To'lov shlyuzi adapter interfeysi. Har bir haqiqiy provayder (Payme, Click,
// va h.k.) kelajakda shu interfeysni amalga oshiradi — PaymentsService
// provayderning ichki tafsilotlaridan mustaqil ishlaydi (adapter pattern).
export interface ChargeRequest {
  amount: string; // '150000.00' — hisob-faktura valyutasida
  currency: string;
  invoiceId: string;
  description: string;
}

export interface ChargeResult {
  success: boolean;
  providerRef: string;
  failureReason?: string;
}

export interface PaymentGatewayAdapter {
  readonly provider: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

// NestJS DI uchun token — PaymentsModule shu tokenga barcha ro'yxatdan
// o'tgan adapterlar massivini bog'laydi (PaymentsService shulardan birini
// so'ralgan provider nomiga qarab tanlaydi).
export const PAYMENT_ADAPTERS = 'PAYMENT_ADAPTERS';
