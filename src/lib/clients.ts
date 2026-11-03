import { sql } from './db';
import { fmtPhone, normPhone } from './http';

/** Find a client by Square id, email, or phone (last 10 digits); create if none. Fills in missing fields. */
export async function upsertClient(c: { name: string; email?: string | null; phone?: string | null; squareCustomerId?: string | null }) {
  const q = sql();
  const email = c.email?.trim().toLowerCase() || null;
  const digits = c.phone ? normPhone(c.phone) : '';
  const phone = digits ? fmtPhone(digits) : null;
  const sqId = c.squareCustomerId || null;
  const rows = await q`select * from clients
    where (${sqId}::text is not null and square_customer_id = ${sqId})
       or (${email}::text is not null and lower(email) = ${email})
       or (${digits}::text <> '' and right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = ${digits})
    order by (square_customer_id = ${sqId}) desc nulls last, (lower(email) = ${email}) desc nulls last, created_at asc
    limit 1`;
  if (rows.length) {
    const cur = rows[0];
    const up = await q`update clients set
        name = case when coalesce(name, '') = '' or name = 'Square client' then ${c.name || cur.name} else name end,
        email = coalesce(email, ${email}),
        phone = coalesce(phone, ${phone}),
        square_customer_id = coalesce(square_customer_id, ${sqId}),
        updated_at = now()
      where id = ${cur.id} returning *`;
    return up[0];
  }
  const ins = await q`insert into clients (name, email, phone, square_customer_id) values (${c.name || 'Square client'}, ${email}, ${phone}, ${sqId}) returning *`;
  return ins[0];
}
