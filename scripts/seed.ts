/**
 * DecentraVote — Firestore Seeder
 *
 * Computes a real SHA-256 genesis block for election e3 (Student Body President)
 * and writes it to Firestore. Run this ONCE after creating your Firebase project.
 *
 * HOW TO RUN:
 *   1. Fill in your .env.local with Firebase Admin credentials
 *   2. npx ts-node --project tsconfig.json scripts/seed.ts
 *      OR: npx tsx scripts/seed.ts
 */

import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

interface VoteData {
    voterId: string;
    electionId: string;
    candidateId: string;
    timestamp: number;
}

function computeHash(index: number, previousHash: string, timestamp: number, data: VoteData): string {
    const str = `${index}${previousHash}${timestamp}${JSON.stringify(data)}`;
    return createHash('sha256').update(str).digest('hex');
}

async function seed() {
    console.log('🌱 Seeding Firestore with genesis blocks...\n');

    const blocksRef = db.collection('blocks');

    // Check if already seeded
    const existing = await blocksRef.limit(1).get();
    if (!existing.empty) {
        console.log('⚠️  Firestore already has blocks. Skipping seed to prevent duplicates.');
        console.log('   Delete the "blocks" and "votes" collections in Firebase Console to reset.\n');
        process.exit(0);
    }

    // Genesis Block — Student Body President (e3), c6 wins
    const genesisData: VoteData = {
        voterId: 'SYS-GENESIS',
        electionId: 'e3',
        candidateId: 'c6',
        timestamp: 1730457600000,
    };
    const genesisHash = computeHash(0, '0', 1730457600000, genesisData);

    // Block 1
    const block1Data: VoteData = {
        voterId: 'DV-99887766',
        electionId: 'e3',
        candidateId: 'c7',
        timestamp: 1730461200000,
    };
    const block1Hash = computeHash(1, genesisHash, 1730461200000, block1Data);

    // Block 2
    const block2Data: VoteData = {
        voterId: 'DV-55443322',
        electionId: 'e3',
        candidateId: 'c7',
        timestamp: 1730464800000,
    };
    const block2Hash = computeHash(2, block1Hash, 1730464800000, block2Data);

    const blocks = [
        { index: 0, timestamp: 1730457600000, data: genesisData, previousHash: '0', hash: genesisHash },
        { index: 1, timestamp: 1730461200000, data: block1Data, previousHash: genesisHash, hash: block1Hash },
        { index: 2, timestamp: 1730464800000, data: block2Data, previousHash: block1Hash, hash: block2Hash },
    ];

    const batch = db.batch();
    for (const block of blocks) {
        const ref = blocksRef.doc();
        batch.set(ref, { ...block, createdAt: admin.firestore.Timestamp.now() });
        console.log(`  ✅ Block #${block.index}: ${block.hash.substring(0, 24)}...`);
    }
    await batch.commit();

    console.log('\n🎉 Seeding complete! 3 genesis blocks written with real SHA-256 hashes.');
    console.log('   Open your app and go to the Ledger tab to see them.\n');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
