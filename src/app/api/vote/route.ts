import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { calculateHash } from '@/lib/blockchain';

// Initialize Firebase Admin SDK (server-side only)
function getAdminApp() {
    if (getApps().length > 0) return getApps()[0];
    try {
        return initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    } catch (error) {
        console.error('Firebase Admin init failed:', error);
        throw new Error('Firebase Admin configuration missing or invalid.');
    }
}

export async function POST(request: NextRequest) {
    try {
        // 1. Verify Firebase ID token from Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        const adminApp = getAdminApp();
        const adminAuth = getAuth(adminApp);
        const adminDb = getFirestore(adminApp);

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }

        const { uid } = decodedToken;
        const body = await request.json();
        const { electionId, candidateId } = body;

        if (!electionId || !candidateId) {
            return NextResponse.json({ error: 'Missing electionId or candidateId' }, { status: 400 });
        }

        // 2. Check for double-vote (server-side — cannot be bypassed)
        const votesRef = adminDb.collection('votes');
        const existingVote = await votesRef
            .where('voterId', '==', uid)
            .where('electionId', '==', electionId)
            .limit(1)
            .get();

        if (!existingVote.empty) {
            return NextResponse.json(
                { error: 'You have already voted in this election.' },
                { status: 409 }
            );
        }

        // 3. Get latest block to chain from
        const blocksRef = adminDb.collection('blocks');
        const latestBlockSnap = await blocksRef.orderBy('index', 'desc').limit(1).get();

        let previousHash = '0';
        let nextIndex = 0;

        if (!latestBlockSnap.empty) {
            const latestBlock = latestBlockSnap.docs[0].data();
            previousHash = latestBlock.hash;
            nextIndex = latestBlock.index + 1;
        }

        // 4. Create the new block with real SHA-256 hash
        const timestamp = Date.now();
        const voteData = { voterId: uid, electionId, candidateId, timestamp };
        const tempBlock = { index: nextIndex, timestamp, data: voteData, previousHash };

        // Re-implement hash here for server environment (no window.crypto available — use Node built-in)
        const { createHash } = await import('crypto');
        const str = tempBlock.index + tempBlock.previousHash + tempBlock.timestamp + JSON.stringify(tempBlock.data);
        const hash = createHash('sha256').update(str).digest('hex');

        const newBlock = { ...tempBlock, hash };

        // 5. Write block and vote record atomically
        const batch = adminDb.batch();

        const blockDoc = blocksRef.doc();
        batch.set(blockDoc, { ...newBlock, createdAt: Timestamp.now() });

        const voteDoc = votesRef.doc();
        batch.set(voteDoc, {
            voterId: uid,
            electionId,
            candidateId,
            blockHash: hash,
            timestamp: Timestamp.now(),
        });

        await batch.commit();

        return NextResponse.json({ success: true, block: newBlock }, { status: 201 });
    } catch (error: any) {
        console.error('[API/vote] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
