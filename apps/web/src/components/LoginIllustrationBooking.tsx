// Kirish sahifasi carousel'ining 1-slaydi uchun illyustratsiya — "Bronlar va
// xonalar". `LoginIllustration.tsx` bilan bir xil vizual til (fon blob'lari,
// bulutlar, soya, gul tuvagi, chamadon, Folio One navy/gold palitrasi) —
// faqat markaziy sahna almashtirilgan: xona eshigi/kalit-karta o'rniga bron
// taqvimi kartochkasi.
export function LoginIllustrationBooking({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 440"
      className={className}
      role="img"
      aria-label="Bron taqvimi va xonalar bandligi"
    >
      {/* fon blob'lari */}
      <circle cx="240" cy="210" r="190" fill="#dbe4fb" />
      <circle cx="300" cy="150" r="110" fill="#c9d7f8" opacity="0.55" />

      {/* yer soyasi */}
      <ellipse cx="240" cy="410" rx="150" ry="14" fill="#c3cdea" opacity="0.5" />

      {/* bulut - chap yuqori */}
      <g opacity="0.9">
        <circle cx="70" cy="70" r="18" fill="#ffffff" />
        <circle cx="92" cy="62" r="22" fill="#ffffff" />
        <circle cx="114" cy="72" r="16" fill="#ffffff" />
        <rect x="60" y="70" width="66" height="18" rx="9" fill="#ffffff" />
      </g>
      <g opacity="0.7">
        <circle cx="390" cy="120" r="12" fill="#ffffff" />
        <circle cx="404" cy="115" r="15" fill="#ffffff" />
        <rect x="384" y="118" width="34" height="12" rx="6" fill="#ffffff" />
      </g>

      {/* "band" xona nishonchasi - o'ng yuqorida suzib turibdi */}
      <g transform="translate(378,58)">
        <ellipse cx="0" cy="46" rx="22" ry="6" fill="#c3cdea" opacity="0.5" />
        <rect x="-24" y="-14" width="48" height="48" rx="12" fill="#ffffff" stroke="#0b2a86" strokeWidth="3" />
        <path d="m-11 10 7 7 15-16" stroke="#3fa66b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* bron taqvimi kartochkasi */}
      <g>
        <rect x="150" y="70" width="180" height="300" rx="28" fill="#0b2a86" />
        <rect x="164" y="86" width="152" height="268" rx="20" fill="#ffffff" />

        {/* kalendar sarlavha paneli */}
        <rect x="180" y="102" width="120" height="30" rx="10" fill="#0b2a86" />
        <circle cx="196" cy="117" r="3.2" fill="#ffffff" />
        <circle cx="240" cy="117" r="3.2" fill="#ffffff" />
        <circle cx="284" cy="117" r="3.2" fill="#ffffff" />

        {/* hafta kunlari qatori */}
        <rect x="180" y="140" width="120" height="10" rx="4" fill="#f7f2e8" />

        {/* kun kataklari - 4 qator x 4 ustun */}
        <g>
          {/* 1-qator */}
          <rect x="180" y="160" width="24" height="24" rx="6" fill="#f7f2e8" />
          <rect x="212" y="160" width="24" height="24" rx="6" fill="#d99a2c" />
          <rect x="244" y="160" width="24" height="24" rx="6" fill="#f7f2e8" />
          <rect x="276" y="160" width="24" height="24" rx="6" fill="#f7f2e8" />
          {/* 2-qator */}
          <rect x="180" y="192" width="24" height="24" rx="6" fill="#0b2a86" />
          <rect x="212" y="192" width="24" height="24" rx="6" fill="#0b2a86" />
          <rect x="244" y="192" width="24" height="24" rx="6" fill="#f7f2e8" />
          <rect x="276" y="192" width="24" height="24" rx="6" fill="#dbe4fb" />
          {/* 3-qator */}
          <rect x="180" y="224" width="24" height="24" rx="6" fill="#dbe4fb" />
          <rect x="212" y="224" width="24" height="24" rx="6" fill="#f7f2e8" />
          <rect x="244" y="224" width="24" height="24" rx="6" fill="#0b2a86" />
          <rect x="276" y="224" width="24" height="24" rx="6" fill="#f7f2e8" />
          {/* 4-qator */}
          <rect x="180" y="256" width="24" height="24" rx="6" fill="#f7f2e8" />
          <rect x="212" y="256" width="24" height="24" rx="6" fill="#dbe4fb" />
          <rect x="244" y="256" width="24" height="24" rx="6" fill="#f7f2e8" />
          <rect x="276" y="256" width="24" height="24" rx="6" fill="#d99a2c" />
        </g>

        {/* xona-band belgisi pastda */}
        <rect x="180" y="298" width="120" height="40" rx="14" fill="#f7f2e8" stroke="#c9d7f8" strokeWidth="2" />
        <rect x="192" y="310" width="18" height="16" rx="4" fill="#d99a2c" />
        <rect x="218" y="312" width="70" height="6" rx="3" fill="#c9d7f8" />
        <rect x="218" y="322" width="46" height="6" rx="3" fill="#dbe4fb" />
      </g>

      {/* gul tuvagi - chap pastda */}
      <g transform="translate(52,330)">
        <path d="M -20 60 L 20 60 L 14 20 L -14 20 Z" fill="#0b2a86" />
        <ellipse cx="0" cy="20" rx="16" ry="6" fill="#12358f" />
        <path d="M 0 20 C -10 -10, -34 -8, -30 10 C -20 6, -8 4, 0 20 Z" fill="#3fa66b" />
        <path d="M 0 20 C 10 -14, 36 -10, 32 8 C 22 4, 8 2, 0 20 Z" fill="#4cb87a" />
        <path d="M 0 20 C 0 -16, 4 -18, 4 -18 C 8 -6, 4 8, 0 20 Z" fill="#5fcf8c" />
      </g>

      {/* xodim - taqvimga ishora qilib turibdi */}
      <g transform="translate(96,150)">
        <rect x="14" y="150" width="16" height="70" rx="8" fill="#0b2a86" />
        <rect x="40" y="150" width="16" height="70" rx="8" fill="#12358f" />
        <ellipse cx="22" cy="222" rx="14" ry="7" fill="#d99a2c" />
        <ellipse cx="48" cy="222" rx="14" ry="7" fill="#c98a1f" />

        <rect x="4" y="70" width="64" height="90" rx="26" fill="#1746b5" />

        <circle cx="36" cy="46" r="28" fill="#f4c9a0" />
        <path d="M 8 46 a 28 28 0 0 1 56 0 C 60 22, 12 22, 8 46 Z" fill="#3c2a1e" />
        <circle cx="27" cy="50" r="2.6" fill="#3c2a1e" />
        <circle cx="45" cy="50" r="2.6" fill="#3c2a1e" />
        <path
          d="M 28 61 Q 36 66 44 61"
          stroke="#c9805a"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />

        <path
          d="M 62 96 C 96 92, 116 80, 128 62"
          stroke="#f4c9a0"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* chamadon - o'ng pastda */}
      <g transform="translate(340,320)">
        <rect x="0" y="14" width="56" height="42" rx="8" fill="#12358f" />
        <rect x="18" y="2" width="20" height="14" rx="4" fill="none" stroke="#12358f" strokeWidth="5" />
        <rect x="24" y="30" width="8" height="8" rx="2" fill="#d99a2c" />
      </g>
    </svg>
  );
}
