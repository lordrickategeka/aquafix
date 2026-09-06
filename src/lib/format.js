/* Shared display helpers. UGX has no minor unit, so amounts are whole numbers
   everywhere and only ever get grouped, never rounded to decimals. */

export function ugx(amount) {
  return Number(amount || 0).toLocaleString('en-US');
}

// 18,432,100 -> "18.4M" for headline figures where the exact digit is noise.
export function ugxShort(amount) {
  const value = Number(amount || 0);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function periodLabel(period) {
  if (!period) return '—';
  const [year, month] = period.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(month) - 1]} ${year}`;
}

export function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function fullDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const CHANNEL_LABELS = {
  mtn: 'MTN MoMo',
  airtel: 'Airtel Money',
  bank: 'Bank',
  cash: 'Cash desk',
};

// CATEGORY_LABELS in billing.js is the full wording for bills and forms; a
// table column needs the short form.
export const CATEGORY_SHORT = {
  domestic: 'Domestic',
  institutional: 'Institutional',
  commercial: 'Commercial',
  kiosk: 'Kiosk',
};

export const STATUS_PILL = {
  active: 'bg-ok-bg text-ok-fg',
  new: 'bg-info-bg text-info-fg',
  disconnected: 'bg-bad-bg text-bad-fg',
  closed: 'bg-[#F1F5F4] text-muted-deep',
};

export const FLAG_PILL = {
  ok: 'bg-ok-bg text-ok-fg',
  high: 'bg-warn-bg text-warn-fg',
  zero: 'bg-info-bg text-info-fg',
  negative: 'bg-bad-bg text-bad-fg',
  missed: 'bg-[#F1F5F4] text-muted-deep',
};

export const FLAG_LABELS = {
  ok: 'Clean',
  high: 'Spike',
  zero: 'Zero',
  negative: 'Error',
  missed: 'Missed',
};

export const BILL_STATUS_PILL = {
  paid: 'bg-ok-bg text-ok-fg',
  part_paid: 'bg-warn-bg text-warn-fg',
  unpaid: 'bg-bad-bg text-bad-fg',
  void: 'bg-[#F1F5F4] text-muted-deep',
};

export const BILL_STATUS_LABELS = {
  paid: 'Paid',
  part_paid: 'Part paid',
  unpaid: 'Unpaid',
  void: 'Void',
};
