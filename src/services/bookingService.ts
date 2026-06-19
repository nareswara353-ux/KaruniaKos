import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const cancelUserBooking = async (bookingId: string, paymentId?: string) => {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'cancelled'
    });
    
    if (paymentId) {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'rejected'
      });
    }
  } catch (error) {
    throw error;
  }
};
