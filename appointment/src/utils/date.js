export const toISODate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayISO = () => toISODate(new Date());

export const formatMonthTitle = (date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const formatDayLong = (date) =>
  date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

export const sameDate = (a, b) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};
