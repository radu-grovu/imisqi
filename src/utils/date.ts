import { addDays, formatISO, isWithinInterval } from 'date-fns';

export const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function campaignDates(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) => ymd(addDays(start, i)));
}

export function isActiveDate(dateStr: string, start: Date, days: number) {
  const date = new Date(dateStr + 'T00:00:00');
  const end = addDays(start, days - 1);
  return isWithinInterval(date, { start, end });
}
