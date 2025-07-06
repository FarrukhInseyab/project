import { supabase } from '../lib/supabase';
import { ActivityService } from './activityService';

export class AuthService {
  static async signUp(email: string, password: string, metadata?: {
    full_name?: string;
    company?: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) throw error;

    // Create profile if user was created
    if (data.user) {
      await this.createProfile(data.user.id, {
        email,
        full_name: metadata?.full_name,
        company: metadata?.company,
      });
    }

    return data;
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Log login activity
    if (data.user) {
      await ActivityService.logActivity('login');
    }

    return data;
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  static async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  static async getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateProfile(updates: {
    full_name?: string;
    company?: string;
    role?: string;
    preferences?: Record<string, any>;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  private static async createProfile(userId: string, profileData: {
    email: string;
    full_name?: string;
    company?: string;
  }) {
    const { error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        ...profileData
      });

    if (error) {
      console.error('Failed to create profile:', error);
    }
  }

  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}