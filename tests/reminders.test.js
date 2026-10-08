import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, buildNewEventMessage, dueItems, escapeHtml, splitMessage } from '../lib/reminders.js';

const EXPECTED_EXAMPLE = `🔔 <b>تذكير المواعيد</b>

🔴 <b>النهارده</b> — الخميس، 8 أكتوبر 2026
• <b>اجتماع</b> — 🕐 10:30 ص

🟠 <b>بكرة</b> — الجمعة، 9 أكتوبر 2026
• <b>عيد ميلاد سارة</b>

🟡 <b>بعد 3 أيام</b> — الأحد، 11 أكتوبر 2026
• <b>فرح أحمد</b> — 🕐 7:00 م
   📝 هات هدية &lt;مهم&gt;`;

const ev = (o) => ({ event_time: null, notes: null, repeat_yearly: false, created_by: null, ...o });

test('digest matches the verified example exactly (three buckets, nearest first)', () => {
  const events = [
    ev({ title: 'فرح أحمد', event_date: '2026-10-11', event_time: '19:00:00', notes: 'هات هدية <مهم>' }),
    ev({ title: 'عيد ميلاد سارة', event_date: '1995-10-09', repeat_yearly: true }),
    ev({ title: 'اجتماع', event_date: '2026-10-08', event_time: '10:30' }),
    ev({ title: 'بعد يومين', event_date: '2026-10-10' }), // 2 days: no bucket
    ev({ title: 'فات', event_date: '2026-10-07' }),
  ];
  assert.equal(buildDigest('2026-10-08', events), EXPECTED_EXAMPLE);
});

test('empty digest returns nothing', () => {
  // 2026-10-12..15: no occasions due on day 0, +1 or +3
  assert.equal(buildDigest('2026-10-12', []), '');
  assert.equal(buildDigest('2026-10-12', [ev({ title: 'x', event_date: '2026-10-14' })]), '');
});

test('yearly repeat is reminded in later years but not before the original', () => {
  const bday = ev({ title: 'عيد ميلاد', event_date: '2026-11-20', repeat_yearly: true });
  assert.notEqual(buildDigest('2027-11-17', [bday]), '');
  assert.notEqual(buildDigest('2027-11-19', [bday]), '');
  assert.equal(buildDigest('2025-11-20', [bday]), '');
});

test('occasions appear with flag; Hijri ones are marked approximate; calendar-only days are skipped', () => {
  // Eid al-Fitr 2026 ≈ 2026-03-20. Today 2026-03-17 → +3 bucket.
  const d = buildDigest('2026-03-17', []);
  assert.match(d, /🟡 <b>بعد 3 أيام<\/b>/);
  assert.match(d, /• 🇪🇬 <b>عيد الفطر المبارك<\/b> \(تاريخ تقريبي حسب الرؤية\)/);
  // Today = 2nd day of Eid: 'تاني يوم' is calendar-only; 21 Mar (Mother's Day) is not.
  const d2 = buildDigest('2026-03-21', []);
  assert.doesNotMatch(d2, /تاني يوم/);
  assert.match(d2, /• 🇪🇬 <b>عيد الأم<\/b>$/m);
  // Fixed occasion has no approximate note.
  const d3 = buildDigest('2026-10-06', []);
  assert.match(d3, /• 🇪🇬 <b>عيد القوات المسلحة \(نصر أكتوبر\)<\/b>$/m);
});

test('dueItems groups by bucket', () => {
  const g = dueItems('2026-10-08', [ev({ title: 'a', event_date: '2026-10-09' })]);
  assert.deepEqual(g.map((x) => x.offset), [1]);
});

test('HTML escaping of user text', () => {
  assert.equal(escapeHtml('a & <b> "c"'), 'a &amp; &lt;b&gt; "c"');
  const msg = buildNewEventMessage(
    ev({ title: '<script>', event_date: '2026-10-08', event_time: '09:00', notes: 'x & y', repeat_yearly: true, created_by: 'مو <3' }),
  );
  assert.ok(msg.includes('📌 <b>&lt;script&gt;</b>'));
  assert.ok(msg.includes('📝 x &amp; y'));
  assert.ok(msg.includes('👤 ضافه: مو &lt;3'));
  assert.ok(msg.includes('🕐 9:00 ص'));
  assert.ok(msg.includes('🔁'));
  assert.ok(!msg.includes('<script>'));
});

test('new-appointment message omits empty optional fields', () => {
  const msg = buildNewEventMessage(ev({ title: 'x', event_date: '2026-10-08' }));
  assert.ok(!msg.includes('🕐'));
  assert.ok(!msg.includes('📝'));
  assert.ok(!msg.includes('👤'));
  assert.ok(!msg.includes('🔁'));
});

test('splitting over 4096 chars keeps lines and tags intact', () => {
  const events = Array.from({ length: 60 }, (_, i) =>
    ev({ title: `معاد رقم ${i}`, event_date: '2026-10-08', notes: 'ملاحظة طويلة & مهمة '.repeat(5) }),
  );
  const digest = buildDigest('2026-10-08', events);
  assert.ok(digest.length > 4096);
  const parts = splitMessage(digest);
  assert.ok(parts.length > 1);
  for (const p of parts) {
    assert.ok(p.length <= 4096);
    assert.equal((p.match(/<b>/g) || []).length, (p.match(/<\/b>/g) || []).length);
  }
  assert.equal(parts.join('\n').replace(/\n+/g, '\n'), digest.replace(/\n+/g, '\n'));
});

test('short message is not split; an over-long single line is cut without breaking entities', () => {
  assert.deepEqual(splitMessage('hello'), ['hello']);
  const line = `   📝 ${escapeHtml('&'.repeat(2000))}`;
  const parts = splitMessage(line, 4096);
  assert.ok(parts.length > 1);
  for (const p of parts) {
    assert.ok(p.length <= 4096);
    assert.doesNotMatch(p.replace(/&amp;/g, ''), /&/);
  }
});
