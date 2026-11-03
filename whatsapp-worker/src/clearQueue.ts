/**
 * HanuJai High School ERP — Clear WhatsApp Notification Queue
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Purges or cancels pending attendance notification jobs from Cloud Firestore
 * so the queue starts fresh with zero backlog.
 * 
 * USAGE:
 *   npm run whatsapp:clear
 */

import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { loadWorkerConfig } from './config.ts';
import { getWorkerDb } from './firebase.ts';

async function clearNotificationQueue() {
  console.log('================================================================================');
  console.log('  HANUJAI HIGH SCHOOL ERP — CLEAR WHATSAPP NOTIFICATION QUEUE');
  console.log('================================================================================');

  const config = loadWorkerConfig();
  const db = getWorkerDb(config);

  console.log(`Connecting to Cloud Firestore (Project: ${config.firebase.projectId})...`);

  try {
    const snap = await getDocs(collection(db, 'attendanceNotifications'));
    console.log(`Found ${snap.size} total notification job(s) in "attendanceNotifications" collection.`);

    if (snap.empty) {
      console.log('✓ Queue is already empty. Nothing to clear.');
      process.exit(0);
    }

    // Process in batches of 400 (Firestore limit is 500)
    let batch = writeBatch(db);
    let count = 0;
    let deletedCount = 0;

    for (const d of snap.docs) {
      batch.delete(doc(db, 'attendanceNotifications', d.id));
      count++;
      deletedCount++;

      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
        console.log(`...deleted ${deletedCount} records`);
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    console.log(`\n✅ Successfully cleared all ${deletedCount} notification job(s) from the Firestore queue!`);
    console.log('The queue is now completely clean (0 pending).');
    console.log('================================================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error clearing notification queue:', err.message);
    process.exit(1);
  }
}

clearNotificationQueue();

