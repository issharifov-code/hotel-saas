import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { GuestDto } from '../lib/types';

export function GuestsPage() {
  const { can } = useAuth();
  const [guests, setGuests] = useState<GuestDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const path = q ? `/guests?search=${encodeURIComponent(q)}` : '/guests';
      setGuests(await apiFetch<GuestDto[]>(path));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(search || undefined), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <AppLayout title="Mehmonlar">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ism, telefon yoki email bo'yicha qidirish..."
          className="input max-w-sm"
        />
        {can('guest_crm', 'create') && (
          <button onClick={() => setShowModal(true)} className="btn-primary shrink-0">
            + Mehmon qo'shish
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {!loading && guests.length === 0 && <p className="p-4 text-sm text-slate-500">Mehmon topilmadi</p>}
        {guests.map((g) => (
          <div key={g.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{g.fullName}</p>
              <p className="text-xs text-slate-500">
                {[g.phone, g.email, g.nationality].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <CreateGuestModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load(search || undefined);
          }}
        />
      )}
    </AppLayout>
  );
}

function CreateGuestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/guests', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          phone: phone || undefined,
          email: email || undefined,
          nationality: nationality || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Yangi mehmon" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">To'liq ism</span>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Telefon</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+998..." />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Fuqarolik</span>
          <input value={nationality} onChange={(e) => setNationality(e.target.value)} className="input" />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Modal>
  );
}
