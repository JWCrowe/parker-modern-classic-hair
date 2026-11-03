import type { APIRoute } from 'astro';
import { json } from '../../../../lib/http';
import { listClients } from '../../../../lib/crm';

export const GET: APIRoute = async ({ url }) => json({ clients: await listClients(url.searchParams.get('q') || '') });
