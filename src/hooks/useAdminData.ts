import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, updateDoc, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Room, Booking, Complaint, Payment, User } from '../types';

interface AdminDataState {
  rooms: Room[];
  bookings: Booking[];
  complaints: Complaint[];
  payments: Payment[];
  users: User[];
  notifications: any[];
  loading: boolean;
}

export const useAdminData = () => {
  const [data, setData] = useState<AdminDataState>({
    rooms: [],
    bookings: [],
    complaints: [],
    payments: [],
    users: [],
    notifications: [],
    loading: true
  });

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    try {
      // Rooms
      unsubscribers.push(
        onSnapshot(collection(db, 'rooms'), (snapshot) => {
          setData(prev => ({
            ...prev,
            rooms: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room))
          }));
        })
      );

      // Bookings (filter out dummy data)
      unsubscribers.push(
        onSnapshot(collection(db, 'bookings'), (snapshot) => {
          const bookings = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Booking))
            .filter(b => !b.userUid.startsWith('dummy'));
          setData(prev => ({
            ...prev,
            bookings
          }));
        })
      );

      // Complaints
      unsubscribers.push(
        onSnapshot(collection(db, 'complaints'), (snapshot) => {
          setData(prev => ({
            ...prev,
            complaints: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint))
          }));
        })
      );

      // Payments (filter out dummy data)
      unsubscribers.push(
        onSnapshot(collection(db, 'payments'), (snapshot) => {
          const payments = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Payment))
            .filter(p => !p.userUid.startsWith('dummy'));
          setData(prev => ({
            ...prev,
            payments
          }));
        })
      );

      // Users (filter out dummy data)
      unsubscribers.push(
        onSnapshot(collection(db, 'users'), (snapshot) => {
          const users = snapshot.docs
            .map(doc => ({ ...doc.data() } as User))
            .filter(u => !u.uid.startsWith('dummy'));
          setData(prev => ({
            ...prev,
            users,
            loading: false
          }));
        })
      );

      // Notifications for admin
      const notificationsQ = query(collection(db, 'notifications'), where('userUid', '==', 'admin'));
      unsubscribers.push(
        onSnapshot(notificationsQ, (snapshot) => {
          setData(prev => ({
            ...prev,
            notifications: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          }));
        })
      );

      // Run Background Tasks Once
      const runCleanupAndBackgroundTasks = async () => {
        try {
          const roomsSnap = await getDocs(collection(db, 'rooms'));
          const fetchedRooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));

          const bookingsSnap = await getDocs(collection(db, 'bookings'));
          const fetchedBookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
          
          const today = new Date();
          
          for (let i = 0; i < fetchedRooms.length; i++) {
            if (fetchedRooms[i].status === 'pending') {
              await updateDoc(doc(db, 'rooms', fetchedRooms[i].id), { status: 'available' });
            }
          }
          
          for (let i = 0; i < fetchedBookings.length; i++) {
            const b = fetchedBookings[i];
            if (b.status === 'confirmed') {
              // This is a simplified version of duration logic
              const start = new Date(b.startDate);
              const end = new Date(start.setMonth(start.getMonth() + b.durationMonths));
              if (end < today) {
                if (b.willRenew !== false) {
                   const room = fetchedRooms.find(r => r.id === b.roomId);
                   if (room) {
                      await addDoc(collection(db, 'bookings'), {
                        userUid: b.userUid,
                        roomId: b.roomId,
                        startDate: end.toISOString(),
                        durationMonths: 1,
                        totalPrice: room.price,
                        status: 'pending_payment',
                        createdAt: new Date().toISOString(),
                        willRenew: true
                      });
                      
                      await addDoc(collection(db, 'notifications'), {
                        userUid: b.userUid,
                        title: 'Tagihan Perpanjangan Kamar',
                        message: `Kamar ${room.number}: Tagihan untuk bulan berikutnya telah diterbitkan. Masa sewa sebelumnya telah selesai.`,
                        read: false,
                        createdAt: new Date().toISOString()
                      });
                   }
                }
                await updateDoc(doc(db, 'bookings', b.id), { status: 'completed' });
                const hasOtherBookings = fetchedBookings.some(other => other.roomId === b.roomId && other.id !== b.id && (other.status === 'confirmed' || (b.willRenew !== false && other.status === 'pending_payment')));
                if (!hasOtherBookings) {
                   await updateDoc(doc(db, 'rooms', b.roomId), { status: 'available' });
                }
              }
            } else if (b.status === 'pending_payment') {
              const created = new Date(b.createdAt);
              const hoursPassed = (today.getTime() - created.getTime()) / (1000 * 60 * 60);
              if (hoursPassed > 72) {
                await updateDoc(doc(db, 'bookings', b.id), { status: 'cancelled' });
              }
            }
          }

          const usersSnap = await getDocs(collection(db, 'users'));
          const fetchedUsers = usersSnap.docs.map(doc => ({ ...doc.data() } as User));
          const validUsers = fetchedUsers.filter(u => !u.uid.startsWith('dummy'));
          const validUids = new Set(validUsers.map(u => u.uid));

          for (const u of fetchedUsers) {
            if (u.uid.startsWith('dummy')) {
              try {
                if (u.uid) {
                  await deleteDoc(doc(db, 'users', u.uid));
                }
              } catch (err) {}
            }
          }

          for (const b of fetchedBookings) {
              const isDummy = b.userUid.startsWith('dummy') || !validUids.has(b.userUid);
              if (isDummy) {
                  try {
                      await deleteDoc(doc(db, 'bookings', b.id));
                  } catch (err) {}
              }
          }
          
          const paymentsSnap = await getDocs(collection(db, 'payments'));
          for (const n of paymentsSnap.docs) {
              const p = n.data() as Payment;
              const isDummy = p.userUid.startsWith('dummy') || !validUids.has(p.userUid);
              if (isDummy) {
                  try {
                      await deleteDoc(n.ref);
                  } catch(err) {}
              }
          }

          const notificationsSnapRaw = await getDocs(query(collection(db, 'notifications'), where('userUid', '==', 'admin')));
          for (const n of notificationsSnapRaw.docs) {
              const data = n.data();
              const isTestError = data.message && typeof data.message === 'string' && data.message.includes('SELF-TEST');
              const isTitleDummy = data.title && typeof data.title === 'string' && data.title.includes('SELF-TEST');
              if (isTestError || isTitleDummy) {
                  try {
                      await deleteDoc(n.ref);
                  } catch(err) {}
              }
          }
        } catch (error) {
          console.error("Error in background tasks:", error);
        }
      };
      
      runCleanupAndBackgroundTasks();
    } catch (error) {
      console.error('Error setting up admin data listeners:', error);
      setData(prev => ({ ...prev, loading: false }));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  return data;
};
