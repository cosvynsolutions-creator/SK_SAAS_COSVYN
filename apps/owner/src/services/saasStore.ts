
export interface SaasPlan {
  id: string;
  label: string;
  price: number;
  durationMonths: number;
  description: string;
  isBestValue?: boolean;
}

export interface SpecialOffer {
  isActive: boolean;
  title: string;
  discountPercent: number;
  endsAt: string; // ISO Date String
}

// Default/Fallback state
export const SHARED_SAAS_PLANS: SaasPlan[] = [
  { 
    id: 'Monthly', 
    label: 'Monthly', 
    price: 999, 
    durationMonths: 1, 
    description: 'Flexible, cancel anytime.' 
  },
  { 
    id: '6 Months', 
    label: '6 Months', 
    price: 5099, 
    durationMonths: 6, 
    description: 'Save ~15% vs monthly.' 
  },
  { 
    id: 'Yearly', 
    label: 'Yearly', 
    price: 9599, 
    durationMonths: 12, 
    description: 'Best Value. Save 20%.',
    isBestValue: true
  }
];

export const SHARED_OFFER: SpecialOffer = {
  isActive: false,
  title: "Flash Sale!",
  discountPercent: 20,
  endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Default 24h from now
};

// Deprecated: Use calculateEffectivePrice with explicit offer object instead
export const getEffectivePrice = (price: number) => {
  if (!SHARED_OFFER.isActive) return price;
  const now = new Date();
  const end = new Date(SHARED_OFFER.endsAt);
  if (now > end) return price; 

  return Math.round(price * (1 - SHARED_OFFER.discountPercent / 100));
};

// New Pure Helper
export const calculateEffectivePrice = (price: number, offer: SpecialOffer) => {
  if (!offer || !offer.isActive) return price;
  const now = new Date();
  const end = new Date(offer.endsAt);
  if (now > end) return price; // Offer expired

  return Math.round(price * (1 - offer.discountPercent / 100));
};
