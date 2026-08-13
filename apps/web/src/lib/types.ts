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

// --- Warehouse (Ombor) ---

export interface StockItemDto {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  unit: string;
  category: string | null;
  reorderPoint: string;
  isActive: boolean;
  createdAt: string;
}

export interface SupplierDto {
  id: string;
  tenantId: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

export interface StockLevelDto {
  stockItemId: string;
  sku: string;
  name: string;
  unit: string;
  reorderPoint: string;
  quantityOnHand: string;
  belowReorderPoint: boolean;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderItemDto {
  id: string;
  purchaseOrderId: string;
  stockItemId: string;
  stockItem?: StockItemDto;
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
}

export interface PurchaseOrderDto {
  id: string;
  tenantId: string;
  propertyId: string;
  warehouseId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  totalAmount: string;
  currency: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  notes: string | null;
  items: PurchaseOrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

// --- POS (Restoran/Bar) ---

export interface MenuItemDto {
  id: string;
  tenantId: string;
  name: string;
  category: string | null;
  price: string;
  isActive: boolean;
  createdAt: string;
}

export type PosOrderStatus = 'open' | 'paid' | 'cancelled';
export type PosPaymentMethod = 'cash' | 'card';

export interface PosOrderItemDto {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem?: MenuItemDto;
  quantity: number;
  unitPrice: string;
  notes: string | null;
}

export interface PosOrderDto {
  id: string;
  tenantId: string;
  propertyId: string;
  outletId: string;
  status: PosOrderStatus;
  tableNumber: string | null;
  guestId: string | null;
  paymentMethod: PosPaymentMethod | null;
  totalAmount: string;
  currency: string;
  createdByUserId: string;
  paidAt: string | null;
  notes: string | null;
  items: PosOrderItemDto[];
  createdAt: string;
  updatedAt: string;
}
