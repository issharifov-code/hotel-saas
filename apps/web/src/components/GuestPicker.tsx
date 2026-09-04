import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { GuestDto } from '../lib/types';

export function GuestPicker({
  value,
  onChange,
}: {
  value: GuestDto | null;
  onChange: (guest: GuestDto | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuestDto[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value) return; // tanlangandan keyin qidiruvni to'xtatamiz
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      apiFetch<GuestDto[]>(`/guests?search=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-full border border-slate-300 px-4 py-2 text-sm">
        <div>
          <p className="font-medium text-slate-900">{value.fullName}</p>
          <p className="text-xs text-slate-500">{[value.phone, value.email].filter(Boolean).join(' · ')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery('');
          }}
          className="text-xs text-brand-navy underline"
        >
          O'zgartirish
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Ism, telefon yoki email bo'yicha qidiring..."
        className="input"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((g) => (
            <button
              type="button"
              key={g.id}
              onClick={() => {
                onChange(g);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
            >
              <p className="font-medium text-slate-900">{g.fullName}</p>
              <p className="text-xs text-slate-500">{[g.phone, g.email].filter(Boolean).join(' · ')}</p>
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1 text-xs text-slate-400">Mehmon topilmadi — "Profillarni boshqarish" bo'limidan qo'shing</p>
      )}
    </div>
  );
}
