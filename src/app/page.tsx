
"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, Vote, ShieldCheck, BarChart3 } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate auth
    setTimeout(() => {
      router.push('/dashboard');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-background font-body flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        
        {/* Left Side: Info */}
        <div className="space-y-8 animate-in fade-in slide-in-from-left duration-700">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-3 bg-primary rounded-xl text-primary-foreground shadow-lg">
              <Vote size={32} />
            </div>
            <h1 className="text-4xl font-headline font-bold text-accent">DecentraVote</h1>
          </div>
          
          <h2 className="text-5xl font-headline font-bold leading-tight">
            Secure, Transparent, and <span className="text-primary">Immutable</span> Voting.
          </h2>
          
          <p className="text-xl text-muted-foreground leading-relaxed">
            Harnessing blockchain principles to ensure your vote is counted, verifiable, and permanent. Join the future of democratic participation.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/10 rounded-lg text-primary">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="font-semibold">Cryptographically Secure</h4>
                <p className="text-sm text-muted-foreground">Every vote is hashed and linked to prevent tampering.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/10 rounded-lg text-primary">
                <BarChart3 size={20} />
              </div>
              <div>
                <h4 className="font-semibold">Real-time Tally</h4>
                <p className="text-sm text-muted-foreground">Instant, transparent updates as soon as votes are cast.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="flex justify-center animate-in fade-in slide-in-from-right duration-700">
          <Card className="w-full max-w-md shadow-2xl border-none">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-headline">{isLogin ? 'Welcome Back' : 'Join DecentraVote'}</CardTitle>
              <CardDescription>
                {isLogin ? 'Sign in to access active elections' : 'Register to verify your identity and vote'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="voterId">Government ID / Voter ID</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="voterId" placeholder="DV-12345678" className="pl-10" required />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="name@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" className="pl-10" required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 text-lg bg-primary hover:bg-primary/90 transition-all" disabled={loading}>
                  {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
