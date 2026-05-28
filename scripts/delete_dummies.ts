import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log("Checking users...");
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
  
  const adminEmail = 'nareswara353@gmail.com';
  
  let deletedCount = 0;
  for (const user of users) {
    if (user.role !== 'admin' && user.email !== adminEmail) {
      console.log(`Deleting dummy user: ${user.email} (ID: ${user.id})`);
      await deleteDoc(doc(db, 'users', user.id));
      deletedCount++;
    }
  }
  
  // also check bookings? Prompt says: "Semua data dummy yang terdapat pada direktori penghuni di hapus, hanya menyisakan admin"
  console.log(`Deleted ${deletedCount} users.`);
}
run()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
