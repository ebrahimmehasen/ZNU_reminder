// Server-only Supabase client using the service-role key.
// Never import this file from a client component.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { ConfigError, requireEnv } from './env.js';

let client;

export function getSupabase() {
  if (!client) {
    const url = requireEnv('SUPABASE_URL');
    if (!/^https?:\/\/[^\s/]+/.test(url)) throw new ConfigError('SUPABASE_URL', 'قيمته مش لينك صحيح (لازم يبدأ بـ https://)');
    client = createClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
      // Never hang a request (or the morning cron) on an unreachable database.
      global: { fetch: (url, init = {}) => fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(10000), cache: 'no-store' }) },
    });
  }
  return client;
}

export class DbError extends Error {
  constructor(cause) {
    super('مش قادرين نوصل لقاعدة البيانات دلوقتي. جرّب تاني بعد شوية.');
    this.name = 'DbError';
    this.cause = cause;
    this.code = cause?.code;
  }
}

/** Throws DbError when a Supabase response carries an error; returns data otherwise. */
export function unwrap({ data, error }) {
  if (error) throw new DbError(error);
  return data;
}
