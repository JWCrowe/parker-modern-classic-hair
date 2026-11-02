// Single source of truth for business facts. Edit here, both pages update.

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

export type Service = {
  id: string;
  name: string;
  desc: string;
  duration: number; // minutes
  time: string;
  price: string;
  tag?: string;
};

export const services: Service[] = [
  { id: 'mens', name: 'Men’s Haircut', desc: 'A precise, detailed, clipper haircut. Complimentary wash and style if requested.', duration: 30, time: '30 min', price: '$38', tag: 'The Standard' },
  { id: 'beard', name: 'Beard', desc: 'Groom, straight razor, and detail beard.', duration: 30, time: '30 min', price: '$25' },
  { id: 'combo', name: 'Men’s Haircut & Beard', desc: 'Combine services.', duration: 60, time: '1 hr', price: '$55', tag: 'The Full Service' },
  { id: 'kids', name: "Kid's Haircut", desc: 'A precise, detailed, clipper haircut. Complimentary wash and style if requested. Age 15 and under.', duration: 30, time: '30 min', price: '$35' },
  { id: 'womens', name: "Women's Haircut", desc: 'Wash, cut, and blow dry.', duration: 60, time: '1 hr', price: '$55' },
];

// Day index matches JS Date.getDay(): 0 = Sunday. Hours are 24h decimals.
export const hours: Record<number, { open: number; close: number } | null> = {
  0: null,
  1: { open: 12, close: 19 },
  2: { open: 9, close: 17.5 },
  3: { open: 9, close: 17 },
  4: { open: 11, close: 18 },
  5: { open: 9, close: 17 },
  6: null,
};

export const hoursDisplay = [
  { day: 'Monday', short: 'Mon', idx: 1, label: '12 PM – 7 PM' },
  { day: 'Tuesday', short: 'Tue', idx: 2, label: '9 AM – 5:30 PM' },
  { day: 'Wednesday', short: 'Wed', idx: 3, label: '9 AM – 5 PM' },
  { day: 'Thursday', short: 'Thu', idx: 4, label: '11 AM – 6 PM' },
  { day: 'Friday', short: 'Fri', idx: 5, label: '9 AM – 5 PM' },
  { day: 'Saturday', short: 'Sat', idx: 6, label: 'Closed' },
  { day: 'Sunday', short: 'Sun', idx: 0, label: 'Closed' },
];

export const reviews = [
  { quote: 'Ben has been cutting my hair for over a year and I could not ask for a better barber. He understands the look and delivers.', name: 'Jordan Stone' },
  { quote: 'Took his time to listen and executed it exactly how I wanted. Efficient and detailed. 10/10.', name: 'Kotaro Goto' },
  { quote: 'Highly recommend Ben for any haircut or beard trim. Had me looking like a million dollars.', name: 'Donnie Carter' },
];

const u = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

export const heroImage = u('1503951914875-452162b0f3f1', 2000);

export const gallery = [
  { src: u('1622286342621-4bd786c2447c', 1100), label: 'Skin Fade', note: 'Tight taper, clean blend', cls: 'g-a' },
  { src: u('1599351431202-1e0f0137899a', 800), label: 'Razor Line-Up', note: 'Hard part, crisp edge', cls: 'g-b' },
  { src: u('1517832606299-7ae9b720a186', 800), label: 'Beard Detail', note: 'Shaped by hand', cls: 'g-c' },
  { src: u('1512690459411-b9245aed614b', 800), label: 'The Chair', note: 'Take a seat', cls: 'g-d' },
  { src: u('1532710093739-9470acff878f', 1100), label: 'Hot Lather', note: 'Straight razor finish', cls: 'g-e' },
  { src: u('1493256338651-d82f7acb2b38', 800), label: 'Clipper Work', note: 'Precise, detailed', cls: 'g-f' },
];
