// Sahifalash (pagination) uchun kichik, qayta ishlatiladigan komponent —
// invoyslar, xabar loglari, night-audit tarixi, channel-manager sinxronlash
// loglari va mehmon ro'yxatga olish hisobotida bir xil ko'rinish/xatti-harakat
// uchun ishlatiladi.

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-1 py-3 text-xs text-slate-500">
      <span>
        {rangeStart}–{rangeEnd} / jami {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
        >
          Oldingi
        </button>
        <span className="text-slate-600">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}
