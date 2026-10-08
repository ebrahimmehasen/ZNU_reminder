import test from 'node:test';
import assert from 'node:assert/strict';
import { occasionsForYear, occasionsInRange, orthodoxEaster } from '../lib/holidays.js';

const REFERENCE = {
  'أول أيام شهر رمضان': ['2026-02-18', '2027-02-08'],
  'عيد الفطر المبارك': ['2026-03-20', '2027-03-09'],
  'عيد القيامة المجيد': ['2026-04-12', '2027-05-02'],
  'شم النسيم': ['2026-04-13', '2027-05-03'],
  'وقفة عرفات': ['2026-05-26', '2027-05-15'],
  'عيد الأضحى المبارك': ['2026-05-27', '2027-05-16'],
  'رأس السنة الهجرية': ['2026-06-16', '2027-06-06'],
  'المولد النبوي الشريف': ['2026-08-25', '2027-08-14'],
};

const HIJRI_TITLES = new Set(['أول أيام شهر رمضان', 'عيد الفطر المبارك', 'وقفة عرفات', 'عيد الأضحى المبارك', 'رأس السنة الهجرية', 'المولد النبوي الشريف']);

for (const [title, [d2026, d2027]] of Object.entries(REFERENCE)) {
  test(`reference date: ${title}`, () => {
    for (const [year, expected] of [[2026, d2026], [2027, d2027]]) {
      const found = occasionsForYear(year).filter((o) => o.title === title);
      assert.equal(found.length, 1, `${title} ${year}`);
      assert.equal(found[0].date, expected);
      assert.equal(found[0].approximate, HIJRI_TITLES.has(title));
    }
  });
}

test('orthodox Easter for a few known years', () => {
  assert.equal(orthodoxEaster(2024), '2024-05-05');
  assert.equal(orthodoxEaster(2025), '2025-04-20');
  assert.equal(orthodoxEaster(2026), '2026-04-12');
});

test('fixed occasions and official flags', () => {
  const y = occasionsForYear(2026);
  const oct6 = y.find((o) => o.date === '2026-10-06');
  assert.equal(oct6.official, true);
  assert.equal(oct6.approximate, false);
  const mothers = y.find((o) => o.title === 'عيد الأم');
  assert.equal(mothers.date, '2026-03-21');
  assert.equal(mothers.official, false);
  assert.equal(y.find((o) => o.title === 'شم النسيم').official, true);
  assert.equal(y.find((o) => o.title === 'عيد القيامة المجيد').official, false);
});

test('every Hijri occasion is approximate; extra Eid days are calendar-only', () => {
  const y = occasionsForYear(2026);
  for (const o of y.filter((o) => o.kind === 'hijri')) assert.equal(o.approximate, true);
  const fitr = y.filter((o) => o.title.startsWith('عيد الفطر'));
  assert.deepEqual(fitr.map((o) => o.date), ['2026-03-20', '2026-03-21', '2026-03-22']);
  assert.deepEqual(fitr.map((o) => o.remind), [true, false, false]);
  const adha = y.filter((o) => o.title.startsWith('عيد الأضحى'));
  assert.equal(adha.length, 4);
  assert.deepEqual(adha.map((o) => o.remind), [true, false, false, false]);
});

test('range across a year boundary', () => {
  const r = occasionsInRange('2026-12-30', '2027-01-08');
  assert.deepEqual(r.map((o) => o.date), ['2027-01-01', '2027-01-07']);
});
