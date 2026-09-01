// Cheksiz o'sadigan ro'yxatlar (invoicing, messaging, night-audit, channel-manager
// sync-logs va h.k.) uchun umumiy sahifalash (pagination) yordamchisi.
//
// `page` — 1-based (birinchi sahifa = 1), `pageSize` — chaqiruvchi controller
// o'zining standart va maksimal qiymatini beradi (masalan xabar loglari uchun
// standart 50, invoyslar uchun 25 va h.k. bo'lishi mumkin).

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination(
  page: string | undefined,
  pageSize: string | undefined,
  defaultPageSize = 50,
  maxPageSize = 200,
): PaginationParams {
  const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const parsedPageSize = Math.min(
    maxPageSize,
    Math.max(
      1,
      parseInt(pageSize ?? String(defaultPageSize), 10) || defaultPageSize,
    ),
  );
  return {
    page: parsedPage,
    pageSize: parsedPageSize,
    skip: (parsedPage - 1) * parsedPageSize,
    take: parsedPageSize,
  };
}
