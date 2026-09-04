import { useRef, useState, type ChangeEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import {
  ACCEPTED_LOGO_TYPES,
  ImageError,
  LOGO_MAX_DIMENSION,
  fileToResizedDataUrl,
} from '../lib/image';

// Mehmonxonaning o'z sozlamalari. Hozircha faqat logotip, lekin bu sahifa
// kelajakdagi mulk sozlamalari (manzil, valyuta, rekvizitlar...) uchun ham
// tabiiy joy. TENANT_SETTINGS ruxsati talab qilinadi — standart rollardan
// faqat Egasi/Bosh menejerda bor.
export function PropertySettingsPage() {
  const { property, can, refresh } = useAuth();
  const canEdit = can('tenant_settings', 'edit');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const logoUrl = property?.logoUrl ?? null;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Bir xil faylni qayta tanlash ham hodisa chiqarishi uchun inputni
    // darhol tozalaymiz.
    e.target.value = '';
    if (!file || !property) return;

    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      await apiFetch(`/properties/${property.id}/logo`, {
        method: 'PUT',
        body: JSON.stringify({ logoUrl: dataUrl }),
      });
      // Yuqori paneldagi belgi darhol yangilanishi uchun — AuthContext
      // property'ni qayta yuklaydi.
      await refresh();
      setSaved(true);
    } catch (err) {
      if (err instanceof ImageError) setError(err.message);
      else if (err instanceof ApiError) setError(err.message);
      else setError('Logotipni saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    if (!property) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await apiFetch(`/properties/${property.id}/logo`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "O'chirishda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Mehmonxona sozlamalari">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        Logotip
      </h2>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 max-w-2xl">
        <div className="flex items-center gap-5">
          {/* Joriy holat — yuqori paneldagi belgi bilan bir xil ko'rinish */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Mehmonxona logotipi" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-bold text-slate-400">
                {(property?.name ?? 'F').trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm text-slate-600">
              {logoUrl
                ? 'Logotip yuqori panelda mehmonxona nomi yonida ko’rsatiladi.'
                : 'Hozircha logotip yuklanmagan — yuqori panelda nomingizning bosh harfi ko’rsatilmoqda.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              PNG, JPEG yoki WebP. Rasm avtomatik ravishda {LOGO_MAX_DIMENSION}px gacha
              kichraytiriladi — shaffof fonli PNG eng yaxshi natija beradi.
            </p>

            {canEdit && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_LOGO_TYPES.join(',')}
                  onChange={handleFile}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                >
                  {saving ? 'Saqlanmoqda...' : logoUrl ? 'Logotipni almashtirish' : 'Logotip yuklash'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={removeLogo}
                    className="btn-secondary"
                  >
                    O'chirish
                  </button>
                )}
                {saved && !saving && (
                  <span className="text-sm text-emerald-700">Saqlandi</span>
                )}
              </div>
            )}

            {!canEdit && (
              <p className="mt-4 text-xs text-slate-500">
                Logotipni o'zgartirish uchun ruxsatingiz yo'q — mehmonxona egasi yoki
                bosh menejeriga murojaat qiling.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
