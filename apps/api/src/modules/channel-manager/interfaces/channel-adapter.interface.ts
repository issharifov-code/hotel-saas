import { Channel } from '../entities/channel.entity';

// Kanal (OTA) adapteri — MessageProviderAdapter/PaymentGatewayAdapter bilan
// bir xil adapter naqshi. Kelajakda haqiqiy OTA API (masalan Booking.com
// Connectivity API) ulanganda, shu interfeysni amalga oshiruvchi yangi
// adapter yozib, ChannelManagerModule'ga ro'yxatdan o'tkazish kifoya —
// ChannelManagerService yoki boshqa hech qanday kodga tegilmaydi.

export interface ChannelAvailabilityDay {
  date: string; // YYYY-MM-DD
  externalRoomTypeId: string;
  availableRooms: number;
  price: string;
}

export interface PushAvailabilityRequest {
  channel: Channel;
  days: ChannelAvailabilityDay[];
}

export interface PushAvailabilityResult {
  success: boolean;
  providerRef: string;
  failureReason?: string;
}

export interface ChannelAdapter {
  readonly provider: string;
  pushAvailability(
    request: PushAvailabilityRequest,
  ): Promise<PushAvailabilityResult>;
}

// NestJS DI token — ChannelManagerModule shu tokenga ro'yxatdan o'tgan
// adapterlar massivini bog'laydi.
export const CHANNEL_ADAPTERS = 'CHANNEL_ADAPTERS';
