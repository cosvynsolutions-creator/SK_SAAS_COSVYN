import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

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
  endsAt: string;
}

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
  endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
};

export const calculateEffectivePrice = (price: number, offer: SpecialOffer) => {
  if (!offer || !offer.isActive) return price;
  const now = new Date();
  const end = new Date(offer.endsAt);
  if (now > end) return price;

  return Math.round(price * (1 - offer.discountPercent / 100));
};

const firebaseConfig = {
  apiKey: "AIzaSyBdOar16LP6FsYfkMZbpejixqX9XIlaHu4",
  authDomain: "subbussinesssaas.firebaseapp.com",
  projectId: "subbussinesssaas",
  storageBucket: "subbussinesssaas.firebasestorage.app",
  messagingSenderId: "954257463672",
  appId: "1:954257463672:web:6bef130b67567997e9108d",
  measurementId: "G-QHYDRHE6RG"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export const useGlobalPricing = () => {
  const [plans, setPlans] = useState<SaasPlan[]>(SHARED_SAAS_PLANS);
  const [offer, setOffer] = useState<SpecialOffer>(SHARED_OFFER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const docRef = doc(db, 'global_settings', 'saas_config');
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.plans) setPlans(data.plans);
          if (data.offer) setOffer(data.offer);
        }
        setLoading(false);
      }, (error) => {
        setPlans(SHARED_SAAS_PLANS);
        setOffer(SHARED_OFFER);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch {
      setPlans(SHARED_SAAS_PLANS);
      setOffer(SHARED_OFFER);
      setLoading(false);
    }
  }, []);

  return { plans, offer, loading };
};
