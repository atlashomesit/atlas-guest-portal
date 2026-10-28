export interface PaymentBadgeItem {
  id: string;
  name: string;
  label: string;
  category: 'upi' | 'card' | 'netbanking' | 'gateway';
}

export const PAYMENT_METHOD_BADGES: readonly PaymentBadgeItem[] = [
  // UPI apps (Over 85% of Indian direct booking travelers)
  { id: 'upi', name: 'UPI', label: 'UPI', category: 'upi' },
  { id: 'gpay', name: 'Google Pay', label: 'Google Pay', category: 'upi' },
  { id: 'phonepe', name: 'PhonePe', label: 'PhonePe', category: 'upi' },
  { id: 'paytm', name: 'Paytm', label: 'Paytm', category: 'upi' },
  { id: 'bhim', name: 'BHIM', label: 'BHIM', category: 'upi' },
  // Credit / Debit Cards
  { id: 'cards', name: 'Credit/Debit Cards', label: 'Credit/Debit Cards', category: 'card' },
  { id: 'visa', name: 'Visa', label: 'Visa', category: 'card' },
  { id: 'mastercard', name: 'Mastercard', label: 'Mastercard', category: 'card' },
  { id: 'rupay', name: 'RuPay', label: 'RuPay', category: 'card' },
  // NetBanking
  { id: 'netbanking', name: 'NetBanking', label: 'NetBanking', category: 'netbanking' },
  // Gateway
  { id: 'razorpay', name: 'Razorpay', label: 'Secured by Razorpay', category: 'gateway' },
] as const;
