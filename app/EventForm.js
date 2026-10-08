'use client';

import { useEffect, useRef, useState } from 'react';
import { LIMITS, validateEvent } from '@/lib/validate';
import { CloseIcon } from './icons';

const NAME_KEY = 'mawaeed:name';

export function loadSavedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name) {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
  } catch {
    // storage unavailable: nothing to remember
  }
}

function initialValues(form) {
  const e = form.event;
  return {
    title: e?.title ?? '',
    event_date: e?.event_date ?? form.date,
    event_time: e?.event_time ?? '',
    notes: e?.notes ?? '',
    repeat_yearly: e?.repeat_yearly ?? false,
    created_by: e ? (e.created_by ?? '') : loadSavedName(),
  };
}

/** Add / edit dialog. `form` is { mode: 'add', date } or { mode: 'edit', event }. */
export default function EventForm({ form, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [values, setValues] = useState(() => initialValues(form));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = form.mode === 'edit';

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((s) => ({ ...s, [k]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const v = validateEvent(values);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/events/${form.event.id}` : '/api/events', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v.value),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.fields) setErrors(body.fields);
        setFormError(body.error || 'مقدرناش نحفظ المعاد. جرّب تاني.');
        return;
      }
      saveName(v.value.created_by);
      onSaved(body, editing);
    } catch {
      setFormError('مفيش اتصال بالسيرفر. اتأكد من النت وجرّب تاني.');
    } finally {
      setSaving(false);
    }
  }

  const field = (k) => ({ id: `f-${k}`, 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `e-${k}` : undefined });
  const err = (k) =>
    errors[k] ? (
      <p className="field-error" id={`e-${k}`}>
        {errors[k]}
      </p>
    ) : null;

  return (
    <dialog ref={dialogRef} className="sheet" onClose={onClose} aria-labelledby="form-title">
      <form onSubmit={submit} noValidate>
        <header className="sheet-head">
          <h2 id="form-title">{editing ? 'تعديل المعاد' : 'معاد جديد'}</h2>
          <button type="button" className="icon-btn" onClick={() => dialogRef.current?.close()} aria-label="اقفل">
            <CloseIcon />
          </button>
        </header>

        <div className="fields">
          <label htmlFor="f-title">اسم المعاد</label>
          <input {...field('title')} value={values.title} onChange={set('title')} maxLength={LIMITS.title} required autoFocus placeholder="مثلاً: عيد ميلاد سارة" />
          {err('title')}

          <div className="row-2">
            <div>
              <label htmlFor="f-event_date">التاريخ</label>
              <input {...field('event_date')} type="date" value={values.event_date} onChange={set('event_date')} required />
              {err('event_date')}
            </div>
            <div>
              <label htmlFor="f-event_time">
                الوقت <span className="optional">(اختياري)</span>
              </label>
              <input {...field('event_time')} type="time" value={values.event_time} onChange={set('event_time')} />
              {err('event_time')}
            </div>
          </div>

          <label htmlFor="f-notes">
            ملاحظات <span className="optional">(اختياري، بتظهر في التذكير)</span>
          </label>
          <textarea {...field('notes')} value={values.notes} onChange={set('notes')} maxLength={LIMITS.notes} rows={3} />
          {err('notes')}

          <label className="check">
            <input type="checkbox" checked={values.repeat_yearly} onChange={set('repeat_yearly')} />
            <span>يتكرر كل سنة <span className="optional">(لأعياد الميلاد والمناسبات)</span></span>
          </label>
          {err('repeat_yearly')}

          <label htmlFor="f-created_by">
            اسمك <span className="optional">(اختياري)</span>
          </label>
          <input {...field('created_by')} value={values.created_by} onChange={set('created_by')} maxLength={LIMITS.createdBy} autoComplete="nickname" />
          {err('created_by')}
        </div>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <footer className="sheet-foot">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'بنحفظ…' : editing ? 'احفظ التعديل' : 'ضيف المعاد'}
          </button>
          <button type="button" className="btn ghost" onClick={() => dialogRef.current?.close()}>
            إلغاء
          </button>
        </footer>
      </form>
    </dialog>
  );
}
