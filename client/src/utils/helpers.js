export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateRange(start, end) {
  const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  const startDate = new Date(start).toLocaleDateString('en-IN', dateOptions);
  const endDate = new Date(end).toLocaleDateString('en-IN', dateOptions);
  return startDate === endDate ? startDate : `${startDate} – ${endDate}`;
}

export function toDateInputValue(date) {
  if (!date) return '';
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(
    parsedDate.getDate(),
  ).padStart(2, '0')}`;
}

export function getDashboardPath(role) {
  return role === 'organizer' ? '/organizer' : '/sponsor';
}

export function fieldErrors(error) {
  const errors = {};

  for (const detail of error?.details ?? []) {
    const path = Array.isArray(detail.path) ? detail.path : [detail.path];
    const field = path.filter((part) => part !== undefined && part !== null).at(-1);
    if (field !== undefined && detail.message) {
      errors[field] = detail.message;
    }
  }

  return errors;
}
