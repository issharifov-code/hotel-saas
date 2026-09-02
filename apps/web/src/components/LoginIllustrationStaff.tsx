// Kirish sahifasi carousel'ining 3-slaydi uchun illyustratsiya — "Xodimlar va
// nazorat". `LoginIllustration.tsx` bilan bir xil vizual til (fon blob'lari,
// bulutlar, soya, gul tuvagi, chamadon, Folio One navy/gold palitrasi) —
// markaziy sahna: ruxsat-qalqon (shield) va vazifalar ro'yxati (checklist)
// bilan ikkita xodim.
export function LoginIllustrationStaff({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 440"
      className={className}
      role="img"
      aria-label="Xodimlar uchun ruxsatlar va vazifalar nazorati"
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

      {/* ruxsat-qalqon - o'ng yuqorida suzib turibdi */}
      <g transform="translate(378,58)">
        <ellipse cx="0" cy="50" rx="22" ry="6" fill="#c3cdea" opacity="0.5" />
        <path
          d="M 0 -14 L 22 -4 C 22 18, 14 34, 0 42 C -14 34, -22 18, -22 -4 Z"
          fill="#ffffff"
          stroke="#0b2a86"
          strokeWidth="3"
        />
        <path d="m-9 12 6 6 13-14" stroke="#e0a237" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* markaziy panel - vazifalar/ruxsatlar kartochkasi */}
      <g>
        <rect x="150" y="70" width="180" height="300" rx="28" fill="#0b2a86" />
        <rect x="164" y="86" width="152" height="268" rx="20" fill="#ffffff" />

        {/* katta qalqon (ruxsatlar) */}
        <g transform="translate(240,150)">
          <path
            d="M 0 -34 L 34 -20 C 34 12, 22 40, 0 54 C -22 40, -34 12, -34 -20 Z"
            fill="#eef2fd"
            stroke="#c9d7f8"
            strokeWidth="2"
          />
          <path
            d="M -14 6 L -3 18 L 18 -8"
            stroke="#3fa66b"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* vazifalar ro'yxati (checklist) */}
        <g>
          <rect x="188" y="228" width="104" height="16" rx="5" fill="#f4f6fd" />
          <circle cx="198" cy="236" r="5" fill="#3fa66b" />
          <path d="m195.5 236 2 2 4-4.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x="212" y="233" width="70" height="6" rx="3" fill="#c9d7f8" />

          <rect x="188" y="252" width="104" height="16" rx="5" fill="#f4f6fd" />
          <circle cx="198" cy="260" r="5" fill="#3fa66b" />
          <path d="m195.5 260 2 2 4-4.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x="212" y="257" width="56" height="6" rx="3" fill="#c9d7f8" />

          <rect x="188" y="276" width="104" height="16" rx="5" fill="#f4f6fd" />
          <circle cx="198" cy="284" r="5" fill="none" stroke="#e0a237" strokeWidth="2" />
          <rect x="212" y="281" width="64" height="6" rx="3" fill="#dbe4fb" />
        </g>

        {/* rol yorlig'i pastda */}
        <rect x="188" y="308" width="104" height="30" rx="14" fill="#eef2fd" stroke="#c9d7f8" strokeWidth="2" />
        <circle cx="206" cy="323" r="8" fill="#e0a237" />
        <rect x="222" y="318" width="58" height="6" rx="3" fill="#c9d7f8" />
        <rect x="222" y="328" width="40" height="5" rx="2.5" fill="#dbe4fb" />
      </g>

      {/* gul tuvagi - chap pastda */}
      <g transform="translate(52,330)">
        <path d="M -20 60 L 20 60 L 14 20 L -14 20 Z" fill="#0b2a86" />
        <ellipse cx="0" cy="20" rx="16" ry="6" fill="#12358f" />
        <path d="M 0 20 C -10 -10, -34 -8, -30 10 C -20 6, -8 4, 0 20 Z" fill="#3fa66b" />
        <path d="M 0 20 C 10 -14, 36 -10, 32 8 C 22 4, 8 2, 0 20 Z" fill="#4cb87a" />
        <path d="M 0 20 C 0 -16, 4 -18, 4 -18 C 8 -6, 4 8, 0 20 Z" fill="#5fcf8c" />
      </g>

      {/* ikkinchi xodim - chapda, planshet bilan */}
      <g transform="translate(90,146)">
        <rect x="14" y="154" width="16" height="70" rx="8" fill="#0b2a86" />
        <rect x="40" y="154" width="16" height="70" rx="8" fill="#12358f" />
        <ellipse cx="22" cy="226" rx="14" ry="7" fill="#e0a237" />
        <ellipse cx="48" cy="226" rx="14" ry="7" fill="#c98a1f" />

        <rect x="4" y="74" width="64" height="90" rx="26" fill="#1746b5" />

        <circle cx="36" cy="50" r="28" fill="#f4c9a0" />
        <path d="M 8 50 a 28 28 0 0 1 56 0 C 60 26, 12 26, 8 50 Z" fill="#3c2a1e" />
        <circle cx="27" cy="54" r="2.6" fill="#3c2a1e" />
        <circle cx="45" cy="54" r="2.6" fill="#3c2a1e" />
        <path
          d="M 28 65 Q 36 70 44 65"
          stroke="#c9805a"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* planshet/klipbord qo'lida */}
        <g transform="translate(56,96) rotate(-10)">
          <rect x="0" y="0" width="34" height="46" rx="6" fill="#ffffff" stroke="#0b2a86" strokeWidth="3" />
          <rect x="7" y="9" width="20" height="4" rx="2" fill="#c9d7f8" />
          <rect x="7" y="18" width="20" height="4" rx="2" fill="#c9d7f8" />
          <rect x="7" y="27" width="14" height="4" rx="2" fill="#e0a237" />
        </g>
      </g>

      {/* chamadon - o'ng pastda */}
      <g transform="translate(340,320)">
        <rect x="0" y="14" width="56" height="42" rx="8" fill="#12358f" />
        <rect x="18" y="2" width="20" height="14" rx="4" fill="none" stroke="#12358f" strokeWidth="5" />
        <rect x="24" y="30" width="8" height="8" rx="2" fill="#e0a237" />
      </g>
    </svg>
  );
}
