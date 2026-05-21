"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Vote,
  Clock,
  CheckCircle2,
  ArrowRight,
  BarChart,
  History as HistoryIcon,
  LogOut,
  User as UserIcon,
  Search,
  LayoutDashboard,
  ShieldCheck,
  Database,
  Hash,
  Menu,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckSquare,
  XSquare,
  Wallet,
  Key,
  Cpu,
  Network,
  ShieldAlert,
  Flame,
  HelpCircle,
  Server,
  Zap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  mockElections, 
  subscribeToChain, 
  getVotedElections, 
  getResultsFromChain, 
  subscribeToMempool,
  tamperWithBlockInFirestore,
  healChainWithConsensusInFirestore,
  hasVoted,
  recordVote,
  addVoteToMempool,
  addToChain,
  clearFromMempool,
  Election 
} from '@/lib/store';
import { 
  validateChain, 
  generateWallet, 
  signVote, 
  calculateHash, 
  Block, 
  VoteData 
} from '@/lib/blockchain';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

type ViewState = 'dashboard' | 'results' | 'history' | 'console';
type NodeStatus = 'idle' | 'syncing' | 'validating' | 'consensus-secured' | 'compromised';

export default function Dashboard() {
  const { user, signOut, isOfflineMode } = useAuth();
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [voting, setVoting] = useState(false);
  const [votedElections, setVotedElections] = useState<Set<string>>(new Set());
  const [chain, setChain] = useState<Block[]>([]);
  const [chainLoading, setChainLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);
  const [aiReports, setAiReports] = useState<Record<string, { summary: string; securityAnalysis: string; verdict: string }>>({});
  const [requestingAi, setRequestingAi] = useState<Record<string, boolean>>({});

  // ─── Cryptographic & Wallet State ──────────────────────────────────────────
  const [wallet, setWallet] = useState<{ publicKeyHex: string; privateKeyHex: string } | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  
  // ─── Mempool & Mining State ────────────────────────────────────────────────
  const [mempool, setMempool] = useState<VoteData[]>([]);
  const [miningTx, setMiningTx] = useState<VoteData | null>(null);
  const [miningDifficulty, setMiningDifficulty] = useState<number>(3);
  const [miningNonce, setMiningNonce] = useState<number>(0);
  const [miningHash, setMiningHash] = useState<string>('');
  const [miningHashRate, setMiningHashRate] = useState<number>(0);
  const [mining, setMining] = useState<boolean>(false);
  const miningActiveRef = useRef<boolean>(false);
  
  // ─── Node consensus state ──────────────────────────────────────────────────
  const [nodesStatus, setNodesStatus] = useState<NodeStatus>('idle');
  const [tamperingBlockIndex, setTamperingBlockIndex] = useState<number | null>(null);
  const [healthyChainBackup, setHealthyChainBackup] = useState<Block[]>([]);

  // ─── Real-time Firestore Subscriptions ─────────────────────────────────────
  useEffect(() => {
    const unsubscribeChain = subscribeToChain((blocks) => {
      setChain(blocks);
      setChainLoading(false);
    });

    const unsubscribeMempool = subscribeToMempool((votes) => {
      setMempool(votes);
    });

    return () => {
      unsubscribeChain();
      unsubscribeMempool();
    };
  }, []);

  // Sync chain integrity check automatically on chain change
  useEffect(() => {
    if (chain.length > 0) {
      validateChain(chain).then((valid) => {
        setChainValid(valid);
        if (valid) {
          setHealthyChainBackup([...chain]);
          if (nodesStatus === 'compromised') {
            setNodesStatus('consensus-secured');
          }
        } else {
          setNodesStatus('compromised');
        }
      });
    } else {
      setChainValid(null);
      setNodesStatus('idle');
    }
  }, [chain]);

  // Load elections voter participated in
  useEffect(() => {
    if (!user) return;
    const epicNumber = user?.voterMetadata?.epicNumber;
    getVotedElections(user.uid, epicNumber).then((ids) => {
      setVotedElections(new Set(ids));
    });

    // Load wallet from localStorage
    const savedWallet = localStorage.getItem(`wallet_${user.uid}`);
    if (savedWallet) {
      try {
        setWallet(JSON.parse(savedWallet));
      } catch (e) {
        console.error("Failed to load local wallet metadata", e);
      }
    }
  }, [user]);

  // Generate a local voter wallet
  const handleGenerateWallet = async () => {
    if (!user) return;
    try {
      const newWallet = await generateWallet();
      localStorage.setItem(`wallet_${user.uid}`, JSON.stringify(newWallet));
      setWallet(newWallet);
      toast({
        title: "🔑 Cryptographic Wallet Generated!",
        description: "Your ECDSA P-256 public-private keys are safely saved in local storage.",
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: "Wallet Generation Failed",
        description: "Browser failed to initialize the Web Crypto ECDSA engine."
      });
    }
  };

  // ─── Client Sign & Cast Vote ──────────────────────────────────────────────
  const handleVote = async (candidateId: string) => {
    if (!selectedElection || !user) return;
    
    // Check if voter has credentials
    const epicNumber = user?.voterMetadata?.epicNumber;
    const aadhaarNumber = user?.voterMetadata?.aadhaarNumber;
    if (!epicNumber || !aadhaarNumber) {
      toast({
        variant: 'destructive',
        title: "🇮🇳 Voter Credentials Required",
        description: "You do not have authenticated Indian ECI credentials linked to this voter profile. Access to voting is restricted.",
      });
      return;
    }

    if (!wallet) {
      toast({
        variant: 'destructive',
        title: "🔑 Wallet Required",
        description: "Please generate your Voter Cryptographic Wallet in the Dashboard before casting a vote.",
      });
      return;
    }

    setVoting(true);
    try {
      const timestamp = Date.now();
      
      // 1. Sign transaction client-side with Voter's Private Key
      const signature = await signVote(
        user.uid,
        selectedElection.id,
        candidateId,
        timestamp,
        wallet.privateKeyHex
      );

      // ─── OFFLINE FALLBACK DIRECT SAVE ─────────────────────────────────────────
      if (isOfflineMode) {
        // Check local double voting by EPIC ID
        const alreadyVoted = await hasVoted(user.uid, selectedElection.id, epicNumber);
        if (alreadyVoted) {
          toast({
            variant: 'destructive',
            title: 'Already Voted',
            description: 'This EPIC Voter ID has already cast a vote in this election.',
          });
          setVotedElections(prev => new Set(prev).add(selectedElection.id));
          setSelectedElection(null);
          return;
        }

        const newTx: VoteData = {
          voterId: user.uid,
          electionId: selectedElection.id,
          candidateId,
          timestamp,
          voterPublicKey: wallet.publicKeyHex,
          signature
        };

        // Push directly to local mempool and record local vote double-voting guard
        await addVoteToMempool(newTx);
        await recordVote(user.uid, selectedElection.id, epicNumber);

        setVotedElections(prev => new Set(prev).add(selectedElection.id));
        toast({
          title: '⚡ Vote Broadcast to Local Mempool!',
          description: `Your vote has been signed and queued in the local mempool. Open the Blockchain Console to mine the block!`,
        });
        setSelectedElection(null);
        setActiveView('console');
        return;
      }

      // 2. Submit signed transaction to server
      const idToken = await user.getIdToken();
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          electionId: selectedElection.id,
          candidateId,
          timestamp,
          voterPublicKey: wallet.publicKeyHex,
          signature,
          epicNumber // Send verified EPIC ID to server-side guard
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast({
          variant: 'destructive',
          title: 'Already Voted',
          description: 'You have already cast a vote in this election.',
        });
        setVotedElections(prev => new Set(prev).add(selectedElection.id));
        setSelectedElection(null);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Transaction rejected by server.');
      }

      setVotedElections(prev => new Set(prev).add(selectedElection.id));
      toast({
        title: '⚡ Vote Broadcast to Mempool!',
        description: `Your vote has been cryptographically signed and broadcast to the unconfirmed mempool. Open the Blockchain Console to mine the block!`,
      });
      setSelectedElection(null);
      setActiveView('console'); // Visual guides to mining console
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Transaction Failed',
        description: error.message || 'A cryptographic signature or server verification error occurred.',
      });
    } finally {
      setVoting(false);
    }
  };

  // ─── Visual Proof-of-Work Mining Loop ──────────────────────────────────────
  const startMiningBlock = async (tx: VoteData) => {
    if (mining || !user) return;
    setMining(true);
    miningActiveRef.current = true;
    setMiningTx(tx);
    setNodesStatus('syncing');

    const previousBlock = chain.length > 0 ? chain[chain.length - 1] : null;
    const previousHash = previousBlock ? previousBlock.hash : "0";
    const nextIndex = previousBlock ? previousBlock.index + 1 : 0;
    const difficulty = miningDifficulty;
    const targetZeros = "0".repeat(difficulty);

    let nonce = 0;
    let hash = '';
    let lastRateUpdateTime = Date.now();
    let hashesSinceLastUpdate = 0;

    const runMiningFrame = async () => {
      if (!miningActiveRef.current) {
        setMining(false);
        setMiningTx(null);
        setNodesStatus('idle');
        return;
      }

      // Compute in chunks of 350 to prevent freezing the UI thread completely
      for (let i = 0; i < 350; i++) {
        nonce++;
        hashesSinceLastUpdate++;

        const tempBlock = {
          index: nextIndex,
          timestamp: tx.timestamp,
          data: tx,
          previousHash,
          nonce,
          difficulty
        };

        hash = await calculateHash(tempBlock);

        if (hash.startsWith(targetZeros)) {
          // Success! Block mined!
          setMiningNonce(nonce);
          setMiningHash(hash);
          setMiningHashRate(0);
          miningActiveRef.current = false;

          toast({
            title: "🎉 Block Mined Successfully!",
            description: `Solved Proof-of-Work nonce: ${nonce}. Hash: ${hash.substring(0, 16)}...`,
          });

          setNodesStatus('validating');
          await new Promise(r => setTimeout(r, 1200)); // Consensus delay animation

          // ─── OFFLINE FALLBACK DIRECT MINE ─────────────────────────────────────────
          if (isOfflineMode) {
            try {
              const minedBlock = {
                ...tempBlock,
                hash
              };
              
              // Direct client-side commit
              await addToChain(minedBlock);
              await clearFromMempool(tx.electionId, tx.voterId);

              toast({
                title: "✅ Block Sealed & Logged Natively!",
                description: "Block successfully added to browser local ledger. Mempool flushed.",
              });
              setNodesStatus('consensus-secured');
              setMiningTx(null);
            } catch (err: any) {
              toast({
                variant: 'destructive',
                title: "Local Block Storage Failed",
                description: err.message || "Failed to commit block to local browser storage."
              });
              setNodesStatus('idle');
            } finally {
              setMining(false);
            }
            return;
          }

          try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/mine', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`
              },
              body: JSON.stringify({
                block: {
                  ...tempBlock,
                  hash
                }
              })
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'Server rejected mined block.');
            }

            toast({
              title: "✅ Block Sealed & Logged!",
              description: "Block added to the decentralized ledger. Mempool flushed.",
            });
            setNodesStatus('consensus-secured');
            setMiningTx(null);
          } catch (err: any) {
            toast({
              variant: 'destructive',
              title: "Consensus Commitment Failed",
              description: err.message || "Failed to broadcast block to validator network."
            });
            setNodesStatus('idle');
          } finally {
            setMining(false);
          }
          return;
        }
      }

      const now = Date.now();
      if (now - lastRateUpdateTime >= 400) {
        const elapsed = (now - lastRateUpdateTime) / 1000;
        setMiningHashRate(Math.round(hashesSinceLastUpdate / elapsed));
        hashesSinceLastUpdate = 0;
        lastRateUpdateTime = now;
        setMiningNonce(nonce);
        setMiningHash(hash);
      }

      requestAnimationFrame(runMiningFrame);
    };

    requestAnimationFrame(runMiningFrame);
  };

  const stopMining = () => {
    miningActiveRef.current = false;
    setMining(false);
    setMiningTx(null);
    setNodesStatus('idle');
    toast({
      title: "Mining Halted",
      description: "Local CPU mining loop terminated by user."
    });
  };

  // ─── Direct Database Tampering Simulator ───────────────────────────────────
  const handleTamperBlock = async (blockIndex: number) => {
    if (healthyChainBackup.length === 0 && chain.length > 0) {
      setHealthyChainBackup([...chain]);
    }
    
    setTamperingBlockIndex(blockIndex);
    try {
      const blockToTamper = chain.find(b => b.index === blockIndex);
      if (!blockToTamper) return;

      const candidates = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'].filter(id => id !== blockToTamper.data.candidateId);
      const maliciousCandidateId = candidates[Math.floor(Math.random() * candidates.length)];

      await tamperWithBlockInFirestore(blockIndex, maliciousCandidateId);
      setChainValid(false);
      setNodesStatus('compromised');

      toast({
        variant: 'destructive',
        title: "⚡ Database Tampering Triggered!",
        description: `Direct Firestore overwrite completed. Modified Block #${blockIndex} candidate data to malicious values. Hash link broken!`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: "Tamper Injection Failed",
        description: err.message || "An error occurred while injecting malicious block data."
      });
    } finally {
      setTamperingBlockIndex(null);
    }
  };

  // ─── P2P consensus self-healing ───────────────────────────────────────────
  const handleHealChain = async () => {
    if (healthyChainBackup.length === 0) {
      toast({
        variant: 'destructive',
        title: "Self-Healing Aborted",
        description: "No healthy chain consensus backup is cached on this client.",
      });
      return;
    }

    setValidating(true);
    await new Promise(r => setTimeout(r, 1800)); // Simulating network audit latency
    
    try {
      await healChainWithConsensusInFirestore(healthyChainBackup);
      setChainValid(true);
      setNodesStatus('consensus-secured');
      toast({
        title: "🛡️ Ledger Healed!",
        description: "Network consensus verified healthy block sequence. Malicious block database row overwritten!",
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: "Consensus Healing Failed",
        description: err.message || "Failed to rewrite ledger using consensus backup."
      });
    } finally {
      setValidating(false);
    }
  };

  // ─── Verify Ledger Chain ───────────────────────────────────────────────────
  const handleVerifyChain = async () => {
    setValidating(true);
    setChainValid(null);
    await new Promise(r => setTimeout(r, 800));
    const valid = await validateChain(chain);
    setChainValid(valid);
    setValidating(false);
  };

  // ─── Gemini AI Audit Report ────────────────────────────────────────────────
  const handleAiAudit = async (election: Election) => {
    setRequestingAi(prev => ({ ...prev, [election.id]: true }));
    try {
      const results = getResultsFromChain(chain, election.id);
      const res = await fetch('/api/ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionTitle: election.title,
          results,
          candidates: election.candidates,
          chainLength: chain.length,
        }),
      });

      if (!res.ok) throw new Error('AI Audit failed');
      const report = await res.json();
      setAiReports(prev => ({ ...prev, [election.id]: report }));
      toast({
        title: 'AI Audit Complete',
        description: 'Gemini AI has audited the blockchain results.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'AI Audit Failed',
        description: 'Failed to generate transparency report. API Key missing or limits reached.',
      });
    } finally {
      setRequestingAi(prev => ({ ...prev, [election.id]: false }));
    }
  };

  // Filter elections
  const filteredElections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return mockElections;
    return mockElections.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const navLinks = [
    { key: 'dashboard', label: 'Voter Portal', icon: <LayoutDashboard size={18} /> },
    { key: 'results', label: 'Results', icon: <BarChart size={18} /> },
    { key: 'history', label: 'Ledger Audit', icon: <HistoryIcon size={18} /> },
    { key: 'console', label: 'Blockchain Console', icon: <Cpu size={18} /> },
  ] as const;

  const NavLinks = ({ onSelect }: { onSelect?: () => void }) => (
    <>
      {navLinks.map(link => (
        <Button
          key={link.key}
          variant={activeView === link.key ? 'secondary' : 'ghost'}
          className={cn('gap-2', activeView === link.key && 'text-primary font-bold')}
          onClick={() => { setActiveView(link.key); onSelect?.(); }}
        >
          {link.icon} {link.label}
        </Button>
      ))}
    </>
  );

  // ─── Dashboard Tab Render ──────────────────────────────────────────────────
  const renderDashboard = () => {
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Voter';
    
    // Check if the actual logged-in user has verified metadata
    const hasCredentials = !!user?.voterMetadata?.epicNumber;

    // Extract metadata with fallbacks for legacy developer profiles
    const metadata = user?.voterMetadata || {
      epicNumber: 'IND' + Math.floor(1000000 + Math.random() * 9000000),
      aadhaarNumber: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      state: 'Delhi (NCT)',
      constituency: 'New Delhi constituency'
    };

    // Clean space from Aadhaar to extract last 4 digits, format visually as XXXX-XXXX-1234
    const rawAadhaar = metadata.aadhaarNumber ? metadata.aadhaarNumber.replace(/\s/g, '') : '';
    const maskedAadhaar = rawAadhaar.length >= 12
      ? `XXXX XXXX ${rawAadhaar.substring(8, 12)}`
      : 'XXXX XXXX 5678';

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        {!hasCredentials && (
          <Alert className="border-2 border-red-500 bg-red-50/70 p-4 mb-4">
            <ShieldAlert className="h-5 w-5 text-red-600 animate-bounce" />
            <AlertDescription className="font-bold text-sm text-red-700">
              ⚠️ CRITICAL ELECTOR SECURITY ALARM: You are logged in with an unverified voter profile. You must possess a certified EPIC Voter ID from the Electoral Commission database to participate in elections or sign digital ballots.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/5 p-6 rounded-2xl border border-slate-100">
          <div>
            <h2 className="text-3xl font-headline font-bold text-accent">Voter Portal</h2>
            <p className="text-muted-foreground">Welcome back, <span className="font-semibold text-accent">{displayName}</span>. Your identity is verified against the National Electoral Roll.</p>
          </div>
          
          {/* Responsive search */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search elections..."
              className="pl-10 bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Credentials and Cryptographic Identity Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* 🇮🇳 ECI Government-Grade Digital Voter Card */}
          <Card className="border-none shadow-xl overflow-hidden relative bg-gradient-to-br from-white via-slate-50 to-slate-100/90 border-t-4 border-orange-500 border-b-4 border-emerald-600 flex flex-col justify-between min-h-[340px]">
            {/* Ashoka Chakra background watermark */}
            <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
              <svg width="320" height="320" viewBox="0 0 100 100" className="text-slate-900 fill-current">
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" fill="none" />
                <circle cx="50" cy="50" r="8" stroke="currentColor" strokeWidth="1" fill="none" />
                {[...Array(24)].map((_, i) => (
                  <line
                    key={i}
                    x1="50"
                    y1="50"
                    x2={50 + 40 * Math.cos((i * 2 * Math.PI) / 24)}
                    y2={50 + 40 * Math.sin((i * 2 * Math.PI) / 24)}
                    stroke="currentColor"
                    strokeWidth="0.5"
                  />
                ))}
              </svg>
            </div>

            <CardHeader className="pb-2 border-b bg-slate-950/5 relative z-10 flex flex-row items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                  🇮🇳
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-800 tracking-wide font-mono block">भारत निर्वाचन आयोग</h4>
                  <h4 className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">Election Commission of India</h4>
                </div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[9px] tracking-wide animate-pulse">
                ● ELECTOR REGISTERED
              </Badge>
            </CardHeader>

            <CardContent className="pt-4 flex-grow relative z-10 grid grid-cols-1 sm:grid-cols-4 gap-4">
              
              {/* Photo placeholder with secure visual stamps */}
              <div className="sm:col-span-1 flex flex-col items-center justify-start space-y-2">
                <div className="relative w-24 h-28 bg-white rounded-lg border-2 border-slate-200 shadow-sm flex flex-col items-center justify-center overflow-hidden group">
                  <UserIcon size={36} className="text-slate-300" />
                  
                  {/* Verified Seal Stamp */}
                  <div className="absolute -top-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm transform rotate-12 border border-white">
                    ✔
                  </div>
                  
                  <div className="absolute bottom-0 w-full text-center bg-slate-800 text-white font-mono text-[8px] py-0.5 tracking-wider font-bold">
                    PHOTO ID
                  </div>
                </div>
                <div className="text-[8px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Verified
                </div>
              </div>

              {/* Voter Details */}
              <div className="sm:col-span-3 space-y-3 font-mono text-xs text-slate-700">
                <div className="grid grid-cols-1 gap-2 border-l-2 border-slate-200 pl-3">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">EPIC Card Number</span>
                    <span className="text-sm font-bold text-primary font-mono tracking-widest select-all">{metadata.epicNumber}</span>
                  </div>
                  
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Full Name (Electors Name)</span>
                    <span className="font-bold text-slate-900 font-headline uppercase">{displayName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">State / UT</span>
                      <span className="font-semibold text-slate-800">{metadata.state}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Constituency</span>
                      <span className="font-semibold text-slate-800">{metadata.constituency}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Aadhaar Card Link Status</span>
                    <span className="text-[10px] font-bold text-slate-900 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      {maskedAadhaar} (UIDAI Verified)
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="py-2.5 border-t bg-slate-950/[0.02] relative z-10 flex flex-row items-center justify-between text-[8px] font-mono text-slate-500">
              <span className="flex items-center gap-1 uppercase tracking-wider">
                <ShieldCheck size={10} className="text-emerald-500" /> ECI SECURE DIGITAL RECORD
              </span>
              <div className="flex items-center gap-1.5 bg-white border px-1.5 py-0.5 rounded shadow-sm">
                <span className="text-[7px] text-slate-400">SIGNING WALLET KEY:</span>
                <span className="font-bold text-slate-700 truncate max-w-[80px]">{wallet ? `${wallet.publicKeyHex.substring(0, 12)}...` : 'NONE'}</span>
              </div>
            </CardFooter>
          </Card>

          {/* Cryptographic Wallet Setup */}
          <Card className="border-none shadow-xl overflow-hidden relative bg-gradient-to-br from-white via-slate-50 to-slate-100 border-t-4 border-[#2673DE] flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Wallet size={22} />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-accent">Voter Cryptographic Wallet</CardTitle>
                  <CardDescription>Your public address is your cryptographic voter identity, secured by ECDSA (P-256).</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              {wallet ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-3 bg-white rounded-lg border border-slate-200/60 shadow-sm space-y-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Public Key (Voter ID)</span>
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-primary truncate max-w-[85%] font-mono select-all">{wallet.publicKeyHex}</code>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            navigator.clipboard.writeText(wallet.publicKeyHex);
                            toast({ title: "Copied!", description: "Public key copied to clipboard." });
                          }}
                        >
                          <Hash size={12} />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200/60 shadow-sm space-y-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Private Signing Key</span>
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-[#391F7A] truncate max-w-[80%] font-mono">
                          {showPrivateKey ? wallet.privateKeyHex : "••••••••••••••••••••••••••••••••••••••••••••••••"}
                        </code>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-[#391F7A]"
                            onClick={() => setShowPrivateKey(!showPrivateKey)}
                          >
                            <Key size={12} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              navigator.clipboard.writeText(wallet.privateKeyHex);
                              toast({ title: "Copied!", description: "Private signing key copied to clipboard. KEEP IT SECURE!" });
                            }}
                          >
                            <Hash size={12} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                  <p className="text-sm text-slate-600 max-w-sm">You do not have a cryptographic signing identity generated yet. Initialize a secure wallet to sign ballots client-side.</p>
                  <Button 
                    onClick={handleGenerateWallet}
                    className="bg-primary hover:bg-primary/95 text-white gap-2 font-semibold h-10 px-5 shrink-0"
                  >
                    <Key size={16} /> Generate Cryptographic Wallet
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="py-2.5 border-t bg-slate-950/[0.02] text-[8px] font-mono text-slate-500">
              Your private key mathematically signs your transactions, protecting against identity theft.
            </CardFooter>
          </Card>
        </div>


        {/* Global Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground overflow-hidden relative shadow-md">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={80} /></div>
            <CardHeader className="pb-2">
              <CardDescription className="text-primary-foreground/80 font-medium">Active Elections</CardDescription>
              <CardTitle className="text-4xl font-headline">
                {filteredElections.filter(e => e.status === 'active').length}
              </CardTitle>
            </CardHeader>
            <CardFooter><span className="text-xs bg-white/20 px-2 py-1 rounded">Participation required</span></CardFooter>
          </Card>

          <Card className="bg-accent text-accent-foreground overflow-hidden relative shadow-md">
            <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 size={80} /></div>
            <CardHeader className="pb-2">
              <CardDescription className="text-accent-foreground/80 font-medium">Votes Cast</CardDescription>
              <CardTitle className="text-4xl font-headline">{votedElections.size}</CardTitle>
            </CardHeader>
            <CardFooter><span className="text-xs bg-white/20 px-2 py-1 rounded">Cryptographically verified</span></CardFooter>
          </Card>

          <Card className="bg-white overflow-hidden relative border-none shadow-md">
            <div className="absolute top-0 right-0 p-4 text-primary/10"><Database size={80} /></div>
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-muted-foreground">Confirmed Blocks Height</CardDescription>
              <CardTitle className="text-4xl font-headline text-accent">
                {chainLoading ? <Loader2 size={28} className="animate-spin text-primary" /> : chain.length}
              </CardTitle>
            </CardHeader>
            <CardFooter>
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded flex items-center gap-1 font-semibold">
                <Zap size={10} className={cn("animate-pulse", isOfflineMode ? "text-amber-500" : "text-green-600")} /> 
                {isOfflineMode ? "Live · Local Ledger" : "Live · Firestore Synced"}
              </span>
            </CardFooter>
          </Card>
        </div>

        {/* Elections list */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mb-8 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="active" className="rounded-lg">Active</TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-lg">Upcoming</TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg">Completed</TabsTrigger>
          </TabsList>

          {(['active', 'upcoming', 'completed'] as const).map(status => (
            <TabsContent key={status} value={status} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredElections.filter(e => e.status === status).length === 0 ? (
                <div className="col-span-3 text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl">
                  <Search size={40} className="mx-auto mb-3 opacity-20" />
                  <p>No {status} elections match your search.</p>
                </div>
              ) : filteredElections.filter(e => e.status === status).map(election => (
                <Card key={election.id} className={cn("group hover:shadow-xl transition-all duration-300 border-none", status !== 'active' && 'opacity-85')}>
                  <div className={cn("relative h-48 w-full overflow-hidden rounded-t-lg", status !== 'active' && 'grayscale')}>
                    <Image
                      src={election.imageUrl}
                      alt={election.title}
                      fill
                      className={cn("object-cover", status === 'active' && "transition-transform group-hover:scale-105")}
                    />
                    <div className="absolute top-4 right-4">
                      <Badge className={cn(
                        status === 'active' && 'bg-green-500 hover:bg-green-600 border-none',
                        status === 'upcoming' && 'bg-blue-500 hover:bg-blue-600 border-none text-white',
                        status === 'completed' && 'bg-gray-500 border-none text-white'
                      )}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-xl font-headline text-accent group-hover:text-primary transition-colors">
                      {election.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{election.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex flex-col gap-3">
                    <div className="w-full flex justify-between items-center text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {status === 'upcoming' ? `Opens ${election.startDate}` : `Ends ${election.endDate}`}
                      </span>
                      <span className="font-medium text-accent">{election.candidates.length} Candidates</span>
                    </div>
                    {status === 'active' && (
                      votedElections.has(election.id) ? (
                        <Button className="w-full bg-green-500 hover:bg-green-600 pointer-events-none gap-2">
                          <CheckCircle2 size={18} /> Vote Submitted to Mempool
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-primary hover:bg-primary/90 gap-2 h-11 text-white font-semibold"
                          onClick={() => setSelectedElection(election)}
                        >
                          Cast Cryptographic Vote <ArrowRight size={18} />
                        </Button>
                      )
                    )}
                    {status === 'completed' && (
                      <Button variant="outline" className="w-full font-semibold" onClick={() => setActiveView('results')}>
                        View Final Tallies
                      </Button>
                    )}
                    {status === 'upcoming' && (
                      <Button variant="outline" className="w-full" disabled>
                        Voting Opens {election.startDate}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  };

  // ─── Results Tab Render ────────────────────────────────────────────────────
  const renderResults = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-headline font-bold text-accent">Real-time Results</h2>
        <p className="text-muted-foreground">Tallies are calculated live by validating confirmed blocks in the decentralized ledger.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {mockElections.map(election => {
          const results = getResultsFromChain(chain, election.id);
          const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);

          return (
            <Card key={election.id} className="border-none shadow-md overflow-hidden">
              <CardHeader className="border-b bg-secondary/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl font-headline text-accent">{election.title}</CardTitle>
                  <Badge
                    variant={election.status === 'completed' ? 'secondary' : 'default'}
                    className={election.status === 'active' ? 'bg-green-500' : ''}
                  >
                    {election.status.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription>{election.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Candidate Standings</span>
                  <span className="text-xs font-medium text-muted-foreground font-mono">
                    {chainLoading ? '...' : totalVotes} Verified Votes Linked
                  </span>
                </div>
                <div className="space-y-4">
                  {election.candidates.map(candidate => {
                    const count = results[candidate.id] || 0;
                    const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                    const isWinning = count === Math.max(...Object.values(results), 0) && count > 0;
                    return (
                      <div key={candidate.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", isWinning ? 'bg-green-500' : 'bg-primary')} />
                            <span className={cn("font-bold", isWinning && 'text-green-700')}>{candidate.name}</span>
                            {isWinning && <Badge className="text-xs bg-green-100 text-green-700 border-none">Leading</Badge>}
                            <span className="text-xs text-muted-foreground">({candidate.party})</span>
                          </div>
                          <span className="font-mono">{count} votes ({percentage.toFixed(1)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2.5" />
                      </div>
                    );
                  })}
                  {totalVotes === 0 && !chainLoading && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No votes have been mined into blocks for this election yet.
                    </div>
                  )}
                  {chainLoading && (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
                  )}
                </div>

                {/* AI Audit Section */}
                <div className="pt-4 border-t border-dashed">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className={cn("text-primary", requestingAi[election.id] && "animate-spin")} />
                      <span className="text-sm font-bold text-accent">Independent AI Verification</span>
                    </div>
                    {!aiReports[election.id] ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1 text-primary hover:bg-primary/5"
                        onClick={() => handleAiAudit(election)}
                        disabled={requestingAi[election.id] || chain.length === 0}
                      >
                        {requestingAi[election.id] ? 'Auditing...' : 'Run Gemini Audit'}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                        Gemini AI Verified
                      </Badge>
                    )}
                  </div>

                  {aiReports[election.id] ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                      <div className="p-3 bg-blue-50/50 rounded-lg text-xs leading-relaxed border border-blue-100 italic text-slate-700">
                        {aiReports[election.id].summary}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-start gap-2 p-2 bg-slate-50 rounded border text-[10px]">
                          <ShieldCheck size={14} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="font-bold block uppercase tracking-wider mb-0.5">Ledger Analysis</span>
                            {aiReports[election.id].securityAnalysis}
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-100 text-[10px]">
                          <CheckCircle2 size={14} className="text-green-600 mt-0.5" />
                          <div>
                            <span className="font-bold block uppercase tracking-wider mb-0.5 text-green-700">Audit Verdict</span>
                            {aiReports[election.id].verdict}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">
                      {requestingAi[election.id] ? 'Gemini is verifying the ledger hash linking parameters...' : 'Run Gemini AI to perform a secure algorithmic ledger consensus audit.'}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/50 py-3 text-xs flex justify-between border-t">
                <span className="font-mono text-slate-400">Verifiable ID: {election.id}-LEDGER-SECURED</span>
                <span className="font-semibold text-green-600 flex items-center gap-1">
                  <ShieldCheck size={12} /> Certified by Network Consensus
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // ─── Ledger Tab Render ─────────────────────────────────────────────────────
  const renderHistory = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-accent">Ledger Audit Panel</h2>
          <p className="text-muted-foreground">Audit the complete SHA-256 chain links. Try tampering with a block to test network alarms!</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleVerifyChain}
            disabled={validating || chain.length === 0}
          >
            {validating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Audit Cryptographic Links
          </Button>
          
          {chainValid === false && (
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2 font-bold"
              onClick={handleHealChain}
              disabled={validating}
            >
              {validating ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
              Resolve Tampering via Consensus
            </Button>
          )}
        </div>
      </div>

      {chainValid !== null && (
        <Alert className={cn("border-2 p-4", chainValid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50/70 animate-pulse')}>
          <div className="flex items-center gap-2">
            {chainValid
              ? <CheckSquare className="h-5 w-5 text-green-600" />
              : <ShieldAlert className="h-5 w-5 text-red-600" />
            }
            <AlertDescription className={cn("font-bold text-sm", chainValid ? 'text-green-700' : 'text-red-700')}>
              {chainValid
                ? `✅ Ledger Fully Verified — All ${chain.length} blocks are cryptographically valid. Link pointers and nonces are secure.`
                : `⚠️ CRITICAL LEDGER BREACH DETECTED — Block parent link or SHA-256 signature mismatch identified! Consensus halted.`
              }
            </AlertDescription>
          </div>
        </Alert>
      )}

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-accent text-accent-foreground">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} />
            <div>
              <CardTitle>System Ledger Blocks</CardTitle>
              <CardDescription className="text-accent-foreground/70">
                Immutable chained log · {chain.length} blocks sealed
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 border-b">
                  <th className="px-6 py-4 text-left font-bold">Block Index</th>
                  <th className="px-6 py-4 text-left font-bold">SHA-256 Hash</th>
                  <th className="px-6 py-4 text-left font-bold">Voter Address</th>
                  <th className="px-6 py-4 text-left font-bold">Difficulty / Nonce</th>
                  <th className="px-6 py-4 text-left font-bold">Status</th>
                  <th className="px-6 py-4 text-center font-bold">Tamper Injection</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {chainLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 size={32} className="mx-auto animate-spin text-primary opacity-40" />
                    </td>
                  </tr>
                ) : chain.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-body">
                      <div className="flex flex-col items-center gap-2">
                        <Database size={40} className="opacity-20" />
                        <p>The blockchain is currently empty. Cast a vote to generate Block #0!</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  [...chain].reverse().map((block) => (
                    <tr key={block.hash} className={cn("hover:bg-secondary/20 transition-colors group", !chainValid && "bg-red-50/20")}>
                      <td className="px-6 py-4 font-bold text-primary">#{block.index}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs bg-slate-100 px-2 py-1 rounded truncate max-w-[150px] block"
                            title={block.hash}
                          >
                            {block.hash.substring(0, 16)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded truncate max-w-[140px] block" title={block.data.voterPublicKey}>
                          {block.data.voterPublicKey ? `${block.data.voterPublicKey.substring(0, 10)}...` : block.data.voterId}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        Zeros: {block.difficulty || 0} / Nonce: {block.nonce || 0}
                      </td>
                      <td className="px-6 py-4">
                        {chainValid ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                            VALIDATED
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none animate-pulse">
                            CORRUPT
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-500 hover:bg-red-50 gap-1 font-bold"
                          onClick={() => handleTamperBlock(block.index)}
                          disabled={tamperingBlockIndex !== null || !chainValid}
                        >
                          {tamperingBlockIndex === block.index ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Flame size={12} />
                          )}
                          Inject Tamper
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50/50 p-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="text-green-600" />
          Natively running verification: verifies P-256 ECDSA transaction signatures and SHA-256 PoW block nonces.
        </CardFooter>
      </Card>
    </div>
  );

  // ─── Blockchain Console Render (Visual Miner, Mempool, Nodes) ─────────────
  const renderConsole = () => {
    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-3xl font-headline font-bold text-accent">Blockchain Console</h2>
          <p className="text-muted-foreground">Inspect unconfirmed transactions in the mempool, run visual Proof-of-Work mining, and watch P2P nodes interact.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Mempool Column */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="border-none shadow-md h-full flex flex-col">
              <CardHeader className="bg-slate-900 text-white rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={20} className="text-primary" />
                    <CardTitle className="text-md font-bold">Unconfirmed Mempool</CardTitle>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-none font-mono">
                    {mempool.length} TXs
                  </Badge>
                </div>
                <CardDescription className="text-slate-300">
                  Transactions signed by voters, queued in the mempool waiting to be mined into a block.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 flex-1 overflow-y-auto max-h-[480px]">
                {mempool.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <HelpCircle size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Mempool is currently empty.</p>
                    <p className="text-xs mt-1 text-slate-400">Cast a vote in the Voter Portal to queue a transaction here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mempool.map((tx, idx) => {
                      const election = mockElections.find(e => e.id === tx.electionId);
                      return (
                        <div key={idx} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative group hover:border-primary transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Transaction #{idx}</span>
                              <h4 className="text-xs font-bold text-slate-800">{election?.title || tx.electionId}</h4>
                            </div>
                            <Badge variant="outline" className="text-[9px] bg-white text-muted-foreground border-slate-200">
                              PENDING
                            </Badge>
                          </div>
                          
                          <div className="text-[10px] space-y-1 font-mono text-slate-500">
                            <div>Candidate: <span className="text-primary font-bold">{tx.candidateId}</span></div>
                            <div>Voter Key: <span className="truncate block max-w-[120px]">{tx.voterPublicKey.substring(0, 14)}...</span></div>
                            <div>Sig: <span className="truncate block max-w-[120px]">{tx.signature.substring(0, 14)}...</span></div>
                          </div>

                          <Button
                            className="w-full mt-2 bg-slate-900 hover:bg-primary text-white text-[10px] h-7 font-bold gap-1"
                            onClick={() => startMiningBlock(tx)}
                            disabled={mining}
                          >
                            <Cpu size={12} /> Mine This Block
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Visual Miner and Peer Nodes */}
          <div className="lg:col-span-2 space-y-8">
            {/* Visual Miner Panel */}
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#2673DE] to-[#391F7A] text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={22} className="text-yellow-400" />
                    <div>
                      <CardTitle className="text-lg font-bold">Proof-of-Work Miner Core</CardTitle>
                      <CardDescription className="text-white/80">Select difficulty and solve the cryptographic SHA-256 target puzzle.</CardDescription>
                    </div>
                  </div>
                  {mining && (
                    <Badge className="bg-yellow-400 text-slate-900 border-none font-bold animate-pulse font-mono gap-1">
                      <Zap size={10} /> MINING ACTIVE
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Difficulty Tuner */}
                <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border">
                  <div>
                    <span className="text-xs font-bold text-accent block">Mining Puzzle Difficulty</span>
                    <span className="text-[10px] text-muted-foreground">Adjust target leading zero count. Higher = slower.</span>
                  </div>
                  <div className="flex gap-2">
                    {([2, 3, 4] as const).map(diff => (
                      <Button
                        key={diff}
                        size="sm"
                        variant={miningDifficulty === diff ? 'default' : 'outline'}
                        className={cn("w-10 h-8 font-bold font-mono", miningDifficulty === diff && 'bg-primary text-white')}
                        onClick={() => setMiningDifficulty(diff)}
                        disabled={mining}
                      >
                        {diff}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Miner screen */}
                <div className="p-5 bg-black text-green-400 rounded-xl font-mono text-xs space-y-3 min-h-[160px] relative border border-slate-900">
                  <div className="flex justify-between text-[10px] text-slate-500 border-b border-slate-800 pb-1.5">
                    <span>DECENTRAVOTE POW HARDWARE ACCELERATOR v1.0</span>
                    <span>STATUS: {mining ? "RUNNING" : "STANDBY"}</span>
                  </div>

                  {miningTx ? (
                    <div className="space-y-1">
                      <div className="text-slate-400">Target Payload: Voter={miningTx.voterId.substring(0, 10)}... Election={miningTx.electionId} Candidate={miningTx.candidateId}</div>
                      <div className="text-slate-400">Target Prefix: {"0".repeat(miningDifficulty)}...</div>
                      <div className="text-yellow-400 mt-2 font-bold animate-pulse">Running SHA-256 Hashing Loop...</div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800">
                        <div>Nonce: <span className="text-white font-bold">{miningNonce}</span></div>
                        <div>Speed: <span className="text-white font-bold">{miningHashRate.toLocaleString()} H/s</span></div>
                      </div>
                      <div className="text-[10px] text-green-500 mt-1 truncate">
                        Hash: {miningHash || "Calculating..."}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-28 text-center text-slate-500 font-body">
                      <Cpu size={32} className="opacity-20 mb-2" />
                      <p className="text-xs">No active block selected for mining.</p>
                      <p className="text-[10px] mt-1">Select a transaction in the unconfirmed mempool to boot the hardware core.</p>
                    </div>
                  )}

                  {mining && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute bottom-4 right-4 h-7 text-[10px] font-bold"
                      onClick={stopMining}
                    >
                      Halt Loop
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Peer Nodes Network */}
            <Card className="border-none shadow-md">
              <CardHeader className="border-b">
                <div className="flex items-center gap-2">
                  <Network size={20} className="text-primary" />
                  <div>
                    <CardTitle className="text-sm font-bold">P2P Peer Consensus Verification</CardTitle>
                    <CardDescription>Visualizing global validator node states. Consensus requires agreement across nodes.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: "Node Chicago", location: "US-East", ping: "42ms" },
                    { id: "Node Frankfurt", location: "EU-Central", ping: "108ms" },
                    { id: "Node Tokyo", location: "AP-East", ping: "185ms" },
                  ].map((node, i) => {
                    const isHealthy = chainValid !== false;
                    let colorClass = "border-slate-200 bg-slate-50 text-slate-800";
                    let stateText = "Synced";
                    let pulseClass = "";

                    if (nodesStatus === 'syncing') {
                      colorClass = "border-blue-200 bg-blue-50/50 text-blue-800";
                      stateText = "Replicating...";
                      pulseClass = "animate-pulse";
                    } else if (nodesStatus === 'validating') {
                      colorClass = "border-yellow-200 bg-yellow-50/50 text-yellow-800";
                      stateText = "Auditing PoW...";
                      pulseClass = "animate-bounce";
                    } else if (nodesStatus === 'consensus-secured') {
                      colorClass = "border-green-200 bg-green-50/50 text-green-800";
                      stateText = "Consensus OK";
                    } else if (!isHealthy) {
                      colorClass = "border-red-200 bg-red-50 text-red-800";
                      stateText = "INTRUSION SHIELD";
                      pulseClass = "animate-pulse";
                    }

                    return (
                      <div key={i} className={cn("p-4 rounded-xl border-2 transition-all space-y-3", colorClass, pulseClass)}>
                        <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                          <span className="text-xs font-bold font-headline">{node.id}</span>
                          <Server size={14} className="opacity-40" />
                        </div>
                        <div className="space-y-1 text-[10px] font-mono">
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="font-bold">{stateText}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Network Height:</span>
                            <span className="font-bold">#{chain.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>P2P Ping:</span>
                            <span className="font-bold text-slate-500">{node.ping}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EDF1F6] font-body">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveView('dashboard')}>
            <div className="p-2 bg-primary rounded-xl text-primary-foreground shadow-sm">
              <Vote size={20} />
            </div>
            <span className="text-xl font-headline font-bold text-accent">DecentraVote</span>
            <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 font-bold ml-1">
              Web3 Engine
            </Badge>
            {isOfflineMode ? (
              <Badge className="text-[9px] bg-amber-500 hover:bg-amber-600 text-white font-bold border-none ml-1 animate-pulse">
                Offline Mode
              </Badge>
            ) : (
              <Badge className="text-[9px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none ml-1">
                Cloud Sync
              </Badge>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-3">
            <NavLinks />
          </div>

          <div className="flex items-center gap-3">
            {/* User display */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full border border-slate-100">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                <UserIcon size={12} />
              </div>
              <span className="text-xs font-bold max-w-[120px] truncate text-slate-700">
                {user?.displayName || user?.email}
              </span>
            </div>

            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-200" onClick={signOut} title="Sign Out">
              <LogOut size={16} />
            </Button>

            {/* Mobile Navigation Hamburger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden h-9 w-9 border-slate-200">
                  <Menu size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="flex items-center gap-2 mb-8 mt-2">
                  <div className="p-2 bg-primary rounded-lg text-primary-foreground">
                    <Vote size={18} />
                  </div>
                  <span className="text-lg font-headline font-bold text-accent">DecentraVote</span>
                  {isOfflineMode ? (
                    <Badge className="text-[8px] bg-amber-500 hover:bg-amber-600 text-white font-bold border-none ml-1 animate-pulse">
                      Offline
                    </Badge>
                  ) : (
                    <Badge className="text-[8px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none ml-1">
                      Cloud
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <NavLinks onSelect={() => setMobileMenuOpen(false)} />
                </div>
                <div className="mt-8 pt-6 border-t">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary rounded-lg mb-4">
                    <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                      <UserIcon size={14} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate">{user?.displayName}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2 text-xs" onClick={signOut}>
                    <LogOut size={14} /> Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'results' && renderResults()}
        {activeView === 'history' && renderHistory()}
        {activeView === 'console' && renderConsole()}
      </main>

      {/* Vote Selection Overlay Modal */}
      {selectedElection && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-auto shadow-2xl border-none">
            <CardHeader className="border-b sticky top-0 bg-white z-10 pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-headline text-accent font-bold">{selectedElection.title}</CardTitle>
                  <CardDescription>Select a candidate. Your vote is sealed with your private key.</CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedElection(null)} disabled={voting}>
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {voting && (
                <div className="flex items-center gap-3 p-4 mb-4 bg-primary/5 rounded-lg border border-primary/20 animate-pulse">
                  <Loader2 size={20} className="animate-spin text-primary" />
                  <p className="text-sm font-medium text-primary">Cryptographically signing vote & broadcasting transaction...</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4">
                {selectedElection.candidates.map(candidate => (
                  <div
                    key={candidate.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group",
                      voting && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => !voting && handleVote(candidate.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-accent group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{candidate.name}</h4>
                        <p className="text-sm text-muted-foreground">{candidate.party}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      disabled={voting}
                      className="group-hover:bg-primary group-hover:text-primary-foreground border-primary text-primary transition-colors font-bold"
                    >
                      {voting ? <Loader2 size={16} className="animate-spin" /> : 'Cast'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-4 border-t">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  DecentraVote runs client-side signing. Your signature mathematically proves your identity using P-256 Elliptic Curve hashes. This transaction is immutable once verified.
                </p>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
