// Pure helpers for the calendar view. Shared by the page and tests.
import { addDays, daysInMonth, normalizeTime, occurrencesInRange, toYMD } from './dates.js';
import { occasionsInRange } from './holidays.js';

function byTime(a, b) {
  const ta = normalizeTime(a.event_time) ?? '';
  const tb = normalizeTime(b.event_time) ?? '';
  return ta < tb ? -1 : ta > tb ? 1 : String(a.title).localeCompare(String(b.title), 'ar');
}

/** Map of 'YYYY-MM-DD' → { occasions, events } for every day in [start, end]. */
export function buildDayMap(events, start, end) {
  const map = new Map();
  const slot = (d) => {
    if (!map.has(d)) map.set(d, { occasions: [], events: [] });
    return map.get(d);
  };
  for (const o of occasionsInRange(start, end)) slot(o.date).occasions.push(o);
  for (const e of events ?? []) for (const d of occurrencesInRange(e, start, end)) slot(d).events.push(e);
  for (const v of map.values()) v.events.sort(byTime);
  return map;
}

/** Day map for one month. */
export function monthDayMap(events, year, month) {
  return buildDayMap(events, toYMD(year, month, 1), toYMD(year, month, daysInMonth(year, month)));
}

/**
 * The next `limit` items from `today` (inclusive) within `horizonDays`:
 * appointments (yearly ones expanded) and main occasions (calendar-only days skipped).
 * Each: { date, kind: 'event' | 'occasion', item }.
 */
export function upcomingItems(today, events, limit = 8, horizonDays = 366) {
  const end = addDays(today, horizonDays);
  const out = [];
  for (const o of occasionsInRange(today, end)) if (o.remind) out.push({ date: o.date, kind: 'occasion', item: o });
  for (const e of events ?? []) for (const d of occurrencesInRange(e, today, end)) out.push({ date: d, kind: 'event', item: e });
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === 'occasion' ? -1 : 1;
    return a.kind === 'event' ? byTime(a.item, b.item) : 0;
  });
  return out.slice(0, limit);
}
