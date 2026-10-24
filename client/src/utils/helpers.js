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
