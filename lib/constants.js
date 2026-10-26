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

// Business categories. Each sets which floors qualify and the shop-size range; everything else uses DEFAULT_PROFILE.
// Agreed with the team on 26 Oct 2026. Editable per project under Brand rules.
export const CATEGORIES = [
  { id: 'eyewear', label: 'Eyewear & optical', example: 'Lenskart', upperFloorOk: false, minSize: 300, maxSize: 3000 },
  { id: 'apparel', label: 'Apparel & footwear', example: 'Bata', upperFloorOk: false, minSize: 400, maxSize: 5000 },
  { id: 'electronics', label: 'Electronics & mobile', example: 'Croma', upperFloorOk: false, minSize: 250, maxSize: 3000 },
  { id: 'pharmacy', label: 'Pharmacy & health', example: 'Apollo Pharmacy', upperFloorOk: false, minSize: 200, maxSize: 2000 },
  { id: 'grocery', label: 'Grocery & convenience', example: 'Reliance Smart', upperFloorOk: false, minSize: 500, maxSize: 5000 },
  { id: 'food', label: 'Food & beverage (QSR, café)', example: 'Domino’s', upperFloorOk: false, minSize: 300, maxSize: 3000 },
  { id: 'beauty', label: 'Beauty & salon', example: 'Naturals', upperFloorOk: true, minSize: 400, maxSize: 3000 },
  { id: 'fitness', label: 'Gym & fitness', example: 'Cult.fit', upperFloorOk: true, minSize: 2500, maxSize: 20000 },
  { id: 'education', label: 'Education & coaching', example: 'Aakash', upperFloorOk: true, minSize: 600, maxSize: 5000 },
  { id: 'other', label: 'Other', example: '', upperFloorOk: false, minSize: 300, maxSize: 3000 },
];

// Rules for a new project: the defaults, with the category's floor and size rules and the brand name.
export function profileFor(categoryId, brandName) {
  const c = CATEGORIES.find((x) => x.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
  return {
    ...DEFAULT_PROFILE,
    brandName: brandName || DEFAULT_PROFILE.brandName,
    category: c.id,
    upperFloorOk: c.upperFloorOk,
    minSize: c.minSize,
    maxSize: c.maxSize,
  };
}

// Labels for the franchisee readiness score (display only; outcomes don't use them). Highest first.
export const READINESS_BANDS = [
  { min: 75, label: 'Ready' },
  { min: 50, label: 'Nearly ready' },
  { min: 0, label: 'Not ready' },
];

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
