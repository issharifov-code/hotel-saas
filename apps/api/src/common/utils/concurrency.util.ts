// Ketma-ket (sequential) `for...await` tsikllarini — har bir elementda alohida
// so'rov/yozuv bo'lgan, lekin bir-biriga bog'liq bo'lmagan hollarda — cheklangan
// parallellik bilan almashtirish uchun umumiy yordamchi. Cheksiz `Promise.all`
// o'rniga (bu DB ulanish poolini katta ro'yxatlarda sarflab yuborishi mumkin)
// `limit` soniga teng "worker" oqimlari ishlatiladi — har biri navbatdagi
// bo'sh elementni oladi, natijalar boshlang'ich tartibda saqlanadi.
//
// Masalan: Night Audit'da no-show bronlarni qayta ishlash (har biri o'z
// hisob-fakturasini yozadi, bir-biriga bog'liq emas) avval to'liq ketma-ket
// bo'lgan — katta mehmonxonada bu kunni yopish jarayonini sekinlashtirardi.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;

  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}
