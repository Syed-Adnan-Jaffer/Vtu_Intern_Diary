import { addDays, format, isSunday, isSaturday, parseISO, differenceInCalendarDays } from "date-fns";

export type DayInfo = {
  date: Date;
  isoDate: string; // yyyy-MM-dd
  dayNumber: number;
};

export function buildInternshipDays(
  startDate: string | null,
  endDate: string | null,
  skipWeekends: boolean,
): DayInfo[] {
  if (!startDate || !endDate) return [];
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const total = differenceInCalendarDays(end, start);
  if (total < 0) return [];
  const days: DayInfo[] = [];
  let dayNum = 1;
  for (let i = 0; i <= total; i++) {
    const d = addDays(start, i);
    if (skipWeekends && (isSaturday(d) || isSunday(d))) continue;
    if (!skipWeekends && isSunday(d)) continue;
    days.push({ date: d, isoDate: format(d, "yyyy-MM-dd"), dayNumber: dayNum });
    dayNum++;
  }
  return days;
}

export function formatDayLabel(d: Date) {
  return format(d, "EEE, MMM d, yyyy");
}
