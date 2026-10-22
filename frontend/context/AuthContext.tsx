'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface User {
    id: string;
    email?: string;
    app_metadata?: Record<string, any>;
    user_metadata?: {
        full_name?: string;
        role?: string;
        [key: string]: any;
    };
    role?: string;
    [key: string]: any;
}

export interface Session {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    user?: User;
    [key: string]: any;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: any | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    updateLocalSession: (data: { user: User, session: Session, require_password_change?: boolean, role?: string }) => void;
    requirePasswordChange: boolean;
    setRequirePasswordChange: (val: boolean) => void;
}

function setSessionCookies(token?: string, role?: string) {
    if (typeof document === 'undefined') return;
    if (token) {
        document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
    }
    if (role) {
        document.cookie = `session_role=${encodeURIComponent(role)}; path=/; max-age=604800; SameSite=Lax`;
    }
}

function clearSessionCookies() {
    if (typeof document === 'undefined') return;
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'session_role=; path=/; max-age=0; SameSite=Lax';
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    signOut: async () => {},
    updateLocalSession: () => {},
    requirePasswordChange: false,
    setRequirePasswordChange: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [requirePasswordChange, setRequirePasswordChange] = useState(false);

    // Fetch full user profile including role from the backend
    const fetchUserProfile = async (userId: string, fallbackMeta?: any) => {
        try {
            const data = await api.get(`/users/${userId}`) as any;
            const liveRole = data?.role || fallbackMeta?.role || 'client';
            // Store full user data as 'profile' plus explicit role and offers
            setProfile({
                ...(fallbackMeta || {}),
                ...data?.profile,
                role: liveRole,
                general_discount: data?.general_discount || 0,
                delivery_fee: data?.delivery_fee || 0,
                productDiscounts: data?.productDiscounts || [],
            });
            setSessionCookies(undefined, liveRole);
        } catch {
            if (fallbackMeta) {
                setProfile(fallbackMeta);
                if (fallbackMeta.role) {
                    setSessionCookies(undefined, fallbackMeta.role);
                }
            }
        }
    };

    useEffect(() => {
        const savedSession = localStorage.getItem('local_session');
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                setUser(parsed.user);
                setSession(parsed.session);
                setRequirePasswordChange(!!parsed.require_password_change);

                // Ensure cookies are synchronized on load
                const token = parsed.session?.access_token;
                const role = parsed.user?.user_metadata?.role || parsed.role || 'client';
                setSessionCookies(token, role);

                // Fetch live profile + role from backend
                fetchUserProfile(parsed.user.id, parsed.user?.user_metadata);
            } catch (e) {
                console.error('Error parsing local session:', e);
            }
        }
        setIsLoading(false);
    }, []);

    const updateLocalSession = (data: { user: any, session: any, require_password_change?: boolean, role?: string }) => {
        setUser(data.user);
        setSession(data.session);
        setRequirePasswordChange(!!data.require_password_change);
        localStorage.setItem('local_session', JSON.stringify(data));

        const token = data.session?.access_token;
        const initialRole = data.user?.user_metadata?.role || data.role || 'client';
        setSessionCookies(token, initialRole);

        // Fetch live profile + role from backend immediately after login
        fetchUserProfile(data.user.id, data.user.user_metadata);
    };

    const signOut = async () => {
        setUser(null);
        setSession(null);
        setProfile(null);
        setRequirePasswordChange(false);
        localStorage.removeItem('local_session');
        clearSessionCookies();
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, isLoading, signOut, updateLocalSession, requirePasswordChange, setRequirePasswordChange }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
