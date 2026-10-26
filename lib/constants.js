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
  minScore: { High: 50, Medium: 60, Low: 70 },
};

export const OUTCOMES = ['Recommended', 'Waitlist', 'Hold', 'Reject'];

export const PIPELINE = ['Site visit', 'Agreement', 'Store setup', 'Training', 'Ready to open'];

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
  notes: 'Notes from applicant',
};
