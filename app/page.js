'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { monthDayMap, upcomingItems } from '@/lib/calendar';
import { WEEKDAYS_SAT_FIRST, diffDays, formatArabicDate, formatTime12, monthGrid, shiftMonth, todayInCairo } from '@/lib/dates';
import { APPROX_NOTE } from '@/lib/holidays';
import EventForm from './EventForm';
import { BellIcon, EditIcon, PlusIcon, PointLeft, PointRight, RepeatIcon, TrashIcon } from './icons';
import ThemeToggle from './ThemeToggle';

const monthFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { timeZone: 'UTC', month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { timeZone: 'UTC', weekday: 'long' });

function monthName(date) {
  return monthFmt.format(new Date(`${date}T00:00:00Z`));
}

function weekdayName(date) {
  return weekdayFmt.format(new Date(`${date}T00:00:00Z`));
}

const MAX_CHIPS = 2;
const WEEKDAY_LETTERS = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];

function relativeLabel(today, date) {
  const n = diffDays(today, date);
  if (n === 0) return 'النهارده';
  if (n === 1) return 'بكرة';
  if (n === 2) return 'بعد بكرة';
  if (n <= 10) return `بعد ${n} أيام`;
  return `بعد ${n} يوم`;
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
  const monthSummary = useMemo(() => {
    let n = 0;
    for (const v of dayMap.values()) n += v.events.length;
    if (n === 0) return 'مفيش مواعيد الشهر ده';
    if (n === 1) return 'معاد واحد الشهر ده';
    if (n === 2) return 'معادين الشهر ده';
    return `${n} ${n <= 10 ? 'مواعيد' : 'معاد'} الشهر ده`;
  }, [dayMap]);
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
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/znu-logo.jpg" alt="شعار جامعة الزقازيق الأهلية" width={44} height={44} />
          <div>
            <p className="brand-name">مواعيدنا</p>
            <p className="brand-sub">جامعة الزقازيق الأهلية</p>
          </div>
        </div>

        <section className="today-card" aria-live="polite">
          {ready && selected ? (
            <>
              <p className="tc-label">{selected < today ? 'فات' : relativeLabel(today, selected)}</p>
              <div className="tc-date">
                <span className="tc-num">{Number(selected.slice(8))}</span>
                <div>
                  <p className="tc-weekday">{weekdayName(selected)}</p>
                  <p className="tc-month">
                    {monthName(selected)} {selected.slice(0, 4)}
                  </p>
                </div>
              </div>

              {selectedDay.occasions.map((o) => (
                <div key={o.title} className={`tc-occasion ${o.official ? 'holiday' : 'occasion'}`}>
                  <p className="tc-occ-title">{o.title}</p>
                  <p className="tc-occ-tags">
                    {o.official ? 'إجازة رسمية' : 'مناسبة مصرية'}
                    {o.approximate ? ` · ≈ ${APPROX_NOTE}` : ''}
                  </p>
                </div>
              ))}

              {status === 'loading' ? <p className="tc-empty">بنحمّل المواعيد…</p> : null}

              {selectedDay.events.length ? (
                <ul className="tc-events">
                  {selectedDay.events.map((e) => (
                    <li key={e.id} className="tc-event">
                      <div className="tc-event-row">
                        <span className="tc-time">{e.event_time ? formatTime12(e.event_time) : 'طول اليوم'}</span>
                        {confirmDelete === e.id ? null : (
                          <span className="tc-actions">
                            <button type="button" className="icon-btn" aria-label={`عدّل ${e.title}`} onClick={() => setForm({ mode: 'edit', event: e })}>
                              <EditIcon />
                            </button>
                            <button type="button" className="icon-btn" aria-label={`امسح ${e.title}`} onClick={() => setConfirmDelete(e.id)}>
                              <TrashIcon />
                            </button>
                          </span>
                        )}
                      </div>
                      <p className="tc-event-title">{e.title}</p>
                      {e.notes ? <p className="tc-notes">{e.notes}</p> : null}
                      {e.repeat_yearly || e.created_by ? (
                        <p className="tc-meta">
                          {e.repeat_yearly ? (
                            <span className="repeat">
                              <RepeatIcon /> كل سنة من {e.event_date.slice(0, 4)}
                            </span>
                          ) : null}
                          {e.created_by ? <span>ضافه: {e.created_by}</span> : null}
                        </p>
                      ) : null}
                      {confirmDelete === e.id ? (
                        <div className="confirm" role="group" aria-label="تأكيد المسح">
                          <span>نمسحه خالص؟</span>
                          <button type="button" className="btn danger small" disabled={busyId === e.id} onClick={() => remove(e)}>
                            {busyId === e.id ? 'بنمسح…' : 'امسح'}
                          </button>
                          <button type="button" className="btn outline small" onClick={() => setConfirmDelete(null)}>
                            لأ
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : status !== 'loading' && !selectedDay.occasions.length ? (
                <p className="tc-empty">مفيش مواعيد في اليوم ده.</p>
              ) : null}

              <button type="button" className="btn primary block" onClick={() => setForm({ mode: 'add', date: selected })}>
                <PlusIcon width={18} height={18} />
                ضيف معاد في اليوم ده
              </button>
            </>
          ) : (
            <p className="tc-empty">بنجهّز الكالندر…</p>
          )}
        </section>

        <section className="legend-box" aria-labelledby="legend-title">
          <h2 id="legend-title" className="legend-title">
            مفتاح الألوان
          </h2>
          <ul className="legend">
            <li>
              <i className="dot d-holiday" aria-hidden="true" /> إجازة رسمية
            </li>
            <li>
              <i className="dot d-occasion" aria-hidden="true" /> مناسبة
            </li>
            <li>
              <span className="approx-mark" aria-hidden="true">
                ≈
              </span>{' '}
              تاريخ هجري تقريبي
            </li>
          </ul>
        </section>

        <div className="rail-actions">
          <button type="button" className="btn outline grow" onClick={sendTest} disabled={testing}>
            <BellIcon width={18} height={18} />
            {testing ? 'بنبعت…' : 'جرّب التنبيه'}
          </button>
          <ThemeToggle className="btn outline square" />
        </div>
      </aside>

      <main className="main">
        {status === 'error' ? (
          <div className="banner" role="alert">
            <p>
              <strong>{loadError}</strong> المناسبات المصرية ظاهرة عادي، بس مواعيدكم مش هتظهر لحد ما الاتصال يرجع.
            </p>
            <button type="button" className="btn outline small" onClick={load}>
              حاول تاني
            </button>
          </div>
        ) : null}

        <div className="top-row">
          <div className="title-group">
            <h1 className="month-title" aria-live="polite">
              {ready ? (
                <>
                  {monthName(`${view.year}-${String(view.month).padStart(2, '0')}-01`)} <span className="year">{view.year}</span>
                </>
              ) : (
                ' '
              )}
            </h1>
            <p className="month-summary">{ready ? monthSummary : ' '}</p>
          </div>
          <div className="month-nav" role="group" aria-label="التنقل بين الشهور">
            <button type="button" className="nav-btn" aria-label="الشهر اللي فات" disabled={!ready} onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}>
              <PointRight />
            </button>
            <button type="button" className="nav-btn text" disabled={!ready} onClick={() => goTo(today)}>
              النهارده
            </button>
            <button type="button" className="nav-btn" aria-label="الشهر الجاي" disabled={!ready} onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}>
              <PointLeft />
            </button>
          </div>
        </div>

        <section aria-label="الكالندر">
          <div className="weekdays" aria-hidden="true">
            {WEEKDAYS_SAT_FIRST.map((d, i) => (
              <div key={d} className="weekday">
                <span className="wd-long">{d}</span>
                <span className="wd-short">{WEEKDAY_LETTERS[i]}</span>
              </div>
            ))}
          </div>

          <div className="month-grid">
            {!ready
              ? Array.from({ length: 35 }, (_, i) => <div key={i} className="cell skeleton" />)
              : cells.map((date, i) => {
                  if (!date) return <div key={`b${i}`} className="cell blank" aria-hidden="true" />;
                  const info = dayMap.get(date) ?? { occasions: [], events: [] };
                  const official = info.occasions.some((o) => o.official);
                  const mark = official ? 'holiday' : info.occasions.length ? 'occasion' : '';
                  const count = info.occasions.length + info.events.length;
                  const cls = ['cell', mark, date === today && 'today', date === selected && 'selected', date < today && 'past'].filter(Boolean).join(' ');
                  return (
                    <button
                      key={date}
                      type="button"
                      className={cls}
                      onClick={() => setSelected(date)}
                      aria-pressed={date === selected}
                      aria-label={`${formatArabicDate(date)}${count ? `، ${count} حاجة` : ''}`}
                    >
                      <span className="cell-num">{Number(date.slice(8))}</span>
                      {info.occasions.map((o) => (
                        <span key={o.title} className={`cell-label ${o.official ? 'holiday' : 'occasion'}`}>
                          {o.title}
                          {o.approximate ? ' ≈' : ''}
                        </span>
                      ))}
                      {info.events.length ? (
                        <span className="chips">
                          {info.events.slice(0, MAX_CHIPS).map((e) => (
                            <span key={e.id} className="chip">
                              {e.title}
                            </span>
                          ))}
                          {info.events.length > MAX_CHIPS ? <span className="chip more">+{info.events.length - MAX_CHIPS}</span> : null}
                        </span>
                      ) : null}
                      {date === today ? <span className="today-tag">النهارده</span> : null}
                      {count ? (
                        <span className="cell-dots" aria-hidden="true">
                          {info.occasions.slice(0, 1).map((o) => (
                            <i key={o.title} className={`dot ${o.official ? 'd-holiday' : 'd-occasion'}`} />
                          ))}
                          {info.events.slice(0, 3).map((e) => (
                            <i key={e.id} className="dot d-event" />
                          ))}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
          </div>
        </section>

        <section className="upcoming" aria-labelledby="up-title">
          <h2 id="up-title">الجاي قريب</h2>
          {!ready ? (
            <p className="muted">…</p>
          ) : upcoming.length ? (
            <ol className="up-grid">
              {upcoming.map((u) => (
                <li key={`${u.kind}-${u.item.id ?? u.item.title}-${u.date}`}>
                  <button type="button" className="up-card" onClick={() => goTo(u.date)}>
                    <span className="up-top">
                      <span className="up-date">
                        {Number(u.date.slice(8))} {monthName(u.date)}
                      </span>
                      {u.kind === 'occasion' ? (
                        <span className={`type-tag ${u.item.official ? 'holiday' : 'occasion'}`}>
                          <i className={`dot ${u.item.official ? 'd-holiday' : 'd-occasion'}`} aria-hidden="true" />
                          {u.item.official ? 'إجازة رسمية' : 'مناسبة'}
                        </span>
                      ) : u.item.event_time ? (
                        <span className="type-tag event">{formatTime12(u.item.event_time)}</span>
                      ) : null}
                    </span>
                    <span className="up-title">
                      {u.item.title}
                      {u.item.approximate ? (
                        <span className="approx-mark" title={APPROX_NOTE}>
                          {' '}≈
                        </span>
                      ) : null}
                    </span>
                    <span className="up-count">{relativeLabel(today, u.date)}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">مفيش حاجة جاية قريب.</p>
          )}
        </section>
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
