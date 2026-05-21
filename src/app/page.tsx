"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Mail, User, Vote, ShieldCheck, BarChart3, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const { signIn, register, error, clearError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ displayName: '', email: '', password: '' });

  // Check if Firebase is configured
  const isConfigured =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'YOUR_FIREBASE_API_KEY';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        if (!formData.displayName.trim()) return;
        await register(formData.email, formData.password, formData.displayName);
      }
    } catch {
      // error is shown via AuthContext error state
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    clearError();
    setIsLogin(!isLogin);
    setFormData({ displayName: '', email: '', password: '' });
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
                <p className="text-sm text-muted-foreground">Every vote is SHA-256 hashed and chain-linked to prevent tampering.</p>
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
                {isLogin ? 'Sign in to access active elections' : 'Register your identity to cast a secure vote'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isConfigured && (
                <Alert className="mb-6 bg-amber-50 border-amber-200 text-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm">
                    <strong>Action Required:</strong> Firebase configuration is missing.
                    Please create a <code>.env.local</code> file with your API keys to enable authentication and voting.
                    See <code>.env.local.example</code> for details.
                  </AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Full Name / Voter Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="displayName"
                        placeholder="Your full name"
                        className="pl-10"
                        required={!isLogin}
                        value={formData.displayName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      className="pl-10"
                      required
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm ml-1">{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full h-11 text-base bg-primary hover:bg-primary/90 transition-all" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Processing...</span>
                  ) : (isLogin ? 'Sign In' : 'Create Account')}
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
                onClick={toggleMode}
                type="button"
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
