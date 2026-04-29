import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: de });
}

export function formatTimeOfDay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m} Uhr`;
}
