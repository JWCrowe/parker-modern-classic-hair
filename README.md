# Parker Modern Classic Hair

Website for Ben's barber chair at 111 S Wall St Ste B, Calhoun, GA 30701.
Astro 5, fully static (`output: 'static'`), no backend.

## Run

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
npm run preview
```

## Structure

- `src/data/site.ts`: **single source of truth** for services, prices, durations, hours, contact info, reviews, and gallery images. Edit here and both pages update.
- `src/layouts/Layout.astro`: SEO/OG/Twitter meta, JSON-LD (HairSalon), fonts, grain overlay, scroll reveal JS, `ClientRouter` page transitions.
- `src/styles/global.css`: design tokens (ink/charcoal, brass, cream), type, buttons, frames, marquee, reveal animations.
- `src/components/`: `Header` (sticky header + full-screen mobile menu), `Footer`, `Marquee`.
- `src/pages/index.astro`: hero, price board, gallery, about Ben, reviews, hours/visit, mobile sticky Book bar.
- `src/pages/book.astro`: 5-step booking (service, date, time, details, done) with live ticket summary. Supports deep links like `/book?service=combo`.

## Design system

- Type: **Anton** (condensed display), **Instrument Serif** italic (accents, quotes), **Archivo** (body/UI). Loaded from Google Fonts.
- Color: ink `#0a0908`, charcoal `#121110`, brass `#c9a25a`, cream `#efe6d2`.
- Motion is CSS-first with a small IntersectionObserver for reveals. Respects `prefers-reduced-motion`.

## Booking

There is no backend. A submitted booking is logged to the console and saved in `localStorage` (`parker-bookings`). The confirmation screen gives the client one-tap **Text Ben** (`sms:`), **Email** (`mailto:`), and **Call** buttons, prefilled with the request, so Ben confirms every appointment personally. Swap in a real booking API later if wanted.

## Assets (`public/`)

- `logo-white.png`, `logo-black.png`, `ben-headshot.jpg`: originals, kept.
- `logo-cream.png`, `logo-brass.png`: transparent versions generated from `logo-white.png` for use on dark backgrounds.
- `ben-portrait.jpg`: portrait crop of `ben-headshot.jpg` used in the About section.
- `og.jpg`: 1200x630 social share image. `favicon.svg`: brass framed P mark.

## To do

- Replace the Unsplash style reference images in `gallery` (`src/data/site.ts`) with real photos of Ben's cuts. They are labeled "Style reference imagery" on the site until then.
- Replace the hero image (`heroImage`) with a real shot of the shop or chair.
- A dedicated professional photo of Ben would beat the cropped headshot.
