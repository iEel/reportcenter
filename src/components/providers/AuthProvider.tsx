"use client";

import { createContext, useContext, useEffect, useState } from 'react';

interface UserInfo {
    userId: number;
    username: string;
    fullName: string;
    roleId: number;
    roleName: string;
    companyId: number;
    allowedCompanies: number[];
    availableReportTypes: number[];
}

interface AuthContextType {
    user: UserInfo | null;
    isLoading: boolean;
    refresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    refresh: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUser = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.status === 401) {
                setUser(null);
                // Redirect to login if on a protected page
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                    window.location.href = '/login';
                }
                return;
            }
            const data = await res.json();
            if (data.success) {
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
        // Re-check session every 5 minutes
        const interval = setInterval(fetchUser, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, refresh: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
