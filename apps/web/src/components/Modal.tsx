import { type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-md',
  icon,
  compact = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  // Sarlavha yonidagi ikonka (2026-09-04) — masalan ogohlantirish uchburchagi.
  // Faqat bezak emas: xabarning TURINI bir qarashda ko'rsatadi, matnni
  // o'qishdan oldin.
  icon?: ReactNode;
  // Ingichkaroq sarlavha qatori — qisqa, bir jumlali oynalar uchun
  // (ogohlantirish, tasdiqlash). Katta formalarda odatiy balandlik qoladi.
  compact?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className={`w-full ${width} rounded-2xl bg-white shadow-xl`}>
        {/* 2026-09-04 (foydalanuvchi fikri): oyna sarlavhasi ham panel
            sarlavhasi kabi biroz to'qroq fonda — `.panel-header` butun
            ilovada bir xil ko'rinish beradi. Padding bu yerda kattaroq
            (`px-5 py-4`), shuning uchun klass ustidan yoziladi. */}
        <div
          className={`panel-header flex items-center justify-between !px-5 ${
            compact ? '!py-2.5' : '!py-4'
          }`}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {icon}
            {title}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
