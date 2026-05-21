'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    onAuthStateChanged,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { setOfflineOverride } from '@/lib/store';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: any;
    loading: boolean;
    signOut: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName: string, voterMetadata?: any) => Promise<void>;
    error: string | null;
    clearError: () => void;
    isOfflineMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Pre-populate mock Electoral Commission database if not initialized
        if (typeof window !== 'undefined') {
            try {
                const registryStr = localStorage.getItem('decentravote_registered_voters');
                if (!registryStr || registryStr.includes('WYK1234567')) {
                    const mockRegistry = {
                        'harsh@eci.gov.in': {
                            uid: 'local-voter-harsh-eci-gov-in',
                            email: 'harsh@eci.gov.in',
                            displayName: 'Harsh Vardhan',
                            password: 'password',
                            voterMetadata: {
                                epicNumber: 'ABLMN0423Y',
                                aadhaarNumber: '1111 2222 3333',
                                state: 'Delhi (NCT)',
                                constituency: 'New Delhi'
                            }
                        },
                        'neeraj@gmail.com': {
                            uid: 'local-voter-neeraj-gmail-com',
                            email: 'neeraj@gmail.com',
                            displayName: 'Neeraj Kumar',
                            password: 'password',
                            voterMetadata: {
                                epicNumber: 'WYK7654321',
                                aadhaarNumber: '9999 8888 7777',
                                state: 'Uttar Pradesh',
                                constituency: 'Noida'
                            }
                        }
                    };
                    localStorage.setItem('decentravote_registered_voters', JSON.stringify(mockRegistry));
                    localStorage.removeItem('decentravote_local_user');
                }
            } catch (e) {
                console.error("Failed to seed mock electoral commission database", e);
            }
        }

        // First check local mock user cache
        if (typeof window !== 'undefined') {
            const cachedUser = localStorage.getItem('decentravote_local_user');
            const authCookie = document.cookie.split('; ').find(row => row.startsWith('decentravote-auth='));
            if (cachedUser && authCookie) {
                try {
                    setUser(JSON.parse(cachedUser));
                    setIsOfflineMode(true);
                    setOfflineOverride(true);
                    setLoading(false);
                    return;
                } catch {}
            }
        }

        // Safe check if auth is correctly initialized
        if (typeof onAuthStateChanged !== 'function' || !auth || !auth.app) {
            setIsOfflineMode(true);
            setOfflineOverride(true);
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsOfflineMode(false);
            setOfflineOverride(false);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        setError(null);
        try {
            if (!auth || !auth.app) {
                throw { code: 'auth/unconfigured' };
            }
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // Set auth cookie for middleware security check
            document.cookie = 'decentravote-auth=1; path=/; max-age=86400; SameSite=Strict';
            setUser(userCredential.user);
            setIsOfflineMode(false);
            setOfflineOverride(false);
            router.push('/dashboard');
        } catch (err: any) {
            if (err.code === 'auth/unconfigured' || err.code === 'auth/configuration-not-found' || err.code === 'auth/wrong-password') {
                console.warn('⚠️ Firebase unconfigured or disabled. Falling back to Developer Local Mode.');
                
                // Read local database registry
                let localUser: any = null;
                if (typeof window !== 'undefined') {
                    try {
                        const registryStr = localStorage.getItem('decentravote_registered_voters') || '{}';
                        const registry = JSON.parse(registryStr);
                        
                        const identityLower = email.toLowerCase().trim();
                        let matchedEntry: any = null;
                        
                        // Search keys (email) or values (voterMetadata.epicNumber)
                        for (const key in registry) {
                            const entry = registry[key];
                            if (
                                entry.email?.toLowerCase() === identityLower ||
                                entry.voterMetadata?.epicNumber?.toLowerCase() === identityLower
                            ) {
                                matchedEntry = entry;
                                break;
                            }
                        }
                        
                        if (matchedEntry) {
                            if (matchedEntry.password && matchedEntry.password !== password) {
                                const msg = getAuthErrorMessage('auth/wrong-password');
                                setError(msg);
                                throw new Error(msg);
                            }
                            localUser = {
                                uid: matchedEntry.uid,
                                email: matchedEntry.email,
                                displayName: matchedEntry.displayName,
                                emailVerified: true,
                                voterMetadata: matchedEntry.voterMetadata
                            };
                        } else {
                            // If credentials are not found in registry database, throw and block sign in
                            const msg = 'Voter credentials not found in Electoral Commission Database. Please sign up first.';
                            setError(msg);
                            throw new Error(msg);
                        }
                    } catch (e: any) {
                        if (e.message?.includes('Incorrect password') || e.message?.includes('wrong-password') || e.message?.includes('not found') || e.message?.includes('Electoral')) throw e;
                    }
                }
                
                if (!localUser) {
                    throw new Error('Voter credentials not found in Electoral Commission Database.');
                }

                document.cookie = 'decentravote-auth=1; path=/; max-age=86400; SameSite=Strict';
                setUser(localUser);
                setIsOfflineMode(true);
                setOfflineOverride(true);
                localStorage.setItem('decentravote_local_user', JSON.stringify(localUser));
                router.push('/dashboard');
                return;
            }
            const msg = getAuthErrorMessage(err.code || 'unknown');
            setError(msg);
            throw new Error(msg);
        }
    };

    const register = async (email: string, password: string, displayName: string, voterMetadata?: any) => {
        setError(null);
        try {
            if (!auth || !auth.app) {
                throw { code: 'auth/unconfigured' };
            }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName });
            // Set auth cookie for middleware security check
            document.cookie = 'decentravote-auth=1; path=/; max-age=86400; SameSite=Strict';
            setUser(userCredential.user);
            setIsOfflineMode(false);
            setOfflineOverride(false);
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Signup Error:', err.code, err.message);
            if (err.code === 'auth/unconfigured' || err.code === 'auth/configuration-not-found') {
                console.warn('⚠️ Firebase unconfigured or disabled. Falling back to Developer Local Mode.');
                const localUid = 'local-voter-' + email.toLowerCase().replace(/[^a-z0-9]/g, '-');
                
                const defaultMetadata = voterMetadata || {
                    epicNumber: 'IND' + Math.floor(1000000 + Math.random() * 9000000),
                    aadhaarNumber: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
                    state: 'Delhi',
                    constituency: 'Delhi General Constituency'
                };

                const localUser = {
                    uid: localUid,
                    email: email,
                    displayName: displayName || email.split('@')[0].toUpperCase(),
                    emailVerified: true,
                    voterMetadata: defaultMetadata
                } as any;

                // Save to local registry database
                if (typeof window !== 'undefined') {
                    try {
                        const registryStr = localStorage.getItem('decentravote_registered_voters') || '{}';
                        const registry = JSON.parse(registryStr);
                        registry[email.toLowerCase()] = {
                            uid: localUid,
                            email: email,
                            displayName: localUser.displayName,
                            voterMetadata: defaultMetadata,
                            password: password
                        };
                        localStorage.setItem('decentravote_registered_voters', JSON.stringify(registry));
                    } catch {}
                }

                document.cookie = 'decentravote-auth=1; path=/; max-age=86400; SameSite=Strict';
                setUser(localUser);
                setIsOfflineMode(true);
                setOfflineOverride(true);
                localStorage.setItem('decentravote_local_user', JSON.stringify(localUser));
                router.push('/dashboard');
                return;
            }
            const msg = getAuthErrorMessage(err.code || 'unknown');
            setError(msg);
            throw new Error(msg);
        }
    };

    const signOut = async () => {
        if (auth && auth.app) {
            await firebaseSignOut(auth);
        }
        if (typeof window !== 'undefined') {
            localStorage.removeItem('decentravote_local_user');
            localStorage.removeItem('decentravote_offline_mode');
        }
        // Remove auth cookie
        document.cookie = 'decentravote-auth=; path=/; max-age=0';
        setUser(null);
        setIsOfflineMode(false);
        setOfflineOverride(false);
        router.push('/');
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider value={{ user, loading, signOut, signIn, register, error, clearError, isOfflineMode }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

function getAuthErrorMessage(code: string): string {
    switch (code) {
        case 'auth/unconfigured': return 'Firebase Authentication is not configured. Please initialize your .env.local file to enable public national election access.';
        case 'auth/configuration-not-found': return 'Firebase Authentication is not enabled for this project. Please go to your Firebase Console -> Build -> Authentication, click "Get Started", and enable the "Email/Password" sign-in provider under the "Sign-in method" tab.';
        case 'auth/email-already-in-use': return 'This email is already registered to a Voter.';
        case 'auth/invalid-email': return 'Please enter a valid email address.';
        case 'auth/weak-password': return 'Voter password must be at least 6 characters.';
        case 'auth/user-not-found': return 'No voter account found with this email.';
        case 'auth/wrong-password': return 'Incorrect password. Please verify credentials.';
        case 'auth/invalid-credential': return 'Invalid email or password.';
        case 'auth/too-many-requests': return 'Too many attempts. Connection locked out.';
        default: return 'An authentication error occurred. Please try again.';
    }
}
