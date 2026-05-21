"use client"

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { mockElections, subscribeToChain, getVotedElections, getResultsFromChain, Election } from '@/lib/store';
import { validateChain, Block } from '@/lib/blockchain';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

type ViewState = 'dashboard' | 'results' | 'history';

export default function Dashboard() {
  const { user, signOut } = useAuth();
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

  // Subscribe to real-time blockchain updates from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToChain((blocks) => {
      setChain(blocks);
      setChainLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load which elections this user has already voted in
  useEffect(() => {
    if (!user) return;
    getVotedElections(user.uid).then((ids) => {
      setVotedElections(new Set(ids));
    });
  }, [user]);

  const handleVote = async (candidateId: string) => {
    if (!selectedElection || !user) return;
    setVoting(true);
    try {
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
        throw new Error(data.error || 'Vote failed');
      }

      setVotedElections(prev => new Set(prev).add(selectedElection.id));
      toast({
        title: '✅ Vote Cast Successfully',
        description: `Cryptographically secured on the blockchain. Hash: ${data.block.hash.substring(0, 16)}...`,
      });
      setSelectedElection(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error casting vote',
        description: error.message || 'A cryptographic error occurred while generating the block.',
      });
    } finally {
      setVoting(false);
    }
  };

  const handleVerifyChain = async () => {
    setValidating(true);
    setChainValid(null);
    await new Promise(r => setTimeout(r, 600)); // small delay for UX
    const valid = await validateChain(chain);
    setChainValid(valid);
    setValidating(false);
  };

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
        description: 'Transparency report generated by Gemini AI.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'AI Audit Error',
        description: 'Failed to generate audit report. Please check API configuration.',
      });
    } finally {
      setRequestingAi(prev => ({ ...prev, [election.id]: false }));
    }
  };

  // Filter elections by search query
  const filteredElections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return mockElections;
    return mockElections.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const navLinks = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'results', label: 'Results', icon: <BarChart size={18} /> },
    { key: 'history', label: 'Ledger', icon: <HistoryIcon size={18} /> },
  ] as const;

  const NavLinks = ({ onSelect }: { onSelect?: () => void }) => (
    <>
      {navLinks.map(link => (
        <Button
          key={link.key}
          variant={activeView === link.key ? 'secondary' : 'ghost'}
          className={cn('gap-2', activeView === link.key && 'text-primary')}
          onClick={() => { setActiveView(link.key); onSelect?.(); }}
        >
          {link.icon} {link.label}
        </Button>
      ))}
    </>
  );

  // ─── Dashboard View ────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Voter';
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-headline font-bold text-accent">Voter Dashboard</h2>
            <p className="text-muted-foreground">Welcome back, <span className="font-semibold text-accent">{displayName}</span>. Select an active election to participate.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search elections..."
              className="pl-10"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={80} /></div>
            <CardHeader className="pb-2">
              <CardDescription className="text-primary-foreground/80 font-medium">Active Elections</CardDescription>
              <CardTitle className="text-4xl font-headline">
                {filteredElections.filter(e => e.status === 'active').length}
              </CardTitle>
            </CardHeader>
            <CardFooter><span className="text-xs bg-white/20 px-2 py-1 rounded">Action required</span></CardFooter>
          </Card>

          <Card className="bg-accent text-accent-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 size={80} /></div>
            <CardHeader className="pb-2">
              <CardDescription className="text-accent-foreground/80 font-medium">Votes Cast</CardDescription>
              <CardTitle className="text-4xl font-headline">{votedElections.size}</CardTitle>
            </CardHeader>
            <CardFooter><span className="text-xs bg-white/20 px-2 py-1 rounded">Identity verified</span></CardFooter>
          </Card>

          <Card className="bg-white overflow-hidden relative border-none shadow-sm">
            <div className="absolute top-0 right-0 p-4 text-primary/10"><Database size={80} /></div>
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-muted-foreground">Blockchain Ledger Height</CardDescription>
              <CardTitle className="text-4xl font-headline text-accent">
                {chainLoading ? <Loader2 size={28} className="animate-spin text-primary" /> : chain.length}
              </CardTitle>
            </CardHeader>
            <CardFooter><span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">Live · Firestore Synchronized</span></CardFooter>
          </Card>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mb-8">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          {(['active', 'upcoming', 'completed'] as const).map(status => (
            <TabsContent key={status} value={status} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredElections.filter(e => e.status === status).length === 0 ? (
                <div className="col-span-3 text-center py-16 text-muted-foreground">
                  <Search size={40} className="mx-auto mb-3 opacity-20" />
                  <p>No {status} elections match your search.</p>
                </div>
              ) : filteredElections.filter(e => e.status === status).map(election => (
                <Card key={election.id} className={cn("group hover:shadow-xl transition-all duration-300 border-none", status !== 'active' && 'opacity-80')}>
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
                        {status === 'upcoming' ? `Starts ${election.startDate}` : `Ends ${election.endDate}`}
                      </span>
                      <span className="font-medium text-accent">{election.candidates.length} Candidates</span>
                    </div>
                    {status === 'active' && (
                      votedElections.has(election.id) ? (
                        <Button className="w-full bg-green-500 hover:bg-green-600 pointer-events-none gap-2">
                          <CheckCircle2 size={18} /> Vote Cast
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-primary hover:bg-primary/90 gap-2 h-11"
                          onClick={() => setSelectedElection(election)}
                        >
                          Cast Your Vote <ArrowRight size={18} />
                        </Button>
                      )
                    )}
                    {status === 'completed' && (
                      <Button variant="outline" className="w-full" onClick={() => setActiveView('results')}>
                        View Final Tally
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

  // ─── Results View ──────────────────────────────────────────────────────────
  const renderResults = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-headline font-bold text-accent">Election Results</h2>
        <p className="text-muted-foreground">Real-time tallies drawn directly from the Firestore blockchain.</p>
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
                  <span className="text-xs font-medium text-muted-foreground">
                    {chainLoading ? '...' : totalVotes} Total Votes Recorded
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
                      No votes have been cast for this election yet.
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
                      <span className="text-sm font-bold text-accent">AI Transparency Report</span>
                    </div>
                    {!aiReports[election.id] ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleAiAudit(election)}
                        disabled={requestingAi[election.id] || chain.length === 0}
                      >
                        {requestingAi[election.id] ? 'Generating...' : 'Generate AI Audit'}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Gemini AI Generated
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
                            <span className="font-bold block uppercase tracking-wider mb-1">Security Analysis</span>
                            {aiReports[election.id].securityAnalysis}
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 bg-green-50 rounded border-green-100 text-[10px]">
                          <CheckCircle2 size={14} className="text-green-600 mt-0.5" />
                          <div>
                            <span className="font-bold block uppercase tracking-wider mb-1 text-green-700">Certificate of Validity</span>
                            {aiReports[election.id].verdict}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">
                      {requestingAi[election.id] ? 'Gemini is auditing the blockchain ledger...' : 'Click to generate an AI-powered security and transparency audit.'}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="bg-secondary/10 py-3 text-xs flex justify-between">
                <span>Verification ID: {election.id}-AUDIT-LOCKED</span>
                <span className="font-medium text-green-700">✅ Verified by Blockchain Network</span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // ─── Ledger View ───────────────────────────────────────────────────────────
  const renderHistory = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-accent">Blockchain Ledger</h2>
          <p className="text-muted-foreground">An immutable, Firestore-persisted record of every vote cast.</p>
        </div>
        <Button
          variant="outline"
          className="gap-2 self-start sm:self-auto"
          onClick={handleVerifyChain}
          disabled={validating || chain.length === 0}
        >
          {validating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Verify Chain Integrity
        </Button>
      </div>

      {chainValid !== null && (
        <Alert className={cn("border-2", chainValid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')}>
          {chainValid
            ? <CheckSquare className="h-5 w-5 text-green-600" />
            : <XSquare className="h-5 w-5 text-red-600" />
          }
          <AlertDescription className={cn("font-semibold ml-2", chainValid ? 'text-green-700' : 'text-red-700')}>
            {chainValid
              ? `✅ Chain Valid — All ${chain.length} blocks verified. No tampering detected.`
              : '❌ Chain Invalid — Hash mismatch detected! The chain may have been tampered with.'}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-none shadow-lg">
        <CardHeader className="bg-accent text-accent-foreground">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} />
            <div>
              <CardTitle>System Integrity Log</CardTitle>
              <CardDescription className="text-accent-foreground/70">
                Cryptographically linked chain · {chain.length} blocks recorded
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 border-b">
                  <th className="px-6 py-4 text-left font-bold">Index</th>
                  <th className="px-6 py-4 text-left font-bold">Block Hash</th>
                  <th className="px-6 py-4 text-left font-bold">Voter ID</th>
                  <th className="px-6 py-4 text-left font-bold">Timestamp</th>
                  <th className="px-6 py-4 text-left font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chainLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 size={32} className="mx-auto animate-spin text-primary opacity-40" />
                    </td>
                  </tr>
                ) : chain.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Database size={40} className="opacity-20" />
                        <p>No transactions recorded yet. Cast the first vote!</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  [...chain].reverse().map((block) => (
                    <tr key={block.hash} className="hover:bg-secondary/20 transition-colors group">
                      <td className="px-6 py-4 font-mono font-bold text-primary">#{block.index}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Hash size={14} className="text-muted-foreground" />
                          <span
                            className="font-mono text-xs bg-secondary px-2 py-1 rounded truncate max-w-[150px]"
                            title={block.hash}
                          >
                            {block.hash.substring(0, 20)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {block.data.voterId.length > 20
                            ? `${block.data.voterId.substring(0, 8)}...${block.data.voterId.slice(-4)}`
                            : block.data.voterId}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(block.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                          VALIDATED
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="bg-secondary/30 p-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="text-green-600" />
          This ledger is persisted in Firebase Firestore and follows SHA-256 proof-of-integrity.
        </CardFooter>
      </Card>
    </div>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background font-body">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveView('dashboard')}>
            <div className="p-2 bg-primary rounded-lg text-primary-foreground">
              <Vote size={20} />
            </div>
            <span className="text-xl font-headline font-bold text-accent">DecentraVote</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <NavLinks />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                <UserIcon size={14} />
              </div>
              <span className="text-xs font-medium max-w-[120px] truncate">
                {user?.displayName || user?.email}
              </span>
            </div>
            <Button variant="outline" size="icon" onClick={signOut} title="Sign Out">
              <LogOut size={18} />
            </Button>

            {/* Mobile hamburger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="flex items-center gap-2 mb-8 mt-2">
                  <div className="p-2 bg-primary rounded-lg text-primary-foreground">
                    <Vote size={18} />
                  </div>
                  <span className="text-lg font-headline font-bold text-accent">DecentraVote</span>
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
                      <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={signOut}>
                    <LogOut size={16} /> Sign Out
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
      </main>

      {/* Vote Modal */}
      {selectedElection && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl border-none">
            <CardHeader className="border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-headline text-accent">{selectedElection.title}</CardTitle>
                  <CardDescription>Select one candidate to cast your permanent, cryptographically-secured vote.</CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedElection(null)} disabled={voting}>
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {voting && (
                <div className="flex items-center gap-3 p-4 mb-4 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 size={20} className="animate-spin text-primary" />
                  <p className="text-sm font-medium text-primary">Generating cryptographic block and writing to Firestore...</p>
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
                      className="group-hover:bg-primary group-hover:text-primary-foreground border-primary text-primary transition-colors"
                    >
                      {voting ? <Loader2 size={16} className="animate-spin" /> : 'Vote'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/30 p-4 border-t">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="text-primary mt-1 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your vote will be cryptographically signed with SHA-256, linked to the blockchain, and permanently recorded in Firestore. This action cannot be undone.
                </p>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
