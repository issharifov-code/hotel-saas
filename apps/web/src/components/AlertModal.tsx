import { useEffect, useRef } from 'react';
import { Modal } from './Modal';

// Ogohlantirish uchburchagi. Rangi qahrabo (amber) — qizil "xatolik yuz
// berdi" degan ma'noni berardi, bu yerda esa ish buzilgani yo'q: shunchaki
// bir narsa yetishmayapti.
function WarningIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5 shrink-0 text-amber-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 3.5L2.5 16.5h15L10 3.5z"
      />
      <path strokeLinecap="round" d="M10 8v3.5" />
      <circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Bir tugmali ogohlantirish oynasi (2026-09-04, OPERA Cloud uslubi).
//
// Brauzerning `alert()` funksiyasi ATAYLAB ishlatilmaydi: u sahifani
// bloklaydi, uslubga bo'ysunmaydi va avtomatlashtirilgan testlarni to'xtatib
// qo'yadi. Bu yerda esa oddiy modal — "OK" bosilsa yopiladi.
export function AlertModal({
  title = 'Ogohlantirish',
  message,
  onClose,
}: {
  title?: string;
  message: string;
  onClose: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);

  // Fokus darhol "OK"da: klaviatura bilan ishlayotgan odam Enter bosib
  // yopa olsin (Escape ham pastda).
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-sm"
      icon={<WarningIcon />}
      compact
    >
      <p className="text-sm text-slate-900">{message}</p>
      <div className="mt-5 flex justify-end">
        <button ref={okRef} type="button" onClick={onClose} className="btn-primary px-8">
          OK
        </button>
      </div>
    </Modal>
  );
}
