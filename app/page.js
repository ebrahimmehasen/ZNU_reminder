'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { monthDayMap, upcomingItems } from '@/lib/calendar';
import {
  WEEKDAYS_SAT_FIRST,
  diffDays,
  formatArabicDate,
  formatArabicMonth,
  formatArabicShort,
  formatTime12,
  monthGrid,
  shiftMonth,
  todayInCairo,
} from '@/lib/dates';
import { APPROX_NOTE } from '@/lib/holidays';
import EventForm from './EventForm';
import { BellIcon, EditIcon, PlusIcon, PointLeft, PointRight, RepeatIcon, TrashIcon } from './icons';

const MAX_CHIPS = 3;

function relativeLabel(today, date) {
  const n = diffDays(today, date);
  if (n === 0) return 'النهارده';
  if (n === 1) return 'بكرة';
  if (n === 2) return 'بعد بكرة';
  if (n <= 10) return `بعد ${n} أيام`;
  return `بعد ${n} يوم`;
}

function occasionClass(o) {
  return o.official ? 'occ official' : 'occ';
}

export default function CalendarPage() {
  // "Today" is computed after mount: the page is prerendered, so deriving it during render would mismatch.
  const [today, setToday] = useState(null);
  const [view, setView] = useState(null);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, tone = 'ok') => setToast({ text, tone, key: Date.now() }), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.tone === 'error' ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const res = await fetch('/api/events', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'مش قادرين نجيب المواعيد دلوقتي.');
      setEvents(body.events ?? []);
      setStatus('ready');
      setLoadError('');
    } catch (err) {
      setStatus('error');
      setLoadError(err instanceof TypeError || err.name === 'TimeoutError' ? 'مفيش اتصال بالسيرفر.' : err.message);
    }
  }, []);

  useEffect(() => {
    const t = todayInCairo();
    setToday(t);
    setSelected(t);
    setView({ year: Number(t.slice(0, 4)), month: Number(t.slice(5, 7)) });
    load();
    // Keep "today" right if the tab stays open past midnight.
    const id = setInterval(() => setToday(todayInCairo()), 60000);
    return () => clearInterval(id);
  }, [load]);

  const dayMap = useMemo(() => (view ? monthDayMap(events, view.year, view.month) : new Map()), [events, view]);
  const cells = useMemo(() => (view ? monthGrid(view.year, view.month) : []), [view]);
  const upcoming = useMemo(() => (today ? upcomingItems(today, events, 8) : []), [today, events]);
  const selectedDay = useMemo(() => {
    if (!selected) return null;
    const y = Number(selected.slice(0, 4));
    const m = Number(selected.slice(5, 7));
    const map = view && view.year === y && view.month === m ? dayMap : monthDayMap(events, y, m);
    return map.get(selected) ?? { occasions: [], events: [] };
  }, [selected, view, dayMap, events]);

  function goTo(date) {
    setSelected(date);
    setView({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) });
  }

  function onSaved(body, editing) {
    setForm(null);
    const ev = body.event;
    setEvents((list) => (editing ? list.map((e) => (e.id === ev.id ? ev : e)) : [...list, ev]));
    goTo(ev.event_date >= today || !ev.repeat_yearly ? ev.event_date : selected);
    if (editing) notify('اتحفظ التعديل');
    else if (body.notified) notify('اتضاف المعاد واتبعت للجروب على تليجرام');
    else notify(`اتضاف المعاد، بس التنبيه موصلش للجروب. ${body.notifyError ?? ''}`, 'warn');
    load();
  }

  async function remove(ev) {
    setBusyId(ev.id);
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(body.error || 'مقدرناش نمسح المعاد.');
      setEvents((list) => list.filter((e) => e.id !== ev.id));
      notify('اتمسح المعاد');
      load();
    } catch (err) {
      notify(err instanceof TypeError ? 'مفيش اتصال بالسيرفر.' : err.message, 'error');
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'التنبيه التجريبي موصلش.');
      notify('اتبعتت رسالة تجريبية للجروب. بص على تليجرام');
    } catch (err) {
      notify(err instanceof TypeError ? 'مفيش اتصال بالسيرفر.' : err.message, 'error');
    } finally {
      setTesting(false);
    }
  }

  const ready = today && view;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/znu-logo.jpg" alt="شعار جامعة الزقازيق الأهلية" width={56} height={56} />
          <div>
            <h1>مواعيدنا</h1>
            <p className="tagline">جامعة الزقازيق الأهلية · التذكير بييجي على تليجرام</p>
          </div>
        </div>
        <button type="button" className="btn on-dark small" onClick={sendTest} disabled={testing}>
          <BellIcon width={16} height={16} />
          {testing ? 'بنبعت…' : 'جرّب التنبيه'}
        </button>
      </header>

      {status === 'error' ? (
        <div className="banner" role="alert">
          <p>
            <strong>{loadError}</strong> المناسبات المصرية ظاهرة عادي، بس مواعيدكم مش هتظهر لحد ما الاتصال يرجع.
          </p>
          <button type="button" className="btn small" onClick={load}>
            حاول تاني
          </button>
        </div>
      ) : null}

      <main className="layout">
        <section className="calendar" aria-label="الكالندر">
          <div className="cal-head">
            <h2 className="month-title" aria-live="polite">
              {ready ? formatArabicMonth(view.year, view.month) : ' '}
            </h2>
            <div className="cal-nav">
              <button type="button" className="icon-btn" aria-label="الشهر اللي فات" disabled={!ready} onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}>
                <PointRight />
              </button>
              <button type="button" className="btn small" disabled={!ready} onClick={() => goTo(today)}>
                النهارده
              </button>
              <button type="button" className="icon-btn" aria-label="الشهر الجاي" disabled={!ready} onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}>
                <PointLeft />
              </button>
            </div>
          </div>

          <div className="grid weekdays" aria-hidden="true">
            {WEEKDAYS_SAT_FIRST.map((d) => (
              <div key={d} className="weekday">
                {d}
              </div>
            ))}
          </div>

          <div className="grid days">
            {!ready
              ? Array.from({ length: 35 }, (_, i) => <div key={i} className="day skeleton" />)
              : cells.map((date, i) => {
                  if (!date) return <div key={`b${i}`} className="day blank" />;
                  const info = dayMap.get(date) ?? { occasions: [], events: [] };
                  const official = info.occasions.some((o) => o.official);
                  const all = [...info.occasions.map((o) => ({ o })), ...info.events.map((e) => ({ e }))];
                  const count = info.occasions.length + info.events.length;
                  const cls = ['day', date === today && 'today', date === selected && 'selected', official && 'holiday', date < today && 'past'].filter(Boolean).join(' ');
                  return (
                    <button
                      key={date}
                      type="button"
                      className={cls}
                      onClick={() => setSelected(date)}
                      aria-pressed={date === selected}
                      aria-label={`${formatArabicDate(date)}${count ? `، ${count} حاجة` : ''}`}
                    >
                      <span className="num">{Number(date.slice(8))}</span>
                      <span className="chips">
                        {all.slice(0, MAX_CHIPS).map((x) =>
                          x.o ? (
                            <span key={`o-${x.o.title}`} className={`chip ${occasionClass(x.o)}`}>
                              {x.o.title}
                            </span>
                          ) : (
                            <span key={`e-${x.e.id}`} className="chip ev">
                              {x.e.title}
                            </span>
                          ),
                        )}
                        {all.length > MAX_CHIPS ? <span className="more">+{all.length - MAX_CHIPS}</span> : null}
                      </span>
                      <span className="dots" aria-hidden="true">
                        {info.occasions.slice(0, 1).map((o) => (
                          <i key={o.title} className={`dot ${o.official ? 'd-official' : 'd-occ'}`} />
                        ))}
                        {info.events.slice(0, 3).map((e) => (
                          <i key={e.id} className="dot d-ev" />
                        ))}
                      </span>
                    </button>
                  );
                })}
          </div>

          <ul className="legend" aria-label="مفتاح الألوان">
            <li>
              <i className="dot d-ev" /> مواعيدنا
            </li>
            <li>
              <i className="dot d-official" /> إجازة رسمية
            </li>
            <li>
              <i className="dot d-occ" /> مناسبة
            </li>
            <li>
              <span className="approx-mark">≈</span> تاريخ هجري تقريبي
            </li>
          </ul>
        </section>

        <aside className="side">
          <section className="panel day-panel" aria-live="polite">
            {ready && selected ? (
              <>
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">{selected < today ? 'فات' : relativeLabel(today, selected)}</p>
                    <h2>{formatArabicDate(selected)}</h2>
                  </div>
                  <button type="button" className="btn primary small" onClick={() => setForm({ mode: 'add', date: selected })}>
                    <PlusIcon width={16} height={16} />
                    ضيف معاد
                  </button>
                </div>

                {selectedDay.occasions.map((o) => (
                  <article key={o.title} className={`occasion-card ${o.official ? 'official' : ''}`}>
                    <p className="occ-title">
                      {o.title}
                    </p>
                    <p className="tags">
                      <span className="tag">{o.official ? 'إجازة رسمية' : 'مناسبة مصرية'}</span>
                      {o.approximate ? <span className="tag approx">≈ {APPROX_NOTE}</span> : null}
                    </p>
                  </article>
                ))}

                {status === 'loading' ? <p className="muted">بنحمّل المواعيد…</p> : null}

                {selectedDay.events.map((e) => (
                  <article key={e.id} className="event-card">
                    <div className="event-main">
                      <h3>{e.title}</h3>
                      <p className="meta">
                        {e.event_time ? <span>🕐 {formatTime12(e.event_time)}</span> : <span>طول اليوم</span>}
                        {e.repeat_yearly ? (
                          <span className="repeat">
                            <RepeatIcon /> كل سنة من {e.event_date.slice(0, 4)}
                          </span>
                        ) : null}
                      </p>
                      {e.notes ? <p className="notes">{e.notes}</p> : null}
                      {e.created_by ? <p className="by">ضافه: {e.created_by}</p> : null}
                    </div>
                    {confirmDelete === e.id ? (
                      <div className="confirm" role="group" aria-label="تأكيد المسح">
                        <span>نمسحه خالص؟</span>
                        <button type="button" className="btn danger small" disabled={busyId === e.id} onClick={() => remove(e)}>
                          {busyId === e.id ? 'بنمسح…' : 'امسح'}
                        </button>
                        <button type="button" className="btn ghost small" onClick={() => setConfirmDelete(null)}>
                          لأ
                        </button>
                      </div>
                    ) : (
                      <div className="actions">
                        <button type="button" className="icon-btn small" aria-label={`عدّل ${e.title}`} onClick={() => setForm({ mode: 'edit', event: e })}>
                          <EditIcon />
                        </button>
                        <button type="button" className="icon-btn small" aria-label={`امسح ${e.title}`} onClick={() => setConfirmDelete(e.id)}>
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </article>
                ))}

                {status !== 'loading' && !selectedDay.events.length && !selectedDay.occasions.length ? (
                  <p className="empty">مفيش مواعيد في اليوم ده.</p>
                ) : null}
              </>
            ) : (
              <p className="muted">بنجهّز الكالندر…</p>
            )}
          </section>

          <section className="panel upcoming" aria-labelledby="up-title">
            <h2 id="up-title">الجاي قريب</h2>
            {!ready ? (
              <p className="muted">…</p>
            ) : upcoming.length ? (
              <ol>
                {upcoming.map((u) => (
                  <li key={`${u.kind}-${u.item.id ?? u.item.title}-${u.date}`}>
                    <button type="button" className="up-item" onClick={() => goTo(u.date)}>
                      <span className={`when ${u.date === today ? 'now' : ''}`}>{relativeLabel(today, u.date)}</span>
                      <span className="what">
                        <span className={u.kind === 'occasion' ? (u.item.official ? 'up-official' : 'up-occ') : ''}>
                          {u.kind === 'occasion' ? <i className={`dot ${u.item.official ? 'd-official' : 'd-occ'}`} aria-hidden="true" /> : null}
                          {u.item.title}
                          {u.item.approximate ? <span className="approx-mark" title={APPROX_NOTE}> ≈</span> : null}
                        </span>
                        <span className="sub">
                          {formatArabicShort(u.date)}
                          {u.kind === 'event' && u.item.event_time ? ` · ${formatTime12(u.item.event_time)}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty">مفيش حاجة جاية قريب.</p>
            )}
          </section>
        </aside>
      </main>

      {form ? <EventForm key={form.mode + (form.event?.id ?? form.date)} form={form} onClose={() => setForm(null)} onSaved={onSaved} /> : null}

      <div className="toast-region" aria-live="polite">
        {toast ? (
          <div key={toast.key} className={`toast ${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
            {toast.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
