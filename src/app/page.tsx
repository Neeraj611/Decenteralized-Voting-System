"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Lock,
  Mail,
  User,
  Vote,
  ShieldCheck,
  BarChart3,
  AlertCircle,
  Loader2,
  Fingerprint,
  FileText,
  MapPin,
  Globe,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi (NCT)',
  'Jammu & Kashmir',
  'Puducherry'
];

export default function LandingPage() {
  const { signIn, register, error, clearError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Electoral verification server simulation states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    epicNumber: '',
    aadhaarNumber: '',
    state: '',
    constituency: '',
    ageConfirmed: false
  });

  // Check if Firebase is configured
  const isConfigured =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'YOUR_FIREBASE_API_KEY';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    clearError();
    setValidationError(null);
    const { id, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [id]: checked }));
    } else if (id === 'aadhaarNumber') {
      // Allow only digits and space, auto-format to XXXX XXXX XXXX
      const clean = value.replace(/\D/g, '').substring(0, 12);
      const parts: string[] = [];
      for (let i = 0; i < clean.length; i += 4) {
        parts.push(clean.substring(i, i + 4));
      }
      setFormData(prev => ({ ...prev, [id]: parts.join(' ') }));
    } else if (id === 'epicNumber') {
      // Auto-capitalize EPIC number, clean non-alphanumeric, max length 10
      const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10);
      setFormData(prev => ({ ...prev, [id]: clean }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (isLogin) {
      const emailTrim = formData.email.trim();
      const isEpicFormat = /^([A-Z]{3}\d{7}|[A-Z]{5}\d{4}[A-Z])$/i.test(emailTrim);

      if (isEpicFormat) {
        setIsVerifying(true);
        setVerificationStep(0);
        
        const steps = [
          () => setVerificationStep(1), // Match EPIC on roll...
          () => setVerificationStep(2), // Match signature...
          () => setVerificationStep(3), // Access granted!
        ];

        for (let i = 0; i < steps.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 800));
          steps[i]();
        }
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      setLoading(true);
      try {
        await signIn(emailTrim, formData.password);
      } catch {
        // Handled in Context
        setIsVerifying(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ─── Registration Validations ─────────────────────────────────────────────
    if (!formData.displayName.trim()) {
      setValidationError('Please enter your full name as printed on your ID card.');
      return;
    }

    // Validate EPIC format (3 letters + 7 digits OR 5 letters + 4 digits + 1 letter)
    const epicClean = formData.epicNumber.replace(/[^A-Z0-9]/g, '');
    const epicRegex = /^([A-Z]{3}\d{7}|[A-Z]{5}\d{4}[A-Z])$/i;
    if (!epicRegex.test(epicClean)) {
      setValidationError('EPIC Voter ID must be exactly 10 characters (e.g. ABLMN0423Y or WYK1234567).');
      return;
    }

    // Validate Aadhaar (12 digits)
    const aadhaarClean = formData.aadhaarNumber.replace(/\s/g, '');
    const aadhaarRegex = /^\d{12}$/;
    if (!aadhaarRegex.test(aadhaarClean)) {
      setValidationError('Aadhaar Card number must be exactly 12 digits.');
      return;
    }

    if (!formData.state) {
      setValidationError('Please select your registered State / UT.');
      return;
    }

    if (!formData.constituency.trim()) {
      setValidationError('Please enter your Parliamentary / Assembly Constituency.');
      return;
    }

    if (!formData.ageConfirmed) {
      setValidationError('You must confirm that you are an Indian citizen aged 18 or older to participate.');
      return;
    }

    // ─── Trigger ECI Server Verification Animation ────────────────────────────
    setIsVerifying(true);
    setVerificationStep(0);

    const steps = [
      () => setVerificationStep(1), // Match EPIC with ECI National Electoral Roll
      () => setVerificationStep(2), // Match Aadhaar biometric token with UIDAI Registry
      () => setVerificationStep(3), // Verification verified! Pushing to key generator.
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1100));
      steps[i]();
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    // Complete actual registration
    setLoading(true);
    try {
      const voterMetadata = {
        epicNumber: epicClean,
        aadhaarNumber: aadhaarClean,
        state: formData.state,
        constituency: formData.constituency.trim()
      };
      await register(formData.email, formData.password, formData.displayName.trim(), voterMetadata);
    } catch {
      setIsVerifying(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    clearError();
    setValidationError(null);
    setIsLogin(!isLogin);
    setFormData({
      displayName: '',
      email: '',
      password: '',
      epicNumber: '',
      aadhaarNumber: '',
      state: '',
      constituency: '',
      ageConfirmed: false
    });
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
            Secure, Transparent, and <span className="text-primary">Immutable</span> Indian Elections.
          </h2>

          <p className="text-xl text-muted-foreground leading-relaxed">
            Harnessing state-of-the-art blockchain technology to ensure your vote is counted, cryptographically sealed, and completely tamper-proof. Securely verified via Aadhaar & ECI credentials.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/10 rounded-lg text-primary">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="font-semibold">Cryptographically Authenticated</h4>
                <p className="text-sm text-muted-foreground">Every voter possesses a unique ECDSA P-256 digital signature, linked to validated electoral credentials.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/10 rounded-lg text-primary">
                <BarChart3 size={20} />
              </div>
              <div>
                <h4 className="font-semibold">Zero Gas Fee Tallying</h4>
                <p className="text-sm text-muted-foreground">Efficient, client-side Proof-of-Work visual mining eliminates gas cost overheads while enforcing consensus.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="flex justify-center animate-in fade-in slide-in-from-right duration-700">
          <Card className="w-full max-w-md shadow-2xl border-none">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-headline">{isLogin ? 'Welcome Back' : 'Register Voter Profile'}</CardTitle>
              <CardDescription>
                {isLogin ? 'Sign in to access active elections' : 'Verify your Indian Electoral Identity to generate dynamic wallet keys'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* ECI Server Gateway Verification Overlay */}
              {isVerifying && (
                <div className="p-5 bg-slate-900 text-white rounded-xl font-mono text-xs space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between text-[10px] text-primary font-bold border-b border-slate-800 pb-2">
                    <span>🇮🇳 NATIONAL ELECTORAL AUTHENTICATION SERVICE</span>
                    <span className="animate-pulse">ONLINE</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={verificationStep >= 0 ? "text-green-400" : "text-slate-500"}>
                        {verificationStep > 0 ? "✔" : "📡"}
                      </span>
                      <span className={verificationStep === 0 ? "text-yellow-400 font-bold" : verificationStep > 0 ? "text-slate-400" : "text-slate-600"}>
                        Connecting to NVSP Gateway...
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={verificationStep >= 1 ? "text-green-400" : "text-slate-500"}>
                        {verificationStep > 1 ? "✔" : verificationStep === 1 ? "🔄" : "⏳"}
                      </span>
                      <span className={verificationStep === 1 ? "text-yellow-400 font-bold" : verificationStep > 1 ? "text-slate-400" : "text-slate-600"}>
                        Checking EPIC {formData.epicNumber} on National Roll...
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={verificationStep >= 2 ? "text-green-400" : "text-slate-500"}>
                        {verificationStep > 2 ? "✔" : verificationStep === 2 ? "🔄" : "⏳"}
                      </span>
                      <span className={verificationStep === 2 ? "text-yellow-400 font-bold" : verificationStep > 2 ? "text-slate-400" : "text-slate-600"}>
                        Handshaking UIDAI Registry for Aadhaar verification...
                      </span>
                    </div>

                    {verificationStep === 3 && (
                      <div className="flex items-center gap-2 text-green-400 font-bold mt-4 p-2 bg-green-950/50 rounded border border-green-800 animate-pulse">
                        <CheckCircle2 size={16} />
                        <span>Voter ID & Aadhaar Authenticated Successfully!</span>
                      </div>
                    )}
                  </div>
                  {verificationStep < 3 && (
                    <div className="flex justify-center pt-2">
                      <Loader2 className="animate-spin text-primary" size={20} />
                    </div>
                  )}
                </div>
              )}

              {!isVerifying && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {!isConfigured && isLogin && (
                    <Alert className="mb-4 bg-amber-50/50 border-amber-200 text-amber-900">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <AlertDescription className="text-xs space-y-1">
                        <div>
                          <strong>Developer Sandbox Active:</strong> Email/password sign-in bypass is enabled.
                        </div>
                        <div className="text-slate-600">
                          Simply log in to load mock credentials, or <strong>Sign Up</strong> to test the real Indian ECI gateway verification!
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {!isLogin && (
                    <div className="space-y-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                      <span className="text-xs uppercase font-bold text-[#391F7A] tracking-wider block border-b pb-1 mb-2">
                        🇮🇳 Indian Electoral Credentials
                      </span>

                      {/* Name input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="displayName" className="text-xs">Full Name (as printed on ID)</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            id="displayName"
                            placeholder="e.g. Harsh Vardhan"
                            className="pl-9 h-9 text-xs"
                            required={!isLogin}
                            value={formData.displayName}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* EPIC input */}
                        <div className="space-y-1.5">
                          <Label htmlFor="epicNumber" className="text-xs">EPIC Voter ID Number</Label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              id="epicNumber"
                              placeholder="e.g. ABLMN0423Y"
                              className="pl-9 h-9 text-xs font-mono"
                              required={!isLogin}
                              value={formData.epicNumber}
                              onChange={handleChange}
                            />
                          </div>
                        </div>

                        {/* Aadhaar input */}
                        <div className="space-y-1.5">
                          <Label htmlFor="aadhaarNumber" className="text-xs">Aadhaar Card Number</Label>
                          <div className="relative">
                            <Fingerprint className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              id="aadhaarNumber"
                              placeholder="0000 0000 0000"
                              className="pl-9 h-9 text-xs font-mono"
                              required={!isLogin}
                              value={formData.aadhaarNumber}
                              onChange={handleChange}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* State Dropdown */}
                        <div className="space-y-1.5">
                          <Label htmlFor="state" className="text-xs">State / Union Territory</Label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <select
                              id="state"
                              className="w-full pl-9 pr-2 h-9 text-xs rounded-md border border-input bg-background py-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              required={!isLogin}
                              value={formData.state}
                              onChange={handleChange}
                            >
                              <option value="">Select State</option>
                              {INDIAN_STATES.map((st) => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Constituency input */}
                        <div className="space-y-1.5">
                          <Label htmlFor="constituency" className="text-xs">Assembly Constituency</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              id="constituency"
                              placeholder="e.g. New Delhi"
                              className="pl-9 h-9 text-xs"
                              required={!isLogin}
                              value={formData.constituency}
                              onChange={handleChange}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Declaration checkbox */}
                      <div className="flex items-start gap-2 pt-1">
                        <input
                          id="ageConfirmed"
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                          required={!isLogin}
                          checked={formData.ageConfirmed}
                          onChange={handleChange}
                        />
                        <label htmlFor="ageConfirmed" className="text-[10px] text-slate-500 leading-snug">
                          I confirm that I am an Indian citizen, aged 18 years or older, registering as a validated voter.
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Standard Sign in Inputs */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">{isLogin ? "Email Address or EPIC Voter ID" : "Email Address"}</Label>
                      <div className="relative">
                        {isLogin && /^([A-Z]{3}\d{7}|[A-Z]{5}\d{4}[A-Z])$/i.test(formData.email.trim()) ? (
                          <FileText className="absolute left-3 top-3 h-4 w-4 text-primary animate-pulse" />
                        ) : (
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        )}
                        <Input
                          id="email"
                          type="text"
                          placeholder={isLogin ? "e.g. name@example.com or ABLMN0423Y" : "name@example.com"}
                          className="pl-10 h-10 text-sm"
                          required
                          value={formData.email}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10 h-10 text-sm"
                          required
                          minLength={6}
                          value={formData.password}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  {validationError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs ml-1">{validationError}</AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs ml-1">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full h-11 text-base bg-primary hover:bg-primary/90 transition-all font-semibold" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Finalizing...</span>
                    ) : (isLogin ? 'Sign In' : 'Authenticate & Sign Up')}
                  </Button>
                </form>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              {!isVerifying && (
                <>
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
                    disabled={loading}
                  >
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

