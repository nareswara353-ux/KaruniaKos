import { collection, getDocs, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';

export async function seedDatabase() {
  try {
    const roomsSnap = await getDocs(collection(db, 'rooms'));
    
    // Clear old data (for testing purposes, usually we shouldn't but since the user is asking to recreate dummy data, we will just delete the existing ones if we call seedData directly). Actually we'll just skip deletion and only return if there are already rooms, but since the user might want a fresh start, if we do have rooms, maybe we should't return. Let's just create new documents if they don't exist.
    if (!roomsSnap.empty) {
      console.log('Database already seeded or has data. Deleting existing rooms to apply new seed...');
      const batch = writeBatch(db);
      roomsSnap.docs.forEach(d => batch.delete(d.ref));
      
      const uSnap = await getDocs(collection(db, 'users'));
      uSnap.docs.forEach(d => { if(d.data().role !== 'admin') batch.delete(d.ref) });
      
      const bSnap = await getDocs(collection(db, 'bookings'));
      bSnap.docs.forEach(d => batch.delete(d.ref));
      
      const pSnap = await getDocs(collection(db, 'payments'));
      pSnap.docs.forEach(d => batch.delete(d.ref));
      
      await batch.commit();
    }

    console.log('Seeding database with example data...');

    // 1. Create dummy users
    const user1 = await addDoc(collection(db, 'users'), {
      uid: 'dummy-uid-1',
      email: 'budi.santoso@gmail.com',
      displayName: 'Budi Santoso',
      role: 'user',
      createdAt: new Date().toISOString()
    });

    const user2 = await addDoc(collection(db, 'users'), {
      uid: 'dummy-uid-2',
      email: 'siti.aminah@gmail.com',
      displayName: 'Siti Aminah',
      role: 'user',
      createdAt: new Date().toISOString()
    });

    const user3 = await addDoc(collection(db, 'users'), {
      uid: 'dummy-uid-3',
      email: 'agus.pratama@gmail.com',
      displayName: 'Agus Pratama',
      role: 'user',
      createdAt: new Date().toISOString()
    });

    const price = 500000;

    // 2. Create occupied rooms
    const r1 = await addDoc(collection(db, 'rooms'), {
      number: '1A',
      type: 'Kamar Standard',
      price,
      status: 'occupied',
      description: 'Kamar depan dengan ventilasi baik.',
      images: []
    });

    const r2 = await addDoc(collection(db, 'rooms'), {
      number: '1B',
      type: 'Kamar Standard',
      price,
      status: 'occupied',
      description: 'Kamar nyaman dan tenang.',
      images: []
    });

    const r3 = await addDoc(collection(db, 'rooms'), {
      number: '2A',
      type: 'Kamar Premium',
      price,
      status: 'occupied',
      description: 'Fasilitas premium dengan luas ekstra.',
      images: []
    });

    // 3. Create available rooms
    await addDoc(collection(db, 'rooms'), {
      number: '2B',
      type: 'Kamar Premium',
      price,
      status: 'available',
      description: 'Siap huni bulan ini.',
      images: []
    });

    await addDoc(collection(db, 'rooms'), {
      number: '3A',
      type: 'Kamar Standard',
      price,
      status: 'available',
      description: 'Kamar lantai atas yang sejuk.',
      images: []
    });

    // 4. Create bookings for dummy users
    const b1 = await addDoc(collection(db, 'bookings'), {
      roomId: r1.id,
      userUid: 'dummy-uid-1',
      startDate: new Date().toISOString(),
      durationMonths: 6,
      totalPrice: price * 6,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    });

    const b2 = await addDoc(collection(db, 'bookings'), {
      roomId: r2.id,
      userUid: 'dummy-uid-2',
      startDate: new Date().toISOString(),
      durationMonths: 12,
      totalPrice: price * 12,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    });

    const b3 = await addDoc(collection(db, 'bookings'), {
      roomId: r3.id,
      userUid: 'dummy-uid-3',
      startDate: new Date().toISOString(),
      durationMonths: 3,
      totalPrice: price * 3,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    });

    // 5. Create payments for these bookings
    await addDoc(collection(db, 'payments'), {
      bookingId: b1.id,
      userUid: 'dummy-uid-1',
      amount: price * 6,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString()
    });

    await addDoc(collection(db, 'payments'), {
      bookingId: b2.id,
      userUid: 'dummy-uid-2',
      amount: price * 12,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString()
    });

    await addDoc(collection(db, 'payments'), {
      bookingId: b3.id,
      userUid: 'dummy-uid-3',
      amount: price * 3,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString()
    });

    console.log('Seeding complete!');
    window.location.reload(); // Refresh the page to show the new data
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
