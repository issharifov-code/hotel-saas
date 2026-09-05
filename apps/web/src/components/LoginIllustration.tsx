// Kirish sahifasi uchun mehmonxona mavzusidagi flat-illyustratsiya (2026-09
// qayta dizayn). Xodim/mehmon kalit-kartani xona eshigi paneliga yaqinlashtirib
// turgan sahna — soft ko'k fon, Folio One brend ranglari (navy/gold) bilan.
export function LoginIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 440"
      className={className}
      role="img"
      aria-label="Mehmonxona xonasiga kalit-karta bilan kirish"
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

      {/* concierge qo'ng'irog'i - o'ng yuqorida suzib turibdi */}
      <g transform="translate(378,60)">
        <ellipse cx="0" cy="46" rx="20" ry="6" fill="#c3cdea" opacity="0.5" />
        <path
          d="M -20 26 C -20 4, -12 -10, 0 -10 C 12 -10, 20 4, 20 26 Z"
          fill="#ffffff"
          stroke="#002385"
          strokeWidth="3"
        />
        <rect x="-26" y="26" width="52" height="8" rx="4" fill="#d99a2c" />
        <circle cx="0" cy="34" r="3.5" fill="#002385" />
        <circle cx="0" cy="-16" r="4" fill="#002385" />
      </g>

      {/* xona eshigi / kalit-karta paneli */}
      <g>
        <rect x="150" y="70" width="180" height="300" rx="28" fill="#0b2a86" />
        <rect x="164" y="86" width="152" height="268" rx="20" fill="#ffffff" />

        {/* mehmon avatari */}
        <circle cx="240" cy="140" r="26" fill="#f4c9a0" />
        <path d="M 214 140 a 26 26 0 0 1 52 0" fill="#3c2a1e" />
        <circle cx="231" cy="144" r="2.4" fill="#3c2a1e" />
        <circle cx="249" cy="144" r="2.4" fill="#3c2a1e" />
        <path
          d="M 232 154 Q 240 159 248 154"
          stroke="#c9805a"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        <rect x="200" y="182" width="80" height="10" rx="5" fill="#dbe4fb" />
        <rect x="212" y="200" width="56" height="8" rx="4" fill="#f7f2e8" />

        {/* kalit-karta uyasi */}
        <rect x="210" y="234" width="60" height="80" rx="12" fill="#f7f2e8" stroke="#c9d7f8" strokeWidth="2" />
        <circle cx="240" cy="264" r="10" fill="#d99a2c" />
        <rect x="236" y="272" width="8" height="24" fill="#d99a2c" />

        <rect x="200" y="332" width="80" height="10" rx="5" fill="#c9d7f8" />
      </g>

      {/* gul tuvagi - chap pastda */}
      <g transform="translate(52,330)">
        <path d="M -20 60 L 20 60 L 14 20 L -14 20 Z" fill="#0b2a86" />
        <ellipse cx="0" cy="20" rx="16" ry="6" fill="#12358f" />
        <path d="M 0 20 C -10 -10, -34 -8, -30 10 C -20 6, -8 4, 0 20 Z" fill="#3fa66b" />
        <path d="M 0 20 C 10 -14, 36 -10, 32 8 C 22 4, 8 2, 0 20 Z" fill="#4cb87a" />
        <path d="M 0 20 C 0 -16, 4 -18, 4 -18 C 8 -6, 4 8, 0 20 Z" fill="#5fcf8c" />
      </g>

      {/* xodim/mehmon - qo'lida kalit-karta bilan */}
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
          d="M 62 96 C 96 90, 118 76, 132 54"
          stroke="#f4c9a0"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
        />

        <g transform="translate(118,20) rotate(28)">
          <rect x="0" y="0" width="70" height="44" rx="8" fill="#d99a2c" />
          <rect x="8" y="8" width="18" height="12" rx="3" fill="#0b2a86" />
          <rect x="8" y="26" width="46" height="4" rx="2" fill="#ffffff" opacity="0.8" />
          <rect x="8" y="34" width="30" height="4" rx="2" fill="#ffffff" opacity="0.6" />
        </g>
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
