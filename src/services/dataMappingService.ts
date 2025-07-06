import { supabase } from '../lib/supabase';

interface TagColumnMapping {
  tagId: string;
  tagName: string;
  columnName: string;
  confidence: number;
  isManual: boolean;
}

export class DataMappingService {
  // Save template mappings to database with version support
  static async saveTemplateMappings(templateId: string, templateVersion: number, mappings: TagColumnMapping[]) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('🔄 Saving template mappings to database:', mappings.length, 'for version', templateVersion);

      // Delete existing mappings for this template version
      const { error: deleteError } = await supabase
        .from('data_mappings')
        .delete()
        .eq('template_id', templateId)
        .eq('template_version', templateVersion);

      if (deleteError) {
        console.error('Error deleting existing mappings:', deleteError);
        // Continue anyway - we'll insert new ones
      }

      // Filter out mappings with empty column names
      const validMappings = mappings.filter(mapping => mapping.columnName.trim() !== '');
      
      if (validMappings.length === 0) {
        console.warn('⚠️ No valid mappings to save');
        return;
      }

      // Insert new mappings with version
      const dbMappings = validMappings.map(mapping => ({
        user_id: user.id,
        template_id: templateId,
        template_version: templateVersion,
        tag_name: mapping.tagName,
        data_key: mapping.columnName,
        mapping_confidence: mapping.confidence,
        is_manual: mapping.isManual,
        is_verified: true,
        usage_count: 0
      }));

      const { error: insertError } = await supabase
        .from('data_mappings')
        .insert(dbMappings);

      if (insertError) throw insertError;

      console.log('✅ Template mappings saved successfully for version:', templateVersion, dbMappings.length);
    } catch (error) {
      console.error('Failed to save template mappings:', error);
      throw new Error('Failed to save mappings to database');
    }
  }

  // Get existing mappings for a template version
  static async getTemplateMappings(templateId: string, templateVersion?: number) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('🔍 Getting template mappings for template:', templateId, 'version:', templateVersion);

      let query = supabase
        .from('data_mappings')
        .select('*')
        .eq('template_id', templateId)
        .eq('user_id', user.id);

      // If version is specified, filter by version
      if (templateVersion !== undefined) {
        query = query.eq('template_version', templateVersion);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('✅ Retrieved template mappings:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Failed to get template mappings:', error);
      throw new Error('Failed to load existing mappings');
    }
  }

  // Check if a template version has mappings
  static async templateVersionHasMappings(templateId: string, templateVersion: number): Promise<boolean> {
    try {
      console.log(`🔍 Checking if template ${templateId} version ${templateVersion} has mappings...`);
      
      // First try using the RPC function
      const { data, error } = await supabase.rpc('template_version_has_mappings', {
        p_template_id: templateId,
        p_version: templateVersion
      });

      if (error) {
        console.error('Error using RPC function:', error);
        
        // Fallback to direct query if RPC fails
        console.log('🔍 Falling back to direct query...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        
        const { data: mappings, error: queryError } = await supabase
          .from('data_mappings')
          .select('id')
          .eq('template_id', templateId)
          .eq('template_version', templateVersion)
          .eq('user_id', user.id)
          .limit(1);
          
        if (queryError) {
          console.error('Error in fallback query:', queryError);
          return false;
        }
        
        const hasMappings = mappings && mappings.length > 0;
        console.log(`✅ Direct query result: ${hasMappings ? 'Has mappings' : 'No mappings'}`);
        return hasMappings;
      }
      
      console.log(`✅ RPC result: ${data ? 'Has mappings' : 'No mappings'}`);
      return data || false;
    } catch (error) {
      console.error('Failed to check template version mappings:', error);
      return false;
    }
  }

  // Debug function to get mapping details for a template
  static async debugTemplateMappings(templateId: string): Promise<any> {
    try {
      console.log(`🔍 Debugging mappings for template ${templateId}...`);
      
      const { data, error } = await supabase.rpc('debug_template_mappings', {
        p_template_id: templateId
      });
      
      if (error) {
        console.error('Error debugging template mappings:', error);
        
        // Fallback to direct query
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data: mappings, error: queryError } = await supabase
          .from('data_mappings')
          .select('*')
          .eq('template_id', templateId)
          .eq('user_id', user.id);
          
        if (queryError) throw queryError;
        
        console.log(`✅ Found ${mappings?.length || 0} mappings via direct query`);
        return mappings;
      }
      
      console.log(`✅ Debug results:`, data);
      return data;
    } catch (error) {
      console.error('Failed to debug template mappings:', error);
      throw error;
    }
  }

  // Get mappings for a specific template version using RPC
  static async getTemplateVersionMappings(templateId: string, templateVersion: number) {
    try {
      console.log(`🔍 Getting mappings for template ${templateId} version ${templateVersion}...`);
      
      const { data, error } = await supabase.rpc('get_template_version_mappings', {
        p_template_id: templateId,
        p_version: templateVersion
      });

      if (error) {
        console.error('Error using RPC function:', error);
        
        // Fallback to direct query if RPC fails
        console.log('🔍 Falling back to direct query...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data: mappings, error: queryError } = await supabase
          .from('data_mappings')
          .select('*')
          .eq('template_id', templateId)
          .eq('template_version', templateVersion)
          .eq('user_id', user.id);
          
        if (queryError) throw queryError;
        
        console.log(`✅ Found ${mappings?.length || 0} mappings via direct query`);
        return mappings;
      }

      console.log(`✅ Found ${data?.length || 0} mappings via RPC`);
      return data || [];
    } catch (error) {
      console.error('Failed to get template version mappings:', error);
      throw new Error('Failed to load version mappings');
    }
  }

  // Update mapping usage statistics
  static async updateMappingUsage(templateId: string, templateVersion: number, tagName: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Fixed: Don't use supabase.sql, use a direct update instead
      const { error } = await supabase
        .from('data_mappings')
        .update({
          usage_count: (await supabase
            .from('data_mappings')
            .select('usage_count')
            .eq('template_id', templateId)
            .eq('template_version', templateVersion)
            .eq('tag_name', tagName)
            .eq('user_id', user.id)
            .single()).data?.usage_count + 1 || 1,
          last_used_at: new Date().toISOString()
        })
        .eq('template_id', templateId)
        .eq('template_version', templateVersion)
        .eq('tag_name', tagName)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating mapping usage:', error);
        // Don't throw - this is not critical
      }
    } catch (error) {
      console.error('Failed to update mapping usage:', error);
      // Don't throw - this is not critical
    }
  }

  // Get mapping suggestions based on usage history
  static async getMappingSuggestions(tagName: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('data_mappings')
        .select('data_key, mapping_confidence, usage_count')
        .eq('tag_name', tagName)
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false })
        .limit(5);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to get mapping suggestions:', error);
      return [];
    }
  }

  // Load data from ProofofDebitAPI based on mappings for a specific version
  static async loadMappedData(templateId: string, templateVersion?: number, selectedCustomerNos?: string[]) {
    try {
      console.log('🔍 Loading mapped data for template:', templateId, 'version:', templateVersion);
      console.log('🔍 Selected customer numbers:', selectedCustomerNos);

      // Get template mappings for the specific version
      const mappings = templateVersion !== undefined 
        ? await this.getTemplateVersionMappings(templateId, templateVersion)
        : await this.getTemplateMappings(templateId);
      
      if (mappings.length === 0) {
        throw new Error('No mappings found for this template version. Please configure tag-column mappings first.');
      }

      console.log('📋 Found mappings:', mappings);

      // Build the query for ProofofDebitAPI records
      let query = supabase
        .from('ProofofDebitAPI')
        .select('*');
      
      // If specific customer numbers are provided, use them
      if (selectedCustomerNos && selectedCustomerNos.length > 0) {
        // Convert string customer numbers to integers for the query
        const customerNosInt = selectedCustomerNos
          .map(num => typeof num === 'string' ? parseInt(num, 10) : Number(num))
          .filter(num => !isNaN(num));
        
        console.log('🔍 Filtering by customer numbers:', customerNosInt);
        query = query.in('customerno', customerNosInt);
      } else {
        // Otherwise, get records with Status = 'New'
        console.log('🔍 Filtering by Status = "New"');
        query = query.eq('Status', 'New');
      }

      // Execute the query
      const { data: records, error } = await query;

      if (error) throw error;

      if (!records || records.length === 0) {
        const errorMsg = selectedCustomerNos && selectedCustomerNos.length > 0
          ? `No records found for the selected customer numbers: ${selectedCustomerNos.join(', ')}`
          : 'No records found with Status = "New" in ProofofDebitAPI';
        throw new Error(errorMsg);
      }

      console.log(`📊 Found ${records.length} records`);

      // Transform data according to mappings
      const mappedData: any = {};
      const customerNumbers: string[] = [];

      // Initialize arrays for each tag
      mappings.forEach(mapping => {
        mappedData[mapping.tag_name] = [];
      });

      // Process each record
      records.forEach(record => {
        // Track customer numbers for status updates
        if (record.customerno) {
          customerNumbers.push(String(record.customerno));
        }

        // Map each column to its corresponding tag
        mappings.forEach(mapping => {
          const value = record[mapping.data_key];
          mappedData[mapping.tag_name].push(value !== null && value !== undefined ? String(value) : '');
          
          // Update mapping usage statistics
          if (templateVersion !== undefined) {
            this.updateMappingUsage(templateId, templateVersion, mapping.tag_name);
          }
        });
      });

      console.log('✅ Data mapped successfully:', {
        recordCount: records.length,
        customerNumbers: customerNumbers.length,
        mappedTags: Object.keys(mappedData).length
      });

      return {
        data: mappedData,
        customerNumbers,
        recordCount: records.length
      };
    } catch (error) {
      console.error('Failed to load mapped data:', error);
      throw error;
    }
  }

  // Validate mappings against current database schema
  static async validateMappings(mappings: TagColumnMapping[]) {
    try {
      // Get sample data to validate column existence
      const { data: sampleData, error } = await supabase
        .from('ProofofDebitAPI')
        .select('*')
        .limit(1);

      if (error) throw error;

      if (!sampleData || sampleData.length === 0) {
        throw new Error('No data available to validate mappings');
      }

      const availableColumns = Object.keys(sampleData[0]);
      const validationResults = mappings.map(mapping => {
        const isValid = availableColumns.includes(mapping.columnName);
        return {
          tagName: mapping.tagName,
          columnName: mapping.columnName,
          isValid,
          error: isValid ? null : `Column "${mapping.columnName}" not found in database`
        };
      });

      const invalidMappings = validationResults.filter(result => !result.isValid);
      
      if (invalidMappings.length > 0) {
        console.warn('⚠️ Invalid mappings found:', invalidMappings);
        return {
          isValid: false,
          errors: invalidMappings.map(m => m.error).filter(Boolean)
        };
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      console.error('Failed to validate mappings:', error);
      return {
        isValid: false,
        errors: ['Failed to validate mappings against database schema']
      };
    }
  }

  // Get all available columns from ProofofDebitAPI
  static async getAvailableColumns() {
    try {
      const { data: sampleData, error } = await supabase
        .from('ProofofDebitAPI')
        .select('*')
        .limit(1);

      if (error) throw error;

      if (!sampleData || sampleData.length === 0) {
        throw new Error('No data available in ProofofDebitAPI');
      }

      const columns = Object.keys(sampleData[0])
        .filter(column => column !== 'Status') // Exclude system columns
        .map(column => ({
          name: column,
          type: typeof sampleData[0][column]
        }));

      return columns;
    } catch (error) {
      console.error('Failed to get available columns:', error);
      throw new Error('Failed to retrieve database columns');
    }
  }

  // Learn from user mappings to improve future recommendations
  static async learnFromMappings(mappings: TagColumnMapping[]) {
    try {
      // This is a placeholder for future machine learning capabilities
      // For now, we'll just log the mappings for analysis
      console.log('🧠 Learning from user mappings:', mappings);
      
      // In a real implementation, this would update a machine learning model
      // or store patterns for future recommendations
      
      return true;
    } catch (error) {
      console.error('Failed to learn from mappings:', error);
      return false;
    }
  }
}