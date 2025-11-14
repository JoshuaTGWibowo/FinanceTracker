import dayjs, { type Dayjs } from "dayjs";

export interface PeriodOption {
  key: string;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
}

export const MONTHS_TO_DISPLAY = 12;

export const buildMonthlyPeriods = (monthsToDisplay: number = MONTHS_TO_DISPLAY): PeriodOption[] => {
  const currentMonth = dayjs().startOf("month");
  return Array.from({ length: monthsToDisplay }).map((_, index) => {
    const month = currentMonth.subtract(monthsToDisplay - 1 - index, "month");
    return {
      key: month.format("YYYY-MM"),
      label: month.format("MMM YYYY"),
      range: () => ({
        start: month.startOf("month"),
        end: month.endOf("month"),
      }),
    };
  });
};
