const pad = (n) => String(n).padStart(2, '0');

export function formatDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

export function toIsoStart(dateStr) {
  const { y, m, d } = parts(dateStr);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

export function toIsoEnd(dateStr) {
  const { y, m, d } = parts(dateStr);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export function presetRange(days = 30, now = new Date()) {
  const n = [7, 30, 90, 365].includes(days) ? days : 30;
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1));
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

export function formatLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${formatDateInput(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
