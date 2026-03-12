"use client"

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  Hash
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { mockElections, getResultsForElection, Election, addToChain, getVoteChain } from '@/lib/store';
import { createNewBlock } from '@/lib/blockchain';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type ViewState = 'dashboard' | 'results' | 'history';

export default function Dashboard() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [voting, setVoting] = useState(false);
  const [votedElections, setVotedElections] = useState<Set<string>>(new Set());

  const chain = getVoteChain();

  const handleVote = async (candidateId: string) => {
    if (!selectedElection) return;
    
    setVoting(true);
    try {
      const currentChain = getVoteChain();
      const prevBlock = currentChain.length > 0 ? currentChain[currentChain.length - 1] : null;
      
      const newBlock = await createNewBlock(prevBlock, {
        voterId: 'vishuu5044',
        electionId: selectedElection.id,
        candidateId: candidateId,
        timestamp: Date.now()
      });
      
      addToChain(newBlock);
      setVotedElections(prev => new Set(prev).add(selectedElection.id));
      
      toast({
        title: "Vote Cast Successfully",
        description: `Your vote has been cryptographically secured. Hash: ${newBlock.hash.substring(0, 12)}...`,
      });
      
      setSelectedElection(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error casting vote",
        description: "A cryptographic error occurred while generating the block.",
      });
    } finally {
      setVoting(false);
    }
  };

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-accent">Voter Dashboard</h2>
          <p className="text-muted-foreground">Welcome back. Select an active election to participate securely.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search elections..." className="pl-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-primary-foreground overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock size={80} />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/80 font-medium">Active Elections</CardDescription>
            <CardTitle className="text-4xl font-headline">
              {mockElections.filter(e => e.status === 'active').length}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Action required</span>
          </CardFooter>
        </Card>
        
        <Card className="bg-accent text-accent-foreground overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle2 size={80} />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-accent-foreground/80 font-medium">Votes Cast</CardDescription>
            <CardTitle className="text-4xl font-headline">{votedElections.size}</CardTitle>
          </CardHeader>
          <CardFooter>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Identity verified</span>
          </CardFooter>
        </Card>

        <Card className="bg-white overflow-hidden relative border-none shadow-sm">
          <div className="absolute top-0 right-0 p-4 text-primary/10">
            <Database size={80} />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-muted-foreground">Blockchain Ledger Height</CardDescription>
            <CardTitle className="text-4xl font-headline text-accent">{chain.length}</CardTitle>
          </CardHeader>
          <CardFooter>
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">Node Synchronized</span>
          </CardFooter>
        </Card>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md mb-8">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockElections.filter(e => e.status === 'active').map(election => (
            <Card key={election.id} className="group hover:shadow-xl transition-all duration-300 border-none">
              <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                <Image 
                  src={election.imageUrl} 
                  alt={election.title} 
                  fill 
                  className="object-cover transition-transform group-hover:scale-105"
                  data-ai-hint="city hall"
                />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-green-500 hover:bg-green-600 border-none">
                    Active
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
                  <span className="flex items-center gap-1"><Clock size={14} /> Ends {election.endDate}</span>
                  <span className="font-medium text-accent">{election.candidates.length} Candidates</span>
                </div>
                {votedElections.has(election.id) ? (
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
                )}
              </CardFooter>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="upcoming" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockElections.filter(e => e.status === 'upcoming').map(election => (
            <Card key={election.id} className="opacity-80 border-none shadow-sm">
              <div className="relative h-48 w-full overflow-hidden rounded-t-lg grayscale">
                <Image src={election.imageUrl} alt={election.title} fill className="object-cover" />
              </div>
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">Upcoming</Badge>
                <CardTitle className="text-xl font-headline text-accent">{election.title}</CardTitle>
                <CardDescription>{election.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-sm font-medium text-muted-foreground">Starts on {election.startDate}</p>
              </CardFooter>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockElections.filter(e => e.status === 'completed').map(election => (
            <Card key={election.id} className="border-none shadow-sm overflow-hidden">
               <div className="relative h-32 w-full overflow-hidden grayscale">
                <Image src={election.imageUrl} alt={election.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                   <Badge variant="secondary" className="bg-white/90">Completed</Badge>
                </div>
              </div>
              <CardHeader>
                <CardTitle className="text-lg font-headline text-accent">{election.title}</CardTitle>
                <CardDescription>Final audit complete and ledger sealed.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setActiveView('results')}>
                  View Final Tally
                </Button>
              </CardFooter>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-headline font-bold text-accent">Election Results</h2>
        <p className="text-muted-foreground">Real-time and finalized tallies across all registered elections.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {mockElections.map(election => {
          const results = getResultsForElection(election.id);
          const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);
          
          return (
            <Card key={election.id} className="border-none shadow-md overflow-hidden">
              <CardHeader className="border-b bg-secondary/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl font-headline text-accent">{election.title}</CardTitle>
                  <Badge variant={election.status === 'completed' ? 'secondary' : 'default'} className={election.status === 'active' ? 'bg-green-500' : ''}>
                    {election.status.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription>{election.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Candidate Standings</span>
                  <span className="text-xs font-medium text-muted-foreground">{totalVotes} Total Votes Recorded</span>
                </div>
                <div className="space-y-4">
                  {election.candidates.map(candidate => {
                    const count = results[candidate.id] || 0;
                    const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                    return (
                      <div key={candidate.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="font-bold">{candidate.name}</span>
                            <span className="text-xs text-muted-foreground">({candidate.party})</span>
                          </div>
                          <span className="font-mono">{count} votes ({percentage.toFixed(1)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2.5" />
                      </div>
                    );
                  })}
                  {totalVotes === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No votes have been cast for this election yet.
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="bg-secondary/10 py-3 text-xs flex justify-between">
                <span>Verification ID: {election.id}-AUDIT-LOCKED</span>
                <span className="font-medium">Verified by Blockchain Network</span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-headline font-bold text-accent">Blockchain Ledger</h2>
        <p className="text-muted-foreground">An immutable record of every vote cast in the system.</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="bg-accent text-accent-foreground">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} />
            <div>
              <CardTitle>System Integrity Log</CardTitle>
              <CardDescription className="text-accent-foreground/70">
                Cryptographically linked chain of blocks.
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
                  <th className="px-6 py-4 text-left font-bold">Voter ID (Anonymized)</th>
                  <th className="px-6 py-4 text-left font-bold">Timestamp</th>
                  <th className="px-6 py-4 text-left font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chain.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Database size={40} className="opacity-20" />
                        <p>No transactions have been recorded in the ledger yet.</p>
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
                          <span className="font-mono text-xs bg-secondary px-2 py-1 rounded truncate max-w-[150px]" title={block.hash}>
                            {block.hash.substring(0, 20)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs">{block.data.voterId}</span>
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
          This ledger is decentralized and follows the Proof-of-Authority consensus protocol.
        </CardFooter>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-body">
      <nav className="sticky top-0 z-50 w-full bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveView('dashboard')}>
            <div className="p-2 bg-primary rounded-lg text-primary-foreground">
              <Vote size={20} />
            </div>
            <span className="text-xl font-headline font-bold text-accent">DecentraVote</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <Button 
              variant={activeView === 'dashboard' ? 'secondary' : 'ghost'} 
              className={cn("gap-2", activeView === 'dashboard' && "text-primary")}
              onClick={() => setActiveView('dashboard')}
            >
              <LayoutDashboard size={18} /> Dashboard
            </Button>
            <Button 
              variant={activeView === 'results' ? 'secondary' : 'ghost'} 
              className={cn("gap-2", activeView === 'results' && "text-primary")}
              onClick={() => setActiveView('results')}
            >
              <BarChart size={18} /> Results
            </Button>
            <Button 
              variant={activeView === 'history' ? 'secondary' : 'ghost'} 
              className={cn("gap-2", activeView === 'history' && "text-primary")}
              onClick={() => setActiveView('history')}
            >
              <HistoryIcon size={18} /> Ledger
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                <UserIcon size={14} />
              </div>
              <span className="text-xs font-medium">vishuu5044</span>
            </div>
            <Button variant="outline" size="icon" onClick={() => router.push('/')}>
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'results' && renderResults()}
        {activeView === 'history' && renderHistory()}
      </main>

      {selectedElection && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl border-none">
            <CardHeader className="border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-headline text-accent">{selectedElection.title}</CardTitle>
                  <CardDescription>Select one candidate to cast your secure vote.</CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedElection(null)} disabled={voting}>
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-4">
                {selectedElection.candidates.map(candidate => (
                  <div 
                    key={candidate.id} 
                    className="flex items-center justify-between p-4 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
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
                    <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground border-primary text-primary transition-colors">
                      Vote
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/30 p-4 border-t">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="text-primary mt-1" />
                <p className="text-xs text-muted-foreground">
                  By clicking a candidate, your vote will be cryptographically signed and broadcast to the secure ledger. 
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
