import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

// 🔬 SAHIFALASH (2026-09-05).
//
// Kichik komponent, lekin OLTI sahifada ishlatiladi (invoyslar, xabar
// jurnali, tungi audit tarixi, kanal sinxronlash jurnali, mehmon
// ro'yxatga olish hisoboti). Chegara hisoblari (birinchi/oxirgi sahifa,
// to'liq bo'lmagan oxirgi sahifa) shu yerda bir marta yozilgan — ya'ni
// bu yerdagi bitta xato hamma joyda bir vaqtda ko'rinadi.

function setup(props: Partial<React.ComponentProps<typeof Pagination>> = {}) {
  const onPageChange = vi.fn();
  const utils = render(
    <Pagination page={1} pageSize={10} total={35} onPageChange={onPageChange} {...props} />,
  );
  return { onPageChange, ...utils };
}

// 📌 QAYD (mutatsion tekshiruv, 2026-09-05). Komponentdagi
// `Math.max(1, Math.ceil(total / pageSize))` dagi `Math.max` ni olib
// tashlasa ham testlar yashil qoladi — va bu TEST KAMCHILIGI EMAS:
// u faqat `total === 0` da farq qilardi, o'sha holat esa bir qator
// yuqorida `return null` bilan allaqachon tugagan. Ya'ni himoya
// ataylab ortiqcha (kelajakda erta qaytish olib tashlansa, nol bilan
// bo'lish natijasi ko'rinmasin uchun). Boshqa uchta mutatsiya —
// `Math.min` ni olib tashlash, "Keyingi" cheklovini ochish, bo'sh
// ro'yxatda ham chizish — testlarni yiqitadi.

describe('Pagination', () => {
  it("bo'sh ro'yxatda umuman chiqmaydi", () => {
    const { container } = setup({ total: 0 });
    expect(container).toBeEmptyDOMElement();
  });

  it('joriy oraliqni va jamini ko\'rsatadi', () => {
    setup({ page: 2, pageSize: 10, total: 35 });
    expect(screen.getByText('11–20 / jami 35')).toBeInTheDocument();
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
  });

  // 🔴 OXIRGI SAHIFA TO'LIQ BO'LMASLIGI MUMKIN. `Math.min` bo'lmasa
  // "31–40 / jami 35" chiqardi — mavjud bo'lmagan yozuvlar.
  it("to'liq bo'lmagan oxirgi sahifada oraliq jamidan oshmaydi", () => {
    setup({ page: 4, pageSize: 10, total: 35 });
    expect(screen.getByText('31–35 / jami 35')).toBeInTheDocument();
  });

  it('birinchi sahifada "Oldingi" o\'chirilgan', () => {
    setup({ page: 1 });
    expect(screen.getByRole('button', { name: 'Oldingi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keyingi' })).toBeEnabled();
  });

  it('oxirgi sahifada "Keyingi" o\'chirilgan', () => {
    setup({ page: 4, pageSize: 10, total: 35 });
    expect(screen.getByRole('button', { name: 'Keyingi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Oldingi' })).toBeEnabled();
  });

  // Bitta sahifalik ro'yxatda ikkala tugma ham o'chirilgan bo'lishi kerak —
  // aks holda foydalanuvchi bo'sh sahifaga o'tib qolardi.
  it("bitta sahifada ikkala tugma ham o'chirilgan", () => {
    setup({ page: 1, pageSize: 10, total: 5 });
    expect(screen.getByRole('button', { name: 'Oldingi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keyingi' })).toBeDisabled();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('tugmalar keyingi/oldingi sahifa raqamini uzatadi', async () => {
    const { onPageChange } = setup({ page: 2 });
    await userEvent.click(screen.getByRole('button', { name: 'Keyingi' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Oldingi' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('sahifa hajmi jamidan katta bo\'lsa ham bitta sahifa chiqadi', () => {
    setup({ page: 1, pageSize: 50, total: 3 });
    expect(screen.getByText('1–3 / jami 3')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });
});
