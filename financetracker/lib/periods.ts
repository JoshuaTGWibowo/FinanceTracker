import dayjs, { type Dayjs } from "dayjs";

export interface PeriodOption {
  key: string;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
  isFuture?: boolean;
}

const DEFAULT_MONTHS_TO_DISPLAY = 12;

/**
 * Build monthly periods, including all months that have transactions
 * @param months - Default number of months to display
 * @param transactionDates - Optional array of transaction dates to ensure their months are included
 */
export const buildMonthlyPeriods = (
  months: number = DEFAULT_MONTHS_TO_DISPLAY, 
  transactionDates?: string[]
): PeriodOption[] => {
  const currentMonth = dayjs().startOf("month");
  
  // Start with default months from current month backwards
  const defaultPeriods = Array.from({ length: months }).map((_, index) => {
    const month = currentMonth.subtract(months - 1 - index, "month");
    return month.format("YYYY-MM");
  });

  // If transaction dates provided, find the oldest one and include all months up to it
  let allMonthKeys = new Set(defaultPeriods);
  
  if (transactionDates && transactionDates.length > 0) {
    const oldestDate = transactionDates.reduce((oldest, dateStr) => {
      const date = dayjs(dateStr);
      return date.isBefore(oldest) ? date : oldest;
    }, dayjs());
    
    // Add all months from oldest transaction date to current month
    let monthCursor = oldestDate.startOf("month");
    while (monthCursor.isBefore(currentMonth) || monthCursor.isSame(currentMonth, 'month')) {
      allMonthKeys.add(monthCursor.format("YYYY-MM"));
      monthCursor = monthCursor.add(1, "month");
    }
  }

  // Convert to array and sort chronologically (oldest first)
  const sortedKeys = Array.from(allMonthKeys).sort();

  // Build period options
  const periods = sortedKeys.map(key => {
    const month = dayjs(key, "YYYY-MM");
    return {
      key,
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
