// Read server env in both Vercel runtime (process.env) and `astro dev` (import.meta.env).
export function env(key: string): string | undefined {
  const p = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  if (p) return p;
  const m = (import.meta.env as Record<string, string | undefined>)[key];
  return m || undefined;
}

export function requireEnv(key: string): string {
  const v = env(key);
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
}
