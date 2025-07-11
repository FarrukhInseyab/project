import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { AuthService } from '../services/authService';
import { ActivityService } from '../services/activityService';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    AuthService.getCurrentUser().then(user => {
      setUser(user);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = AuthService.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: { full_name?: string; company?: string }) => {
    setLoading(true);
    try {
      const result = await AuthService.signUp(email, password, metadata);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await AuthService.signIn(email, password);      
      return result;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    try {
      const result = await AuthService.resetPassword(email);
      // Log password reset request activity
      await ActivityService.logActivity('password_reset_requested', 'user', email);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    setLoading(true);
    try {
      const result = await AuthService.updatePassword(password);
      // Log password update activity
      await ActivityService.logActivity('password_updated', 'user');
      return result;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    try {
      const result = await AuthService.resetPassword(email);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    setLoading(true);
    try {
      const result = await AuthService.updatePassword(password);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await AuthService.signOut();
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    resetPassword,
    updatePassword,
    resetPassword,
    updatePassword,
    signOut,
    isAuthenticated: !!user
  };
};