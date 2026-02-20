"use client";

import { createContext, useContext, useEffect, useState } from 'react';

interface UserInfo {
    userId: number;
    username: string;
    fullName: string;
    roleId: number;
    roleName: string;
    companyId: number;
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
