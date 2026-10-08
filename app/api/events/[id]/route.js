import { errorJson, handleError, json, readJson } from '@/lib/http';
import { getSupabase, unwrap } from '@/lib/supabase';
import { isUuid, normalizeEventRow, validateEvent } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const COLUMNS = 'id, title, event_date, event_time, notes, repeat_yearly, created_by, created_at';
const NOT_FOUND = 'المعاد ده مش موجود. يمكن حد مسحه.';

export async function PUT(request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return errorJson('رقم المعاد مش صحيح', 400);

  const v = validateEvent(await readJson(request));
  if (!v.ok) return errorJson('في بيانات ناقصة أو مش صحيحة', 400, { fields: v.errors });

  try {
    const rows = unwrap(await getSupabase().from('events').update(v.value).eq('id', id).select(COLUMNS));
    if (!rows.length) return errorJson(NOT_FOUND, 404);
    return json({ event: normalizeEventRow(rows[0]) });
  } catch (err) {
    return handleError(err, 'PUT /api/events/[id]');
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return errorJson('رقم المعاد مش صحيح', 400);

  try {
    const rows = unwrap(await getSupabase().from('events').delete().eq('id', id).select('id'));
    if (!rows.length) return errorJson(NOT_FOUND, 404);
    return json({ deleted: id });
  } catch (err) {
    return handleError(err, 'DELETE /api/events/[id]');
  }
}
