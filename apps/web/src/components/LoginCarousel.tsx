import { useEffect, useRef, useState, type ReactNode } from 'react';

// Kirish sahifasining chap panelidagi (illyustratsiya + sarlavha + izoh)
// bloki uchun avtomatik aylanadigan slayder (2026-09). Talablar:
// - har 7 soniyada (6-8s oralig'ida) avtomatik keyingi slaydga o'tadi;
// - sichqoncha ustida yoki fokusda (nuqta tugmalaridan biriga) turganda
//   avtoplay to'xtaydi;
// - `prefers-reduced-motion: reduce` bo'lsa avtoplay umuman ishga
//   tushirilmaydi (foydalanuvchi baribir nuqtalar orqali qo'lda o'tkaza oladi);
// - pastda 3 ta nuqta-indikator, ular orqali istalgan slaydga to'g'ridan-to'g'ri
//   o'tish mumkin — faol nuqta boshqalardan sezilarli kattaroq/uzunroq, bosish
//   mumkinligi aniq ko'rinishi uchun;
// - illyustratsiya va matn orasida yumshoq fade + yengil pastdan-yuqoriga
//   siljish (`folio-carousel-fade`, `index.css`da).
export interface LoginCarouselSlide {
  illustration: ReactNode;
  title: string;
  desc: string;
}

const AUTOPLAY_INTERVAL_MS = 7000;
const FADE_MS = 480;

export function LoginCarousel({ slides }: { slides: LoginCarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, reducedMotion, slides.length]);

  const active = slides[index];

  return (
    <div
      className="flex flex-col items-center gap-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        key={index}
        className="flex flex-col items-center gap-8"
        style={{
          animation: reducedMotion ? undefined : `folio-carousel-fade ${FADE_MS}ms ease-out`,
        }}
      >
        <div className="flex h-64 w-64 items-center justify-center">{active.illustration}</div>
        <div className="min-h-[104px] max-w-sm space-y-2 text-center">
          <h2 className="text-2xl font-semibold leading-tight text-brand-navy">{active.title}</h2>
          <p className="text-sm text-slate-500">{active.desc}</p>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="flex items-center gap-2" role="tablist" aria-label="Slaydlar">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}-slayd: ${s.title}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 ${
                i === index ? 'w-9 bg-brand-navy' : 'w-2.5 bg-brand-navy/25 hover:bg-brand-navy/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
