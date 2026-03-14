export type ReportDateMode = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportDateRangeInput {
  mode: ReportDateMode;
  anchorDate: string;
  fromDate: string;
  toDate: string;
}

export interface ResolvedReportDateRange {
  fromDate: string;
  toDate: string;
  label: string;
}

const toYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseYmd = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const getTodayYmd = (): string => toYmd(new Date());

export const getYesterdayYmd = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toYmd(date);
};

export const resolveReportDateRange = ({
  mode,
  anchorDate,
  fromDate,
  toDate,
}: ReportDateRangeInput): ResolvedReportDateRange => {
  const anchor = parseYmd(anchorDate);
  const today = new Date();

  if (mode === 'daily') {
    const date = toYmd(anchor);
    return {
      fromDate: date,
      toDate: date,
      label: `Date: ${date}`,
    };
  }

  if (mode === 'weekly') {
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday=0
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek);

    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - 7);
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() - 1);

    const start = toYmd(weekStart);
    const end = toYmd(weekEnd);
    return {
      fromDate: start,
      toDate: end,
      label: `Last Week: ${start} to ${end}`,
    };
  }

  if (mode === 'monthly') {
    const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStart = new Date(firstOfCurrentMonth.getFullYear(), firstOfCurrentMonth.getMonth() - 1, 1);
    const monthEnd = new Date(firstOfCurrentMonth.getFullYear(), firstOfCurrentMonth.getMonth(), 0);

    const start = toYmd(monthStart);
    const end = toYmd(monthEnd);
    return {
      fromDate: start,
      toDate: end,
      label: `Last Month: ${start} to ${end}`,
    };
  }

  return {
    fromDate,
    toDate,
    label: `Custom: ${fromDate} to ${toDate}`,
  };
};
