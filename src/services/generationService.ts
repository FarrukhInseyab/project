import { supabase } from '../lib/supabase';
import type { DocumentGeneration } from '../lib/supabase';
import { ActivityService } from './activityService';

export class GenerationService {
  // Create a new document generation record
  static async createGeneration(generation: Omit<DocumentGeneration, 'id' | 'user_id' | 'created_at' | 'completed_at'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('document_generations')
      .insert({
        ...generation,
        user_id: user.id,
        completed_at: generation.status === 'completed' ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Log activity
    await ActivityService.logActivity('document_generated', 'document', data.id, {
      template_id: generation.template_id,
      documents_count: generation.documents_count,
      generation_type: generation.generation_type
    });

    return data;
  }

  // Get user's document generations
  static async getGenerations(options?: {
    template_id?: string;
    status?: DocumentGeneration['status'];
    limit?: number;
    offset?: number;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('document_generations')
      .select(`
        *,
        template:document_templates(
          id,
          name,
          description,
          original_filename
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (options?.template_id) {
      query = query.eq('template_id', options.template_id);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Get a specific generation
  static async getGeneration(id: string) {
    const { data, error } = await supabase
      .from('document_generations')
      .select(`
        *,
        template:document_templates(
          id,
          name,
          description,
          original_filename,
          category:template_categories(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // Update generation status
  static async updateGenerationStatus(id: string, status: DocumentGeneration['status'], errorMessage?: string) {
    const updates: any = { 
      status,
      ...(status === 'completed' && { completed_at: new Date().toISOString() }),
      ...(errorMessage && { error_message: errorMessage })
    };

    const { data, error } = await supabase
      .from('document_generations')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // Update generation with additional data
  static async updateGeneration(id: string, updates: Partial<DocumentGeneration>) {
    const { data, error } = await supabase
      .from('document_generations')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // Delete a generation record
  static async deleteGeneration(id: string) {
    const { error } = await supabase
      .from('document_generations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Get generation statistics
  static async getGenerationStats(days: number = 30) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('document_generations')
      .select('id, documents_count, generation_type, status, created_at, file_size_total')
      .eq('user_id', user.id)
      .gte('created_at', startDate);

    if (error) throw error;

    const stats = {
      totalGenerations: data.length,
      totalDocuments: data.reduce((sum, g) => sum + g.documents_count, 0),
      totalFileSize: data.reduce((sum, g) => sum + (g.file_size_total || 0), 0),
      byStatus: data.reduce((acc, g) => {
        acc[g.status] = (acc[g.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: data.reduce((acc, g) => {
        acc[g.generation_type] = (acc[g.generation_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentGenerations: data.slice(0, 10)
    };

    return stats;
  }

  // Get generations for a specific template
  static async getTemplateGenerations(templateId: string, limit: number = 10) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('document_generations')
      .select('*')
      .eq('user_id', user.id)
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Batch operations
  static async createBatchGeneration(
    templateId: string,
    inputDataArray: Record<string, any>[],
    metadata?: Record<string, any>
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const generation = {
      template_id: templateId,
      generation_type: 'batch' as const,
      documents_count: inputDataArray.length,
      input_data: { batch_data: inputDataArray },
      status: 'pending' as const,
      metadata: metadata || {}
    };

    return this.createGeneration(generation);
  }
}