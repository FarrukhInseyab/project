import { supabase, testSupabaseConnection } from '../lib/supabase';
import type { DocumentTemplate, TemplateTag, TemplateCategory } from '../lib/supabase';

export class TemplateService {
  // Helper method to handle database errors
  private static handleDatabaseError(error: any, operation: string) {
    console.error(`TemplateService ${operation} error:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });

    // Check for common connection issues
    if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
      throw new Error('Unable to connect to the database. Please check your internet connection and try again.');
    }

    if (error.message?.includes('JWT')) {
      throw new Error('Authentication error. Please log in again.');
    }

    if (error.message?.includes('permission')) {
      throw new Error('You do not have permission to perform this action.');
    }

    throw error;
  }

  // Test connection before operations
  private static async ensureConnection() {
    const connectionTest = await testSupabaseConnection();
    if (!connectionTest.success) {
      throw new Error(`Database connection failed: ${connectionTest.error}`);
    }
  }

  // Template CRUD operations
  static async createTemplate(template: Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at' | 'user_id'>) {
    try {
      await this.ensureConnection();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('document_templates')
        .insert({
          ...template,
          user_id: user.id,
        })
        .select('*')
        .single();

      if (error) this.handleDatabaseError(error, 'createTemplate');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'createTemplate');
    }
  }

  static async getTemplates(options?: {
    category_id?: string;
    is_public?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      console.log('🔍 TemplateService.getTemplates called with options:', options);
      
      // Test connection first
      await this.ensureConnection();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('✅ User authenticated:', user.id);

      let query = supabase
        .from('document_templates')
        .select(`
          *,
          category:template_categories(*),
          tags:template_tags(*)
        `)
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });

      if (options?.category_id) {
        query = query.eq('category_id', options.category_id);
      }

      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      console.log('🚀 Executing query...');
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Query failed:', error);
        this.handleDatabaseError(error, 'getTemplates');
      }

      console.log('✅ Query successful, returned', data?.length || 0, 'templates');
      return data;
    } catch (error) {
      console.error('❌ TemplateService.getTemplates error:', error);
      this.handleDatabaseError(error, 'getTemplates');
    }
  }

  static async getTemplate(id: string) {
    try {
      await this.ensureConnection();

      const { data, error } = await supabase
        .from('document_templates')
        .select(`
          *,
          category:template_categories(*),
          tags:template_tags(*)
        `)
        .eq('id', id)
        .single();

      if (error) this.handleDatabaseError(error, 'getTemplate');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'getTemplate');
    }
  }

  static async updateTemplate(id: string, updates: Partial<DocumentTemplate>) {
    try {
      await this.ensureConnection();

      const { data, error } = await supabase
        .from('document_templates')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) this.handleDatabaseError(error, 'updateTemplate');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'updateTemplate');
    }
  }

  static async deleteTemplate(id: string) {
    try {
      await this.ensureConnection();

      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id);

      if (error) this.handleDatabaseError(error, 'deleteTemplate');
    } catch (error) {
      this.handleDatabaseError(error, 'deleteTemplate');
    }
  }

  static async incrementUsageCount(id: string) {
    try {
      await this.ensureConnection();

      const { error } = await supabase.rpc('increment_template_usage', {
        template_id: id
      });

      if (error) this.handleDatabaseError(error, 'incrementUsageCount');
    } catch (error) {
      this.handleDatabaseError(error, 'incrementUsageCount');
    }
  }

  // Template Tags operations
  static async createTemplateTags(templateId: string, tags: Omit<TemplateTag, 'id' | 'template_id' | 'created_at' | 'updated_at'>[]) {
    try {
      await this.ensureConnection();

      const { data, error } = await supabase
        .from('template_tags')
        .insert(
          tags.map(tag => ({
            ...tag,
            template_id: templateId,
          }))
        )
        .select('*');

      if (error) this.handleDatabaseError(error, 'createTemplateTags');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'createTemplateTags');
    }
  }

  static async updateTemplateTag(id: string, updates: Partial<TemplateTag>) {
    try {
      await this.ensureConnection();

      const { data, error } = await supabase
        .from('template_tags')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) this.handleDatabaseError(error, 'updateTemplateTag');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'updateTemplateTag');
    }
  }

  static async deleteTemplateTag(id: string) {
    try {
      await this.ensureConnection();

      const { error } = await supabase
        .from('template_tags')
        .delete()
        .eq('id', id);

      if (error) this.handleDatabaseError(error, 'deleteTemplateTag');
    } catch (error) {
      this.handleDatabaseError(error, 'deleteTemplateTag');
    }
  }

  // Categories operations
  static async getCategories() {
    try {
      await this.ensureConnection();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('template_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) this.handleDatabaseError(error, 'getCategories');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'getCategories');
    }
  }

  static async createCategory(category: Omit<TemplateCategory, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    try {
      await this.ensureConnection();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('template_categories')
        .insert({
          ...category,
          user_id: user.id,
        })
        .select('*')
        .single();

      if (error) this.handleDatabaseError(error, 'createCategory');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'createCategory');
    }
  }

  // Analytics and statistics
  static async getTemplateStats() {
    try {
      await this.ensureConnection();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: templates, error: templatesError } = await supabase
        .from('document_templates')
        .select('id, usage_count, created_at, category_id')
        .eq('user_id', user.id)
        .eq('is_archived', false);

      if (templatesError) this.handleDatabaseError(templatesError, 'getTemplateStats - templates');

      const { data: tags, error: tagsError } = await supabase
        .from('template_tags')
        .select('id, template_id')
        .in('template_id', templates.map(t => t.id));

      if (tagsError) this.handleDatabaseError(tagsError, 'getTemplateStats - tags');

      const { data: generations, error: generationsError } = await supabase
        .from('document_generations')
        .select('id, created_at, documents_count')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (generationsError) this.handleDatabaseError(generationsError, 'getTemplateStats - generations');

      return {
        totalTemplates: templates.length,
        totalTags: tags.length,
        totalGenerations: generations.reduce((sum, g) => sum + g.documents_count, 0),
        recentTemplates: templates.filter(t => 
          new Date(t.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        templates,
        tags,
        generations
      };
    } catch (error) {
      this.handleDatabaseError(error, 'getTemplateStats');
    }
  }

  // Search functionality
  static async searchTemplates(query: string, options?: {
    category_id?: string;
    limit?: number;
  }) {
    try {
      await this.ensureConnection();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let searchQuery = supabase
        .from('document_templates')
        .select(`
          *,
          category:template_categories(*),
          tags:template_tags(*)
        `)
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .textSearch('search_vector', query)
        .order('usage_count', { ascending: false });

      if (options?.category_id) {
        searchQuery = searchQuery.eq('category_id', options.category_id);
      }

      if (options?.limit) {
        searchQuery = searchQuery.limit(options.limit);
      }

      const { data, error } = await searchQuery;
      if (error) this.handleDatabaseError(error, 'searchTemplates');
      return data;
    } catch (error) {
      this.handleDatabaseError(error, 'searchTemplates');
    }
  }
}