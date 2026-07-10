// Shared date/time formatting used across ticket and review detail views.

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function toDate(value: string | number | Date) {
  return value instanceof Date ? value : new Date(value);
}

// e.g. "Jul 6, 2026, 0:00" — short month, full year, 24h clock with no seconds.
export function formatDateTime(value: string | number | Date) {
  return DATE_TIME_FORMAT.format(toDate(value));
}

// e.g. "Jul 6, 2026"
export function formatDate(value: string | number | Date) {
  return DATE_FORMAT.format(toDate(value));
}

// Compact "just now / 5m ago / 3h ago / 2d ago / 4mo ago" relative time.
export function relativeTime(value: string | number | Date) {
  const at = toDate(value).getTime();
  const diff = Date.now() - at;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  const months = Math.round(days / 30);
  return future ? `in ${months}mo` : `${months}mo ago`;
}
