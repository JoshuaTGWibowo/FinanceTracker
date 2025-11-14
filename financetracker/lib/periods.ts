import dayjs, { type Dayjs } from "dayjs";

export interface PeriodOption {
  key: string;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
}

const MONTHS_TO_DISPLAY = 12;

export const buildMonthlyPeriods = (): PeriodOption[] => {
  const currentMonth = dayjs().startOf("month");
  return Array.from({ length: MONTHS_TO_DISPLAY }).map((_, index) => {
    const month = currentMonth.subtract(MONTHS_TO_DISPLAY - 1 - index, "month");
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
