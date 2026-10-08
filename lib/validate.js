// Server-side validation for an appointment. Pure.
import { normalizeTime, parseYMD } from './dates.js';

export const LIMITS = { title: 200, notes: 2000, createdBy: 60 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

function optionalText(v) {
  if (v == null) return null;
  if (typeof v !== 'string') return undefined; // signals a type error
  const t = v.trim();
  return t === '' ? null : t;
}

/**
 * Validates and normalizes an appointment payload.
 * Returns { ok: true, value } or { ok: false, errors: { field: 'رسالة' } }.
 */
export function validateEvent(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { _: 'البيانات المبعوتة مش مفهومة' } };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) errors.title = 'اكتب اسم المعاد';
  else if ([...title].length > LIMITS.title) errors.title = `اسم المعاد لازم يكون ${LIMITS.title} حرف بالكتير`;

  const date = parseYMD(input.event_date);
  if (!date) errors.event_date = 'التاريخ مش صحيح';
  else if (date.year < 1900 || date.year > 2099) errors.event_date = 'التاريخ لازم يكون بين سنة 1900 و 2099';

  let event_time = null;
  if (input.event_time != null && input.event_time !== '') {
    event_time = typeof input.event_time === 'string' ? normalizeTime(input.event_time) : null;
    const [h, m] = (event_time ?? '99:99').split(':').map(Number);
    if (!event_time || h > 23 || m > 59) errors.event_time = 'الوقت مش صحيح';
  }

  const notes = optionalText(input.notes);
  if (notes === undefined) errors.notes = 'الملاحظات لازم تكون نص';
  else if (notes && [...notes].length > LIMITS.notes) errors.notes = `الملاحظات لازم تكون ${LIMITS.notes} حرف بالكتير`;

  const created_by = optionalText(input.created_by);
  if (created_by === undefined) errors.created_by = 'الاسم لازم يكون نص';
  else if (created_by && [...created_by].length > LIMITS.createdBy) errors.created_by = `الاسم لازم يكون ${LIMITS.createdBy} حرف بالكتير`;

  const r = input.repeat_yearly;
  if (r != null && typeof r !== 'boolean') errors.repeat_yearly = 'قيمة التكرار مش صحيحة';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      event_date: input.event_date,
      event_time,
      notes,
      repeat_yearly: r === true,
      created_by,
    },
  };
}

/** Normalizes a database row for the client and message builders. */
export function normalizeEventRow(row) {
  return { ...row, event_time: normalizeTime(row.event_time) };
}
