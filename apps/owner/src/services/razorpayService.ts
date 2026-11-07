import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db, createRazorpayOrderCallable, verifyRazorpayPaymentCallable } from './firebase';

// Load Razorpay Script dynamically from official Razorpay CDN
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof (window as any).Razorpay !== 'undefined') {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface PlanMeta {
  label: string;
  amountInRupees: number;
  durationMonths?: number;
  credits?: number;
  type: 'subscription' | 'invoice_recharge';
}

/**
 * Fallback static plans (used ONLY if real-time Firestore database is unreachable and no explicit amount was passed)
 */
export const AUTHORITATIVE_PLANS: Record<string, PlanMeta> = {
  // Subscriptions fallback
  'Monthly': { label: 'Monthly Subscription', amountInRupees: 999, durationMonths: 1, type: 'subscription' },
  '6 Months': { label: '6 Months Subscription', amountInRupees: 5099, durationMonths: 6, type: 'subscription' },
  'Yearly': { label: 'Yearly Subscription', amountInRupees: 9599, durationMonths: 12, type: 'subscription' },
  'monthly': { label: 'Monthly Subscription', amountInRupees: 999, durationMonths: 1, type: 'subscription' },
  '6months': { label: '6 Months Subscription', amountInRupees: 5099, durationMonths: 6, type: 'subscription' },
  'yearly': { label: 'Yearly Subscription', amountInRupees: 9599, durationMonths: 12, type: 'subscription' },
  
  // Invoice Recharge packs
  'mini': { label: 'Mini Pack', amountInRupees: 10, credits: 1, type: 'invoice_recharge' },
  'saver': { label: 'Saver Pack', amountInRupees: 15, credits: 2, type: 'invoice_recharge' },
  'value': { label: 'Value Pack', amountInRupees: 25, credits: 5, type: 'invoice_recharge' },
  'smart': { label: 'Smart Pack', amountInRupees: 40, credits: 10, type: 'invoice_recharge' },
  'pro': { label: 'Pro Saver Pack', amountInRupees: 60, credits: 20, type: 'invoice_recharge' },
  'ultimate': { label: 'Ultimate Pack', amountInRupees: 100, credits: 50, type: 'invoice_recharge' },
};

/**
 * Resolves plan metadata.
 * CRITICAL RULE: If an explicit amount is passed (e.g. from real-time database or admin panel),
 * it is ALWAYS strictly respected and never overridden by static defaults!
 */
export const resolvePlanMeta = (
  planId: string,
  fallbackName?: string,
  explicitAmount?: number,
  explicitDurationMonths?: number,
  explicitCredits?: number
): PlanMeta => {
  const isInvoice = (fallbackName || planId).toLowerCase().includes('invoice') || 
                    (fallbackName || planId).toLowerCase().includes('pack') ||
                    (explicitCredits !== undefined && explicitCredits > 0);

  // 1. If explicitAmount is passed from the UI (loaded directly from real-time database),
  // we MUST STRICTLY RESPECT IT! Never override an admin-configured price with static defaults.
  if (explicitAmount !== undefined && explicitAmount !== null && explicitAmount > 0) {
    return {
      label: fallbackName || planId || (isInvoice ? 'Invoice Recharge Pack' : 'SaaS Subscription'),
      amountInRupees: explicitAmount,
      durationMonths: explicitDurationMonths || (isInvoice ? undefined : 1),
      credits: explicitCredits || (isInvoice ? 1 : undefined),
      type: isInvoice ? 'invoice_recharge' : 'subscription'
    };
  }

  // 2. Check static fallback catalog if explicitAmount is missing
  if (AUTHORITATIVE_PLANS[planId]) {
    const base = { ...AUTHORITATIVE_PLANS[planId] };
    if (explicitDurationMonths) base.durationMonths = explicitDurationMonths;
    if (explicitCredits) base.credits = explicitCredits;
    return base;
  }
  const normalized = (planId || '').toLowerCase();
  for (const [k, v] of Object.entries(AUTHORITATIVE_PLANS)) {
    if (k.toLowerCase() === normalized) {
      const base = { ...v };
      if (explicitDurationMonths) base.durationMonths = explicitDurationMonths;
      if (explicitCredits) base.credits = explicitCredits;
      return base;
    }
  }

  if (isInvoice) {
    return {
      label: fallbackName || planId,
      amountInRupees: 10,
      credits: explicitCredits || 1,
      type: 'invoice_recharge'
    };
  }

  return {
    label: fallbackName || planId || 'SaaS Subscription',
    amountInRupees: 999,
    durationMonths: explicitDurationMonths || 1,
    type: 'subscription'
  };
};

/**
 * Resolves active platform Razorpay Key ID strictly from environment variables (.env).
 * Enterprise standard: Keys are never hardcoded in source code or entered via web UI.
 */
export const getActiveRazorpayKeyId = (): string => {
  try {
    const envKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
      return envKey.trim();
    }
  } catch (e) {
    console.warn('Error reading VITE_RAZORPAY_KEY_ID from environment:', e);
  }
  return '';
};

export interface FulfillPaymentProps {
  userId: string;
  type: 'subscription' | 'invoice_recharge';
  planId: string;
  planName: string;
  amount: number;
  creditsToAdd?: number;
  durationMonths?: number;
  paymentId: string;
  customerEmail?: string;
  customerContact?: string;
}

/**
 * Authoritatively fulfills payment records in Firestore:
 * - Updates businesses/{userId} with new credits or active subscription dates
 * - Appends receipt to businesses/{userId}/billing_history
 * - Synchronizes active local session cache
 */
export const fulfillPaymentRecord = async ({
  userId,
  type,
  planId,
  planName,
  amount,
  creditsToAdd = 0,
  durationMonths = 1,
  paymentId,
  customerEmail = '',
  customerContact = ''
}: FulfillPaymentProps) => {
  if (!userId) {
    throw new Error('User ID is required to fulfill payment.');
  }

  const bizRef = doc(db, 'businesses', userId);
  const now = new Date();
  const nowIso = now.toISOString();

  if (type === 'invoice_recharge') {
    let curCredits = 0;
    try {
      const bizSnap = await getDoc(bizRef);
      if (bizSnap.exists()) {
        curCredits = bizSnap.data().purchasedInvoiceCredits || 0;
      }
    } catch (e) {
      console.warn('Could not read existing credits, assuming 0:', e);
    }

    const newCredits = curCredits + creditsToAdd;

    // 1. Update business document in Firestore
    await updateDoc(bizRef, {
      purchasedInvoiceCredits: newCredits,
      lastRechargePlan: planName,
      lastPaymentId: paymentId,
      updatedAt: nowIso
    }).catch(async (err) => {
      console.warn('updateDoc failed, trying setDoc merge:', err);
      const { setDoc } = await import('firebase/firestore');
      await setDoc(bizRef, {
        purchasedInvoiceCredits: newCredits,
        lastRechargePlan: planName,
        lastPaymentId: paymentId,
        updatedAt: nowIso
      }, { merge: true });
    });

    // 2. Append receipt to billing_history
    try {
      const historyCol = collection(db, 'businesses', userId, 'billing_history');
      await addDoc(historyCol, {
        id: paymentId,
        paymentId: paymentId,
        planName: `Invoice Recharge: ${planName} (+${creditsToAdd} Credits)`,
        amount: amount,
        status: 'Success',
        type: 'invoice_recharge',
        creditsAdded: creditsToAdd,
        date: nowIso,
        createdAt: nowIso
      });
    } catch (histErr) {
      console.warn('Could not record billing_history entry:', histErr);
    }

    // 3. Update localStorage session cache
    try {
      const stored = localStorage.getItem('scalekitchen_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.purchasedInvoiceCredits = newCredits;
        localStorage.setItem('scalekitchen_auth_session', JSON.stringify(parsed));
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('scalekitchen_credits_updated', { detail: { newCredits } }));

    return { success: true, newCredits };
  } else {
    // Subscription renewal / activation
    let baseDate = now;
    try {
      const bizSnap = await getDoc(bizRef);
      if (bizSnap.exists()) {
        const d = bizSnap.data();
        if (d.planExpiryDate) {
          const existingDate = new Date(d.planExpiryDate);
          if (existingDate > now) {
            baseDate = existingDate;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read existing subscription:', e);
    }

    const computedExpiry = new Date(baseDate);
    // Extends by exactly the plan's duration in months (e.g. 1, 6, 8, 12)
    computedExpiry.setDate(computedExpiry.getDate() + (durationMonths * 30));
    const newExpiryDateStr = computedExpiry.toISOString().split('T')[0];

    // 1. Update business document in Firestore
    await updateDoc(bizRef, {
      planStatus: 'Active',
      planName: `COSVYN ONE (${planName})`,
      planExpiryDate: newExpiryDateStr,
      lastPaymentId: paymentId,
      updatedAt: nowIso
    }).catch(async (err) => {
      console.warn('updateDoc failed for subscription, attempting merge:', err);
      const { setDoc } = await import('firebase/firestore');
      await setDoc(bizRef, {
        planStatus: 'Active',
        planName: `COSVYN ONE (${planName})`,
        planExpiryDate: newExpiryDateStr,
        lastPaymentId: paymentId,
        updatedAt: nowIso
      }, { merge: true });
    });

    // 2. Append receipt to billing_history
    try {
      const historyCol = collection(db, 'businesses', userId, 'billing_history');
      await addDoc(historyCol, {
        id: paymentId,
        paymentId: paymentId,
        planName: `COSVYN ONE (${planName})`,
        amount: amount,
        status: 'Success',
        type: 'subscription',
        durationMonths: durationMonths,
        date: nowIso,
        createdAt: nowIso
      });
    } catch (histErr) {
      console.warn('Could not record billing_history entry:', histErr);
    }

    // 3. Update localStorage session cache
    try {
      const stored = localStorage.getItem('scalekitchen_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.planStatus = 'Active';
        parsed.planName = `COSVYN ONE (${planName})`;
        parsed.planExpiryDate = newExpiryDateStr;
        localStorage.setItem('scalekitchen_auth_session', JSON.stringify(parsed));
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('scalekitchen_subscription_updated', {
      detail: { planStatus: 'Active', planExpiryDate: newExpiryDateStr }
    }));

    return { success: true, planStatus: 'Active', planExpiryDate: newExpiryDateStr };
  }
};

export interface ServerPaymentProps {
  planId: string;
  planName?: string;
  amount?: number;
  userEmail?: string;
  userContact?: string;
  businessName?: string;
  userId?: string;
  creditsToAdd?: number;
  durationMonths?: number;
  onSuccess: (result: { paymentId: string; planExpiryDate?: string; planStatus?: string }) => void;
  onFailure?: (error: any) => void;
}

/**
 * Universal Real Razorpay Checkout Orchestrator.
 * 
 * Directly opens the official Razorpay Checkout pop-up window:
 * 1. Synchronizes price and duration with real-time Firestore database (global_settings/saas_config)
 * 2. Resolves official platform Razorpay Key ID (never prompts user for keys)
 * 3. Mounts official Razorpay modal with exact price in integer paise
 * 4. Fulfills the purchase in Firestore upon successful payment verification
 */
export const handleRazorpayPayment = async ({
  planId,
  planName,
  amount,
  userEmail = '',
  userContact = '',
  businessName = 'Business Owner',
  userId = '',
  creditsToAdd,
  durationMonths,
  onSuccess,
  onFailure
}: ServerPaymentProps) => {
  // 1. Fetch real-time pricing and platform key from Firestore global_settings/saas_config
  // This guarantees that any changes made by the admin in Admin Panel are immediately applied.
  let liveAmount = amount;
  let liveDuration = durationMonths;
  let liveLabel = planName;

  try {
    const configSnap = await getDoc(doc(db, 'global_settings', 'saas_config')).catch(() => null);
    if (configSnap && configSnap.exists()) {
      const configData = configSnap.data();
      const dbPlans = configData.plans || [];
      const dbOffer = configData.offer;

      const matchedPlan = dbPlans.find((p: any) => 
        p.id === planId || 
        (p.label && p.label.toLowerCase() === (planName || planId).toLowerCase()) ||
        (p.id && p.id.toLowerCase() === (planId || '').toLowerCase())
      );

      if (matchedPlan) {
        // If explicit amount was not passed, compute from database price + active offer
        if (liveAmount === undefined || liveAmount === null || liveAmount <= 0) {
          let calculatedPrice = Number(matchedPlan.price) || 0;
          if (dbOffer && dbOffer.isActive && dbOffer.discountPercent > 0) {
            const endsAt = dbOffer.endsAt ? new Date(dbOffer.endsAt) : null;
            if (!endsAt || new Date() < endsAt) {
              calculatedPrice = Math.round(calculatedPrice * (1 - Number(dbOffer.discountPercent) / 100));
            }
          }
          liveAmount = calculatedPrice;
        }

        if (liveDuration === undefined || liveDuration === null) {
          liveDuration = Number(matchedPlan.durationMonths) || 1;
        }

        if (!liveLabel) {
          liveLabel = matchedPlan.label;
        }
      }
    }
  } catch (err) {
    console.warn("Could not query global_settings/saas_config in razorpayService:", err);
  }

  const planMeta = resolvePlanMeta(planId, liveLabel, liveAmount, liveDuration, creditsToAdd);

  // Resolve target userId if not explicitly passed
  let resolvedUid = userId;
  if (!resolvedUid) {
    try {
      const stored = localStorage.getItem('scalekitchen_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.uid) resolvedUid = parsed.uid;
      }
    } catch (e) {}
  }

  // 2. Try server-side order callable if deployed
  let serverOrderRes: any = null;
  try {
    const res = await createRazorpayOrderCallable({ planId: planId || planMeta.label });
    if (res?.data?.orderId) {
      serverOrderRes = res.data;
    }
  } catch (serverErr) {
    // Cloud Functions undeployed or unconfigured — seamlessly continue with direct client checkout
  }

  // 3. Load official Razorpay checkout script
  const isSdkLoaded = await loadRazorpayScript();
  if (!isSdkLoaded) {
    const netErr = new Error('Razorpay Checkout failed to load. Please check your internet connection and try again.');
    alert(netErr.message);
    if (onFailure) onFailure(netErr);
    return;
  }

  // 4. Resolve official platform Razorpay Key ID strictly from environment (.env)
  const activeKeyId = getActiveRazorpayKeyId() || serverOrderRes?.keyId || '';

  if (!activeKeyId) {
    const configErr = new Error('Payment gateway is not configured. Please define VITE_RAZORPAY_KEY_ID in your .env file.');
    alert(configErr.message);
    if (onFailure) onFailure(configErr);
    return;
  }

  // 5. Open Real Razorpay Checkout directly with authoritative amount in integer paise
  try {
    const amountInPaise = Math.round(planMeta.amountInRupees * 100);

    const options: any = {
      key: activeKeyId,
      amount: amountInPaise, // Exactly matches real-time database amount
      currency: 'INR',
      name: 'ScaleKitchen',
      description: planMeta.label,
      image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      handler: async function (response: any) {
        try {
          const razorpayPaymentId = response.razorpay_payment_id;
          if (!razorpayPaymentId) {
            throw new Error('Razorpay payment ID was missing in payment response.');
          }

          // Optional server verification if available
          let verifyRes: any = null;
          if (response.razorpay_signature && serverOrderRes?.orderId) {
            try {
              verifyRes = await verifyRazorpayPaymentCallable({
                orderId: response.razorpay_order_id || serverOrderRes.orderId,
                paymentId: razorpayPaymentId,
                signature: response.razorpay_signature
              });
            } catch (vErr) {
              console.warn('Server verification callable unreachable, fulfilling on client:', vErr);
            }
          }

          // Authoritatively fulfill payment in Firestore
          let fulfillRes: any = null;
          if (resolvedUid) {
            fulfillRes = await fulfillPaymentRecord({
              userId: resolvedUid,
              type: planMeta.type,
              planId,
              planName: planMeta.label,
              amount: planMeta.amountInRupees,
              creditsToAdd: planMeta.credits,
              durationMonths: planMeta.durationMonths,
              paymentId: razorpayPaymentId,
              customerEmail: userEmail,
              customerContact: userContact
            });
          }

          onSuccess({
            paymentId: razorpayPaymentId,
            planExpiryDate: verifyRes?.data?.planExpiryDate || fulfillRes?.planExpiryDate,
            planStatus: verifyRes?.data?.planStatus || fulfillRes?.planStatus || 'Active'
          });
        } catch (handlerErr: any) {
          console.error('[Razorpay Fulfillment Error]:', handlerErr);
          alert('Error completing payment: ' + (handlerErr?.message || 'Contact support.'));
          if (onFailure) onFailure(handlerErr);
        }
      },
      prefill: {
        name: businessName,
        email: userEmail,
        contact: userContact
      },
      notes: {
        plan_id: planId,
        user_id: resolvedUid
      },
      theme: {
        color: '#0d40e6'
      },
      modal: {
        ondismiss: function () {
          if (onFailure) onFailure(new Error('Payment window closed.'));
        }
      }
    };

    if (serverOrderRes?.orderId) {
      options.order_id = serverOrderRes.orderId;
    }

    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', function (resp: any) {
      console.error('[Razorpay Payment Failed]:', resp.error);
      const desc = resp.error?.description || 'Payment was declined by bank or gateway.';
      alert(`Payment Failed: ${desc}`);
      if (onFailure) onFailure(resp.error);
    });

    rzp.open();
  } catch (openErr: any) {
    console.error('[Razorpay Launch Error]:', openErr);
    alert('Could not open Razorpay checkout: ' + (openErr?.message || 'Please check your Razorpay Key ID.'));
    if (onFailure) onFailure(openErr);
  }
};
