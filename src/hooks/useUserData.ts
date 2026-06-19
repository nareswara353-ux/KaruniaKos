import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Complaint, Notification, Payment, Room } from '../types';

interface UserDataState {
  bookings: Booking[];
  complaints: Complaint[];
  notifications: Notification[];
  payments: Payment[];
  rooms: Room[];
  loading: boolean;
}

export const useUserData = (userUid: string | undefined) => {
  const [data, setData] = useState<UserDataState>({
    bookings: [],
    complaints: [],
    notifications: [],
    payments: [],
    rooms: [],
    loading: true
  });

  useEffect(() => {
    if (!userUid) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const unsubscribers: Array<() => void> = [];

    try {
      // Bookings
      const bookingsQ = query(collection(db, 'bookings'), where('userUid', '==', userUid));
      unsubscribers.push(
        onSnapshot(bookingsQ, (snapshot) => {
          setData(prev => ({
            ...prev,
            bookings: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking))
          }));
        })
      );

      // Complaints
      const complaintsQ = query(collection(db, 'complaints'), where('userUid', '==', userUid));
      unsubscribers.push(
        onSnapshot(complaintsQ, (snapshot) => {
          setData(prev => ({
            ...prev,
            complaints: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint))
          }));
        })
      );

      // Notifications
      const notificationsQ = query(collection(db, 'notifications'), where('userUid', '==', userUid));
      unsubscribers.push(
        onSnapshot(notificationsQ, (snapshot) => {
          setData(prev => ({
            ...prev,
            notifications: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification))
          }));
        })
      );

      // Payments
      const paymentsQ = query(collection(db, 'payments'), where('userUid', '==', userUid));
      unsubscribers.push(
        onSnapshot(paymentsQ, (snapshot) => {
          setData(prev => ({
            ...prev,
            payments: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)),
            loading: false
          }));
        })
      );

      // Rooms (all rooms for display purposes)
      unsubscribers.push(
        onSnapshot(collection(db, 'rooms'), (snapshot) => {
          setData(prev => ({
            ...prev,
            rooms: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room))
          }));
        })
      );
    } catch (error) {
      console.error('Error setting up data listeners:', error);
      setData(prev => ({ ...prev, loading: false }));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [userUid]);

  return data;
};
