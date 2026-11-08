export const pct = (n) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : '-');

/** coral below 40%, marigold below 70%, mint from 70%: the same cut-offs the test difficulty uses. */
export function levelColor(level) {
  if (!Number.isFinite(level)) return '#8EA9A5';
  if (level < 0.4) return '#EF6F5A';
  if (level < 0.7) return '#F0B03A';
  return '#6ED3A3';
}

export function levelWord(level) {
  if (!Number.isFinite(level)) return 'Not tested';
  if (level >= 0.8) return 'Mastered';
  if (level >= 0.7) return 'Strong';
  if (level >= 0.4) return 'Developing';
  return 'Needs work';
}

export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso.length === 10 ? iso : iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function dateTime(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
}

export function minutesLabel(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export const WEIGHT_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
export const SEVERITY_LABEL = { high: 'Big gap', medium: 'Some gap', low: 'Small gap', mastered: 'On target' };
