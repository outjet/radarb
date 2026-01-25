const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(require('../dusk-writer-key.json'))
});

const db = admin.firestore();
const LAT = 41.48;
const LNG = -81.8;

async function clearDuskLog() {
  const snapshot = await db.collection('duskLog').get();
  const deletions = snapshot.docs.map(doc => doc.ref.delete());
  await Promise.all(deletions);
  console.log(`🧹 Deleted ${deletions.length} existing duskLog entries`);
}

async function backfill(startDateStr, endDateStr) {
  let currentDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const apiUrl = `https://api.sunrise-sunset.org/json?lat=${LAT}&lng=${LNG}&date=${dateStr}&formatted=0`;

    try {
      const response = await axios.get(apiUrl);
      const duskUTC = response.data.results.civil_twilight_end;
      const duskDate = new Date(duskUTC);

      const duskLocal = duskDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const localDate = duskDate.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York'
      });

      await db.collection('duskLog').doc(localDate).set({
        dusk: duskLocal,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ ${localDate}: ${duskLocal}`);
    } catch (err) {
      console.error(`❌ Failed for ${dateStr}:`, err.message);
    }

    // Step forward by 15 days
    currentDate.setDate(currentDate.getDate() + 15);
  }
}

(async () => {
  await clearDuskLog();
  await backfill('2025-01-01', new Date().toISOString().split('T')[0]);
})();

async function insertMarchDST() {
  const dates = ['2025-03-09', '2025-03-10'];

  for (const dateStr of dates) {
    const apiUrl = `https://api.sunrise-sunset.org/json?lat=${LAT}&lng=${LNG}&date=${dateStr}&formatted=0`;

    try {
      const response = await axios.get(apiUrl);
      const duskUTC = response.data.results.civil_twilight_end;
      const duskDate = new Date(duskUTC);

      const duskLocal = duskDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const localDate = duskDate.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York'
      });

      await db.collection('duskLog').doc(localDate).set({
        dusk: duskLocal,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`🌗 DST Inserted: ${localDate}: ${duskLocal}`);
    } catch (err) {
      console.error(`❌ DST Insert failed for ${dateStr}:`, err.message);
    }
  }
}

insertMarchDST();
