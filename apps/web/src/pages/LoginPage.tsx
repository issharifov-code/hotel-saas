import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type LoginResult, type TenantOption } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import folioOneLogo from '../assets/folio-one-logo.png';
import folioOneLogoFull from '../assets/folio-one-logo-full.png';
import { LoginIllustration } from '../components/LoginIllustration';
import { LoginIllustrationBooking } from '../components/LoginIllustrationBooking';
import { LoginIllustrationStaff } from '../components/LoginIllustrationStaff';
import { LoginCarousel, type LoginCarouselSlide } from '../components/LoginCarousel';
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_COUNTRY_ISO2,
  PRIORITY_ISO2,
  countryFlagEmoji,
} from '../lib/countryDialCodes';

// Login sahifasi qayta dizayni (2026-09): split-screen (chap — yengil/och fon
// ustida illyustratsiya va xususiyatlar ro'yxati, o'ng — forma), Subdomain
// maydoni olib tashlandi (tenant email orqali avtomatik aniqlanadi —
// AuthContext.login), "Parolni unutdingizmi?" (interim: administratorga
// murojaat), "Demo so'rash" sahifa ichidagi forma, footer.
//
// 2026-09-01: sodda/yengil (soft-illustration) uslubga yangilandi — och ko'k
// fon, yumaloq (pill) input/tugmalar, ikonkali maydonlar. Global `.input` /
// `.btn-primary` klasslariga tegilmadi (ular butun ilova bo'ylab ishlatiladi);
// bu yerdagi pill uslubi to'liq mustaqil Tailwind util klasslari bilan
// yozilgan, shu sahifaga xos.
//
// 2026-09-02: chap paneldagi statik illyustratsiya+xususiyatlar ro'yxati
// avtomatik aylanadigan 3-slaydli carousel'ga (`LoginCarousel`) almashtirildi
// — har bir slayd o'z illyustratsiyasi bilan (bron taqvimi / front desk /
// xodimlar-ruxsatlar). Batafsil xatti-harakat `LoginCarousel.tsx`da.
//
// 2026-09-02 (polish): foydalanuvchi fikr-mulohazasi asosida yana bir tur
// tuzatish — (1) chap panel carousel endi logotipdan keyingi bo'sh joyda
// vertikal markazlashtirilgan (avvalgi `justify-between` ortiqcha bo'sh joy
// qoldirardi), (2) "Parolni unutdingizmi?" havolasi parol maydoni OSTIGA
// ko'chirildi (label bilan bir qatorda zichlik muammosi bor edi), (3) email
// maydoniga misol placeholder qo'shildi, (4) "Ro'yxatdan o'ting" (matn havola)
// va "Demo so'rash" (endi yengil outline tugma) vizual jihatdan aniq
// ajratildi, (5) ikki marta takrorlangan copyright — chap paneldagisi olib
// tashlandi, faqat umumiy footer'dagisi qoldi, (6) accessibility: parol
// ko'rsatish/yashirish tugmasi, "Meni tizimda saqlab qol" checkbox'i (haqiqiy
// ta'sir bilan — localStorage vs sessionStorage, qarang `lib/api.ts`), xato
// xabari uchun `role="alert"`/`aria-live` va maydonlarda `aria-invalid`, (7)
// F1 logotipi atrofidagi ortiqcha oq to'rtburchak (`bg-white p-1 shadow-sm`)
// olib tashlandi — logotip fayli o'zi shaffof, alohida oq fon shart emas edi.
//
// 2026-09-02 (2-tur polish, qo'lda chizilgan skrinshot izohlari asosida):
// (1) logotip foydalanuvchi bergan to'liq lockup (`folio-one-logo-full.png`,
// F1 belgisi + "Folio One" so'zi bitta rasmda) bilan almashtirildi — endi
// alohida `<span>Folio One</span>` matni kerak emas (faqat LoginPage'da;
// AppLayout/AdminPage'dagi kichik ikonka-versiyasi o'zgarmadi), (2) "Meni
// tizimda saqlab qol" → "Meni tizimda eslab qol", (3) "Ro'yxatdan o'ting" →
// "Ro'yxatdan o'tish", (4) shu havola bilan "Demo so'rash" tugmasi orasiga
// kichik "yoki" matni qo'shildi, (5)-(6) 2- va 3-slayd tavsiflari:
// "Tez check-in/out..." → "Tezkor check-in/out...", "...real-time
// hisobotlar" → "...real vaqt hisobotlari" (inglizcha so'z o'rniga o'zbekcha).
//
// 2026-09-02 (3-tur polish): (1) logotip kattalashtirildi (h-10→h-11, ~10%)
// va chap panelda gorizontal markazlashtirildi (`self-start`→`self-center`),
// (2) "Meni tizimda eslab qol" checkbox qatoriga qo'shimcha bo'sh joy
// (`pt-2.5`, ~10px) — parol maydoni ostidagi "Parolni unutdingizmi?"dan
// nafas olishi uchun, (3) "yoki" endi ikki ingichka gorizontal chiziq
// orasida (divider uslubi) ko'rsatiladi. Carousel'ning o'zidagi tuzatishlar
// (`LoginCarousel.tsx`): faol nuqta-indikator sezilarli kattaroq (w-9,
// avvalgi w-6), crossfade yumshoqroq va sekinroq (480ms, avvalgi 350ms) +
// yengil pastdan-yuqoriga siljish qo'shildi (`index.css`dagi
// `folio-carousel-fade`).
//
// 2026-09-02 (4-tur, qo'lda chizilgan skrinshot izohi asosida): logotip
// endi chap (ko'k) panel ichida emas — ikki panelni (ko'k va oq fon)
// "bog'lovchi" element sifatida ularning chegarasi (seam) ustida, gorizontal
// markazda, mutlaq pozitsiyalangan holda ko'rsatiladi (faqat md+ ekranlarda —
// mobil'da panellar ustma-ust joylashgani uchun chegara yo'q, mobil header
// logotipi o'zgarishsiz qoldi). Shu bilan birga biroz kattalashtirildi
// (h-11→h-14, ~27%). Logotip endi oq fonli (bg-white), yumaloq burchakli,
// yengil soyali qutichada — chegaraning ko'k tomonida ham aniq o'qilishi
// uchun (shaffof logotip to'g'ridan-to'g'ri ko'k fon ustida past kontrastli
// edi).
//
// 2026-09-02 (5-tur): panellar chegarasidagi "bog'lovchi" logotip qutisi
// olib tashlandi (OPERA Cloud/Oracle Hospitality'dagi kabi — asosiy ekranda
// katta logotip emas, faqat FOOTER'da kichik logotip + brend nomi
// ko'rsatiladi). Kichik ikonka-versiya (`folio-one-logo.png`, AppLayout'da
// ishlatiladigan xuddi o'sha fayl) endi umumiy footer'da "Folio One" matni
// bilan yonma-yon, copyright qatoridan oldin ko'rsatiladi.
//
// 2026-09-02 (6-tur, keng qamrovli visual/UX polish — qayta dizayn EMAS,
// authentication/carousel/link/button xatti-harakati o'zgarmadi):
// (1) Layout: chap carousel guruhi (illyustratsiya+sarlavha+dots) ichki
// bo'shlig'i ixchamlashtirildi (gap-8→gap-6, LoginCarousel.tsx), o'ng forma
// blokidagi ba'zi bo'shliqlar ozroq siqildi (subtitle mb-6→mb-5, ro'yxatdan
// o'tish qatori mt-5→mt-4) — ortiqcha vertikal bo'shliqni kamaytirish uchun.
// Ikki panel atrofiga border/card qo'shilmadi (fon farqi yetarli).
// (2) Copy: checkbox matni "Meni tizimda saqlab qol"dan farqli ravishda
// "Tizimda eslab qolish"ga, 3-slayd tavsifidagi "tasklari"→"vazifalari"ga
// o'zgartirildi. Checkbox qatoridagi qo'shimcha `pt-2.5` (3-turda qo'shilgan)
// olib tashlandi — endi barcha forma elementlari orasidagi bo'shliq
// `space-y-4` orqali izchil. "yoki" divider chiziqlari yanada ochroq
// (bg-slate-200→bg-slate-100).
// (3) Input/tipografiya: pill inputlar balandligi ~54px'ga oshirildi
// (py-2.5→py-4, standart matn+border bilan 52-56px oralig'ida), fokus
// halqasi ring-1→ring-2 (hamon navy, 2px chegarada), placeholder
// kontrasti oshirildi (slate-400→500). Label'lar font-medium→font-semibold.
// "Parolni unutdingizmi?" matni text-xs→text-sm (havolalar uchun min. 14px
// talabiga mos). Subtitle/footer matn kontrasti biroz oshirildi
// (slate-500→600 / slate-400→500).
// (4) Footer: sahifa wrapper `min-h-screen`dan `min-h-[100dvh]`ga
// o'tkazildi, footer'ga `shrink-0` qo'shildi (`position: fixed` ishlatilmadi
// — flex-column + flex-1 asosiy kontent orqali footer tabiiy ravishda
// pastda turadi). Footer'dagi "Folio One" matni endi bosilanadigan havola —
// `folioone.uz` saytiga yangi tabda ochiladi (`target="_blank"`,
// `rel="noopener noreferrer"`).
// (5) Responsive: mobil'da endi kichik logotipdan keyin ixcham "compact"
// carousel hero ko'rsatiladi (`LoginCarousel compact` — illyustratsiyasiz,
// faqat sarlavha/tavsif/dots, `LoginCarousel.tsx`dagi yangi `compact` prop
// orqali) — carousel matni endi mobil'da ham forma tepasida ko'rinadi,
// avtoplay/pauza/reduced-motion xatti-harakati o'zgarishsiz.
//
// 2026-09-02 (7-tur — faqat logo/footer/input focus, sahifa qayta
// ishlanmadi): (1) O'ng forma panelida "Xush kelibsiz!" sarlavhasi ustiga
// kichik F1 belgi (icon-only, `folio-one-logo.png`) qo'shildi — oq
// fonli, yengil soyali kvadrat badge ichida, gorizontal markazda, HAR
// IKKALA breakpoint'da (avvalgi mobil'ga xos to'liq lockup logotip
// (`folio-one-logo-full.png`) shu badge bilan almashtirildi — mobil
// compact carousel hero o'zgarishsiz qoldi, faqat undan keyingi logotip
// almashdi). Badge dekorativ (`aria-hidden`), CTA'dan ko'ra kichik/yengil.
// (2) Footer: markazdan chapga (`md:justify-start`, `md:pl-16`) o'tkazildi
// (mobil'da hamon markazlashgan va kerak bo'lsa ikki qatorga wrap
// bo'ladi); F1 ikonka o'lchami kattalashtirildi (h-4→h-5, ~20px);
// havola matni endi faqat ikonkaning o'zida (`aria-label` bilan), qo'shni
// oddiy matn "© {yil} Folio One — barcha huquqlar himoyalangan" ko'rinishida
// birlashtirildi — havola xatti-harakati (`folioone.uz`, yangi tab)
// o'zgarishsiz saqlandi.
// (3) Input focus: fokus halqasi yumshatildi — `ring-brand-navy` (to'liq
// tiniqlik) o'rniga `ring-brand-navy/20` (juda yengil halqa), chegara
// `border-brand-navy/70` (avvalgi to'liq to'q navy o'rniga nozikroq).
// Xato holati ham ozroq yumshatildi (`ring-rose-400`→`ring-rose-300`),
// lekin normal fokusdan hamon aniqroq ajralib turadi. Barcha pill
// inputlarga `hover:` (chegara ozgina to'qlashadi) va `disabled:`
// (kulrang fon, kursor, xiralik) holatlari ham qo'shildi — normal/hover/
// fokus/xato/disabled endi bir-biridan vizual jihatdan aniq ajraladi.
//
// 2026-09-02 (8-tur — logo asset va mobil carousel): (1) `folio-one-logo.png`
// asset foydalanuvchi yuborgan yuqori sifatli F1 belgisi (rasmning faqat
// ikonka qismi, matnsiz, kvadrat canvas'ga markazlashtirilgan) bilan
// almashtirildi — avvalgi versiya kichik o'lchamda (28px) yaxshi
// o'qilmasligi sababli. Login panel badge'i ham kattalashtirildi
// (kontainer h-11→h-14 (~56px), ikonka h-7→h-9 (~36px)) — footer'dagi
// logotip o'lchami o'zgarishsiz qoldi (h-5, ~20px), chunki foydalanuvchi
// faqat login panel badge'i haqida fikr bildirgan edi. (2) Mobil versiyadagi
// ixcham carousel-hero (`compact` LoginCarousel) butunlay olib tashlandi —
// endi mobil'da login formasi F1 badge va sarlavhadan boshlanadi, aylanuvchi
// slayder ko'rsatilmaydi. Desktop'dagi chap panel carousel'i o'zgarishsiz.
// `LoginCarousel`ning `compact` prop'i komponentda saqlanib qoldi (kelajakda
// kerak bo'lishi mumkin), lekin hozircha hech qayerda ishlatilmaydi.
//
// 2026-09-03: foydalanuvchi aniqladi — badge'da faqat F1 belgisi emas, aynan
// o'zi bergan to'liq logotip (F1 belgisi + ostida "FolioOne" yozuvi bitta
// rasmda) ko'rsatilishi kerak edi. Kvadrat oq badge qutisi (h-14 w-14,
// icon-only) olib tashlandi, o'rniga to'liq lockup rasmi (`folio-one-logo-full.png`,
// asl fayldan faqat tashqi shaffof bo'shliq kesilgan holda) to'g'ridan-to'g'ri,
// konteynersiz, h-16 balandlikda ko'rsatiladi. Bu fayl faqat login badge'ida
// ishlatiladi — footer'dagi kichik icon-only logotip (`folio-one-logo.png`,
// "Folio One" havola matni bilan yonma-yon) o'zgarishsiz qoldi.
//
// 2026-09-03 (2-tur, kechroq): (1) badge logotipi biroz yuqoriga ko'chirildi
// (`-mt-4`, o'lchami o'zgarishsiz, h-16) — foydalanuvchi qo'lda chizilgan
// izohli skrinshot yubordi. (2) "Demo so'rash" formasi konversiya uchun
// qayta ishlandi: forma ichiga sarlavha ("Demo so'rash") va tavsif matni
// qo'shildi; forma ochilganda undan yuqoridagi "Ro'yxatdan o'tish / yoki /
// Demo so'rash" bloki yashiriladi (aks holda foydalanuvchi bir xil action
// ichida turib yana o'sha action tugmasini ko'rar edi); "Ismingiz" →
// "Ism va familiyangiz"; "Telefon" → "Telefon raqamingiz", endi qulflangan
// "+998" prefiksi bilan (foydalanuvchi faqat qolgan raqamlarni kiritadi,
// submit'da birlashtiriladi); B2B lead'ni saralash uchun yangi ixtiyoriy
// "Xonalar soni" tanlov maydoni qo'shildi (1–20/21–50/51–100/100+) — bu
// maydon uchun backend'da yangi ustun ochilmadi, allaqachon mavjud bo'lgan
// ixtiyoriy `DemoRequest.note` maydoniga "Xonalar soni: ..." shaklida
// yoziladi; "Bekor qilish" → "Ortga qaytish", "Yuborish" → "Demo so'rovini
// yuborish"; tugmalar mobil'da ustma-ust (`flex-col sm:flex-row`); kichik
// maxfiylik matni qo'shildi; muvaffaqiyat xabari "So'rovingiz qabul
// qilindi. Tez orada siz bilan bog'lanamiz."ga yangilandi.
//
// 2026-09-03 (3-tur — desktop layout/scroll va demo-flow tuzatish, batafsil
// yozma spec asosida): (1) Demo-flow endi to'liq almashtiruv: "Demo so'rash"
// bosilganda login formasi (email/parol/checkbox/"Kirish"/"Parolni
// unutdingizmi?"/ro'yxatdan o'tish/"yoki"/"Demo so'rash" tugmasi) BUTUNLAY
// yashiriladi, o'rniga FAQAT demo forma ko'rinadi (avval ikkalasi bir vaqtda
// ko'rinardi — demo forma login formaning tagiga qo'shilardi). "Ortga
// qaytish" login state'ga qaytaradi. `DemoRequestForm`ning o'zi endi mustaqil
// sarlavha+tavsif chiqaradi ("Demo so'rash" / "Jamoamiz siz bilan
// bog'lanib..."), login h1/p bilan bir xil o'lcham/joylashuv iyerarxiyasida
// — ilgarigi kichik ichki-karta uslubi (rounded-2xl border bg-slate-50/60
// karta, h2 text-base) olib tashlandi. (2) Desktop scroll: sahifa endi
// `md:h-[100dvh] md:overflow-hidden` — global (body-darajasidagi) vertikal
// scroll md+ ekranlarda umuman paydo bo'lmaydi; qator (`flex md:flex-row`)
// `md:min-h-0` bilan; chap carousel paneli `md:overflow-hidden` (hech qachon
// scroll bo'lmaydi, ichki kontent avtoplay/illyustratsiya o'zgarishsiz
// vertikal markazlashgan turadi); o'ng panel `md:overflow-y-auto
// md:min-h-0` — demo forma (yoki uzun xato xabarlari) viewport balandligiga
// sig'masagina FAQAT shu panel ichida scroll paydo bo'ladi, chap panel va
// footer joyida qoladi. Markazlashgan kontent flexbox `items-center`/
// `justify-center` o'rniga `mx-auto`/`md:my-auto` (margin:auto) orqali
// markazlashtiriladi — bu ba'zi brauzerlarda `align-items:center` +
// `overflow:auto` birgalikda ishlatilganda kontentning yuqori qismi scroll
// orqali ko'rinmay qolishi mumkin bo'lgan mashhur flexbox xatosining oldini
// oladi. (3) Mobil/tablet: global page scroll ruxsat etiladi (`md:` prefiksi
// bo'lmagani uchun asosiy wrapper faqat `min-h-[100dvh]`da qoladi); F1
// logotipidan keyin, forma tepasida ixcham "hero" carousel (`LoginCarousel
// compact`, faqat `md:hidden`) qaytarildi — 8-turda butunlay olib
// tashlangan edi, endi qayta tiklandi (login va demo state'larning
// ikkalasida ham ko'rinadi, umumiy "chrome" sifatida). Demo forma mobil'da
// ham login formani to'liq almashtiradi (yuqoridagi (1)ga qarang); demo
// forma tugmalari (`flex flex-col sm:flex-row`) endi ikkalasi ham aniq
// `w-full sm:w-auto`/`sm:flex-1` bilan — avval `flex-col`dagi standart
// `align-items:stretch` orqali bilvosita to'liq kenglikda edi, endi aniq
// belgilangan.
//
// 2026-09-03 (4-tur — demo forma muvaffaqiyat holatini kuchaytirish):
// foydalanuvchi jonli skrinshotni ko'rgach fikr bildirdi — muvaffaqiyat
// bloki "toza va professional" chiqqan, lekin (1) chap tarafiga kichik
// `✓` (CheckCircleIcon, yangi) ikonka qo'shildi, (2) pastiga yengil,
// outline-pill "Kirish sahifasiga qaytish" tugmasi qo'shildi (`onClose`
// chaqiradi — xuddi "Ortga qaytish" bilan bir xil, login holatiga
// qaytaradi) — aks holda foydalanuvchi keyin nima qilishini bilmay
// qolishi mumkin edi, (3) blok bilan undan yuqoridagi subtitle orasidagi
// bo'shliq (`mb-8`, 32px) ustiga qo'shimcha `mt-2` (8px) qo'shildi —
// jami ~40px, so'ralgan 36-44px oralig'ida. Matnning o'zi ("So'rovingiz
// qabul qilindi...") o'zgarishsiz qoldi.
//
// 2026-09-03 (5-tur): Demo so'rash formasidagi telefon maydonida qulflangan
// "+998" prefiksi o'rniga davlat kodi `<select>`i qo'shildi
// (`apps/web/src/lib/countryDialCodes.ts`, yangi umumiy fayl) — standart
// holat O'zbekiston, lekin ochib istalgan boshqa davlatni tanlash mumkin.
// Tez-tez tanlanadigan 10 ta davlat (`PRIORITY_ISO2`) alohida optgroup'da
// tepada, qolganlari "Barcha davlatlar" optgroup'ida ingliz nomi bo'yicha
// alfavit tartibida. Bayroq emoji regional-indicator trikidan avtomatik
// hosil qilinadi (`countryFlagEmoji`) — 190+ emoji qo'lda yozilmagan.
// Submit paytida tanlangan davlatning `dialCode`si raqam bilan birlashtiriladi.
//
// 2026-09-03 (6-tur): Mobil/tablet'dagi ixcham "hero" carousel (`LoginCarousel
// compact`, `md:hidden` bloki, F1 logotipidan keyin) butunlay olib
// tashlandi — foydalanuvchi mobil versiyalarda avtomatik aylanadigan
// elementlarni istamadi (hech bir sahifada). Desktop'dagi chap panel
// carousel'i (illyustratsiya bilan, `md:flex`) o'zgarishsiz qoldi.

const SLIDES: LoginCarouselSlide[] = [
  {
    illustration: <LoginIllustrationBooking className="h-64 w-64" />,
    title: 'Bronlar va xonalar',
    desc: 'Bron taqvimi, Channel Manager va real vaqtdagi bandlik',
  },
  {
    illustration: <LoginIllustration className="h-64 w-64" />,
    title: 'Front Desk va moliya',
    desc: "Tezkor check-in/out, folio, to'lovlar va kunni yopish",
  },
  {
    illustration: <LoginIllustrationStaff className="h-64 w-64" />,
    title: 'Xodimlar va nazorat',
    desc: 'Aniq ruxsatlar, housekeeping vazifalari va real vaqt hisobotlari',
  },
];

// `hasError` bo'lsa maydon chegarasi/fokus rangi qizg'ishga o'tadi (umumiy
// login xatosi — backend qaysi aniq maydon xato ekanini ajratmaydi, shuning
// uchun ikkala maydon ham belgilanadi). `trailingIcon` parol ko'rsatish/
// yashirish tugmasi uchun o'ng tarafda qo'shimcha joy (pr-11) ochadi.
function pillInputClass({ hasError = false, trailingIcon = false } = {}) {
  return [
    'w-full rounded-full border bg-slate-50 py-4 pl-11 text-sm text-slate-900 placeholder-slate-500 transition-colors focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60',
    trailingIcon ? 'pr-11' : 'pr-4',
    hasError
      ? 'border-rose-300 hover:border-rose-400 focus:border-rose-500 focus:ring-rose-300'
      : 'border-slate-200 hover:border-slate-300 focus:border-brand-navy/70 focus:ring-brand-navy/20',
  ].join(' ');
}

const pillInputNoIcon =
  'w-full rounded-full border border-slate-200 bg-slate-50 py-4 px-4 text-sm text-slate-900 placeholder-slate-500 transition-colors hover:border-slate-300 focus:border-brand-navy/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60';

const pillPrimaryBtn =
  'w-full rounded-full bg-brand-navy py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-navy-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:opacity-40';

const pillSecondaryBtn =
  'rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-navy transition-colors hover:bg-slate-50 disabled:opacity-40';

function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
      {children}
    </span>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M3 3l18 18M10.6 5.2A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 4.1M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.3 0 2.5-.2 3.6-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="mt-0.5 flex-shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type LoginStep = 'credentials' | 'select-tenant';

export function LoginPage() {
  useEffect(() => {
    document.title = 'Folio One | Kirish';
  }, []);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [showForgot, setShowForgot] = useState(false);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleResult = (result: LoginResult) => {
    if (result.status === 'select-tenant') {
      setTenantOptions(result.tenants);
      setStep('select-tenant');
      return;
    }
    navigate(result.user.isPlatformAdmin ? '/admin' : '/dashboard');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      handleResult(await login({ email, password, remember: rememberMe }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const onSelectTenant = async (subdomain: string) => {
    setError(null);
    setLoading(true);
    try {
      handleResult(await login({ subdomain, email, password, remember: rememberMe }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col md:h-[100dvh] md:overflow-hidden">
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <div className="hidden md:flex md:w-1/2 md:overflow-hidden flex-col bg-gradient-to-br from-[#eef2fd] to-[#dde5fa] p-12 text-slate-900">
          <div className="flex flex-1 items-center justify-center">
            <LoginCarousel slides={SLIDES} />
          </div>
        </div>

        <div className="flex flex-1 flex-col bg-white px-6 py-12 md:min-h-0 md:overflow-y-auto">
          <div className="mx-auto w-full max-w-sm md:my-auto">
            {step === 'credentials' && (
              <>
                <div className="-mt-4 mb-7 flex justify-center">
                  <img src={folioOneLogoFull} alt="Folio One" aria-hidden="true" className="h-16 w-auto" />
                </div>

                {!showDemoForm ? (
                  <>
                    <h1 className="mb-2 text-center text-2xl font-semibold text-slate-900">Xush kelibsiz!</h1>
                    <p className="mb-8 text-center text-sm text-slate-600">
                      Tizimga kirish uchun email va parolingizni kiriting
                    </p>

                    <form onSubmit={onSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="login-email" className="mb-1 block text-sm font-semibold text-slate-700">
                          Email
                        </label>
                        <div className="relative">
                          <FieldIcon>
                            <MailIcon />
                          </FieldIcon>
                          <input
                            id="login-email"
                            type="email"
                            required
                            autoFocus
                            placeholder="email@hotel.uz"
                            aria-invalid={!!error}
                            className={pillInputClass({ hasError: !!error })}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="login-password" className="mb-1 block text-sm font-semibold text-slate-700">
                          Parol
                        </label>
                        <div className="relative">
                          <FieldIcon>
                            <LockIcon />
                          </FieldIcon>
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Parolingiz"
                            aria-invalid={!!error}
                            className={pillInputClass({ hasError: !!error, trailingIcon: true })}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
                          >
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                        <div className="mt-1.5 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowForgot((v) => !v)}
                            className="text-sm font-medium text-brand-navy hover:underline"
                          >
                            Parolni unutdingizmi?
                          </button>
                        </div>
                      </div>

                      {showForgot && (
                        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                          Hozircha parolni faqat mehmonxonangiz administratori "Xodimlar" bo'limidan
                          tiklashi mumkin — administratoringizga murojaat qiling.
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          id="remember-me"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-navy focus:ring-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
                        />
                        <label htmlFor="remember-me" className="cursor-pointer select-none text-sm text-slate-600">
                          Tizimda eslab qolish
                        </label>
                      </div>

                      {error && (
                        <p role="alert" aria-live="polite" className="text-sm text-rose-600">
                          {error}
                        </p>
                      )}

                      <button type="submit" disabled={loading} className={pillPrimaryBtn}>
                        {loading ? 'Kirilmoqda...' : 'Kirish'}
                      </button>
                    </form>

                    <p className="mt-4 text-center text-sm text-slate-500">
                      Yangi mehmonxonami?{' '}
                      <Link to="/register" className="font-medium text-brand-navy hover:underline">
                        Ro'yxatdan o'tish
                      </Link>
                    </p>

                    <div className="mt-3 flex items-center gap-3" role="presentation">
                      <span className="h-px flex-1 bg-slate-100" />
                      <span className="text-xs text-slate-400">yoki</span>
                      <span className="h-px flex-1 bg-slate-100" />
                    </div>

                    <div className="mt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setShowDemoForm(true)}
                        className="inline-flex items-center justify-center rounded-full border border-brand-navy/25 px-4 py-1.5 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
                      >
                        Demo so'rash
                      </button>
                    </div>
                  </>
                ) : (
                  <DemoRequestForm onClose={() => setShowDemoForm(false)} />
                )}
              </>
            )}

            {step === 'select-tenant' && (
              <TenantSelectStep
                tenants={tenantOptions}
                loading={loading}
                error={error}
                onSelect={onSelectTenant}
                onBack={() => {
                  setStep('credentials');
                  setError(null);
                }}
              />
            )}
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 md:justify-start md:pl-16">
        <a
          href="https://folioone.uz"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Folio One — folioone.uz saytiga o'tish"
          className="flex items-center rounded transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
        >
          <img src={folioOneLogo} alt="" aria-hidden="true" className="h-5 w-5" />
        </a>
        <span>© {new Date().getFullYear()} Folio One — barcha huquqlar himoyalangan</span>
      </footer>
    </div>
  );
}

function TenantSelectStep({
  tenants,
  loading,
  error,
  onSelect,
  onBack,
}: {
  tenants: TenantOption[];
  loading: boolean;
  error: string | null;
  onSelect: (subdomain: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Mehmonxonani tanlang</h1>
      <p className="mb-6 text-sm text-slate-500">
        Bu email bir nechta mehmonxonada ro'yxatdan o'tgan — qaysi biriga kirmoqchisiz?
      </p>
      <div className="space-y-2">
        {tenants.map((t) => (
          <button
            key={t.subdomain}
            type="button"
            disabled={loading}
            onClick={() => onSelect(t.subdomain)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm transition-colors hover:border-brand-navy hover:bg-brand-navy-light disabled:opacity-50"
          >
            <p className="font-medium text-slate-900">{t.name}</p>
            <p className="text-xs text-slate-500">{t.subdomain}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button type="button" onClick={onBack} className="mt-4 text-sm text-slate-500 hover:underline">
        Orqaga
      </button>
    </div>
  );
}

// Xonalar soni B2B lead'ni saralash uchun foydali, ammo backend'da alohida
// ustun ochish (migratsiya) shart emas — DemoRequest.note maydoni (ixtiyoriy,
// 1000 belgigacha) allaqachon mavjud, shuning uchun tanlangan variant shu
// maydonga qisqa matn sifatida yoziladi ("Xonalar soni: 21–50").
const ROOM_COUNT_OPTIONS = ['1–20', '21–50', '51–100', '100+'];

function DemoRequestForm({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState('');
  const [countryIso2, setCountryIso2] = useState(DEFAULT_COUNTRY_ISO2);
  const [phone, setPhone] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [roomCount, setRoomCount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDemoError(null);
    setSubmitting(true);
    try {
      const dialCode =
        COUNTRY_DIAL_CODES.find((c) => c.iso2 === countryIso2)?.dialCode ?? '+998';
      const fullPhone = `${dialCode} ${phone}`.replace(/\s+/g, ' ').trim();
      await apiFetch('/marketing/demo-requests', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          fullName,
          phone: fullPhone,
          email: demoEmail || undefined,
          note: roomCount ? `Xonalar soni: ${roomCount}` : undefined,
        }),
      });
      setSent(true);
    } catch (err) {
      setDemoError(err instanceof ApiError ? err.message : 'Yuborishda xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="mb-2 text-center text-2xl font-semibold text-slate-900">Demo so'rash</h2>
      <p className="mb-8 text-center text-sm text-slate-600">
        Jamoamiz siz bilan bog'lanib, Folio One'ni tanishtiradi.
      </p>

      {sent ? (
        <div className="mt-2">
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircleIcon />
            <p>So'rovingiz qabul qilindi. Tez orada siz bilan bog'lanamiz.</p>
          </div>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-4 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
            >
              Kirish sahifasiga qaytish
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Ism va familiyangiz</label>
            <input
              required
              className={pillInputNoIcon}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Telefon raqamingiz</label>
            <div className="flex">
              <div className="relative">
                <select
                  aria-label="Davlat kodi"
                  value={countryIso2}
                  onChange={(e) => setCountryIso2(e.target.value)}
                  className="h-full w-[7.5rem] appearance-none rounded-l-full border border-r-0 border-slate-200 bg-slate-100 py-4 pl-3.5 pr-7 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 focus:border-brand-navy/70 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                >
                  <optgroup label="Tez-tez tanlanadi">
                    {COUNTRY_DIAL_CODES.filter((c) => PRIORITY_ISO2.includes(c.iso2)).map((c) => (
                      <option key={c.iso2} value={c.iso2}>
                        {countryFlagEmoji(c.iso2)} {c.name} ({c.dialCode})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Barcha davlatlar">
                    {COUNTRY_DIAL_CODES.filter((c) => !PRIORITY_ISO2.includes(c.iso2)).map((c) => (
                      <option key={c.iso2} value={c.iso2}>
                        {countryFlagEmoji(c.iso2)} {c.name} ({c.dialCode})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronDownIcon />
                </span>
              </div>
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                className="w-full rounded-r-full border border-slate-200 bg-slate-50 py-4 px-4 text-sm text-slate-900 placeholder-slate-500 transition-colors hover:border-slate-300 focus:border-brand-navy/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                placeholder="90 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Email <span className="font-normal text-slate-400">(ixtiyoriy)</span>
            </label>
            <input
              type="email"
              className={pillInputNoIcon}
              value={demoEmail}
              onChange={(e) => setDemoEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Xonalar soni <span className="font-normal text-slate-400">(ixtiyoriy)</span>
            </label>
            <div className="relative">
              <select
                className={`${pillInputNoIcon} appearance-none pr-9`}
                value={roomCount}
                onChange={(e) => setRoomCount(e.target.value)}
              >
                <option value="">Tanlang</option>
                {ROOM_COUNT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                <ChevronDownIcon />
              </span>
            </div>
          </div>

          {demoError && <p className="text-sm text-rose-600">{demoError}</p>}

          <p className="text-[11px] leading-snug text-slate-400">
            Yuborish orqali siz bilan demo bo'yicha bog'lanishimizga rozilik bildirasiz.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={submitting} className={`${pillPrimaryBtn} w-full sm:flex-1`}>
              {submitting ? 'Yuborilmoqda...' : "Demo so'rovini yuborish"}
            </button>
            <button type="button" onClick={onClose} className={`${pillSecondaryBtn} w-full sm:w-auto`}>
              Ortga qaytish
            </button>
          </div>
        </form>
      )}
    </>
  );
}
