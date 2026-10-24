/**
 * HanuJai High School ERP — Authentication Context
 * Supports both Firebase Authentication and In-Browser Demo Authentication.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { StaffUser, StaffRole } from '../domain/types';
import { isDemoMode } from '../config/firebase';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getDataProvider } from '../data';
import { initialStaff } from '../data/demo/seedData';

interface AuthContextType {
  currentUser: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoRole: (role: StaffRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check if user actively selected a role persona override
    const overrideJson = localStorage.getItem('hanujai_demo_user_override');
    if (overrideJson) {
      try {
        const savedOverride = JSON.parse(overrideJson);
        if (savedOverride && savedOverride.role) {
          setCurrentUser(savedOverride);
          setIsLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem('hanujai_demo_user_override');
      }
    }

    if (isDemoMode()) {
      const savedUserId = localStorage.getItem('hanujai_demo_user_id') || 'staff-001';
      const user = initialStaff.find(s => s.id === savedUserId) || initialStaff[0];
      setCurrentUser(user);
      setIsLoading(false);
    } else if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async user => {
        setIsLoading(true);
        if (user) {
          try {
            // Re-check override on auth change
            const activeOverride = localStorage.getItem('hanujai_demo_user_override');
            if (activeOverride) {
              const parsed = JSON.parse(activeOverride);
              if (parsed && parsed.role) {
                setCurrentUser(parsed);
                setIsLoading(false);
                return;
              }
            }
            const provider = getDataProvider();
            const staffDoc = await provider.getCurrentStaffUser(user.uid);
            setCurrentUser(staffDoc);
          } catch (err) {
            console.error('Failed to load user profile from Firestore:', err);
            setError('Could not retrieve staff profile.');
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!email.trim() || !pass.trim()) {
        throw new Error('Please enter both your institutional email and password.');
      }

      // Clear any prior demo override upon explicit new login
      localStorage.removeItem('hanujai_demo_user_override');

      if (isDemoMode()) {
        const found = initialStaff.find(
          s => s.email.toLowerCase() === email.toLowerCase().trim()
        );
        if (found) {
          setCurrentUser(found);
          localStorage.setItem('hanujai_demo_user_id', found.id);
        } else {
          throw new Error('Staff account not found with this email address. Please select an authorized demo persona or verify credentials.');
        }
      } else if (auth) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
        const provider = getDataProvider();
        const staffDoc = await provider.getCurrentStaffUser(cred.user.uid);
        if (!staffDoc) {
          throw new Error('No staff record linked to this authenticated account.');
        }
        setCurrentUser(staffDoc);
      } else {
        throw new Error('Firebase Authentication services are offline or unconfigured. Run in Demo Mode or configure .env.local.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify username and password.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      localStorage.removeItem('hanujai_demo_user_override');
      localStorage.removeItem('hanujai_demo_user_id');
      if (auth) {
        await firebaseSignOut(auth);
      }
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoRole = (role: StaffRole) => {
    let target: StaffUser | undefined;
    if (role === 'principal') {
      target = initialStaff.find(s => s.role === 'principal');
    } else if (role === 'class_teacher') {
      target = initialStaff.find(s => s.id === 'staff-002') || initialStaff.find(s => s.id === 'staff-003');
    } else if (role === 'subject_teacher') {
      const base = initialStaff.find(s => s.id === 'staff-003');
      target = base
        ? { ...base, role: 'subject_teacher' as StaffRole }
        : initialStaff.find(s => s.role === 'subject_teacher');
    }

    if (target) {
      setCurrentUser(target);
      localStorage.setItem('hanujai_demo_user_override', JSON.stringify(target));
      localStorage.setItem('hanujai_demo_user_id', target.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isLoading,
        error,
        login,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
