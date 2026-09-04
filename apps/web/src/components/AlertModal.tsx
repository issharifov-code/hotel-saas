import { useEffect, useRef } from 'react';
import { Modal } from './Modal';

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
    <Modal title={title} onClose={onClose} width="max-w-sm">
      <p className="text-sm text-slate-900">{message}</p>
      <div className="mt-5 flex justify-end">
        <button ref={okRef} type="button" onClick={onClose} className="btn-primary px-8">
          OK
        </button>
      </div>
    </Modal>
  );
}
