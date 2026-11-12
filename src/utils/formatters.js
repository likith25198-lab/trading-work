// Format helpers

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num) {
  if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
  if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function getChangeColor(value) {
  if (value > 0) return '#00C853';
  if (value < 0) return '#FF1744';
  return '#999';
}

