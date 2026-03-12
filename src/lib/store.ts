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
      { id: 'c10', name: 'Udit', party: 'Civic Union' }
    ]
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
      { id: 'c5', name: 'Mark Zuckerberg Jr.', party: 'Web 3.0 Collective' }
    ]
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
      { id: 'c7', name: 'Maria Garcia', party: 'Liberty Guild' }
    ]
  }
];

// In-memory state for demonstration purposes
// Initialized with some "completed" election data for visibility
let voteChain: Block[] = [
  {
    index: 0,
    timestamp: 1730457600000,
    data: { voterId: 'SYS-GENESIS', electionId: 'e3', candidateId: 'c6', timestamp: 1730457600000 },
    previousHash: '0',
    hash: '89eb0a191f4a433a54d6d6a2f7f9b8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6'
  },
  {
    index: 1,
    timestamp: 1730461200000,
    data: { voterId: 'DV-99887766', electionId: 'e3', candidateId: 'c7', timestamp: 1730461200000 },
    previousHash: '89eb0a191f4a433a54d6d6a2f7f9b8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6',
    hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2'
  },
  {
    index: 2,
    timestamp: 1730464800000,
    data: { voterId: 'DV-55443322', electionId: 'e3', candidateId: 'c7', timestamp: 1730464800000 },
    previousHash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
    hash: 'f2e1d0c9b8a765z4y3x2w1v0u9t8s7r6q5p4o3n2m1l0k9j8i7h6g5f4e3d2c1b0'
  }
];

export const getVoteChain = () => voteChain;

export const addToChain = (block: Block) => {
  voteChain.push(block);
};

export const getResultsForElection = (electionId: string) => {
  const votes = voteChain.filter(b => b.data.electionId === electionId);
  const counts: Record<string, number> = {};
  votes.forEach(v => {
    counts[v.data.candidateId] = (counts[v.data.candidateId] || 0) + 1;
  });
  return counts;
};
