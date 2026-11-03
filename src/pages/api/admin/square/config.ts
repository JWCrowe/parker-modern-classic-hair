import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { bad, json, readJson, str } from '../../../../lib/http';
import { listLocations, listServices, listTeam, updateSquareConn } from '../../../../lib/square';

// GET: Square locations, bookable team members, and appointment services for the settings form.
export const GET: APIRoute = async () => {
  try {
    const [locations, team, services] = await Promise.all([listLocations(), listTeam(), listServices()]);
    return json({ locations, team, services });
  } catch (e) {
    return bad((e as Error).message, 502);
  }
};

// POST { location_id?, team_member_id?, service_map?: { [localServiceId]: squareVariationId | '' } }
export const POST: APIRoute = async ({ request }) => {
  const b = await readJson(request);
  if (!b) return bad('Send JSON.');
  const patch: Record<string, string | undefined> = {};
  if (b.location_id !== undefined) {
    patch.location_id = str(b.location_id, 80) || undefined;
    patch.location_name = str(b.location_name, 120) || undefined;
  }
  if (b.team_member_id !== undefined) {
    patch.team_member_id = str(b.team_member_id, 80) || undefined;
    patch.team_member_name = str(b.team_member_name, 120) || undefined;
  }
  if (Object.keys(patch).length) await updateSquareConn(patch as any);
  if (b.service_map && typeof b.service_map === 'object') {
    const catalog = await listServices().catch(() => []);
    for (const [id, v] of Object.entries<string>(b.service_map)) {
      const varId = str(v, 80) || null;
      const hit = catalog.find((s) => s.variationId === varId);
      await sql()`update services set square_variation_id = ${varId}, square_variation_version = ${hit?.version ?? null} where id = ${id}`;
    }
  }
  return json({ ok: true });
};
