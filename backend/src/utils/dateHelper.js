import { addDays, isWeekend, format } from 'date-fns';

export const findNextValidDate = (startDate, settings) => {
  let current = new Date(startDate);
  const { avoidWeekends, avoidHolidays, holidayList } = settings;

  // Safety limit to prevent infinite loops
  for (let i = 0; i < 365; i++) {
    let isBadDate = false;

    // Check Weekends
    if (avoidWeekends === 'sat_sun' && isWeekend(current)) isBadDate = true;

    // Check Holidays (assuming holidayList is array of 'YYYY-MM-DD')
    if (avoidHolidays && holidayList.includes(format(current, 'yyyy-MM-dd'))) {
      isBadDate = true;
    }

    if (!isBadDate) return current;
    current = addDays(current, 1);
  }
  return startDate;
};