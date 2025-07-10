import { supabase } from '../lib/supabase';
import { StorageService } from './storageService';

export class EditorService {
  static PDF_CONVERSION_METHOD = 'cloudconvert'; // Default method

  // Set the PDF conversion method
  static setPdfConversionMethod(method: 'cloudconvert') {
    this.PDF_CONVERSION_METHOD = method;
    console.log('PDF conversion method set to:', method);
  }

  // Get the PDF conversion method
  static getPdfConversionMethod(): string {
    return this.PDF_CONVERSION_METHOD;
  }

  // Check if editor is available
  static async checkEditorAvailability(): Promise<boolean> {
    try {
      console.log('Checking editor availability...');
      // CKEditor is a client-side library, so it's always available
      return true;
    } catch (error) {
      console.warn('Editor availability check failed:', error);
      return false;
    }
  }

  // Create a new blank document
  static createBlankDocument(): Blob {
    // This is a minimal DOCX structure
    const blankDocxContent = `
      UEsDBBQAAAAIAOuAOVcAAAAAAAAAAAAAAAALAAAAX3JlbHMvLnJlbHOtksFqwzAMhu+DvYPRfXGSdqNMXUuHYYOxXgfbO1jOJBH5I2Nt9/YzHQwGG2Mc9P/f9+8VmPUcdjJgeAMODK7RdVG26EjCj2+NXvgBJawS6T16Ug+3nUQf1gMuEoo/jILfrAEaw2Bl6JBOZMLvz4tJwT1ahdxWSNDfgjyjlSIWnP3isCCRfQGd6eTt28UrAjNVkArABTpOPnICvQBfQP+gHqOCrk9MS9WkMSdgV4+9X2b1Ub7jR0IZmBt+kYqXJ0/jGkn7bPHnzBXW8BXd4Rqapz7Dws2zfYu+lMdMRtu2tpJEtlYZ3eOOSBLFwkdB2/s3yElLsT/PK/BfAAD//wMAUEsDBBQAAAAIAOuAOVcAAAAAAAAAAAAAAAAPAAAAZG9jUHJvcHMvYXBwLnhtbJPBSgMxEIafBd9hyL1Jd1sQabZFELyIFLyGZCZtMJkJyWxr396sWi8qPc5l/v9/5vtIrOs2OQdQjbU8Y2nGmANZWCt5nbGXl/v0jjlnhLRCWYcZO4Jh6/z6CtNSl1pJeHIOlHMZq4xpY9IkEUJDI5S1HXjwpjVaJOCtrhMhbQsJY1nGhkkS1YJWQjXQCaE7+A8BaQz/B4Dv7Wq1+gNAz/sPgIhSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSS
    `;
    
    // Convert to blob
    return new Blob([blankDocxContent], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
  }

  // Get document URL for editing
  static async getDocumentUrl(templateId: string): Promise<string> {
    console.log('📥 Getting document URL for templateId:', templateId);

    try {
      const { TemplateService } = await import('./templateService');
      console.log('📦 Template service imported');

      const template = await TemplateService.getTemplate(templateId);
      console.log('📄 Template fetched:', template);

      if (!template.storage_path) {
        throw new Error('Template file not found in storage');
      }

      const signedUrl = await StorageService.getSignedUrl(template.storage_path, 'document-templates', { expiresIn: 3600 * 24 });
      console.log('🔗 Signed URL:', signedUrl);

      return signedUrl;
    } catch (error) {
      console.error('❌ Error getting document URL:', error);
      throw error;
    }
  }

  // Convert DOCX to PDF using CloudConvert
  static async convertDocxToPdf(docxBlob: Blob, filename: string): Promise<Blob> {
    try {
      console.log('🔄 Starting PDF conversion...');
      
      // Use CloudConvert service for PDF conversion
      const { CloudConvertService } = await import('./cloudConvertService');
      return await CloudConvertService.convertDocxToPdf(docxBlob, filename);
    } catch (error) {
      console.error('❌ PDF conversion failed:', error);
      throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Load OnlyOffice settings from user preferences
  static async loadSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          serverUrl: '',
          pdfConversionMethod: 'cloudconvert'
        };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const preferences = profile?.preferences || {};
      
      console.log('PDF conversion method from preferences:', preferences.pdf_conversion_method);
      
      return {
        serverUrl: '',
        pdfConversionMethod: preferences.pdf_conversion_method || 'cloudconvert'
      };
    } catch (error) {
      console.warn('Failed to load editor settings:', error);
      return {
        serverUrl: '',
        pdfConversionMethod: 'cloudconvert'
      };
    }
  }
}