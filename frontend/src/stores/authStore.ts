/**
 * Auth Store
 * Manages authentication state with Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
    // State
    isAuthenticated: boolean;
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;

    // Actions
    login: (user: User, accessToken: string, refreshToken: string) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
    setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            // Initial state
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,

            // Login action
            login: (user, accessToken, refreshToken) =>
                set({
                    isAuthenticated: true,
                    user,
                    accessToken,
                    refreshToken,
                }),

            // Logout action
            logout: () =>
                set({
                    isAuthenticated: false,
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                }),

            // Update user
            updateUser: (userData) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...userData } : null,
                })),

            // Update tokens
            setTokens: (accessToken, refreshToken) =>
                set({ accessToken, refreshToken }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                isAuthenticated: state.isAuthenticated,
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
            }),
        }
    )
);

export default useAuthStore;
