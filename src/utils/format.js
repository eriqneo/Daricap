export function formatCurrency(amount) {
  if (amount === undefined || amount === null) return 'KES 0';
  return 'KES ' + Number(amount).toLocaleString('en-KE');
}

export function displayProduct(product) {
  if (!product || product === 'undefined' || product === 'null') {
    return 'Not specified';
  }
  return product;
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '—';
  }
}
