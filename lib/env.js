// Reads required environment variables with a clear Arabic error. Server only.
import 'server-only';

export class ConfigError extends Error {
  constructor(name) {
    super(`المتغير ${name} مش متظبط في إعدادات البيئة (Environment Variables). ضيفه وأعد التشغيل.`);
    this.name = 'ConfigError';
    this.variable = name;
  }
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new ConfigError(name);
  return v.trim();
}
