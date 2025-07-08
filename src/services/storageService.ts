import { supabase } from '../lib/supabase';

export class StorageService {
  private static readonly TEMPLATES_BUCKET = 'document-templates';
  private static readonly GENERATED_BUCKET = 'generated-documents';
  private static readonly EMPTY_TEMPLATE_BUCKET = 'empty-template';

  // Upload original DOCX template to storage
  static async uploadTemplate(file: File | ArrayBuffer, templateId: string): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create a unique file path: user_id/template_id/original.docx
      const fileName = `${user.id}/${templateId}/original.docx`;
      
      // Convert ArrayBuffer to File if needed
      let fileToUpload: File;
      if (file instanceof ArrayBuffer) {
        fileToUpload = new File([file], 'original.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
      } else {
        fileToUpload = file;
      }

      // Upload file to templates bucket
      const { data, error } = await supabase.storage
        .from(this.TEMPLATES_BUCKET)
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true // Replace if exists
        });

      if (error) {
        console.error('Template upload error:', error);
        throw error;
      }

      console.log('✅ Template uploaded to storage:', data.path);
      return data.path;
    } catch (error) {
      console.error('Failed to upload template to storage:', error);
      throw new Error('Failed to upload template to storage');
    }
  }

  // Download original DOCX template from storage
  static async downloadTemplate(filePath: string): Promise<ArrayBuffer> {
    try {
      const { data, error } = await supabase.storage
        .from(this.TEMPLATES_BUCKET)
        .download(filePath);

      if (error) {
        console.error('Template download error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No template file data received from storage');
      }

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await data.arrayBuffer();
      console.log('✅ Template downloaded from storage:', filePath);
      return arrayBuffer;
    } catch (error) {
      console.error('Failed to download template from storage:', error);
      throw new Error('Failed to download template from storage');
    }
  }

  // Get empty template from storage
  static async getEmptyTemplate(): Promise<ArrayBuffer> {
    try {
      console.log('Attempting to download empty template from storage...');
      const { data, error } = await supabase.storage
        .from(this.EMPTY_TEMPLATE_BUCKET)
        .download('emptytemplate.docx');

      if (error) {
        console.error('Empty template download error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No empty template file data received from storage');
      }

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await data.arrayBuffer();
      console.log('✅ Empty template downloaded from storage');
      return arrayBuffer;
    } catch (error) {
      console.error('Failed to download empty template from storage:', error);
      throw new Error('Failed to download empty template from storage');
    }
  }

  // Upload generated DOCX document to storage
  static async uploadGeneratedDocument(
    file: Blob | ArrayBuffer, 
    generationId: string, 
    fileName: string
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create a unique file path: user_id/generation_id/filename.docx
      const filePath = `${user.id}/${generationId}/${fileName}`;
      
      // Convert to File if needed
      let fileToUpload: File;
      if (file instanceof ArrayBuffer) {
        fileToUpload = new File([file], fileName, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
      } else if (file instanceof Blob) {
        fileToUpload = new File([file], fileName, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
      } else {
        fileToUpload = file;
      }

      // Upload file to generated documents bucket
      const { data, error } = await supabase.storage
        .from(this.GENERATED_BUCKET)
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Generated document upload error:', error);
        throw error;
      }

      console.log('✅ Generated document uploaded to storage:', data.path);
      return data.path;
    } catch (error) {
      console.error('Failed to upload generated document to storage:', error);
      throw new Error('Failed to upload generated document to storage');
    }
  }

  // Download generated DOCX document from storage
  static async downloadGeneratedDocument(filePath: string): Promise<ArrayBuffer> {
    try {
      const { data, error } = await supabase.storage
        .from(this.GENERATED_BUCKET)
        .download(filePath);

      if (error) {
        console.error('Generated document download error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No generated document data received from storage');
      }

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await data.arrayBuffer();
      console.log('✅ Generated document downloaded from storage:', filePath);
      return arrayBuffer;
    } catch (error) {
      console.error('Failed to download generated document from storage:', error);
      throw new Error('Failed to download generated document from storage');
    }
  }

  // Get signed URL for file access
  static async getSignedUrl(filePath: string, bucketName: string, p0: { expiresIn: number; }): Promise<string> {
    try {
      //const expiresInSeconds = 60; // 1 minute expiration
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, p0.expiresIn);

      if (error) {
        console.error('Signed URL creation error:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL received from storage');
      }

      console.log('✅ Signed URL created for:', filePath);
      return data.signedUrl;
    } catch (error) {
      console.error('Failed to create signed URL:', error);
      throw new Error('Failed to create signed URL');
    }
  }

  // Delete template file from storage
  static async deleteTemplate(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.TEMPLATES_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('Template delete error:', error);
        throw error;
      }

      console.log('✅ Template deleted from storage:', filePath);
    } catch (error) {
      console.error('Failed to delete template from storage:', error);
      throw new Error('Failed to delete template from storage');
    }
  }

  // Delete generated document from storage
  static async deleteGeneratedDocument(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.GENERATED_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('Generated document delete error:', error);
        throw error;
      }

      console.log('✅ Generated document deleted from storage:', filePath);
    } catch (error) {
      console.error('Failed to delete generated document from storage:', error);
      throw new Error('Failed to delete generated document from storage');
    }
  }

  // Check if template file exists in storage
  static async templateExists(filePath: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage
        .from(this.TEMPLATES_BUCKET)
        .list(filePath.split('/').slice(0, -1).join('/'));

      if (error) return false;

      const fileName = filePath.split('/').pop();
      return data?.some(file => file.name === fileName) || false;
    } catch (error) {
      console.error('Error checking template existence:', error);
      return false;
    }
  }

  // Check if generated document exists in storage
  static async generatedDocumentExists(filePath: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage
        .from(this.GENERATED_BUCKET)
        .list(filePath.split('/').slice(0, -1).join('/'));

      if (error) return false;

      const fileName = filePath.split('/').pop();
      return data?.some(file => file.name === fileName) || false;
    } catch (error) {
      console.error('Error checking generated document existence:', error);
      return false;
    }
  }

  // Test storage access (for debugging)
  static async testStorageAccess(): Promise<{
    canAccessTemplates: boolean;
    canAccessGenerated: boolean;
    canAccessEmptyTemplate: boolean;
    userInfo: any;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 Testing storage access for user:', user?.id);

      // Test template bucket access
      let canAccessTemplates = false;
      try {
        const { data: templateList, error: templateError } = await supabase.storage
          .from(this.TEMPLATES_BUCKET)
          .list(user?.id || '', { limit: 1 });
        
        canAccessTemplates = !templateError;
        console.log('📁 Template bucket access:', canAccessTemplates ? '✅' : '❌', templateError?.message);
      } catch (error) {
        console.log('📁 Template bucket access: ❌', error);
      }

      // Test generated documents bucket access
      let canAccessGenerated = false;
      try {
        const { data: generatedList, error: generatedError } = await supabase.storage
          .from(this.GENERATED_BUCKET)
          .list(user?.id || '', { limit: 1 });
        
        canAccessGenerated = !generatedError;
        console.log('📁 Generated bucket access:', canAccessGenerated ? '✅' : '❌', generatedError?.message);
      } catch (error) {
        console.log('📁 Generated bucket access: ❌', error);
      }

      // Test empty template bucket access
      let canAccessEmptyTemplate = false;
      try {
        const { data: emptyTemplateList, error: emptyTemplateError } = await supabase.storage
          .from(this.EMPTY_TEMPLATE_BUCKET)
          .list('', { limit: 1 });
        
        canAccessEmptyTemplate = !emptyTemplateError;
        console.log('📁 Empty template bucket access:', canAccessEmptyTemplate ? '✅' : '❌', emptyTemplateError?.message);
      } catch (error) {
        console.log('📁 Empty template bucket access: ❌', error);
      }

      return {
        canAccessTemplates,
        canAccessGenerated,
        canAccessEmptyTemplate,
        userInfo: {
          id: user?.id,
          email: user?.email,
          authenticated: !!user
        }
      };
    } catch (error) {
      console.error('Failed to test storage access:', error);
      return {
        canAccessTemplates: false,
        canAccessGenerated: false,
        canAccessEmptyTemplate: false,
        userInfo: null
      };
    }
  }
}