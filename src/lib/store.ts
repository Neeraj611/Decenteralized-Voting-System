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
} from 'firebase/firestore';
import { Block } from './blockchain';

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
    title: 'City Council 2025',
    description: 'Elect the new members of the city council for the upcoming term.',
    startDate: '2025-05-01',
    endDate: '2025-05-15',
    status: 'active',
    imageUrl: 'https://picsum.photos/seed/vote2/600/400',
    candidates: [
      { id: 'c1', name: 'Vishu', party: 'Progressive Alliance' },
      { id: 'c2', name: 'Neeraj', party: 'Reform Party' },
      { id: 'c3', name: 'Vanshika', party: 'Independent' },
      { id: 'c8', name: 'Naman', party: 'Youth Coalition' },
      { id: 'c9', name: 'Bhavishya', party: 'Green Future' },
      { id: 'c10', name: 'Udit', party: 'Civic Union' },
    ],
  },
  {
    id: 'e2',
    title: 'Technology Board Election',
    description: 'Selection of steering committee for the Regional Tech Hub.',
    startDate: '2025-06-10',
    endDate: '2025-06-12',
    status: 'upcoming',
    imageUrl: 'https://picsum.photos/seed/vote3/600/400',
    candidates: [
      { id: 'c4', name: 'Dr. Emily Chen', party: 'Innovation Group' },
      { id: 'c5', name: 'Mark Zuckerberg Jr.', party: 'Web 3.0 Collective' },
    ],
  },
  {
    id: 'e3',
    title: 'Student Body President',
    description: 'University-wide election for the student council leadership.',
    startDate: '2024-11-01',
    endDate: '2024-11-05',
    status: 'completed',
    imageUrl: 'https://picsum.photos/seed/vote1/600/400',
    candidates: [
      { id: 'c6', name: 'James Wilson', party: 'United Students' },
      { id: 'c7', name: 'Maria Garcia', party: 'Liberty Guild' },
    ],
  },
];

// ─── Firestore collections ────────────────────────────────────────────────────

const BLOCKS_COLLECTION = 'blocks';
const VOTES_COLLECTION = 'votes';

/**
 * Fetch all blocks from Firestore, ordered by block index.
 */
export async function getVoteChain(): Promise<Block[]> {
  const q = query(collection(db, BLOCKS_COLLECTION), orderBy('index', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Block);
}

/**
 * Subscribe to real-time block updates.
 */
export function subscribeToChain(callback: (blocks: Block[]) => void): () => void {
  // Safe check for valid db instance
  if (!db || typeof db.type !== 'string') {
    console.warn('Firestore not initialized. Real-time updates disabled.');
    return () => { };
  }
  const q = query(collection(db, BLOCKS_COLLECTION), orderBy('index', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const blocks = snapshot.docs.map(doc => doc.data() as Block);
    callback(blocks);
  });
}

/**
 * Add a new block to Firestore.
 */
export async function addToChain(block: Block): Promise<void> {
  await addDoc(collection(db, BLOCKS_COLLECTION), {
    ...block,
    createdAt: Timestamp.now(),
  });
}

/**
 * Check if a voter has already voted in a given election.
 */
export async function hasVoted(voterId: string, electionId: string): Promise<boolean> {
  const q = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId),
    where('electionId', '==', electionId)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Record that a voter has voted in an election (for double-vote prevention).
 */
export async function recordVote(voterId: string, electionId: string): Promise<void> {
  await addDoc(collection(db, VOTES_COLLECTION), {
    voterId,
    electionId,
    timestamp: Timestamp.now(),
  });
}

/**
 * Get all election IDs that a voter has already voted in.
 */
export async function getVotedElections(voterId: string): Promise<string[]> {
  const q = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().electionId as string);
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
