
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
  History, 
  LogOut,
  User as UserIcon,
  Search,
  LayoutDashboard
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { mockElections, getResultsForElection, Election, addToChain, getVoteChain } from '@/lib/store';
import { createNewBlock } from '@/lib/blockchain';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [voting, setVoting] = useState(false);
  const [votedElections, setVotedElections] = useState<Set<string>>(new Set());

  const handleVote = async (candidateId: string) => {
    if (!selectedElection) return;
    
    setVoting(true);
    try {
      const currentChain = getVoteChain();
      const prevBlock = currentChain.length > 0 ? currentChain[currentChain.length - 1] : null;
      
      const newBlock = await createNewBlock(prevBlock, {
        voterId: 'voter-123', // Hardcoded for demo
        electionId: selectedElection.id,
        candidateId: candidateId,
        timestamp: Date.now()
      });
      
      addToChain(newBlock);
      setVotedElections(prev => new Set(prev).add(selectedElection.id));
      
      toast({
        title: "Vote Cast Successfully",
        description: `Your vote for election "${selectedElection.title}" has been added to the blockchain ledger. Hash: ${newBlock.hash.substring(0, 16)}...`,
      });
      
      setSelectedElection(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error casting vote",
        description: "An unexpected error occurred during the cryptographic process.",
      });
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg text-primary-foreground">
              <Vote size={20} />
            </div>
            <span className="text-xl font-headline font-bold text-accent">DecentraVote</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <Button variant="ghost" className="text-primary font-medium flex gap-2">
              <LayoutDashboard size={18} /> Dashboard
            </Button>
            <Button variant="ghost" className="flex gap-2">
              <BarChart size={18} /> Results
            </Button>
            <Button variant="ghost" className="flex gap-2">
              <History size={18} /> History
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                <UserIcon size={14} />
              </div>
              <span className="text-xs font-medium">DV-12345678</span>
            </div>
            <Button variant="outline" size="icon" onClick={() => router.push('/')}>
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-headline font-bold text-accent">Voter Dashboard</h2>
            <p className="text-muted-foreground">Welcome back, John. Select an active election to participate.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search elections..." className="pl-10" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Clock size={80} />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-primary-foreground/80 font-medium">Active Elections</CardDescription>
              <CardTitle className="text-4xl font-headline">2</CardTitle>
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
              <span className="text-xs bg-white/20 px-2 py-1 rounded">Account verified</span>
            </CardFooter>
          </Card>

          <Card className="bg-white overflow-hidden relative border-none shadow-sm">
            <div className="absolute top-0 right-0 p-4 text-primary/10">
              <BarChart size={80} />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="font-medium">Total Ledger Blocks</CardDescription>
              <CardTitle className="text-4xl font-headline">{getVoteChain().length}</CardTitle>
            </CardHeader>
            <CardFooter>
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">Syncing...</span>
            </CardFooter>
          </Card>
        </div>

        {/* Elections Content */}
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
              <Card key={election.id} className="opacity-80 grayscale-[0.5] border-none shadow-sm">
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2">Upcoming</Badge>
                  <CardTitle className="text-xl font-headline">{election.title}</CardTitle>
                  <CardDescription>{election.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <p className="text-sm font-medium text-muted-foreground">Starts on {election.startDate}</p>
                </CardFooter>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="completed" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockElections.filter(e => e.status === 'completed').map(election => {
              const results = getResultsForElection(election.id);
              const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);
              
              return (
                <Card key={election.id} className="border-none shadow-sm overflow-hidden">
                  <CardHeader className="bg-secondary/50">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary">Completed</Badge>
                      <span className="text-xs font-mono bg-white px-2 py-1 rounded shadow-sm">Ledger Verified</span>
                    </div>
                    <CardTitle className="text-lg font-headline mt-2">{election.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <p className="text-sm font-medium">Final Tally Results:</p>
                    {election.candidates.map(candidate => {
                      const count = results[candidate.id] || 0;
                      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                      return (
                        <div key={candidate.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{candidate.name}</span>
                            <span>{count} votes</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </CardContent>
                  <CardFooter className="bg-accent text-accent-foreground py-2 text-center justify-center">
                    <p className="text-xs font-medium">Election Concluded on {election.endDate}</p>
                  </CardFooter>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </main>

      {/* Voting Modal */}
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

// Re-using lucide check for some icons
function ShieldCheck({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
