
import { Customer, SubscriptionStatus, Transaction, Delivery, Expense, ChartDataPoint } from '../types';

const NAMES = ['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince', 'Evan Wright', 'Fiona Gallagher', 'George Miller', 'Hannah Davis'];
const PLANS = ['Basic', 'Pro', 'Enterprise'];
const STATUSES = [SubscriptionStatus.ACTIVE, SubscriptionStatus.ACTIVE, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED, SubscriptionStatus.CANCELLED];

export const generateCustomers = (count: number): Customer[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `cust_${i + 1}`,
    name: NAMES[i % NAMES.length],
    email: `user${i + 1}@example.com`,
    plan: PLANS[i % PLANS.length],
    status: STATUSES[i % STATUSES.length],
    joinedDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
    mrr: [2499, 4999, 9999][i % 3],
    avatarUrl: `https://picsum.photos/seed/${i}/100/100`
  }));
};

export const generateTransactions = (count: number): Transaction[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `tx_${i + 1}`,
    customerId: `cust_${(i % 10) + 1}`,
    customerName: NAMES[i % NAMES.length],
    amount: [2499, 4999, 9999][i % 3],
    date: new Date(Date.now() - Math.random() * 2592000000).toISOString().split('T')[0],
    status: Math.random() > 0.1 ? 'Completed' : 'Failed',
    type: 'Payment'
  }));
};

export const generateDeliveries = (count: number): Delivery[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `del_${i + 1}`,
    customerId: `cust_${(i % 10) + 1}`,
    address: `${Math.floor(Math.random() * 1000)} Main St, Cityville`,
    status: ['Pending', 'Shipped', 'Delivered'][Math.floor(Math.random() * 3)] as any,
    expectedDate: new Date(Date.now() + Math.random() * 604800000).toISOString().split('T')[0],
  }));
};

export const generateRevenueData = (): ChartDataPoint[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map(month => ({
    name: month,
    value: Math.floor(Math.random() * 500000) + 200000, // Revenue in Lakhs
    secondaryValue: Math.floor(Math.random() * 200000) + 100000 // Expenses
  }));
};

export const mockExpiringSubscriptions = [
  { id: 'sub_1', name: 'Alice Smith', plan: 'Pro Plan', expires: '2 Days' },
  { id: 'sub_2', name: 'Evan Wright', plan: 'Basic Plan', expires: '5 Days' },
  { id: 'sub_3', name: 'Diana Prince', plan: 'Enterprise', expires: '1 Week' },
];

export const mockCustomers = generateCustomers(20);
export const mockTransactions = generateTransactions(15);
export const mockDeliveries = generateDeliveries(10);
export const mockRevenueData = generateRevenueData();
