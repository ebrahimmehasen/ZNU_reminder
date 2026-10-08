import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  diffDays,
  formatArabicDate,
  formatTime12,
  isValidYMD,
  leadingBlanks,
  monthGrid,
  normalizeTime,
  occurrencesInRange,
  occursOn,
  shiftMonth,
  todayInCairo,
} from '../lib/dates.js';

test('Cairo today around midnight UTC (summer, UTC+3)', () => {
  assert.equal(todayInCairo(new Date('2026-10-07T20:59:00Z')), '2026-10-07');
  assert.equal(todayInCairo(new Date('2026-10-07T21:00:00Z')), '2026-10-08');
  assert.equal(todayInCairo(new Date('2026-10-07T23:59:00Z')), '2026-10-08');
  assert.equal(todayInCairo(new Date('2026-10-08T00:01:00Z')), '2026-10-08');
});

test('Cairo today around midnight UTC (winter, UTC+2)', () => {
  assert.equal(todayInCairo(new Date('2026-01-15T21:59:00Z')), '2026-01-15');
  assert.equal(todayInCairo(new Date('2026-01-15T22:00:00Z')), '2026-01-16');
  assert.equal(todayInCairo(new Date('2026-01-15T23:59:00Z')), '2026-01-16');
  assert.equal(todayInCairo(new Date('2026-01-16T00:01:00Z')), '2026-01-16');
});

test('date arithmetic crosses months, years and leap days', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-10-08', '2026-10-11'), 3);
  assert.equal(isValidYMD('2026-02-29'), false);
  assert.equal(isValidYMD('2028-02-29'), true);
  assert.equal(isValidYMD('2026-13-01'), false);
  assert.equal(isValidYMD('26-1-1'), false);
});

test('Saturday-first grid offsets', () => {
  // 1 Oct 2026 is a Thursday → Sat, Sun, Mon, Tue, Wed blank = 5
  assert.equal(leadingBlanks(2026, 10), 5);
  // 1 Aug 2026 is a Saturday → no blanks
  assert.equal(leadingBlanks(2026, 8), 0);
  // 1 Nov 2026 is a Sunday → 1 blank
  assert.equal(leadingBlanks(2026, 11), 1);
  const g = monthGrid(2026, 10);
  assert.equal(g.length % 7, 0);
  assert.equal(g[5], '2026-10-01');
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
});

test('times', () => {
  assert.equal(normalizeTime('10:30:00'), '10:30');
  assert.equal(normalizeTime(null), null);
  assert.equal(formatTime12('10:30'), '10:30 ص');
  assert.equal(formatTime12('19:00:00'), '7:00 م');
  assert.equal(formatTime12('00:05'), '12:05 ص');
  assert.equal(formatTime12('12:00'), '12:00 م');
});

test('Arabic date with Latin digits', () => {
  assert.equal(formatArabicDate('2026-10-08'), 'الخميس، 8 أكتوبر 2026');
});

test('yearly repeat occurs in later years, never earlier', () => {
  const e = { event_date: '2026-10-09', repeat_yearly: true };
  assert.equal(occursOn(e, '2026-10-09'), true);
  assert.equal(occursOn(e, '2027-10-09'), true);
  assert.equal(occursOn(e, '2030-10-09'), true);
  assert.equal(occursOn(e, '2025-10-09'), false);
  assert.equal(occursOn(e, '2027-10-10'), false);
  const once = { event_date: '2026-10-09', repeat_yearly: false };
  assert.equal(occursOn(once, '2027-10-09'), false);
  assert.deepEqual(occurrencesInRange(e, '2025-01-01', '2028-12-31'), ['2026-10-09', '2027-10-09', '2028-10-09']);
});

test('29 Feb repeats only in leap years', () => {
  const e = { event_date: '2024-02-29', repeat_yearly: true };
  assert.deepEqual(occurrencesInRange(e, '2024-01-01', '2029-12-31'), ['2024-02-29', '2028-02-29']);
  assert.equal(occursOn(e, '2028-02-29'), true);
});
