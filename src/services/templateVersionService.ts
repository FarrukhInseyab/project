import { supabase } from '../lib/supabase';

export interface TemplateVersion {
  version_id: string;
  version_number: number;
  is_current: boolean;
  original_filename: string;
  file_size: number;
  version_notes?: string;
  created_by_email: string;
  created_at: string;
  metadata: Record<string, any>;
}

export class TemplateVersionService {
  // Create a new version of a template
  static async createNewVersion(
    templateId: string,
    file: File,
    documentContent: string,
    documentHtml: string,
    storagePath: string,
    versionNotes?: string
  ): Promise<string> {
    try {
      console.log('🔄 Creating new template version...');
      console.log('📋 Template ID:', templateId);
      console.log('📋 File:', file.name, file.size);
      console.log('📋 Storage path:', storagePath);
      
      // CRITICAL: Extract tags from the new document content
      // This ensures the new version has the correct tags
      const { extractTagsFromContent } = await import('../utils/documentUtils');
      const extractedTags = extractTagsFromContent(documentContent);
      
      console.log('🏷️ Extracted tags from new version:', extractedTags);

      const { data, error } = await supabase.rpc('create_template_version', {
        p_template_id: templateId,
        p_original_filename: file.name,
        p_document_content: documentContent,
        p_document_html: documentHtml,
        p_file_size: file.size,
        p_storage_path: storagePath,
        p_version_notes: versionNotes
      });

      if (error) {
        console.error('❌ Error creating template version:', error);
        throw error;
      }
      
      console.log('✅ Template version created:', data);

      // CRITICAL: Update the template tags with the new extracted tags
      if (extractedTags.length > 0) {
        console.log('🔄 Updating template tags with new version tags...');
        
        // First, delete existing tags for this template
        const { error: deleteError } = await supabase
          .from('template_tags')
          .delete()
          .eq('template_id', templateId);

        if (deleteError) {
          console.error('⚠️ Error deleting old tags:', deleteError);
          // Continue anyway - we'll add new tags
        }

        // Then, add the new tags
        const dbTags = extractedTags.map(tag => ({
          template_id: templateId,
          name: tag.name,
          display_name: tag.displayName,
          description: tag.description,
          expected_value: tag.expectedValue || '',
          data_type: 'text' as const,
          is_required: false,
          validation_rules: {}
        }));

        const { error: insertError } = await supabase
          .from('template_tags')
          .insert(dbTags);

        if (insertError) {
          console.error('⚠️ Error inserting new tags:', insertError);
          // Don't fail the entire operation for tag errors
        } else {
          console.log('✅ Template tags updated with new version tags');
        }
      }

      return data;
    } catch (error) {
      console.error('Failed to create template version:', error);
      throw new Error('Failed to create new template version');
    }
  }

  // Get version history for a template
  static async getVersionHistory(templateId: string): Promise<TemplateVersion[]> {
    try {
      const { data, error } = await supabase.rpc('get_template_version_history', {
        p_template_id: templateId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get version history:', error);
      throw new Error('Failed to load version history');
    }
  }

  // Rollback to a specific version (updates current template, doesn't create new version)
  static async rollbackToVersion(
    templateId: string,
    versionNumber: number,
    rollbackNotes?: string
  ): Promise<string> {
    try {
      console.log('🔄 Rolling back to version:', versionNumber);
      console.log('📋 This will update the current template, not create a new version');
      
      const { data, error } = await supabase.rpc('rollback_template_version', {
        p_template_id: templateId,
        p_version_number: versionNumber,
        p_rollback_notes: rollbackNotes
      });

      if (error) {
        console.error('❌ Error rolling back template version:', error);
        throw error;
      }
      
      console.log('✅ Template rollback completed - current template updated');

      // CRITICAL: After rollback, we need to update the tags too
      // Get the version we rolled back to and extract its tags
      const { data: versionData, error: versionError } = await supabase
        .from('template_versions')
        .select('document_content')
        .eq('template_id', templateId)
        .eq('version_number', versionNumber)
        .single();

      if (!versionError && versionData) {
        const { extractTagsFromContent } = await import('../utils/documentUtils');
        const extractedTags = extractTagsFromContent(versionData.document_content);
        
        console.log('🏷️ Extracted tags from rollback version:', extractedTags);

        if (extractedTags.length > 0) {
          console.log('🔄 Updating template tags with rollback version tags...');
          
          // Delete existing tags
          const { error: deleteError } = await supabase
            .from('template_tags')
            .delete()
            .eq('template_id', templateId);

          if (deleteError) {
            console.error('⚠️ Error deleting old tags during rollback:', deleteError);
          }

          // Add rollback version tags
          const dbTags = extractedTags.map(tag => ({
            template_id: templateId,
            name: tag.name,
            display_name: tag.displayName,
            description: tag.description,
            expected_value: tag.expectedValue || '',
            data_type: 'text' as const,
            is_required: false,
            validation_rules: {}
          }));

          const { error: insertError } = await supabase
            .from('template_tags')
            .insert(dbTags);

          if (insertError) {
            console.error('⚠️ Error inserting rollback tags:', insertError);
          } else {
            console.log('✅ Template tags updated with rollback version tags');
          }
        }
      }

      return data;
    } catch (error) {
      console.error('Failed to rollback template version:', error);
      throw new Error('Failed to rollback to selected version');
    }
  }

  // Get specific version details
  static async getVersionDetails(templateId: string, versionNumber: number) {
    try {
      const { data, error } = await supabase
        .from('template_versions')
        .select('*')
        .eq('template_id', templateId)
        .eq('version_number', versionNumber)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get version details:', error);
      throw new Error('Failed to load version details');
    }
  }

  // Download a specific version as DOCX file
  static async downloadVersion(templateId: string, versionNumber: number): Promise<void> {
    try {
      console.log(`📥 Downloading version ${versionNumber} of template ${templateId}...`);
      
      // Get version details
      const version = await this.getVersionDetails(templateId, versionNumber);
      
      if (!version.storage_path) {
        throw new Error('No file available for this version');
      }

      // Download from storage
      const { StorageService } = await import('../services/storageService');
      const fileBuffer = await StorageService.downloadTemplate(version.storage_path);
      
      // Create blob and download
      const blob = new Blob([fileBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = version.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`✅ Version ${versionNumber} downloaded successfully`);
    } catch (error) {
      console.error('Failed to download version:', error);
      throw new Error('Failed to download version');
    }
  }

  // Download current version of template - FIXED to use storage bucket
  static async downloadCurrentVersion(templateId: string): Promise<void> {
    try {
      console.log(`📥 Downloading current version of template ${templateId}...`);
      
      // Get template details from database
      const { TemplateService } = await import('../services/templateService');
      const template = await TemplateService.getTemplate(templateId);
      
      if (!template.storage_path) {
        throw new Error('No file available for this template. The original DOCX file may not have been uploaded to storage.');
      }

      console.log('📁 Template storage path:', template.storage_path);

      // Download from storage bucket
      const { StorageService } = await import('../services/storageService');
      console.log('📥 Downloading file from storage bucket...');
      const fileBuffer = await StorageService.downloadTemplate(template.storage_path);
      
      console.log('✅ File downloaded from storage, creating download...');
      
      // Create blob and download
      const blob = new Blob([fileBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`✅ Current version downloaded successfully: ${template.original_filename}`);
    } catch (error) {
      console.error('Failed to download current version:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('storage')) {
          throw new Error('Failed to download current version from storage. The file may have been moved or deleted.');
        } else if (error.message.includes('No file available')) {
          throw new Error('No DOCX file available for this template. Please upload a new version to enable downloads.');
        }
      }
      
      throw new Error('Failed to download current version');
    }
  }

  // Compare two versions
  static async compareVersions(templateId: string, version1: number, version2: number) {
    try {
      const [v1, v2] = await Promise.all([
        this.getVersionDetails(templateId, version1),
        this.getVersionDetails(templateId, version2)
      ]);

      return {
        version1: v1,
        version2: v2,
        differences: {
          filename: v1.original_filename !== v2.original_filename,
          fileSize: v1.file_size !== v2.file_size,
          content: v1.document_content !== v2.document_content,
          sizeDifference: v2.file_size - v1.file_size
        }
      };
    } catch (error) {
      console.error('Failed to compare versions:', error);
      throw new Error('Failed to compare versions');
    }
  }

  // Delete a specific version (not current)
  static async deleteVersion(templateId: string, versionNumber: number): Promise<void> {
    try {
      // Verify it's not the current version
      const { data: version, error: versionError } = await supabase
        .from('template_versions')
        .select('is_current')
        .eq('template_id', templateId)
        .eq('version_number', versionNumber)
        .single();

      if (versionError) throw versionError;
      
      if (version.is_current) {
        throw new Error('Cannot delete the current version');
      }

      const { error } = await supabase
        .from('template_versions')
        .delete()
        .eq('template_id', templateId)
        .eq('version_number', versionNumber);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete version:', error);
      throw new Error('Failed to delete version');
    }
  }
}