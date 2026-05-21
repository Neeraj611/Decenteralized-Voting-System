import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { verifyVoteSignature } from '@/lib/blockchain';

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
        const { electionId, candidateId, timestamp, voterPublicKey, signature, epicNumber } = body;

        if (!electionId || !candidateId || !timestamp || !voterPublicKey || !signature) {
            return NextResponse.json({ error: 'Missing transaction parameters (electionId, candidateId, timestamp, voterPublicKey, signature)' }, { status: 400 });
        }

        // 2. Cryptographically verify the voter's transaction signature (server-side audit)
        const isSigValid = await verifyVoteSignature(
            uid,
            electionId,
            candidateId,
            timestamp,
            voterPublicKey,
            signature
        );

        if (!isSigValid) {
            return NextResponse.json({ error: 'Cryptographic signature verification failed. The transaction payload may have been tampered with.' }, { status: 400 });
        }

        // 3. Check for double-vote (server-side — cannot be bypassed)
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

        if (epicNumber) {
            const existingEpicVote = await votesRef
                .where('epicNumber', '==', epicNumber)
                .where('electionId', '==', electionId)
                .limit(1)
                .get();

            if (!existingEpicVote.empty) {
                return NextResponse.json(
                    { error: 'This EPIC Voter ID has already cast a vote in this election.' },
                    { status: 409 }
                );
            }
        }

        // 4. Save vote directly to the MEMPOOL (pending_votes) collection
        const mempoolRef = adminDb.collection('pending_votes');
        
        const newTx = {
            voterId: uid,
            epicNumber: epicNumber || null,
            electionId,
            candidateId,
            timestamp,
            voterPublicKey,
            signature,
            createdAt: Timestamp.now()
        };

        const batch = adminDb.batch();
        
        // Push unconfirmed transaction to Mempool
        const txDoc = mempoolRef.doc();
        batch.set(txDoc, newTx);

        // Instantly record vote double-voting guard
        const voteDoc = votesRef.doc();
        batch.set(voteDoc, {
            voterId: uid,
            epicNumber: epicNumber || null,
            electionId,
            candidateId,
            timestamp: Timestamp.now()
        });

        await batch.commit();

        return NextResponse.json({ success: true, transaction: newTx }, { status: 201 });
    } catch (error: any) {
        console.error('[API/vote] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
