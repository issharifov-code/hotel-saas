import { AppLayout } from '../components/AppLayout';

interface GuideItem {
  key: string;
  title: string;
  body: string;
}

interface GuideGroup {
  key: string;
  label: string;
  items: GuideItem[];
}

// Yordam sahifasi tarkibi (2026-09) — chap menyudagi NAV_SECTIONS bilan bir xil
// guruhlashda, har bir modul uchun qisqa "qanday foydalanish" yo'riqnomasi.
// Matn shu sahifalarning haqiqiy tarkibiga (asosiy jadval ustunlari, "+ ..."
// tugmalari, tab'lar) asoslangan — o'ylab topilgan funksiya yo'q.
const GUIDE_GROUPS: GuideGroup[] = [
  {
    key: 'dashboard',
    label: 'Bosh sahifa',
    items: [
      {
        key: 'dashboard',
        title: 'Bosh sahifa (Dashboard)',
        body: "Kirganingizda birinchi ko'rinadigan boshqaruv paneli — uchta tabga bo'lingan: \"Umumiy\" (bandlik, ADR, RevPAR, daromad tendensiyasi va sodiqlik darajalari kabi asosiy ko'rsatkichlar, hammaga ko'rinadi), \"Housekeeping\" (tozalash kutayotgan xonalar va vazifalar holati — shu modulga ruxsati borlarga) va \"Moliyaviy / Rev Mgt\" (USALI departamentlari bo'yicha daromad taqsimoti — moliyaviy hisobotlarga ruxsati borlarga). Tab'lar sizning ruxsatlaringizga qarab avtomatik ko'rinadi yoki yashiriladi.",
      },
    ],
  },
  {
    key: 'client-relations',
    label: 'Mehmonlar bilan aloqalar',
    items: [
      {
        key: 'guests',
        title: 'Mehmonlar',
        body: "Barcha mehmonlaringiz bazasi. Ism, telefon yoki email bo'yicha qidiring, \"+ Mehmon qo'shish\" orqali yangi mehmon yarating. Har bir mehmon kartochkasida sodiqlik darajasi (Bronza/Kumush/Oltin/Platina) va ballari ko'rinadi; mehmon ustiga bosib uning bronlar tarixi va sodiqlik tranzaksiyalarini ko'rishingiz mumkin. Bir xil mehmon ikki marta kiritilgan bo'lsa, \"Ikkilanmalar\" orqali ularni birlashtiring.",
      },
      {
        key: 'messaging',
        title: 'Xabarlar',
        body: "Mehmonlarga email yoki SMS orqali yuboriladigan xabarlarni shu yerdan boshqarasiz. \"Xabarlar tarixi\" tabida yuborilgan barcha xabarlar (kanal, mavzu, holat, vaqt) ko'rinadi. \"Shablonlar\" tabida esa bron tasdiqlandi / check-in / check-out kabi hodisalarda avtomatik yuboriladigan xabar shablonlarini sozlaysiz. \"+ Yangi xabar\" tugmasi orqali mehmonga qo'lda xabar yuborishingiz ham mumkin.",
      },
    ],
  },
  {
    key: 'bookings',
    label: 'Bronlar',
    items: [
      {
        key: 'bookings-calendar',
        title: 'Bronlar taqvimi',
        body: "Barcha xonalar va bronlarni bitta taqvimda ko'rasiz — har bir katak bitta xona + bitta sanani bildiradi, rangi bron holatini ko'rsatadi (kutilmoqda/tasdiqlangan/joylashgan/chiqib ketgan/kelmadi). \"+ Yangi bron\" tugmasi yoki bo'sh katakka bosib tezkor bron yarating; mavjud bronga bosib uning batafsil oynasini (check-in/check-out va h.k.) oching. Oldinga/orqaga tugmalari va \"Bugun\" bilan sanalar orasida harakatlaning.",
      },
      {
        key: 'group-bookings',
        title: 'Guruh bronlari',
        body: "Korporativ mijoz yoki turizm agentligi uchun bir nechta xonani bitta guruh ostida bron qiling. \"+ Yangi guruh bron\" bilan guruh yarating (kompaniya, sanalar), so'ng guruh ustiga bosib uning \"rooming list\"iga (xonalar ro'yxati) alohida xonalar qo'shing. Jadvalda har bir guruhning umumiy xonalar soni va jami summasi ko'rinadi.",
      },
      {
        key: 'agencies',
        title: 'Agentliklar',
        body: "Mehmonxonaga muntazam mehmon yo'naltiradigan turizm agentliklari va korporativ hamkorlaringizni shu yerda ro'yxatga oling — har biri uchun komissiya foizini belgilang. \"+ Yangi agentlik\" bilan qo'shing, faol/nofaol holatini boshqaring; har bir agentlik uchun \"Batafsil\" orqali u orqali kelgan daromad xulosasini ko'ring.",
      },
      {
        key: 'function-spaces',
        title: 'Tadbir zallari',
        body: "Konferens-zal yoki banket zali ijarasini boshqarish uchun. \"Zallar\" tabida zallaringizni (sig'imi, kunlik narxi) qo'shing; \"Tadbir bronlari\" tabida esa har bir tadbirni (tashkilotchi, vaqt, holat: dastlabki band/tasdiqlangan/bekor qilingan) \"+ Yangi tadbir\" orqali ro'yxatga oling.",
      },
      {
        key: 'channel-manager',
        title: 'Channel Manager',
        body: "Booking.com, Airbnb, Agoda, Expedia kabi OTA kanallariga xona turlaringizni bog'lab, mavjudlik va narxni bitta joydan boshqarasiz — bu ikki tomondan bir xonani sotib qo'yish (overbooking) xavfini kamaytiradi. \"+ Yangi kanal\" bilan kanal ulang, har biri uchun \"Boshqarish\" orqali xona turlarini bog'lang va sinxronlash (sync) tarixini kuzating.",
      },
    ],
  },
  {
    key: 'front-desk',
    label: 'Front Desk',
    items: [
      {
        key: 'night-audit',
        title: 'Kunni yopish (Night Audit)',
        body: "Har kuni oxirida bajariladigan jarayon: kelmagan (no-show) mehmonlarni avtomatik \"kelmadi\" deb belgilaydi, o'sha kunning bandlik/ADR/RevPAR ko'rsatkichlarini o'zgarmas audit yozuvi sifatida saqlab qo'yadi va mulkning joriy biznes sanasini bir kunga suradi. Sahifada joriy biznes sana va kutilayotgan no-show'lar haqida ogohlantirish ko'rinadi; \"Kunni yopish\" tugmasi tasdiqlash oynasi bilan ishga tushiriladi. Bir kunni faqat bir marta yopish mumkin — pastda barcha o'tgan auditlar tarixi saqlanadi.",
      },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventar',
    items: [
      {
        key: 'rooms',
        title: 'Xonalar',
        body: "Xona turlari, aniq xonalar va narx rejalarini shu yerda sozlaysiz. \"Xona turlari\" bo'limida yangi tur qo'shing (bazaviy narx, maksimal mehmon soni); \"Narx rejalari\"da xona turiga bog'lab kechalik narx va shartlarni (qaytarilmaydigan/bekor qilish/no-show jarimasi) belgilang. Xonalar ro'yxatida har bir xonaning joriy holati (bo'sh/band/texnik xizmatda/ishlamaydi) ko'rinadi.",
      },
      {
        key: 'housekeeping',
        title: 'Housekeeping',
        body: "Xona tozalash jarayonini boshqarish. \"Xonalar holati\" tabida har bir xonaning tozalik holati (toza/iflos/tozalanmoqda/tekshirilgan) kartochka ko'rinishida chiqadi — iflos xona uchun to'g'ridan-to'g'ri vazifa yaratishingiz mumkin. \"Vazifalar\" tabida esa har bir vazifani boshlash, bajarildi deb belgilash, tekshirish yoki bekor qilish amallarini bajarasiz.",
      },
      {
        key: 'maintenance',
        title: 'Texnik xizmat',
        body: "Xonalardagi ta'mirlash talab qiladigan muammolarni qayd qilish uchun. \"+ Yangi so'rov\" bilan xona, muammo tavsifi va muhimlik darajasini (past/o'rta/yuqori/shoshilinch) kiriting. Har bir so'rov uchun \"Boshlash\", hal qilingan deb belgilash yoki bekor qilish amallarini bajarishingiz mumkin; jadvalda barcha so'rovlar va ularning holati ko'rinadi.",
      },
      {
        key: 'warehouse',
        title: 'Ombor',
        body: "To'rt bo'limli ombor va xarid moduli: \"Zaxira\" (tanlangan ombordagi tovar qoldiqlari), \"Tovarlar\" (barcha stock-item'lar ro'yxati), \"Ta'minotchilar\" (yetkazib beruvchilar ro'yxati) va \"Xarid buyurtmalari\" (qoralama → tasdiqlanishi kutilmoqda → tasdiqlangan → qisman/to'liq qabul qilingan bosqichlari bilan). Tovar kelganda buyurtmani \"qabul qilish\" amali orqali zaxiraga qo'shasiz.",
      },
    ],
  },
  {
    key: 'pos',
    label: 'POS',
    items: [
      {
        key: 'pos',
        title: 'POS (Restoran / Bar)',
        body: "Restoran yoki bar savdo nuqtasi moduli. \"Buyurtmalar\" tabida stol raqami, holati (ochiq/to'langan/bekor qilingan) va summasi bilan buyurtmalarni ko'rasiz — \"+ Yangi buyurtma\" bilan yangisini oching. \"Menyu\" tabida esa taomlarni kategoriya bo'yicha boshqarasiz, \"+ Taom qo'shish\" orqali yangi taom kiritasiz va faol/nofaol holatini belgilaysiz.",
      },
    ],
  },
  {
    key: 'financials',
    label: 'Moliyaviy',
    items: [
      {
        key: 'invoicing',
        title: 'Hisob-fakturalar',
        body: "Mehmonlarning hisob-fakturalari ro'yxati — mehmon ismi, xona, sanalar, holat (ochiq/yakunlangan/to'langan/bekor qilingan), summa va qoldiq bilan. Hisobga bosib uning batafsil oynasida qator (line item) qo'shishingiz yoki to'lov qabul qilishingiz mumkin (naqd, karta, bank o'tkazmasi yoki onlayn to'lov tizimi orqali).",
      },
      {
        key: 'city-ledger',
        title: 'City Ledger',
        body: "Mehmonxona bilan \"kredit\"da ishlaydigan kompaniyalar uchun — mehmon check-out paytida o'zi to'lamaydi, hisob-faktura kompaniyaning umumiy hisob-varag'iga (statement) qo'shiladi. \"+ Yangi hisob\" bilan kompaniyani ro'yxatga oling (to'lov muddati, kun hisobida); har bir hisob uchun \"Hisob-varaq\" orqali umumiy statement'ni ko'rasiz.",
      },
      {
        key: 'accounting',
        title: 'Moliyaviy hisob (USALI)',
        body: "To'liq buxgalteriya moduli, to'rt bo'lim: \"Hisoblar rejasi\" (chart of accounts — kod, nomi, turi, USALI departamenti), \"Jurnal yozuvlari\" (barcha moliyaviy operatsiyalar — manba modul va sana bo'yicha filtrlash, \"+ yangi yozuv\" bilan qo'lda kiritish ham mumkin), \"Aylanma-saldo\" (trial balance) va \"Daromadlar hisoboti\" (income statement, tanlangan davr uchun).",
      },
      {
        key: 'billing',
        title: "Obuna va to'lovlar",
        body: "O'zingizning Folio One obunangizni ko'rish uchun (bu yerda hech narsa yaratilmaydi — faqat ma'lumot). Joriy tarif rejasi, holati (sinov/faol/muzlatilgan/bekor qilingan), oylik narx, filial/foydalanuvchi limitlari, so'nggi hisob-faktura va to'lovlar tarixi ko'rinadi, shuningdek boshqa mavjud tarif rejalari bilan taqqoslash mumkin.",
      },
    ],
  },
  {
    key: 'reports',
    label: 'Hisobotlar',
    items: [
      {
        key: 'segment-reports',
        title: 'Daromad tahlili',
        body: "Qaysi bozor segmenti (walk-in, korporativ, OTA, turizm agentligi, guruh, davlat), kanal (resepshn, veb-sayt, OTA, Exely) yoki qaysi agentlik/hamkor qancha daromad keltirayotganini ko'rsatadi. Davr filtrini (30/90/365 kun) tanlang — jadvallarda har bir kesim bo'yicha bronlar soni, kecha-xona, daromad va ADR ko'rinadi.",
      },
      {
        key: 'guest-registration-report',
        title: "Ro'yxatga olish hisoboti",
        body: "Tanlangan davrda turgan yoki turayotgan mehmonlarning hujjat ma'lumotlarini (pasport/ID karta, fuqarolik, tug'ilgan sana) davlat organlariga (migratsiya/politsiya) taqdim etish uchun. Davr filtri (7/30/90 kun); hujjat ma'lumoti to'liq kiritilmagan qatorlar sariq rang bilan ajratib ko'rsatiladi — ularni to'ldirish kerakligini bildiradi.",
      },
    ],
  },
  {
    key: 'settings',
    label: 'Sozlamalar',
    items: [
      {
        key: 'staff',
        title: 'Xodimlar va ruxsatlar',
        body: "Yuqori paneldagi Sozlamalar (⚙) tugmasi orqali ochiladi. \"Xodimlar\" tabida jamoa a'zolarini taklif qiling (invite), ularga rol biriktiring, parolini tiklang yoki faollashtiring/o'chiring. \"Rollar va ruxsatlar\" tabida esa har bir rol uchun modul × amal (ko'rish/yaratish/tahrirlash/o'chirish/tasdiqlash) darajasidagi ruxsatlar matritsasini ko'rasiz va kerak bo'lsa yangi rol yaratasiz.",
      },
    ],
  },
];

export function HelpPage() {
  return (
    <AppLayout title="Yordam">
      <div className="max-w-4xl">
        <p className="text-sm text-slate-600 mb-6">
          Bu sahifada tizimdagi har bir modulning nima uchun ekanligi va undan qanday foydalanish haqida qisqa
          yo'riqnoma berilgan. Kerakli bo'limga o'tish uchun quyidagi mundarijadan foydalaning.
        </p>

        <nav className="rounded-2xl border border-slate-200 bg-white p-4 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Mundarija</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {GUIDE_GROUPS.map((group) => (
              <li key={group.key}>
                <a href={`#${group.key}`} className="text-sm text-brand-navy hover:underline">
                  {group.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-8">
          {GUIDE_GROUPS.map((group) => (
            <section key={group.key} id={group.key} className="scroll-mt-6">
              <h2 className="text-base font-semibold text-slate-900 mb-3">{group.label}</h2>
              <div className="space-y-4">
                {group.items.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-brand-navy mb-1.5">{item.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
