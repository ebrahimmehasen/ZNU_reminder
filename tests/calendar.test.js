import test from 'node:test';
import assert from 'node:assert/strict';
import { monthDayMap, upcomingItems } from '../lib/calendar.js';

const ev = (o) => ({ event_time: null, notes: null, repeat_yearly: false, ...o });

test('month map contains appointments, yearly repeats and occasions', () => {
  const events = [ev({ id: 'a', title: 'a', event_date: '2026-10-20' }), ev({ id: 'b', title: 'b', event_date: '2020-10-20', repeat_yearly: true })];
  const m = monthDayMap(events, 2026, 10);
  assert.deepEqual(m.get('2026-10-20').events.map((e) => e.id).sort(), ['a', 'b']);
  assert.equal(m.get('2026-10-06').occasions[0].title, 'عيد القوات المسلحة (نصر أكتوبر)');
  // Calendar-only Eid days still show on the calendar.
  assert.ok(monthDayMap([], 2026, 3).get('2026-03-21').occasions.some((o) => o.title.includes('تاني يوم')));
});

test('upcoming list is sorted, starts today, skips calendar-only days', () => {
  const events = [ev({ id: 'x', title: 'x', event_date: '2026-10-09', event_time: '09:00' }), ev({ id: 'old', title: 'old', event_date: '2026-10-01' })];
  const u = upcomingItems('2026-10-08', events, 5);
  assert.equal(u[0].date, '2026-10-09');
  assert.equal(u[0].item.id, 'x');
  assert.ok(u.every((x, i) => i === 0 || u[i - 1].date <= x.date));
  assert.ok(!u.some((x) => x.item.id === 'old'));
  const all = upcomingItems('2026-01-01', [], 100);
  assert.ok(!all.some((x) => x.item.title?.includes('تاني يوم')));
});
