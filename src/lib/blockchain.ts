export interface VoteData {
  voterId: string;
  electionId: string;
  candidateId: string;
  timestamp: number;
  voterPublicKey: string; // ECDSA raw public key (hex)
  signature: string;      // ECDSA transaction signature (hex)
}

export interface Block {
  index: number;
  timestamp: number;
  data: VoteData;
  previousHash: string;
  hash: string;
  nonce: number;          // Mining nonce
  difficulty: number;     // Proof-of-work difficulty level (number of leading zeros)
}

// Helper to resolve SubtleCrypto natively in both browser and Node.js
async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof window !== 'undefined') {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Web Crypto API (window.crypto.subtle) is not available. Ensure you are using a secure context (localhost or HTTPS).");
    }
    return window.crypto.subtle;
  }
  // Server-side (Node.js): Using dynamic require to bypass static bundler checks
  const nativeCrypto = eval('require')('crypto');
  return nativeCrypto.webcrypto.subtle as unknown as SubtleCrypto;
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a cryptographically secure ECDSA Keypair in Hex format
 */
export async function generateWallet(): Promise<{ publicKeyHex: string; privateKeyHex: string }> {
  const subtle = await getSubtle();
  const keyPair = await subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );

  const rawPub = await subtle.exportKey('raw', keyPair.publicKey);
  const pkcs8Priv = await subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKeyHex: bytesToHex(new Uint8Array(rawPub)),
    privateKeyHex: bytesToHex(new Uint8Array(pkcs8Priv))
  };
}

/**
 * Sign a vote transaction using the Voter's Private Key
 */
export async function signVote(
  voterId: string,
  electionId: string,
  candidateId: string,
  timestamp: number,
  privateKeyHex: string
): Promise<string> {
  const subtle = await getSubtle();
  const privBytes = hexToBytes(privateKeyHex);
  const privateKey = await subtle.importKey(
    'pkcs8',
    privBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  );

  const msg = `${voterId}:${electionId}:${candidateId}:${timestamp}`;
  const msgBytes = new TextEncoder().encode(msg);

  const signature = await subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" }
    },
    privateKey,
    msgBytes
  );

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verify a transaction's cryptographic signature using the Voter's Public Key
 */
export async function verifyVoteSignature(
  voterId: string,
  electionId: string,
  candidateId: string,
  timestamp: number,
  publicKeyHex: string,
  signatureHex: string
): Promise<boolean> {
  try {
    const subtle = await getSubtle();
    const pubBytes = hexToBytes(publicKeyHex);
    const sigBytes = hexToBytes(signatureHex);

    const publicKey = await subtle.importKey(
      'raw',
      pubBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );

    const msg = `${voterId}:${electionId}:${candidateId}:${timestamp}`;
    const msgBytes = new TextEncoder().encode(msg);

    return await subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" }
      },
      publicKey,
      sigBytes,
      msgBytes
    );
  } catch (error) {
    console.error("Signature verification crashed:", error);
    return false;
  }
}

/**
 * Calculate the SHA-256 block hash including difficulty, nonce, and link metadata
 */
export async function calculateHash(block: Omit<Block, 'hash'>): Promise<string> {
  const subtle = await getSubtle();
  const str = block.index + block.previousHash + block.timestamp + block.nonce + block.difficulty + JSON.stringify(block.data);
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await subtle.digest('SHA-256', msgUint8);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Validates the complete proof-of-work link history and all cryptographic signatures in the ledger
 */
export async function validateChain(chain: Block[]): Promise<boolean> {
  if (chain.length === 0) return true;

  for (let i = 0; i < chain.length; i++) {
    const currentBlock = chain[i];

    // 1. Verify block hash matches fields
    const calculatedHash = await calculateHash({
      index: currentBlock.index,
      timestamp: currentBlock.timestamp,
      data: currentBlock.data,
      previousHash: currentBlock.previousHash,
      nonce: currentBlock.nonce,
      difficulty: currentBlock.difficulty
    });

    if (currentBlock.hash !== calculatedHash) {
      console.warn(`[Integrity Error] Block #${currentBlock.index} hash mismatch. Record: ${currentBlock.hash}, Re-calculated: ${calculatedHash}`);
      return false;
    }

    // 2. Verify block points accurately to previous block
    if (i > 0) {
      const previousBlock = chain[i - 1];
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.warn(`[Consensus Error] Block #${currentBlock.index} parent hash link broken.`);
        return false;
      }
    }

    // 3. Verify Proof-of-Work difficulty target (leading zeros)
    const targetZeros = "0".repeat(currentBlock.difficulty);
    if (!currentBlock.hash.startsWith(targetZeros)) {
      console.warn(`[PoW Validation Failed] Block #${currentBlock.index} hash does not satisfy target difficulty of ${currentBlock.difficulty} zeros.`);
      return false;
    }

    // 4. Verify cryptographic signature of the voter
    const { voterId, electionId, candidateId, timestamp, voterPublicKey, signature } = currentBlock.data;
    if (voterPublicKey && signature) {
      const isSigValid = await verifyVoteSignature(
        voterId,
        electionId,
        candidateId,
        timestamp,
        voterPublicKey,
        signature
      );
      if (!isSigValid) {
        console.warn(`[Tamper Warning] Cryptographic signature in Block #${currentBlock.index} is INVALID for voter public address.`);
        return false;
      }
    }
  }
  return true;
}
