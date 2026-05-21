import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  where,
  Timestamp,
  doc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { Block, VoteData } from './blockchain';

export interface Candidate {
  id: string;
  name: string;
  party: string;
  avatar?: string;
}

export interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'upcoming';
  candidates: Candidate[];
  imageUrl: string;
}

// Static election data (can be migrated to Firestore later)
export const mockElections: Election[] = [
  {
    id: 'e1',
    title: 'Sovereign Presidential Election 2026',
    description: 'National general election to elect the President of the Republic. Each ballot is cryptographically sealed client-side using P-256 ECDSA wallets and validated via dynamic Proof-of-Work ledger consensus.',
    startDate: '2026-05-01',
    endDate: '2026-05-25',
    status: 'active',
    imageUrl: 'https://picsum.photos/seed/sovereign2026/600/400',
    candidates: [
      { id: 'c1', name: 'Alexander Sterling', party: 'Democratic National Union' },
      { id: 'c2', name: 'Elena Rostova', party: 'Progressive Reform Alliance' },
      { id: 'c3', name: 'Vanshika Sen', party: 'Independent Constitutionalist' },
      { id: 'c8', name: 'Marcus Vance', party: 'Liberty & Privacy Coalition' },
      { id: 'c9', name: 'Dr. Sarah Jenkins', party: 'Green Planetary Coalition' },
      { id: 'c10', name: 'Udit Narayan', party: 'Federal Civic Union' },
    ],
  },
  {
    id: 'e2',
    title: 'Federal Senate & Parliamentary Elections',
    description: 'National legislative seats election to determine parliamentary majority across federal voting zones. Requires real-time biometric signature auditing.',
    startDate: '2026-06-10',
    endDate: '2026-06-12',
    status: 'upcoming',
    imageUrl: 'https://picsum.photos/seed/parliament2026/600/400',
    candidates: [
      { id: 'c4', name: 'Senator Robert Thorne', party: 'Traditional Constitutional Coalition' },
      { id: 'c5', name: 'Julia Chen', party: 'Progressive Democratic Front' },
    ],
  },
  {
    id: 'e3',
    title: 'National Constitutional Referendum 2025',
    description: 'Sovereign public voting on draft amendments to Chapter IV (Digital Civil Liberties, Cryptographic Privacy, and Algorithmic Sovereignty) of the Constitution.',
    startDate: '2025-11-01',
    endDate: '2025-11-05',
    status: 'completed',
    imageUrl: 'https://picsum.photos/seed/referendum2025/600/400',
    candidates: [
      { id: 'c6', name: 'Yes (Ratify Crypto Privacy Protection)', party: 'Citizens for Digital Liberty' },
      { id: 'c7', name: 'No (Maintain Current Status)', party: 'Committee for Sovereign Security' },
    ],
  },
];

// ─── Local State & Storage Fallback ───────────────────────────────────────────

let localChain: Block[] = [];
let localVotes: Array<{ voterId: string; electionId: string }> = [];
let localMempool: VoteData[] = [];

// Helper to check if Firestore is fully configured and active
let offlineOverride = false;

export function setOfflineOverride(val: boolean) {
  offlineOverride = val;
  if (typeof window !== 'undefined') {
    if (val) {
      localStorage.setItem('decentravote_offline_mode', 'true');
    } else {
      localStorage.removeItem('decentravote_offline_mode');
    }
  }
}

function isDbValid(): boolean {
  if (offlineOverride) return false;
  if (typeof window !== 'undefined') {
    const offlineMode = localStorage.getItem('decentravote_offline_mode');
    if (offlineMode === 'true') {
      return false;
    }
  }
  return !!db && typeof db.type === 'string';
}

// SSR-safe client-side initialization
if (typeof window !== 'undefined') {
  try {
    const cachedChain = localStorage.getItem('decentravote_local_chain');
    if (cachedChain) localChain = JSON.parse(cachedChain);
  } catch {}
  try {
    const cachedVotes = localStorage.getItem('decentravote_local_votes');
    if (cachedVotes) localVotes = JSON.parse(cachedVotes);
  } catch {}
  try {
    const cachedMempool = localStorage.getItem('decentravote_local_mempool');
    if (cachedMempool) localMempool = JSON.parse(cachedMempool);
  } catch {}
}

const BLOCKS_COLLECTION = 'blocks';
const VOTES_COLLECTION = 'votes';

/**
 * Fetch all blocks from Firestore, ordered by block index.
 */
export async function getVoteChain(): Promise<Block[]> {
  if (!isDbValid()) {
    return localChain;
  }
  const q = query(collection(db, BLOCKS_COLLECTION), orderBy('index', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Block);
}

/**
 * Subscribe to real-time block updates.
 */
export function subscribeToChain(callback: (blocks: Block[]) => void): () => void {
  if (!isDbValid()) {
    // Return current local state immediately
    callback(localChain);
    
    // Register local custom listener to update in real-time
    const handleLocalUpdate = () => {
      callback([...localChain]);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('decentravote_chain_update', handleLocalUpdate);
      return () => {
        window.removeEventListener('decentravote_chain_update', handleLocalUpdate);
      };
    }
    return () => {};
  }
  
  const q = query(collection(db, BLOCKS_COLLECTION), orderBy('index', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const blocks = snapshot.docs.map(doc => doc.data() as Block);
    callback(blocks);
  });
}

/**
 * Add a new block to Firestore or local ledger.
 */
export async function addToChain(block: Block): Promise<void> {
  if (!isDbValid()) {
    localChain.push(block);
    if (typeof window !== 'undefined') {
      localStorage.setItem('decentravote_local_chain', JSON.stringify(localChain));
      window.dispatchEvent(new Event('decentravote_chain_update'));
    }
    return;
  }
  await addDoc(collection(db, BLOCKS_COLLECTION), {
    ...block,
    createdAt: Timestamp.now(),
  });
}

/**
 * Check if a voter has already voted in a given election.
 */
export async function hasVoted(voterId: string, electionId: string, epicNumber?: string): Promise<boolean> {
  if (!isDbValid()) {
    return localVotes.some(v => 
      (v.voterId === voterId || (epicNumber && (v as any).epicNumber === epicNumber)) && 
      v.electionId === electionId
    );
  }
  
  // 1. Check by voterId
  const q1 = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId),
    where('electionId', '==', electionId)
  );
  const snapshot1 = await getDocs(q1);
  if (!snapshot1.empty) return true;

  // 2. Check by epicNumber if provided
  if (epicNumber) {
    const q2 = query(
      collection(db, VOTES_COLLECTION),
      where('epicNumber', '==', epicNumber),
      where('electionId', '==', electionId)
    );
    const snapshot2 = await getDocs(q2);
    if (!snapshot2.empty) return true;
  }

  return false;
}

/**
 * Record that a voter has voted in an election (for double-vote prevention).
 */
export async function recordVote(voterId: string, electionId: string, epicNumber?: string): Promise<void> {
  if (!isDbValid()) {
    localVotes.push({ voterId, electionId, epicNumber } as any);
    if (typeof window !== 'undefined') {
      localStorage.setItem('decentravote_local_votes', JSON.stringify(localVotes));
    }
    return;
  }
  await addDoc(collection(db, VOTES_COLLECTION), {
    voterId,
    epicNumber: epicNumber || null,
    electionId,
    timestamp: Timestamp.now(),
  });
}

/**
 * Get all election IDs that a voter has already voted in.
 */
export async function getVotedElections(voterId: string, epicNumber?: string): Promise<string[]> {
  if (!isDbValid()) {
    return localVotes
      .filter(v => v.voterId === voterId || (epicNumber && (v as any).epicNumber === epicNumber))
      .map(v => v.electionId);
  }
  
  const q1 = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId)
  );
  const snapshot1 = await getDocs(q1);
  const ids = new Set(snapshot1.docs.map(doc => doc.data().electionId as string));

  if (epicNumber) {
    const q2 = query(
      collection(db, VOTES_COLLECTION),
      where('epicNumber', '==', epicNumber)
    );
    const snapshot2 = await getDocs(q2);
    snapshot2.docs.forEach(doc => ids.add(doc.data().electionId as string));
  }

  return Array.from(ids);
}

/**
 * Compute vote tallies for an election from the blockchain.
 */
export function getResultsFromChain(chain: Block[], electionId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  chain
    .filter(b => b.data.electionId === electionId)
    .forEach(b => {
      counts[b.data.candidateId] = (counts[b.data.candidateId] || 0) + 1;
    });
  return counts;
}

// ─── Mempool (Pending Votes) Handlers ──────────────────────────────────────────

const MEMPOOL_COLLECTION = 'pending_votes';

/**
 * Subscribe to the unconfirmed transaction mempool in real-time
 */
export function subscribeToMempool(callback: (votes: VoteData[]) => void): () => void {
  if (!isDbValid()) {
    callback(localMempool);
    
    const handleLocalMempoolUpdate = () => {
      callback([...localMempool]);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('decentravote_mempool_update', handleLocalMempoolUpdate);
      return () => {
        window.removeEventListener('decentravote_mempool_update', handleLocalMempoolUpdate);
      };
    }
    return () => {};
  }
  
  const q = query(collection(db, MEMPOOL_COLLECTION), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const votes = snapshot.docs.map(doc => doc.data() as VoteData);
    callback(votes);
  });
}

/**
 * Push a signed vote transaction into the unconfirmed mempool
 */
export async function addVoteToMempool(vote: VoteData): Promise<void> {
  if (!isDbValid()) {
    localMempool.push(vote);
    if (typeof window !== 'undefined') {
      localStorage.setItem('decentravote_local_mempool', JSON.stringify(localMempool));
      window.dispatchEvent(new Event('decentravote_mempool_update'));
    }
    return;
  }
  await addDoc(collection(db, MEMPOOL_COLLECTION), {
    ...vote,
    createdAt: Timestamp.now()
  });
}

/**
 * Clear a confirmed vote from the mempool
 */
export async function clearFromMempool(electionId: string, voterId: string): Promise<void> {
  if (!isDbValid()) {
    localMempool = localMempool.filter(v => !(v.electionId === electionId && v.voterId === voterId));
    if (typeof window !== 'undefined') {
      localStorage.setItem('decentravote_local_mempool', JSON.stringify(localMempool));
      window.dispatchEvent(new Event('decentravote_mempool_update'));
    }
    return;
  }
  const q = query(
    collection(db, MEMPOOL_COLLECTION),
    where('electionId', '==', electionId),
    where('voterId', '==', voterId)
  );
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

// ─── Tampering & Self-Healing Utilities ──────────────────────────────────────

/**
 * Maliciously tampers with a block directly in the database to simulate an attack
 */
export async function tamperWithBlockInFirestore(blockIndex: number, newCandidateId: string): Promise<void> {
  if (!isDbValid()) {
    const idx = localChain.findIndex(b => b.index === blockIndex);
    if (idx === -1) throw new Error(`Block #${blockIndex} not found in local chain.`);
    
    localChain[idx] = {
      ...localChain[idx],
      data: {
        ...localChain[idx].data,
        candidateId: newCandidateId
      },
      hash: "corrupted_hash_" + Math.random().toString(36).substring(2, 8)
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('decentravote_local_chain', JSON.stringify(localChain));
      window.dispatchEvent(new Event('decentravote_chain_update'));
    }
    return;
  }

  const q = query(collection(db, BLOCKS_COLLECTION), where('index', '==', blockIndex));
  const snapshot = await getDocs(q);
  if (snapshot.empty) throw new Error(`Block #${blockIndex} not found in Firestore.`);
  
  const docRef = snapshot.docs[0].ref;
  const blockData = snapshot.docs[0].data() as Block;
  
  // Modify the vote data directly in the block, making its hash invalid
  const modifiedData = {
    ...blockData.data,
    candidateId: newCandidateId
  };
  
  await setDoc(docRef, {
    ...blockData,
    data: modifiedData,
    hash: "corrupted_hash_" + Math.random().toString(36).substring(2, 8)
  });
}

/**
 * Restores ledger health by overwriting the corrupted database with a consensus-verified blockchain
 */
export async function healChainWithConsensusInFirestore(healthyChain: Block[]): Promise<void> {
  if (!isDbValid()) {
    localChain = [...healthyChain];
    if (typeof window !== 'undefined') {
      localStorage.setItem('decentravote_local_chain', JSON.stringify(localChain));
      window.dispatchEvent(new Event('decentravote_chain_update'));
    }
    return;
  }

  // 1. Delete all current blocks in Firestore
  const allBlocksSnap = await getDocs(collection(db, BLOCKS_COLLECTION));
  const deleteBatch = writeBatch(db);
  allBlocksSnap.docs.forEach((d) => {
    deleteBatch.delete(d.ref);
  });
  await deleteBatch.commit();
  
  // 2. Write the healthy chain documents back
  const writeBatchInstance = writeBatch(db);
  healthyChain.forEach((block) => {
    const docRef = doc(collection(db, BLOCKS_COLLECTION));
    writeBatchInstance.set(docRef, {
      ...block,
      createdAt: Timestamp.now()
    });
  });
  await writeBatchInstance.commit();
}
