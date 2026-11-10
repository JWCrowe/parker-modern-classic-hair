// Business facts that do not live in Square (address, phone, reviews, photos).

export const business = {
  name: 'Parker Modern Classic Hair',
  short: 'Parker',
  barber: 'Ben',
  est: '2009',
  street: '111 S Wall St Ste B',
  city: 'Calhoun',
  region: 'GA',
  zip: '30701',
  phone: '(706) 403-9150',
  phoneHref: 'tel:7064039150',
  smsHref: 'sms:7064039150',
  email: 'benjamin3241959@yahoo.com',
  rating: '5.0',
  reviewCount: '28+',
  mapsHref:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Parker Modern Classic Hair, 111 S Wall St Ste B, Calhoun, GA 30701'),
};

// Services, prices, and durations are NOT kept here. Square Appointments is the source of truth:
// see src/lib/catalog.ts. Ben edits services and hours in Square and the site follows.

// Hours fallback only: used until Square is connected (or if no business hours are posted in Square).
// Day index matches JS Date.getDay(): 0 = Sunday. Hours are 24h decimals.
export const fallbackHours: Record<number, { open: number; close: number } | null> = {
  0: null,
  1: { open: 12, close: 19 },
  2: { open: 9, close: 17.5 },
  3: { open: 9, close: 17 },
  4: { open: 11, close: 18 },
  5: { open: 9, close: 17 },
  6: null,
};

export const reviews = [
  { quote: 'Ben has been cutting my hair for over a year and I could not ask for a better barber. He understands the look and delivers.', name: 'Jordan Stone' },
  { quote: 'Took his time to listen and executed it exactly how I wanted. Efficient and detailed. 10/10.', name: 'Kotaro Goto' },
  { quote: 'Highly recommend Ben for any haircut or beard trim. Had me looking like a million dollars.', name: 'Donnie Carter' },
];

const u = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

// Style reference photography (Unsplash): dark shop floor, warm wood, chair, razor work.
export const heroImage = u('1622287162716-f311baa1a2b8', 2000);
export const floorImage = u('1585747860715-2ba37e788b70', 2000);

export const gallery = [
  { src: u('1622286342621-4bd786c2447c', 900), label: 'Skin Fade', note: 'Tight taper, clean blend', cls: 'g-a' },
  { src: u('1599351431202-1e0f0137899a', 900), label: 'Razor Line-Up', note: 'Hard part, crisp edge', cls: 'g-b' },
  { src: u('1532710093739-9470acff878f', 900), label: 'Hot Lather', note: 'Straight razor finish', cls: 'g-c' },
  { src: u('1512690459411-b9245aed614b', 900), label: 'The Chair', note: 'Take a seat', cls: 'g-d' },
  { src: u('1514336937476-a5b961020a5c', 900), label: 'Clipper Work', note: 'Precise, detailed', cls: 'g-e' },
  { src: u('1517832606299-7ae9b720a186', 900), label: 'Beard Detail', note: 'Shaped by hand', cls: 'g-f' },
];
