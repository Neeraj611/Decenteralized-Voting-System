import { Block } from './blockchain';

export interface VoteRequest {
  voterId: string;
  electionId: string;
  candidateId: string;
}

export interface ChainResponse {
  block: Block;
  chain: Block[];
}

export async function fetchVoteChain(): Promise<Block[]> {
  const response = await fetch('/api/blockchain', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load blockchain ledger');
  }
  return response.json();
}

export async function submitVote(vote: VoteRequest): Promise<ChainResponse> {
  const response = await fetch('/api/blockchain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vote),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || 'Unable to submit vote');
  }

  return response.json();
}
