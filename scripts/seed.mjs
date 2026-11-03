// Usage: npm run seed  (reads .env). Runs migrations in db/migrations, creates the admin if missing.
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const dir = join(root, 'db', 'migrations');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const text = readFileSync(join(dir, f), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  for (const stmt of text.split(';').map((s) => s.trim()).filter(Boolean)) {
    await sql.query(stmt);
  }
  console.log(`migrated ${f}`);
}

const existing = await sql`select email from admins`;
if (existing.length) {
  console.log(`admin already exists (${existing.length}); skipping. Change the password from /admin/settings.`);
} else if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log('No admin yet and ADMIN_EMAIL / ADMIN_PASSWORD are not set; skipping admin seed.');
} else {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await sql`insert into admins (email, password_hash, name) values (${ADMIN_EMAIL.trim().toLowerCase()}, ${hash}, ${ADMIN_NAME || 'Ben'})`;
  console.log('admin created for', ADMIN_EMAIL.replace(/^(.).*(@.*)$/, '$1***$2'));
}
console.log('seed done');
