/**
 * HanuJai High School ERP — Authentication Context
 * Supports both Firebase Authentication and Secure In-Browser Demo Authentication.
 * 
 * Strict Phase 1 Role Architecture:
 * Only TWO active accounts: Principal (read-only) and Admin Office (full entry).
 * All teacher accounts are deactivated from active login.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { StaffUser } from '../domain/types';
import { isDemoMode } from '../config/firebase';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getDataProvider } from '../data';
import { initialStaff, defaultDeveloperUser } from '../data/demo/seedData';

interface AuthContextType {
  currentUser: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode()) {
      const override = localStorage.getItem('hanujai_demo_user_override');
      if (override) {
        try {
          const parsed = JSON.parse(override);
          setCurrentUser(parsed);
          setIsLoading(false);
          return;
        } catch {
          // ignore
        }
      }
      const savedUserId = localStorage.getItem('hanujai_demo_user_id') || 'staff-admin';
      const user = savedUserId === 'staff-dev'
        ? defaultDeveloperUser
        : (initialStaff.find(s => s.id === savedUserId) || initialStaff.find(s => s.role === 'admin' && s.status === 'active') || initialStaff[0]);
      setCurrentUser(user);
      setIsLoading(false);
    } else if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async user => {
        setIsLoading(true);
        if (user) {
          try {
            const provider = getDataProvider();
            const staffDoc = await provider.getCurrentStaffUser(user.uid);
            if (staffDoc) {
              if (staffDoc.status === 'deactivated' || staffDoc.role === 'class_teacher' || staffDoc.role === 'subject_teacher') {
                setError('Teacher accounts are deactivated in this operating phase. Only Principal and Admin Office accounts have active access.');
                setCurrentUser(null);
                if (auth) {
                  await firebaseSignOut(auth);
                }
              } else {
                setCurrentUser(staffDoc);
              }
            } else {
              setCurrentUser(null);
            }
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
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !pass.trim()) {
        throw new Error('Please enter both your institutional email and password.');
      }

      // Check for known teacher email patterns
      if (
        cleanEmail.includes('teacher.') ||
        cleanEmail.includes('rajeshwar.choudhary') ||
        cleanEmail.includes('alok.saxena') ||
        cleanEmail.includes('priyanka.sen') ||
        cleanEmail.includes('tutor.')
      ) {
        throw new Error('Classroom teacher accounts are deactivated in this operating phase. Classroom attendance is entered centrally by the Admin Office.');
      }

      if (isDemoMode()) {
        if (cleanEmail === 'developer@hanujai.edu.in') {
          setCurrentUser(defaultDeveloperUser);
          localStorage.setItem('hanujai_demo_user_id', defaultDeveloperUser.id);
          return;
        }
        const found = initialStaff.find(
          s => s.email.toLowerCase() === cleanEmail
        );
        if (found) {
          if (found.status === 'deactivated' || found.role === 'class_teacher' || found.role === 'subject_teacher') {
            throw new Error('Classroom teacher accounts are deactivated in this operating phase. Only Principal and Admin Office accounts are authorized.');
          }
          setCurrentUser(found);
          localStorage.setItem('hanujai_demo_user_id', found.id);
        } else {
          throw new Error('Staff account not found with this email address. Please verify credentials.');
        }
      } else if (auth) {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        const provider = getDataProvider();
        const staffDoc = await provider.getCurrentStaffUser(cred.user.uid);
        if (!staffDoc) {
          throw new Error('No staff record linked to this authenticated account.');
        }
        if (staffDoc.status === 'deactivated' || staffDoc.role === 'class_teacher' || staffDoc.role === 'subject_teacher') {
          await firebaseSignOut(auth);
          throw new Error('Classroom teacher accounts are deactivated in this operating phase. Only Principal and Admin Office accounts are authorized.');
        }
        setCurrentUser(staffDoc);
      } else {
        throw new Error('Firebase Authentication services are offline or unconfigured.');
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
      localStorage.removeItem('hanujai_demo_user_id');
      if (auth) {
        await firebaseSignOut(auth);
      }
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
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
