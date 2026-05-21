import { NextRequest, NextResponse } from 'next/server';
import { createNewBlock, VoteData } from '@/lib/blockchain';
import { addToChain, getVoteChain } from '@/lib/store';

export async function GET(request: NextRequest) {
  const chain = getVoteChain();
  return NextResponse.json(chain, { status: 200 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body || typeof body.electionId !== 'string' || typeof body.candidateId !== 'string' || typeof body.voterId !== 'string') {
    return NextResponse.json({ error: 'Invalid vote payload' }, { status: 400 });
  }

  const chain = getVoteChain();
  const prevBlock = chain.length > 0 ? chain[chain.length - 1] : null;

  const voteData: VoteData = {
    voterId: body.voterId,
    electionId: body.electionId,
    candidateId: body.candidateId,
    timestamp: Date.now(),
  };

  const newBlock = await createNewBlock(prevBlock, voteData);
  addToChain(newBlock);

  return NextResponse.json({ block: newBlock, chain: getVoteChain() }, { status: 201 });
}
