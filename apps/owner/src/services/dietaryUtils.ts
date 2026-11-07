// Dietary types and utilities for Veg & Non-Veg meal management

export type DietaryType = 'Veg' | 'Non-Veg';

export interface PlanDietarySchedule {
  // Day of week: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  [dayOfWeek: number]: DietaryType;
}

export const WEEKDAYS_MAP = [
  { id: 0, label: 'Sun', short: 'S', fullName: 'Sunday' },
  { id: 1, label: 'Mon', short: 'M', fullName: 'Monday' },
  { id: 2, label: 'Tue', short: 'T', fullName: 'Tuesday' },
  { id: 3, label: 'Wed', short: 'W', fullName: 'Wednesday' },
  { id: 4, label: 'Thu', short: 'T', fullName: 'Thursday' },
  { id: 5, label: 'Fri', short: 'F', fullName: 'Friday' },
  { id: 6, label: 'Sat', short: 'S', fullName: 'Saturday' },
];

const NON_VEG_KEYWORDS = [
  'non-veg', 'nonveg', 'non veg', 'chicken', 'mutton', 'fish', 'egg', 'meat',
  'prawn', 'seafood', 'beef', 'pork', 'keema', 'biryani non-veg', 'butter chicken'
];

/**
 * Heuristically infers whether an item or plan name is Non-Veg or Veg if not explicitly tagged.
 */
export const inferDietaryTypeFromName = (name?: string): DietaryType => {
  if (!name) return 'Veg';
  const lower = name.toLowerCase();
  for (const kw of NON_VEG_KEYWORDS) {
    if (lower.includes(kw)) {
      return 'Non-Veg';
    }
  }
  return 'Veg';
};

/**
 * Creates a default dietary schedule for a given set of weekdays.
 * If fallbackType is provided or inferred from plan name, assigns that to all active weekdays.
 */
export const createDefaultDietarySchedule = (
  weekdays: number[] = [1, 2, 3, 4, 5, 6],
  fallbackType?: DietaryType
): Record<number, DietaryType> => {
  const defaultType: DietaryType = fallbackType || 'Veg';
  const schedule: Record<number, DietaryType> = {};
  weekdays.forEach(d => {
    schedule[d] = defaultType;
  });
  return schedule;
};

/**
 * Resolves whether a plan is Veg or Non-Veg on a specific date (YYYY-MM-DD).
 * Hierarchy:
 * 1. Customer override ('Veg' | 'Non-Veg')
 * 2. Plan dietary schedule for that day of week (plan.dietarySchedule[dayOfWeek])
 * 3. Plan explicit dietary type (plan.dietaryType)
 * 4. Inferred from plan name
 */
export const getPlanDietaryOnDate = (
  plan: {
    name?: string;
    dietarySchedule?: Record<number, DietaryType>;
    dietaryType?: DietaryType | 'Mixed';
  } | null | undefined,
  targetDateStr: string,
  customerDietaryOverride?: string | null
): DietaryType => {
  // 1. Customer explicit preference override
  if (customerDietaryOverride === 'Veg' || customerDietaryOverride === 'Strict Veg') {
    return 'Veg';
  }
  if (customerDietaryOverride === 'Non-Veg' || customerDietaryOverride === 'Strict Non-Veg') {
    return 'Non-Veg';
  }

  // 2. Resolve day of week
  const cleanTarget = (targetDateStr || '').split('T')[0].trim();
  const parts = cleanTarget.split('-').map(Number);
  const dayOfWeek = parts.length === 3
    ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0).getDay()
    : new Date().getDay();

  // 3. Check plan schedule
  if (plan?.dietarySchedule && plan.dietarySchedule[dayOfWeek]) {
    return plan.dietarySchedule[dayOfWeek];
  }

  // 4. Check plan generic dietary type
  if (plan?.dietaryType === 'Veg' || plan?.dietaryType === 'Non-Veg') {
    return plan.dietaryType;
  }

  // 5. Fallback inference from name
  return inferDietaryTypeFromName(plan?.name);
};

/**
 * Returns a human-friendly summary of a plan's dietary schedule.
 */
export const getPlanDietarySummary = (
  dietarySchedule?: Record<number, DietaryType>,
  weekdays: number[] = [1, 2, 3, 4, 5, 6]
): {
  type: 'Pure Veg' | 'Pure Non-Veg' | 'Mixed';
  vegCount: number;
  nonVegCount: number;
  label: string;
} => {
  if (!dietarySchedule || Object.keys(dietarySchedule).length === 0) {
    return {
      type: 'Pure Veg',
      vegCount: weekdays.length,
      nonVegCount: 0,
      label: 'Pure Veg'
    };
  }

  let vegCount = 0;
  let nonVegCount = 0;

  weekdays.forEach(d => {
    const diet = dietarySchedule[d];
    if (diet === 'Non-Veg') {
      nonVegCount++;
    } else {
      vegCount++;
    }
  });

  if (nonVegCount === 0) {
    return {
      type: 'Pure Veg',
      vegCount,
      nonVegCount: 0,
      label: 'Pure Veg'
    };
  }
  if (vegCount === 0) {
    return {
      type: 'Pure Non-Veg',
      vegCount: 0,
      nonVegCount,
      label: 'Pure Non-Veg'
    };
  }
  return {
    type: 'Mixed',
    vegCount,
    nonVegCount,
    label: `Mixed (${vegCount} Veg • ${nonVegCount} Non-Veg)`
  };
};
