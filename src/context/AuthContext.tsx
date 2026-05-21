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
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName: string) => Promise<void>;
    error: string | null;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Safe check if auth is correctly initialized
        if (typeof onAuthStateChanged !== 'function' || !auth || !auth.app) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        setError(null);
        try {
            // BYPASS FIREBASE: Force login without validation
            console.warn('Logging in via BYPASS MODE');
            // Mock a user object
            setUser({ email, uid: 'dummy-uid-123', displayName: 'Bypass User' } as User); 
            // Set auth cookie for middleware
            document.cookie = 'decentravote-auth=1; path=/; max-age=86400; SameSite=Strict';
            router.push('/dashboard');
        } catch (err: any) {
            const msg = getAuthErrorMessage(err.code || 'unknown');
            setError(msg);
            throw new Error(msg);
        }
    };

    const register = async (email: string, password: string, displayName: string) => {
        setError(null);
        try {
            // BYPASS FIREBASE: Force registration without validation
            console.warn('Registering via BYPASS MODE');
            // Mock a user object
            setUser({ email, uid: 'dummy-uid-123', displayName } as User);
            document.cookie = 'decentravote-auth=1; path=/; max-age=86400; SameSite=Strict';
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Signup Error:', err.code, err.message);
            const msg = getAuthErrorMessage(err.code || 'unknown');
            setError(msg);
            throw new Error(msg);
        }
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        // Remove auth cookie
        document.cookie = 'decentravote-auth=; path=/; max-age=0';
        router.push('/');
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider value={{ user, loading, signOut, signIn, register, error, clearError }}>
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
        case 'auth/email-already-in-use': return 'This email is already registered.';
        case 'auth/invalid-email': return 'Please enter a valid email address.';
        case 'auth/weak-password': return 'Password must be at least 6 characters.';
        case 'auth/user-not-found': return 'No account found with this email.';
        case 'auth/wrong-password': return 'Incorrect password. Please try again.';
        case 'auth/invalid-credential': return 'Invalid email or password.';
        case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
        default: return 'An authentication error occurred. Please try again.';
    }
}
