import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey,
    env: import.meta.env.MODE,
    actualUrl: supabaseUrl,
    actualKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined'
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file or Netlify environment variables.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  throw new Error('Invalid Supabase URL format. Please check your VITE_SUPABASE_URL environment variable.');
}

console.log('Initializing Supabase client:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  environment: import.meta.env.MODE,
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'undefined'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
});

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Supabase connection test successful');
    return { success: true, data };
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Database types
export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  company?: string;
  role?: string;
  preferences: Record<string, any>;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface TemplateCategory {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplate {
  id: string;
  user_id: string;
  category_id?: string;
  name: string;
  description?: string;
  original_filename: string;
  document_content: string;
  document_html: string;
  file_size: number;
  file_type: string;
  version: number;
  is_default: boolean;
  is_public: boolean;
  is_archived: boolean;
  preview_image_url?: string;
  usage_count: number;
  last_used_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  storage_path?: string;
  category?: TemplateCategory;
  tags?: TemplateTag[];
}

export interface TemplateTag {
  id: string;
  template_id: string;
  name: string;
  display_name: string;
  description?: string;
  expected_value?: string;
  data_type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'url' | 'boolean';
  is_required: boolean;
  default_value?: string;
  validation_rules: Record<string, any>;
  position_start?: number;
  position_end?: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentGeneration {
  id: string;
  user_id: string;
  template_id: string;
  generation_type: 'single' | 'batch';
  documents_count: number;
  input_data: Record<string, any>;
  output_filenames: string[];
  file_urls: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  processing_time_ms?: number;
  file_size_total: number;
  metadata: Record<string, any>;
  created_at: string;
  completed_at?: string;
  storage_path?: string;
  template?: DocumentTemplate;
}

export interface DataMapping {
  id: string;
  user_id: string;
  template_id: string;
  tag_name: string;
  data_key: string;
  mapping_confidence: number;
  is_manual: boolean;
  is_verified: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: 'template_created' | 'template_updated' | 'template_deleted' | 'template_used' | 
                 'document_generated' | 'data_imported' | 'tag_created' | 'tag_updated' |
                 'category_created' | 'login' | 'export_data';
  resource_type?: 'template' | 'document' | 'tag' | 'category' | 'user';
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface TemplateSharing {
  id: string;
  template_id: string;
  owner_id: string;
  shared_with_id?: string;
  shared_with_email?: string;
  permission_level: 'view' | 'edit' | 'admin';
  is_active: boolean;
  expires_at?: string;
  access_count: number;
  last_accessed_at?: string;
  created_at: string;
  updated_at: string;
}