export interface RoomTypeDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  basePrice: string;
  maxOccupancy: number;
  description: string | null;
  createdAt: string;
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'out_of_order';

export interface RoomDto {
  id: string;
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  roomType?: RoomTypeDto;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  createdAt: string;
}

export interface GuestDto {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type BookingSource = 'direct' | 'website' | 'ota' | 'exely';

export interface BookingDto {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId: string;
  room?: RoomDto;
  guestId: string;
  guest?: GuestDto;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  source: BookingSource;
  totalAmount: string;
  currency: string;
  externalRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDto {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  currency: string;
  createdAt: string;
}
