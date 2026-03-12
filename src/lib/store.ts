
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
      { id: 'c1', name: 'Alice Thompson', party: 'Progressive Alliance' },
      { id: 'c2', name: 'Robert Blake', party: 'Reform Party' },
      { id: 'c3', name: 'Sarah Jenkins', party: 'Independent' }
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
    startDate: '2025-01-01',
    endDate: '2025-01-05',
    status: 'completed',
    imageUrl: 'https://picsum.photos/seed/vote1/600/400',
    candidates: [
      { id: 'c6', name: 'James Wilson', party: 'United Students' },
      { id: 'c7', name: 'Maria Garcia', party: 'Liberty Guild' }
    ]
  }
];

// In-memory state for demonstration purposes
// In a real app, this would be MongoDB
let voteChain: Block[] = [];

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
