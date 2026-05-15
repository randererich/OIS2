export function quantity(value) {
  const fixed = Number(value || 0).toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed;
}

export function signedQuantity(value) {
  const n = Number(value || 0);
  const formatted = quantity(n);
  return n > 0 ? `+${formatted}` : formatted;
}
