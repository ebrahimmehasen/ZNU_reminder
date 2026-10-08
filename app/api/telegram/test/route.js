import { todayInCairo } from '@/lib/dates';
import { handleError, json } from '@/lib/http';
import { buildTestMessage } from '@/lib/reminders';
import { sendTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await sendTelegram(buildTestMessage(todayInCairo()));
    return json({ sent: true });
  } catch (err) {
    return handleError(err, 'POST /api/telegram/test');
  }
}
