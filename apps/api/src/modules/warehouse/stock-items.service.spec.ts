import { ConflictException } from '@nestjs/common';
import { StockItemsService } from './stock-items.service';

// 🔬 SKU TAKRORLANMASLIGI (2026-09-05, mutatsion sinovda topilgan
// bo'shliq — bu servis uchun umuman spec fayli yo'q edi).
//
// SKU — tovarning tizimdagi yagona kaliti: xarid buyurtmasi, ombor
// partiyalari (FIFO), inventarizatsiya va tannarx hisobi hammasi shu
// orqali bog'lanadi. Ikkita bir xil SKU bo'lsa, xodim qaysi tovarni
// buyurtma qilayotganini bilmaydi va FIFO tannarxi ikki qatorga
// bo'linib ketadi.
//
// Bazada `UNIQUE (tenant_id, sku)` indeksi ham bor (poygada himoya),
// lekin ilova tekshiruvi FOYDALANUVCHIGA tushunarli xabar beradi.
describe('StockItemsService.create — SKU takrorlanmasligi', () => {
  function createService(existing: Record<string, unknown> | null) {
    const stockItemRepo = {
      findOneBy: jest.fn().mockResolvedValue(existing),
      create: jest.fn((d: unknown) => d),
      save: jest.fn((x: unknown) => Promise.resolve({ id: 'si1', ...(x as object) })),
    };
    return { service: new StockItemsService(stockItemRepo as never), stockItemRepo };
  }

  const dto = { sku: 'SOCHIQ-01', name: 'Sochiq', unit: 'dona' };

  it('yangi SKU bilan tovar yaratiladi', async () => {
    const { service, stockItemRepo } = createService(null);

    await service.create('t1', dto as never);

    expect(stockItemRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'SOCHIQ-01', tenantId: 't1' }),
    );
  });

  it('takrorlangan SKU rad etiladi', async () => {
    const { service, stockItemRepo } = createService({ id: 'eski', sku: 'SOCHIQ-01' });

    await expect(service.create('t1', dto as never)).rejects.toThrow(
      /allaqachon mavjud/,
    );
    expect(stockItemRepo.save).not.toHaveBeenCalled();
  });

  // Tekshiruv TENANT doirasida bo'lishi shart — boshqa mehmonxonada
  // xuddi shu SKU bo'lishi mumkin va bu to'sqinlik qilmasligi kerak.
  it('takrorlanish tekshiruvi tenant doirasida qilinadi', async () => {
    const { service, stockItemRepo } = createService(null);

    await service.create('t1', dto as never);

    expect(stockItemRepo.findOneBy).toHaveBeenCalledWith({
      tenantId: 't1',
      sku: 'SOCHIQ-01',
    });
  });
});
