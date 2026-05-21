import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { calculateHash, verifyVoteSignature } from '@/lib/blockchain';

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
        // 1. Verify User Session for security
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        const adminApp = getAdminApp();
        const adminAuth = getAuth(adminApp);
        const adminDb = getFirestore(adminApp);

        try {
            await adminAuth.verifyIdToken(token);
        } catch {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await request.json();
        const { block } = body;

        if (!block || !block.data) {
            return NextResponse.json({ error: 'Missing block payload' }, { status: 400 });
        }

        const { index, timestamp, data, previousHash, nonce, difficulty, hash } = block;

        // 2. Server-side cryptographically verify the proposed block details
        const expectedHash = await calculateHash({
            index,
            timestamp,
            data,
            previousHash,
            nonce,
            difficulty
        });

        if (hash !== expectedHash) {
            return NextResponse.json({ error: 'Block hash verification failed. Recalculated hash does not match block header.' }, { status: 400 });
        }

        // 3. Verify Proof-of-Work target (leading zeros check)
        const targetPrefix = '0'.repeat(difficulty);
        if (!hash.startsWith(targetPrefix)) {
            return NextResponse.json({ error: `Block hash does not satisfy target difficulty of ${difficulty} leading zeros.` }, { status: 400 });
        }

        // 4. Verify transaction cryptographic signature in the block data
        const isSigValid = await verifyVoteSignature(
            data.voterId,
            data.electionId,
            data.candidateId,
            data.timestamp,
            data.voterPublicKey,
            data.signature
        );

        if (!isSigValid) {
            return NextResponse.json({ error: 'Proposed block transaction signature is INVALID.' }, { status: 400 });
        }

        // 5. Verify parent link (previous hash) matching current tail of the chain in Firestore
        const blocksRef = adminDb.collection('blocks');
        const latestBlockSnap = await blocksRef.orderBy('index', 'desc').limit(1).get();

        if (!latestBlockSnap.empty) {
            const latestBlock = latestBlockSnap.docs[0].data();
            
            // Check index is strictly subsequent
            if (index !== latestBlock.index + 1) {
                return NextResponse.json({ error: `Invalid block index. Expected ${latestBlock.index + 1}, received ${index}.` }, { status: 400 });
            }

            // Check previous hash pointer
            if (previousHash !== latestBlock.hash) {
                return NextResponse.json({ error: `Parent hash pointer mismatch. Block points to ${previousHash}, actual chain head is ${latestBlock.hash}.` }, { status: 400 });
            }
        } else {
            // Genesis block check (index 0)
            if (index !== 0 || previousHash !== '0') {
                return NextResponse.json({ error: 'Genesis block must have index 0 and previousHash "0".' }, { status: 400 });
            }
        }

        // 6. Block approved! Commit to blockchain and clear from mempool atomically
        const batch = adminDb.batch();

        // Write block to the chain
        const blockDoc = blocksRef.doc();
        batch.set(blockDoc, {
            ...block,
            createdAt: Timestamp.now()
        });

        // Flush this transaction from the pending_votes Mempool
        const mempoolRef = adminDb.collection('pending_votes');
        const pendingTxSnap = await mempoolRef
            .where('electionId', '==', data.electionId)
            .where('voterId', '==', data.voterId)
            .limit(1)
            .get();

        if (!pendingTxSnap.empty) {
            batch.delete(pendingTxSnap.docs[0].ref);
        }

        await batch.commit();

        return NextResponse.json({ success: true, block }, { status: 201 });
    } catch (error: any) {
        console.error('[API/mine] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
