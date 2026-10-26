export const CITIES = {
  Bengaluru: { prefix: '560', tier: 'Tier 1' },
  Mysuru: { prefix: '570', tier: 'Tier 2' },
  Mangaluru: { prefix: '575', tier: 'Tier 2' },
  'Hubballi-Dharwad': { prefix: '580', tier: 'Tier 2' },
  Belagavi: { prefix: '590', tier: 'Tier 2' },
  Tumakuru: { prefix: '572', tier: 'Tier 3' },
  Davanagere: { prefix: '577', tier: 'Tier 3' },
};

export const CITY_ALIASES = {
  bengaluru: 'Bengaluru', bangalore: 'Bengaluru', blr: 'Bengaluru',
  mysuru: 'Mysuru', mysore: 'Mysuru',
  mangaluru: 'Mangaluru', mangalore: 'Mangaluru',
  'hubballi-dharwad': 'Hubballi-Dharwad', hubballi: 'Hubballi-Dharwad', hubli: 'Hubballi-Dharwad',
  dharwad: 'Hubballi-Dharwad', 'hubli-dharwad': 'Hubballi-Dharwad', 'hubballi dharwad': 'Hubballi-Dharwad',
  belagavi: 'Belagavi', belgaum: 'Belagavi',
  tumakuru: 'Tumakuru', tumkur: 'Tumakuru',
  davanagere: 'Davanagere', davangere: 'Davanagere',
};

// Where a new partner shadows an existing store during training.
export const SHADOW_CITY = { Tumakuru: 'Bengaluru', Davanagere: 'Hubballi-Dharwad' };

export const DEFAULT_PROFILE = {
  brandName: 'Your brand',
  minInvestment: { 'Tier 1': 30, 'Tier 2': 22, 'Tier 3': 18 },
  rejectShortfall: 25, // percent below the minimum that means Reject instead of Hold
  minSize: 300,
  maxSize: 3000, // above this, a "much larger than a typical store" warning
  upperFloorOk: false, // false: upper floors go on hold (walk-in retail needs street-level footfall)
  minScore: { High: 50, Medium: 60, Low: 70 },
};

// Labels for the franchisee readiness score (display only; outcomes don't use them). Highest first.
export const READINESS_BANDS = [
  { min: 75, label: 'Ready' },
  { min: 50, label: 'Nearly ready' },
  { min: 0, label: 'Not ready' },
];

// Conditional: won a slot, approved once a condition is met. Redirect: would qualify, offered a free pin instead.
// Withdrawn: taken out of the pool in chat (pulled out, or a duplicate).
export const OUTCOMES = ['Recommended', 'Conditional', 'Redirect', 'Waitlist', 'Hold', 'Reject', 'Withdrawn'];

// Actions a reviewer can schedule for a recommended partner.
export const NEXT_STEP_TYPES = {
  visit: { label: 'Site visit', icon: '📍', minutes: 90 },
  call: { label: 'Call', icon: '📞', minutes: 30 },
  signing: { label: 'Agreement signing', icon: '✍️', minutes: 60 },
};

export const PIPELINE =['Site visit', 'Agreement', 'Store setup', 'Training', 'Ready to open'];

export const EDITABLE_FIELDS = {
  investment: 'Investment capacity (₹ lakh)',
  experience: 'Retail experience (years)',
  space: 'Space available',
  size: 'Space size (sq ft)',
  floor: 'Floor',
  launch: 'Target launch (months)',
  language: 'Preferred language',
  pin: 'Pin code',
  city: 'City',
  business: 'Current / past business',
};

// The chat never edits the applicant's own notes: they're the original record.
// Territory and store facts the chat can change, and applicant status (withdrawn / duplicate / active).
export const TERRITORY_FIELDS = { slots: 'Open slots', priority: 'Priority' };
export const STORE_FIELDS = { closed: 'Closed' };
export const STATUS_FIELD = { status: 'Status' };
