const cadFormatter = new Intl.NumberFormat('en-CA', {
  currency: 'CAD',
  style: 'currency',
});

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

export function formatCad(amountCents: number) {
  return cadFormatter.format(amountCents / 100);
}

export function formatTransactionDate(date: Date) {
  return dateFormatter.format(date);
}
