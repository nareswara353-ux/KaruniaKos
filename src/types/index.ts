export interface Room {
  id: string;
  number: string;
  type: string;
  price: number;
  capacity?: number;
  status: 'available' | 'maintenance' | 'occupied' | 'pending';
  description: string;
  images: string[];
}

export interface Booking {
  id: string;
  userUid: string;
  roomId: string;
  startDate: string;
  durationMonths: number;
  totalPrice: number;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  vaNumber?: string;
  proofUrl?: string;
  confirmedAt?: string;
  willRenew?: boolean;
  createdAt: string;
}

export interface Complaint {
  id: string;
  userUid: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  adminNote?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  userUid: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  proofUrl?: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userUid: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
}
