
export interface VoteData {
  voterId: string;
  electionId: string;
  candidateId: string;
  timestamp: number;
}

export interface Block {
  index: number;
  timestamp: number;
  data: VoteData;
  previousHash: string;
  hash: string;
}

/**
 * Simple hash function for demonstration. 
 * In a real app, use crypto.subtle.digest('SHA-256', ...)
 */
export async function calculateHash(block: Omit<Block, 'hash'>): Promise<string> {
  const str = block.index + block.previousHash + block.timestamp + JSON.stringify(block.data);
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createNewBlock(
  previousBlock: Block | null,
  data: VoteData
): Promise<Block> {
  const index = previousBlock ? previousBlock.index + 1 : 0;
  const timestamp = Date.now();
  const previousHash = previousBlock ? previousBlock.hash : "0";
  
  const tempBlock: Omit<Block, 'hash'> = {
    index,
    timestamp,
    data,
    previousHash,
  };

  const hash = await calculateHash(tempBlock);
  
  return {
    ...tempBlock,
    hash,
  };
}

export async function validateChain(chain: Block[]): Promise<boolean> {
  for (let i = 1; i < chain.length; i++) {
    const currentBlock = chain[i];
    const previousBlock = chain[i - 1];

    if (currentBlock.hash !== (await calculateHash(currentBlock))) {
      return false;
    }

    if (currentBlock.previousHash !== previousBlock.hash) {
      return false;
    }
  }
  return true;
}
