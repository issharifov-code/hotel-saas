import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { COUNTRIES, countryName } from '../lib/countries';

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="9" cy="9" r="6" />
      <path strokeLinecap="round" d="M13.5 13.5L17 17" />
    </svg>
  );
}

// Davlat tanlash (2026-09-04, OPERA Cloud "Search and Select Country"
// referensi). Maydonning o'zi ERKIN yoziladigan bo'lib qoladi — reception
// "UZ" deb tez yozib ketishi mumkin; lupa esa kodini eslay olmaganlar uchun.
//
// Saqlanadigan qiymat — ISO kodi ("UZ"), ko'rsatiladigan qiymat esa nomi.
// Bazada nom emas, kod turgani muhim: nom tili o'zgarishi mumkin, kod yo'q.
export function CountryPicker({
  value,
  onChange,
  placeholder = 'masalan: UZ',
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input"
          placeholder={placeholder}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          // `shrink-0` — uzun ro'yxatli grid ichida ikonka siqilib ketmasin.
          className="shrink-0 rounded-full border border-slate-300 bg-white p-2 text-brand-navy transition-colors hover:bg-slate-50 disabled:opacity-40"
          aria-label="Davlatlar ro'yxatidan tanlash"
          title="Davlatlar ro'yxati"
        >
          <SearchIcon />
        </button>
      </div>
      {/* Tanlangan kodning nomi — foydalanuvchi "UZ" to'g'ri kod ekanini
          darhol ko'rsin (noto'g'ri kodda hech narsa chiqmaydi). */}
      {value.trim() !== '' && countryName(value) !== value.toUpperCase() && (
        <p className="mt-1 text-[11px] text-slate-500">{countryName(value)}</p>
      )}
      {open && (
        <CountryModal
          onClose={() => setOpen(false)}
          onSelect={(code) => {
            onChange(code);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function CountryModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (code: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  // Qidiruv KOD bo'yicha ham, NOM bo'yicha ham ishlaydi: "UZ" ham,
  // "o'zbek" ham topilsin. Diakritik/apostrof farqlarini yengish uchun
  // apostroflar tashlab yuboriladi ("Oʻzbekiston" -> "ozbekiston").
  const norm = (s: string) =>
    s.toLowerCase().replace(/[ʻʼ'’‘`]/g, '');

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => norm(c.name).includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Modal title="Davlatni qidirish va tanlash" onClose={onClose} width="max-w-lg">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input mb-3"
        placeholder="Nomi yoki kodi..."
      />
      <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200">
        <div className="sticky top-0 grid grid-cols-[60px_1fr] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Kod</span>
          <span>Nomi</span>
        </div>
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-500">Davlat topilmadi</p>
        )}
        {filtered.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setSelected(c.code)}
            // Ikki bosqichli tanlov (belgilash -> "Tanlash") ataylab OPERA
            // uslubida: bitta bosishda yopilib ketsa, tasodifiy bosishda
            // noto'g'ri davlat tushib qolardi.
            onDoubleClick={() => onSelect(c.code)}
            className={`grid w-full grid-cols-[60px_1fr] gap-2 px-3 py-2 text-left text-sm ${
              selected === c.code
                ? 'bg-brand-navy-light text-brand-navy'
                : 'text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="text-slate-500">{c.code}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          Bekor qilish
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          className="btn-primary"
        >
          Tanlash
        </button>
      </div>
    </Modal>
  );
}
