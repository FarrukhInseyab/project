import { supabase } from '../lib/supabase';

export class CloudConvertService {
  private static readonly API_BASE_URL = 'https://api.cloudconvert.com/v2';
  
  // Get API key from environment or user settings
  private static async getApiKey(): Promise<string> {
    // First try to get from environment
    const envApiKey = import.meta.env.VITE_CLOUDCONVERT_API_KEY;
    if (envApiKey) {
      return envApiKey;
    }
    
    // If not in environment, get from user profile preferences
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const apiKey = profile?.preferences?.cloudconvert_api_key;
      if (!apiKey) {
        throw new Error('OnlineConverter API key not configured. Please add it in your profile settings.');
      }
      
      return apiKey;
    } catch (error) {
      throw new Error('OnlineConverter API key not found. Please configure it in your settings or environment variables.');
    }
  }

  // Convert DOCX blob to PDF
  static async convertDocxToPdf(docxBlob: Blob, filename: string): Promise<Blob> {
    try {
      // Check if we should use OnlyOffice for conversion
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('user_id', user.id)
          .single();
        
        const preferences = profile?.preferences || {};
        console.log('PDF conversion method from preferences:', preferences.pdf_conversion_method);
        
        if (preferences.pdf_conversion_method === 'onlyoffice') {
          // Use OnlyOffice for conversion
          console.log('Using OnlyOffice for PDF conversion based on user preference');
          const { OnlyOfficeService } = await import('./onlyOfficeService');
          try {
            return await OnlyOfficeService.convertDocxToPdf(docxBlob, filename);
          } catch (onlyOfficeError) {
            console.error('My Editor PDF conversion failed, falling back to OnlineConverter:', onlyOfficeError);
            // Fall back to CloudConvert if OnlyOffice fails
          }
        } else {
          console.log('Using CloudConvert for PDF conversion based on user preference');
        }
      }
      
      // Use CloudConvert for conversion
      const apiKey = await this.getApiKey();
      
      console.log('🔄 Starting OnlineConverter DOCX to PDF conversion...');
      
      // Step 1: Create a job
      const jobResponse = await fetch(`${this.API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: {
            'import-docx': {
              operation: 'import/upload'
            },
            'convert-to-pdf': {
              operation: 'convert',
              input: 'import-docx',
              output_format: 'pdf',
              some_other_option: 'value'
            },
            'export-pdf': {
              operation: 'export/url',
              input: 'convert-to-pdf'
            }
          },
          tag: 'document-conversion'
        })
      });

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json();
        const errorMessage = errorData.message || jobResponse.statusText;
        
        // Handle specific CloudConvert errors with helpful messages
        if (errorMessage.toLowerCase().includes('email address is not verified')) {
          throw new Error('Your OnlineConverter account email address needs to be verified. Please log in to cloudconvert.com and verify your email address, then try again.');
        }
        
        if (errorMessage.toLowerCase().includes('invalid api key') || errorMessage.toLowerCase().includes('unauthorized')) {
          throw new Error('Invalid OnlineConverter API key. Please check your API key in the settings and ensure it\'s correct.');
        }
        
        if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('limit')) {
          throw new Error('OnlineConverter quota exceeded. Please check your account limits at cloudconvert.com or upgrade your plan.');
        }
        
        throw new Error(`OnlineConverter API error: ${errorMessage}`);
      }

      const jobData = await jobResponse.json();
      console.log('✅ OnlineConverter job created:', jobData.data.id);

      // Step 2: Upload the DOCX file
      const importTask = jobData.data.tasks.find((task: any) => task.name === 'import-docx');
      const uploadUrl = importTask.result.form.url;
      const uploadParams = importTask.result.form.parameters;

      const formData = new FormData();
      Object.entries(uploadParams).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', docxBlob, filename);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file to OnlineConverter: ${uploadResponse.statusText}`);
      }

      console.log('✅ File uploaded to OnlineConverter');

      // Step 3: Wait for conversion to complete
      const jobId = jobData.data.id;
      let jobStatus = 'processing';
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (jobStatus === 'processing' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`${this.API_BASE_URL}/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          }
        });

        if (!statusResponse.ok) {
          throw new Error(`Failed to check job status: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();
        jobStatus = statusData.data.status;
        attempts++;

        console.log(`🔄 Conversion status: ${jobStatus} (attempt ${attempts}/${maxAttempts})`);
      }

      if (jobStatus !== 'finished') {
        throw new Error(`Conversion failed or timed out. Status: ${jobStatus}`);
      }

      // Step 4: Get the download URL
      const finalJobResponse = await fetch(`${this.API_BASE_URL}/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      });

      const finalJobData = await finalJobResponse.json();
      const exportTask = finalJobData.data.tasks.find((task: any) => task.name === 'export-pdf');
      
      if (!exportTask || !exportTask.result || !exportTask.result.files || exportTask.result.files.length === 0) {
        throw new Error('No PDF file found in conversion result');
      }

      const downloadUrl = exportTask.result.files[0].url;

      // Step 5: Download the PDF
      const pdfResponse = await fetch(downloadUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
      }

      const pdfBlob = await pdfResponse.blob();
      console.log('✅ PDF conversion completed successfully');
      
      return pdfBlob;
    } catch (error) {
      console.error('❌ OnlineConverter PDF conversion failed:', error);
      throw error;
    }
  }

  // Check if API key is configured
  static async isConfigured(): Promise<boolean> {
    try {
      await this.getApiKey();
      return true;
    } catch {
      return false;
    }
  }

  // Save API key to user preferences
  static async saveApiKey(apiKey: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .single();

    const updatedPreferences = {
      ...profile?.preferences,
      cloudconvert_api_key: apiKey
    };

    const { error } = await supabase
      .from('profiles')
      .update({ preferences: updatedPreferences })
      .eq('user_id', user.id);

    if (error) throw error;
  }

  // Remove API key from user preferences
  static async removeApiKey(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .single();

    const updatedPreferences = { ...profile?.preferences };
    delete updatedPreferences.cloudconvert_api_key;

    const { error } = await supabase
      .from('profiles')
      .update({ preferences: updatedPreferences })
      .eq('user_id', user.id);

    if (error) throw error;
  }
}