import { type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className={`w-full ${width} rounded-2xl bg-white shadow-xl`}>
        {/* 2026-09-04 (foydalanuvchi fikri): oyna sarlavhasi ham panel
            sarlavhasi kabi biroz to'qroq fonda — `.panel-header` butun
            ilovada bir xil ko'rinish beradi. Padding bu yerda kattaroq
            (`px-5 py-4`), shuning uchun klass ustidan yoziladi. */}
        <div className="panel-header flex items-center justify-between !px-5 !py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
