// Pure date helpers. Every date is a 'YYYY-MM-DD' string; arithmetic is done in UTC.
// Never use local-time Date methods here: the server may run in any timezone.

export const CAIRO_TZ = 'Africa/Cairo';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

const cairoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Cairo as 'YYYY-MM-DD'. `now` is injectable for tests. */
export function todayInCairo(now = new Date()) {
  return cairoFmt.format(now);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toYMD(year, month, day) {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** Parses 'YYYY-MM-DD' into numbers, or null when the string is not a real calendar date. */
export function parseYMD(s) {
  if (typeof s !== 'string') return null;
  const m = YMD_RE.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidYMD(s) {
  return parseYMD(s) !== null;
}

function toUTC(s) {
  const p = parseYMD(s);
  if (!p) throw new Error(`Invalid date: ${s}`);
  return Date.UTC(p.year, p.month - 1, p.day);
}

function fromUTC(ms) {
  const d = new Date(ms);
  return toYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Converts a UTC-midnight Date (or ms) to 'YYYY-MM-DD'. */
export function ymdFromUTCDate(d) {
  return fromUTC(typeof d === 'number' ? d : d.getTime());
}

/** Date object at UTC midnight for the given 'YYYY-MM-DD' (for Intl formatting with timeZone UTC). */
export function utcDate(s) {
  return new Date(toUTC(s));
}

export function addDays(s, n) {
  return fromUTC(toUTC(s) + n * DAY_MS);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(s) {
  return new Date(toUTC(s)).getUTCDay();
}

/** Blank cells before day 1 in a Saturday-first grid. */
export function leadingBlanks(year, month) {
  return (dayOfWeek(toYMD(year, month, 1)) + 1) % 7;
}

/**
 * Cells of a Saturday-first month grid: nulls for leading blanks, then 'YYYY-MM-DD'
 * strings, padded with trailing nulls to whole weeks.
 */
export function monthGrid(year, month) {
  const cells = Array(leadingBlanks(year, month)).fill(null);
  const n = daysInMonth(year, month);
  for (let d = 1; d <= n; d++) cells.push(toYMD(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Moves { year, month } by `delta` months. */
export function shiftMonth(year, month, delta) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Trims Postgres 'HH:MM:SS' to 'HH:MM'. Returns null for empty input. */
export function normalizeTime(t) {
  if (t == null || t === '') return null;
  const m = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(String(t));
  return m ? `${m[1]}:${m[2]}` : null;
}

/** 'HH:MM' → '10:30 ص' / '7:00 م'. */
export function formatTime12(t) {
  const n = normalizeTime(t);
  if (!n) return '';
  const [h, m] = n.split(':').map(Number);
  const suffix = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${suffix}`;
}

const LOCALE = 'ar-EG-u-nu-latn';
const fullFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const monthFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' });

/** 'الخميس، 8 أكتوبر 2026' */
export function formatArabicDate(s) {
  return fullFmt.format(utcDate(s));
}

/** 'أكتوبر 2026' */
export function formatArabicMonth(year, month) {
  return monthFmt.format(utcDate(toYMD(year, month, 1)));
}

/** 'الخميس، 8 أكتوبر' */
export function formatArabicShort(s) {
  return shortFmt.format(utcDate(s));
}

/** Arabic weekday names, Saturday first. */
export const WEEKDAYS_SAT_FIRST = ['السبت', 'الحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة'];

/**
 * Does an appointment fall on `day`? A yearly one occurs on its original date and the
 * same month-day in every later year (never earlier). 29 Feb only matches leap years.
 */
export function occursOn(event, day) {
  if (event.event_date === day) return true;
  if (!event.repeat_yearly) return false;
  return day > event.event_date && day.slice(5) === event.event_date.slice(5);
}

/** All dates in [start, end] (inclusive) on which the event occurs. */
export function occurrencesInRange(event, start, end) {
  const out = [];
  if (!event.repeat_yearly) {
    if (event.event_date >= start && event.event_date <= end) out.push(event.event_date);
    return out;
  }
  const md = event.event_date.slice(5);
  const firstYear = Math.max(Number(start.slice(0, 4)), Number(event.event_date.slice(0, 4)));
  const lastYear = Number(end.slice(0, 4));
  for (let y = firstYear; y <= lastYear; y++) {
    const d = `${String(y).padStart(4, '0')}-${md}`;
    if (!isValidYMD(d)) continue; // 29 Feb in a non-leap year
    if (d >= start && d <= end && d >= event.event_date) out.push(d);
  }
  return out;
}
