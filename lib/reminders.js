// Pure builders for Telegram messages (HTML parse mode). No network, no database.
import { addDays, formatArabicDate, formatTime12, normalizeTime, occursOn } from './dates.js';
import { APPROX_NOTE, occasionsOn } from './holidays.js';

export const TELEGRAM_LIMIT = 4096;

// Nearest first.
export const BUCKETS = [
  { offset: 0, emoji: '🔴', label: 'النهارده' },
  { offset: 1, emoji: '🟠', label: 'بكرة' },
  { offset: 3, emoji: '🟡', label: 'بعد 3 أيام' },
];

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function notesLines(notes, indent) {
  const text = String(notes ?? '').trim();
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => (i === 0 ? `${indent}📝 ${escapeHtml(l)}` : `${indent}      ${escapeHtml(l)}`));
}

function compareEvents(a, b) {
  const ta = normalizeTime(a.event_time) ?? '';
  const tb = normalizeTime(b.event_time) ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), 'ar');
}

function occasionLine(o) {
  const approx = o.approximate ? ` (${APPROX_NOTE})` : '';
  return `• 🇪🇬 <b>${escapeHtml(o.title)}</b>${approx}`;
}

function eventLines(e) {
  const time = formatTime12(e.event_time);
  const head = `• <b>${escapeHtml(e.title)}</b>${time ? ` — 🕐 ${time}` : ''}`;
  return [head, ...notesLines(e.notes, '   ')];
}

/**
 * Items due for each reminder bucket relative to `today` ('YYYY-MM-DD', Cairo).
 * Returns [{ ...bucket, date, occasions, events }] for non-empty buckets only.
 */
export function dueItems(today, events) {
  const out = [];
  for (const b of BUCKETS) {
    const date = addDays(today, b.offset);
    const occasions = occasionsOn(date).filter((o) => o.remind);
    const evs = (events ?? []).filter((e) => occursOn(e, date)).sort(compareEvents);
    if (occasions.length || evs.length) out.push({ ...b, date, occasions, events: evs });
  }
  return out;
}

/** Counts entries in a dueItems() result. */
export function countItems(groups) {
  return groups.reduce((n, g) => n + g.occasions.length + g.events.length, 0);
}

/** The morning digest, or '' when nothing is due. */
export function buildDigest(today, events) {
  const groups = dueItems(today, events);
  if (!groups.length) return '';
  const lines = ['🔔 <b>تذكير المواعيد</b>'];
  for (const g of groups) {
    lines.push('', `${g.emoji} <b>${g.label}</b> — ${formatArabicDate(g.date)}`);
    for (const o of g.occasions) lines.push(occasionLine(o));
    for (const e of g.events) lines.push(...eventLines(e));
  }
  return lines.join('\n');
}

/** Announcement posted to the group when someone adds an appointment. */
export function buildNewEventMessage(e) {
  const lines = ['🆕 <b>معاد جديد اتضاف</b>', '', `📌 <b>${escapeHtml(e.title)}</b>`, `📅 ${formatArabicDate(e.event_date)}`];
  const time = formatTime12(e.event_time);
  if (time) lines.push(`🕐 ${time}`);
  if (e.repeat_yearly) lines.push('🔁 بيتكرر كل سنة');
  lines.push(...notesLines(e.notes, ''));
  if (e.created_by && String(e.created_by).trim()) lines.push(`👤 ضافه: ${escapeHtml(String(e.created_by).trim())}`);
  return lines.join('\n');
}

export function buildTestMessage(today) {
  return [
    '✅ <b>البوت شغّال</b>',
    '',
    'دي رسالة تجريبية من موقع مواعيدنا.',
    'لو شايفها يبقى التنبيهات هتوصل الجروب ده كل يوم الصبح.',
    today ? `📅 ${formatArabicDate(today)}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

// Cuts an over-long single line without splitting an HTML entity like '&amp;'.
function hardSplit(line, max) {
  const out = [];
  let rest = line;
  while (rest.length > max) {
    let cut = max;
    const amp = rest.lastIndexOf('&', cut - 1);
    if (amp !== -1 && amp > cut - 6 && !rest.slice(amp, cut).includes(';')) cut = amp;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  out.push(rest);
  return out;
}

/**
 * Splits a message into chunks of at most `max` characters on line boundaries,
 * which keeps every tag balanced (no tag spans a line in our messages).
 */
export function splitMessage(text, max = TELEGRAM_LIMIT) {
  if (text.length <= max) return [text];
  const chunks = [];
  let cur = '';
  const flush = () => {
    if (cur.trim()) chunks.push(cur.replace(/\n+$/, ''));
    cur = '';
  };
  for (const raw of text.split('\n')) {
    for (const line of raw.length > max ? hardSplit(raw, max) : [raw]) {
      const candidate = cur ? `${cur}\n${line}` : line;
      if (candidate.length > max) {
        flush();
        cur = line;
      } else {
        cur = candidate;
      }
    }
  }
  flush();
  return chunks;
}
