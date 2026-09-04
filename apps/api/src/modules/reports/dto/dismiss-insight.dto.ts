import { IsIn } from 'class-validator';
import type { InsightSeverity } from '../reports.service';

// Yopish so'rovi jiddiylik darajasini ham olib keladi.
//
// NIMA UCHUN MIJOZDAN: yopish paytida foydalanuvchi AYNAN NIMANI ko'rib
// turganini yozib qo'yish kerak — keyinchalik holat yomonlashsa tavsiya
// qaytadan chiqishi shunga tayanadi. Serverda qayta hisoblash ham mumkin
// edi, lekin u ortiqcha to'liq `getInsights` chaqiruvini talab qilardi va
// oradagi soniyalarda qiymat o'zgarib, foydalanuvchi ko'rmagan darajani
// yozib qo'yishi mumkin edi.
//
// Xavfsizlik jihatidan bu maydon zararsiz: u faqat foydalanuvchining O'Z
// ko'rinishiga ta'sir qiladi. Eng yomoni — noto'g'ri daraja yuborilsa,
// tavsiya kutilganidan erta yoki kech qayta chiqadi.
export class DismissInsightDto {
  @IsIn(['critical', 'warning', 'info', 'positive'], {
    message: "severity noto'g'ri qiymatda",
  })
  severity: InsightSeverity;
}
