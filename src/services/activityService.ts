import { supabase } from '../lib/supabase';
import type { UserActivity } from '../lib/supabase';

export class ActivityService {
  static async logActivity(
    activityType: UserActivity['activity_type'],
    resourceType?: UserActivity['resource_type'],
    resourceId?: string,
    details?: Record<string, any>
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Don't throw error for activity logging

    try {
      const { error } = await supabase
        .from('user_activity')
        .insert({
          user_id: user.id,
          activity_type: activityType,
          resource_type: resourceType,
          resource_id: resourceId,
          details: details || {},
        });

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  static async getRecentActivity(limit: number = 10) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  static async getActivityStats(days: number = 30) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('user_activity')
      .select('activity_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by activity type
    const stats = data.reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActivities: data.length,
      byType: stats,
      recentActivities: data.slice(0, 10)
    };
  }
}