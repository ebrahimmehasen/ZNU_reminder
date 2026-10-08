// Telegram Bot API sendMessage wrapper. Server only; the bot only sends.
import 'server-only';
import { requireEnv } from './env.js';
import { splitMessage } from './reminders.js';

export class TelegramError extends Error {
  constructor(description) {
    super(`تليجرام رفض الرسالة: ${description}`);
    this.name = 'TelegramError';
    this.description = description;
  }
}

async function sendChunk(token, chatId, text) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
  } catch (err) {
    // Do not include the URL: it contains the token.
    throw new TelegramError(err?.name === 'TimeoutError' ? 'انتهت مهلة الاتصال' : 'مش قادرين نوصل لسيرفر تليجرام');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // fall through
  }
  if (!body?.ok) throw new TelegramError(body?.description || `HTTP ${res.status}`);
  return body.result;
}

/** Sends `text` to the group, split into ≤4096-char chunks. Throws ConfigError or TelegramError. */
export async function sendTelegram(text) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');
  const results = [];
  for (const chunk of splitMessage(text)) results.push(await sendChunk(token, chatId, chunk));
  return results;
}
