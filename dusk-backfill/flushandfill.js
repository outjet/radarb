const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(require('../dusk-writer-key.json'))
});

const db = admin.firestore();

const entries = [
  ['2024-12-21', '17:32'],
  ['2025-01-23', '18:00'],
  ['2025-02-04', '18:15'],
  ['2025-02-17', '18:30'],
  ['2025-03-01', '18:45'],
  ['2025-03-08', '18:53'],
  ['2025-03-09', '19:54'],
  ['2025-03-14', '20:00'],
  ['2025-03-28', '20:15'],
  ['2025-04-10', '20:30'],
  ['2025-04-23', '20:45'],
  ['2025-05-06', '21:00'],
  ['2025-05-19', '21:15'],
  ['2025-06-05', '21:30'],
  ['2025-06-20', '21:38']
];

async function flushAndFill() {
  const snapshot = await db.collection('duskLog').get();
  const deletes = snapshot.docs.map(doc => doc.ref.delete());
  await Promise.all(deletes);
  console.log(`🧹 Cleared ${deletes.length} existing entries.`);

  for (const [date, time] of entries) {
    await db.collection('duskLog').doc(date).set({
      dusk: time,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Inserted ${date}: ${time}`);
  }
}

flushAndFill();