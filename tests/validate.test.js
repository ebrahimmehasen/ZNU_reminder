import test from 'node:test';
import assert from 'node:assert/strict';
import { isUuid, validateEvent } from '../lib/validate.js';

test('valid minimal and full payloads are normalized', () => {
  const r = validateEvent({ title: '  اجتماع ', event_date: '2026-10-08' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { title: 'اجتماع', event_date: '2026-10-08', event_time: null, notes: null, repeat_yearly: false, created_by: null });
  const f = validateEvent({ title: 'x', event_date: '2026-10-08', event_time: '10:30:00', notes: ' n ', repeat_yearly: true, created_by: '' });
  assert.equal(f.ok, true);
  assert.equal(f.value.event_time, '10:30');
  assert.equal(f.value.notes, 'n');
  assert.equal(f.value.created_by, null);
});

test('rejects missing / invalid fields', () => {
  const r = validateEvent({ title: '  ', event_date: '2026-02-30', event_time: '25:00', repeat_yearly: 'yes' });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['event_date', 'event_time', 'repeat_yearly', 'title']);
  assert.equal(validateEvent(null).ok, false);
  assert.equal(validateEvent([]).ok, false);
  assert.equal(validateEvent({ title: 'x', event_date: '2026-10-08', event_time: 'abc' }).ok, false);
  assert.equal(validateEvent({ title: 'x', event_date: '2026-10-08', notes: 5 }).ok, false);
});

test('length limits', () => {
  const base = { event_date: '2026-10-08' };
  assert.equal(validateEvent({ ...base, title: 'ا'.repeat(200) }).ok, true);
  assert.equal(validateEvent({ ...base, title: 'ا'.repeat(201) }).ok, false);
  assert.equal(validateEvent({ ...base, title: 'x', notes: 'n'.repeat(2001) }).ok, false);
  assert.equal(validateEvent({ ...base, title: 'x', created_by: 'n'.repeat(61) }).ok, false);
});

test('uuid check', () => {
  assert.equal(isUuid('3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b'), true);
  assert.equal(isUuid('nope'), false);
  assert.equal(isUuid("1' or '1'='1"), false);
});
