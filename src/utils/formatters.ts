const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
  minimumFractionDigits: 0,
});

export function formatCurrency(amount: number) {
  return CURRENCY_FORMATTER.format(amount);
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export function formatNumber(number: number, minLength?: number, padChar: string = '0') {
  const formatted = NUMBER_FORMATTER.format(number);
  return minLength ? formatted.padStart(minLength, padChar) : formatted;
}
