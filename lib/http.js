// Small helpers shared by the API routes. Server only.
import 'server-only';
import { ConfigError } from './env.js';
import { DbError } from './supabase.js';
import { TelegramError } from './telegram.js';

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function errorJson(message, status, extra = {}) {
  return json({ error: message, ...extra }, status);
}

/** Maps a thrown error to an Arabic JSON response; never leaks a stack trace. */
export function handleError(err, context) {
  if (err instanceof ConfigError) return errorJson(err.message, 500, { variable: err.variable });
  if (err instanceof DbError) {
    console.error(`[${context}] database error:`, err.cause?.message ?? err.cause);
    return errorJson(err.message, 503);
  }
  if (err instanceof TelegramError) return errorJson(err.message, 502);
  console.error(`[${context}] unexpected error:`, err);
  return errorJson('حصلت مشكلة غير متوقعة. جرّب تاني.', 500);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
