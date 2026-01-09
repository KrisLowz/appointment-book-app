import { toISODate } from './date';

export function buildMonthGrid(currentDate) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay(); // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysPrevMonth - i;
    const d = new Date(year, month - 1, day);
    cells.push({ date: d, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const day = cells.length - daysInMonth - firstWeekday + 1;
    const d = new Date(year, month + 1, day);
    cells.push({ date: d, inMonth: false });
  }

  return cells;
}

export function buildHolidayMap(holidays) {
  const map = {};
  holidays.forEach((h) => {
    const start = new Date(h.startDate);
    const end = new Date(h.endDate || h.startDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      map[toISODate(d)] = h;
    }
  });
  return map;
}
