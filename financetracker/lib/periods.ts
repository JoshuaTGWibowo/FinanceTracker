import dayjs, { type Dayjs } from "dayjs";

export interface PeriodOption {
  key: string;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
  isFuture?: boolean;
}

const DEFAULT_MONTHS_TO_DISPLAY = 12;

export const buildMonthlyPeriods = (months: number = DEFAULT_MONTHS_TO_DISPLAY): PeriodOption[] => {
  const currentMonth = dayjs().startOf("month");

  const periods = Array.from({ length: months }).map((_, index) => {
    const month = currentMonth.subtract(months - 1 - index, "month");

    return {
      key: month.format("YYYY-MM"),
      label: month.format("MMM YYYY"),
      range: () => ({
        start: month.startOf("month"),
        end: month.endOf("month"),
      }),
    };
  });

  // Find the index of the current month and insert "Future" right after it
  const currentMonthKey = currentMonth.format("YYYY-MM");
  const currentMonthIndex = periods.findIndex(p => p.key === currentMonthKey);
  
  const futurePeriod: PeriodOption = {
    key: "future",
    label: "Future",
    isFuture: true,
    range: () => ({
      start: dayjs().add(1, "day").startOf("day"),
      end: dayjs().add(100, "year"),
    }),
  };

  // Insert Future period right after current month (or at the end if current month not found)
  if (currentMonthIndex !== -1) {
    periods.splice(currentMonthIndex + 1, 0, futurePeriod);
  } else {
    periods.push(futurePeriod);
  }

  return periods;
};
