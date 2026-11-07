export interface ContainerInfo {
  id: string;
  type: string;
  size?: string;
  isReusable?: boolean;
}

export interface MealItem {
  mealId: string;
  session: 'breakfast' | 'lunch' | 'dinner';
  plan: string;
  status: 'pending' | 'delivered' | 'failed';
  containers?: ContainerInfo[];
}

export interface DriverDeliveryStop {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  mealsToday: MealItem[];
  collectedBoxes: ContainerInfo[];
  status: 'not_visited' | 'delivered' | 'failed' | 'customer_not_home' | 'refused';
  notes?: string;
  sequence?: number;
  completedAt?: string;
}

export interface DriverRouteSummary {
  driverId: string;
  driverName?: string;
  date: string;
  totalStops: number;
  completedStops: number;
  mealSessions: {
    breakfast: { count: number; completed: number };
    lunch: { count: number; completed: number };
    dinner: { count: number; completed: number };
  };
  deliveries: DriverDeliveryStop[];
}

export interface ReusableBoxSummary {
  boxType: string;
  issued: number;
  collectedClean: number;
  collectedUnclean: number;
  damagedOrMissing: number;
  pendingRecollection: number;
}
