import { errorJson, handleError, json, readJson } from '@/lib/http';
import { buildNewEventMessage } from '@/lib/reminders';
import { getSupabase, unwrap } from '@/lib/supabase';
import { sendTelegram } from '@/lib/telegram';
import { normalizeEventRow, validateEvent } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const COLUMNS = 'id, title, event_date, event_time, notes, repeat_yearly, created_by, created_at';

export async function GET() {
  try {
    const rows = unwrap(
      await getSupabase().from('events').select(COLUMNS).order('event_date').order('event_time', { nullsFirst: true }),
    );
    return json({ events: rows.map(normalizeEventRow) });
  } catch (err) {
    return handleError(err, 'GET /api/events');
  }
}

export async function POST(request) {
  const body = await readJson(request);
  const v = validateEvent(body);
  if (!v.ok) return errorJson('في بيانات ناقصة أو مش صحيحة', 400, { fields: v.errors });

  let event;
  try {
    event = normalizeEventRow(unwrap(await getSupabase().from('events').insert(v.value).select(COLUMNS).single()));
  } catch (err) {
    return handleError(err, 'POST /api/events');
  }

  // The appointment is saved; a Telegram failure must not fail the request.
  let notified = false;
  let notifyError = null;
  try {
    await sendTelegram(buildNewEventMessage(event));
    notified = true;
  } catch (err) {
    notifyError = err.message;
    console.error('[POST /api/events] telegram notification failed:', err.message);
  }
  return json({ event, notified, notifyError }, 201);
}
