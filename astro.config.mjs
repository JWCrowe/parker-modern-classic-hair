import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Server output: marketing pages opt into prerendering (`export const prerender = true`),
// admin pages and /api routes render on demand as Vercel Node functions.
export default defineConfig({
  // Until parkermodernclassichair.com DNS points at this project, site must match the live host
  // or Astro checkOrigin blocks admin form POSTs (Sign out, etc.).
  site: 'https://parker-modern-classic-hair.vercel.app',
  output: 'server',
  adapter: vercel({
    // Ensure Node.js serverless (not Edge) so Neon + bcryptjs work.
    maxDuration: 30,
  }),
  security: { checkOrigin: true },
});
