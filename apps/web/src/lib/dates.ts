export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return toISODate(date);
}

export function dateRange(startIsoDate: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startIsoDate, i));
}

const WEEKDAY_LABELS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const MONTH_LABELS = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
];

export function formatDayLabel(isoDate: string): { weekday: string; dayMonth: string } {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: WEEKDAY_LABELS[date.getDay()],
    dayMonth: `${d} ${MONTH_LABELS[m - 1]}`,
  };
}

export function isSameOrAfter(a: string, b: string): boolean {
  return a >= b;
}
