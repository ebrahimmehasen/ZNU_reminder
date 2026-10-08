// Egyptian occasions, computed in code for any year. Pure; used by server and browser.
import { addDays, daysInMonth, toYMD } from './dates.js';

export const APPROX_NOTE = 'تاريخ تقريبي حسب الرؤية';

// kind: 'fixed' | 'coptic' | 'hijri'. official = public day off. remind = included in Telegram reminders.
const FIXED = [
  { md: '01-01', title: 'رأس السنة الميلادية', official: false },
  { md: '01-07', title: 'عيد الميلاد المجيد', official: true },
  { md: '01-25', title: 'عيد الشرطة وثورة 25 يناير', official: true },
  { md: '03-21', title: 'عيد الأم', official: false },
  { md: '04-25', title: 'عيد تحرير سيناء', official: true },
  { md: '05-01', title: 'عيد العمال', official: true },
  { md: '06-30', title: 'ثورة 30 يونيو', official: true },
  { md: '07-23', title: 'ثورة 23 يوليو', official: true },
  { md: '10-06', title: 'عيد القوات المسلحة (نصر أكتوبر)', official: true },
];

// Keyed by 'month-day' of the Umm al-Qura Hijri calendar.
const HIJRI = {
  '1-1': { title: 'رأس السنة الهجرية', official: true, remind: true },
  '3-12': { title: 'المولد النبوي الشريف', official: true, remind: true },
  '9-1': { title: 'أول أيام شهر رمضان', official: false, remind: true },
  '10-1': { title: 'عيد الفطر المبارك', official: true, remind: true },
  '10-2': { title: 'عيد الفطر (تاني يوم)', official: true, remind: false },
  '10-3': { title: 'عيد الفطر (تالت يوم)', official: true, remind: false },
  '12-9': { title: 'وقفة عرفات', official: true, remind: true },
  '12-10': { title: 'عيد الأضحى المبارك', official: true, remind: true },
  '12-11': { title: 'عيد الأضحى (تاني يوم)', official: true, remind: false },
  '12-12': { title: 'عيد الأضحى (تالت يوم)', official: true, remind: false },
  '12-13': { title: 'عيد الأضحى (رابع يوم)', official: true, remind: false },
};

/** Orthodox Easter (Gregorian 'YYYY-MM-DD'): Meeus Julian algorithm + 13 days. Valid 1900–2099. */
export function orthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // Julian date expressed as a proleptic UTC date, then shifted to Gregorian.
  return addDays(toYMD(year, month, day), 13);
}

const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/** Hijri { year, month, day } (Umm al-Qura, astronomical estimate) for a Gregorian date. */
export function hijriParts(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const parts = hijriFmt.formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

const yearCache = new Map();

/**
 * All occasions in a Gregorian year, sorted by date.
 * Each: { date, title, official, approximate, remind, kind, isOccasion: true }.
 */
export function occasionsForYear(year) {
  if (yearCache.has(year)) return yearCache.get(year);
  const list = [];

  for (const f of FIXED) {
    list.push({ date: `${year}-${f.md}`, title: f.title, official: f.official, approximate: false, remind: true, kind: 'fixed' });
  }

  const easter = orthodoxEaster(year);
  list.push({ date: easter, title: 'عيد القيامة المجيد', official: false, approximate: false, remind: true, kind: 'coptic' });
  list.push({ date: addDays(easter, 1), title: 'شم النسيم', official: true, approximate: false, remind: true, kind: 'coptic' });

  // Walk every day of the year once; a Hijri month-day can occur twice in one Gregorian year.
  for (let m = 1; m <= 12; m++) {
    const n = daysInMonth(year, m);
    for (let d = 1; d <= n; d++) {
      const date = toYMD(year, m, d);
      const h = hijriParts(date);
      const def = HIJRI[`${h.month}-${h.day}`];
      if (def) list.push({ date, ...def, approximate: true, kind: 'hijri' });
    }
  }

  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const o of list) o.isOccasion = true;
  yearCache.set(year, list);
  return list;
}

/** Occasions with start <= date <= end. */
export function occasionsInRange(start, end) {
  const out = [];
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    for (const o of occasionsForYear(y)) if (o.date >= start && o.date <= end) out.push(o);
  }
  return out;
}

export function occasionsOn(date) {
  return occasionsInRange(date, date);
}
