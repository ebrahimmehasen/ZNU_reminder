import { timingSafeEqual } from 'node:crypto';
import { todayInCairo } from '@/lib/dates';
import { errorJson, handleError, json } from '@/lib/http';
import { buildDigest, countItems, dueItems } from '@/lib/reminders';
import { DbError, getSupabase, unwrap } from '@/lib/supabase';
import { sendTelegram } from '@/lib/telegram';
import { normalizeEventRow } from '@/lib/validate';

export const dynamic = 'force-dynamic';

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function authorized(request, url) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Bearer ') && safeEqual(header.slice(7), secret)) return true;
  const key = url.searchParams.get('key');
  return key != null && safeEqual(key, secret);
}

export async function GET(request) {
  const url = new URL(request.url);
  if (!authorized(request, url)) return errorJson('مش مسموح', 401);

  const force = url.searchParams.get('force') === '1';
  const today = todayInCairo();

  let db;
  let digest;
  let items;
  try {
    db = getSupabase();
    const rows = unwrap(await db.from('events').select('id, title, event_date, event_time, notes, repeat_yearly'));
    const events = rows.map(normalizeEventRow);
    digest = buildDigest(today, events);
    items = countItems(dueItems(today, events));
  } catch (err) {
    return handleError(err, 'cron');
  }

  if (!digest) return json({ today, sent: false, reason: 'مفيش حاجة النهارده' });

  // Claim the day so a double-fired cron cannot send twice. ?force=1 bypasses the claim.
  if (!force) {
    const { error } = await db.from('reminder_runs').insert({ run_date: today, items });
    if (error?.code === '23505') return json({ today, sent: false, reason: 'تذكير النهارده اتبعت قبل كده' });
    if (error) return handleError(new DbError(error), 'cron');
  }

  try {
    await sendTelegram(digest);
  } catch (err) {
    if (!force) {
      // Release the claim so a retry can succeed.
      const { error } = await db.from('reminder_runs').delete().eq('run_date', today);
      if (error) console.error('[cron] failed to release claim:', error.message);
    }
    return handleError(err, 'cron');
  }

  return json({ today, sent: true, items, forced: force });
}
