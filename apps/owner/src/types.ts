export enum SubscriptionStatus {
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  CANCELLED = 'Cancelled',
  PAST_DUE = 'Past Due'
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: SubscriptionStatus;
  joinedDate: string;
  mrr: number; // Monthly Recurring Revenue
  avatarUrl: string;
  reusableBoxType?: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  status: 'Completed' | 'Failed' | 'Pending';
  type: 'Payment' | 'Refund';
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
}

export interface Delivery {
  id: string;
  customerId: string;
  address: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Returned';
  expectedDate: string;
  reusableBoxType?: string;
  deliveryDayNumber?: number;
  boxRecollectionStatus?: 'Collected Clean' | 'Collected Unclean' | 'Damaged / Missing Part' | 'Not Returned' | 'Pending';
  boxIssueNote?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  secondaryValue?: number;
}
