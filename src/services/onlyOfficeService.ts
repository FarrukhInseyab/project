import { supabase } from '../lib/supabase';
import { StorageService } from './storageService';
import { TemplateVersionService } from './templateVersionService';

export class OnlyOfficeService {
  static SERVER_URL = 'http://172.22.25.154:8082'; // Default URL

  // Set the server URL
  static setServerUrl(url: string) {
    this.SERVER_URL = url;
    console.log('My Editor server URL set to:', url);
  }

  // Get the server URL
  static getServerUrl(): string {
    return this.SERVER_URL;
  }

  // Check if OnlyOffice server is available
  static async checkServerAvailability(customUrl?: string): Promise<boolean> {
    const url = customUrl || this.SERVER_URL;
    
    try {
      console.log(`Testing My Editor server availability at ${url}...`);
      
      // First, check if the URL is valid
      try {
        new URL(url);
      } catch (urlError) {
        console.warn('Invalid My Editor server URL:', url);
        return false;
      }
      
      // Try a simple fetch with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        console.log('Attempting to connect to My Editor server...');
        const response = await fetch(`${url}/healthcheck`, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-cache',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        // Check if response is ok (status 200-299)
        if (response.ok) {
          console.log('My Editor server is available');
          return true;
        } else {
          console.log(`My Editor server responded with status: ${response.status}`);
          // Even if healthcheck fails, try the main endpoint
          return await this.tryMainEndpoint(url);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.log('Healthcheck endpoint failed, trying main endpoint...', fetchError);
        return await this.tryMainEndpoint(url);
      }
    } catch (error) {
      console.warn('My Editor server availability check failed:', error);
      return false;
    }
  }

  // Try the main OnlyOffice endpoint
  private static async tryMainEndpoint(url: string): Promise<boolean> {
    try {
      console.log('Trying main My Editor endpoints...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      // Try multiple endpoints that might be available
      const endpoints = [
        '/web-apps/apps/api/documents/api.js',
        '/web-apps/',
        '/'
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${url}${endpoint}`);
          const response = await fetch(`${url}${endpoint}`, {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors', // Use no-cors as fallback
            cache: 'no-cache'
          });
          
          clearTimeout(timeoutId);
          console.log(`My Editor endpoint ${endpoint} appears to be available`);
          return true;
        } catch (endpointError) {
          // Continue to next endpoint
          console.log(`Endpoint ${endpoint} failed, trying next...`, endpointError);
        }
      }
      
      clearTimeout(timeoutId);
      console.warn('All My Editor endpoints failed to respond');
      return false;
    } catch (error) {
      console.warn('My Editor main endpoint check failed:', error);
      return false;
    }
  }

  // Get configuration for editing a template
  static getEditorConfig(
    documentUrl: string,
    documentKey: string,
    documentTitle: string,
    mode: 'edit' | 'view' = 'edit'
  ) {
    return {
      documentType: 'word',
      document: {
        fileType: 'docx',
        key: documentKey || `template_${Date.now()}`,
        title: documentTitle,
        url: documentUrl,
        permissions: {
          edit: mode === 'edit',
          download: true,
          print: true,
          review: mode === 'edit',
          comment: mode === 'edit'
        }
      },
      editorConfig: {
        mode: mode,
        lang: 'en',
        callbackUrl: '', // We'll handle saving manually
        user: {
          id: 'user-1',
          name: 'User'
        },
        customization: {
          autosave: false,
          forcesave: false,
          compactToolbar: false,
          toolbar: true,
          statusBar: true,
          chat: false,
          comments: false,
          zoom: 100
        }
      },
      events: {
        onDocumentReady: () => {
          console.log('Document ready for editing');
        },
        onError: (event: any) => {
          console.error('My Editor editor error:', event);
        }
      },
      width: '100%',
      height: '600px'
    };
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
    console.log('📥 getDocumentUrl called with templateId:', templateId);

    try {
      const { TemplateService } = await import('./templateService');
      console.log('📦 TemplateService imported');

      const template = await TemplateService.getTemplate(templateId);
      console.log('📄 Template fetched:', template);

      if (!template.storage_path) {
        throw new Error('Template file not found in storage');
      }

      const signedUrl = await StorageService.getSignedUrl(template.storage_path, 'document-templates', { expiresIn: 3600 * 24 });
      console.log('🔗 Signed URL:', signedUrl);

      return signedUrl;
    } catch (error) {
      console.error('❌ getDocumentUrl error:', error);
      throw error;
    }
  }

  // Convert DOCX to PDF using OnlyOffice
  static async convertDocxToPdf(docxBlob: Blob, filename: string): Promise<Blob> {
    try {
      console.log('🔄 Starting My Editor PDF conversion...');
      
      // Get OnlyOffice URL from user preferences
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const preferences = profile?.preferences || {};
      const serverUrl = preferences.onlyoffice_url || this.SERVER_URL;
      
      console.log('🔄 Using My Editor server URL for PDF conversion:', serverUrl);
      
      // Check if OnlyOffice server is available
      const isAvailable = await this.checkServerAvailability(serverUrl);
      if (!isAvailable) {
        throw new Error('My Editor server is not available for PDF conversion. Please check your server configuration or use OnlineConverter instead.');
      }

      // Try multiple conversion approaches in sequence
      try {
        // Approach 1: Direct conversion API
        return await this.convertUsingDirectApi(serverUrl, docxBlob, filename);
      } catch (directApiError) {
        console.warn('Direct API conversion failed, trying conversion service:', directApiError);
        
        try {
          // Approach 2: Conversion service
          return await this.convertUsingConversionService(serverUrl, docxBlob, filename);
        } catch (conversionServiceError) {
          console.warn('Conversion service failed, trying document editor API:', conversionServiceError);
          
          // Approach 3: Document editor API
          return await this.convertUsingDocumentEditorApi(serverUrl, docxBlob, filename);
        }
      }
    } catch (error) {
      console.error('❌ My Editor PDF conversion failed:', error);
      throw new Error(`My Editor PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Approach 1: Direct conversion API
  private static async convertUsingDirectApi(serverUrl: string, docxBlob: Blob, filename: string): Promise<Blob> {
    console.log('🔄 Trying direct conversion API...');
    
    // Create a unique key for this conversion
    const conversionKey = `pdf_conversion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', docxBlob, filename);
    formData.append('outputtype', 'pdf');
    formData.append('key', conversionKey);
    formData.append('filetype', 'docx');
    
    // Try the direct conversion endpoint
    const conversionEndpoint = `${serverUrl}/ConvertService.ashx`;
    console.log('🔄 Using direct conversion endpoint:', conversionEndpoint);
    
    const response = await fetch(conversionEndpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json, application/pdf',
      },
    });
    
    if (!response.ok) {
      console.error('❌ Direct conversion failed with status:', response.status);
      const errorText = await response.text();
      throw new Error(`Direct conversion failed: ${response.status} - ${errorText}`);
    }
    
    // Check if the response is JSON or PDF
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      // Parse the JSON response
      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Direct conversion error: ${result.error}`);
      }
      
      // If the response contains a fileUrl, fetch the converted file
      if (result.fileUrl) {
        console.log('🔄 Fetching converted PDF from:', result.fileUrl);
        const pdfResponse = await fetch(result.fileUrl);
        
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download converted PDF: ${pdfResponse.status}`);
        }
        
        const pdfBlob = await pdfResponse.blob();
        console.log('✅ PDF conversion completed successfully via direct API with URL');
        return pdfBlob;
      }
    }
    
    // If the response is directly the PDF file
    if (contentType && contentType.includes('application/pdf')) {
      const pdfBlob = await response.blob();
      console.log('✅ PDF conversion completed successfully via direct API with PDF response');
      return pdfBlob;
    }
    
    throw new Error('Direct conversion API did not return a valid PDF or URL');
  }

  // Approach 2: Conversion service
  private static async convertUsingConversionService(serverUrl: string, docxBlob: Blob, filename: string): Promise<Blob> {
    console.log('🔄 Trying conversion service...');
    
    // Create a unique key for this conversion
    const conversionKey = `pdf_conversion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', docxBlob, filename);
    formData.append('async', 'false');
    formData.append('filetype', 'docx');
    formData.append('outputtype', 'pdf');
    formData.append('key', conversionKey);
    formData.append('title', filename);
    
    // Try the conversion service endpoint
    const conversionEndpoint = `${serverUrl}/ConvertService`;
    console.log('🔄 Using conversion service endpoint:', conversionEndpoint);
    
    const response = await fetch(conversionEndpoint, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      console.error('❌ Conversion service failed with status:', response.status);
      const errorText = await response.text();
      throw new Error(`Conversion service failed: ${response.status} - ${errorText}`);
    }
    
    // Check if the response is directly the PDF file
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) {
      const pdfBlob = await response.blob();
      console.log('✅ PDF conversion completed successfully via conversion service');
      return pdfBlob;
    }
    
    // If the response is JSON, it might contain a URL to the converted file
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Conversion service error: ${result.error}`);
      }
      
      if (result.fileUrl) {
        console.log('🔄 Fetching converted PDF from:', result.fileUrl);
        const pdfResponse = await fetch(result.fileUrl);
        
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download converted PDF: ${pdfResponse.status}`);
        }
        
        const pdfBlob = await pdfResponse.blob();
        console.log('✅ PDF conversion completed successfully via conversion service with URL');
        return pdfBlob;
      }
    }
    
    throw new Error('Conversion service did not return a valid PDF or URL');
  }

  // Approach 3: Document editor API
  private static async convertUsingDocumentEditorApi(serverUrl: string, docxBlob: Blob, filename: string): Promise<Blob> {
    console.log('🔄 Trying document editor API for conversion...');
    
    // Create a unique key for this conversion
    const conversionKey = `pdf_conversion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create a temporary URL for the blob
    const docxUrl = URL.createObjectURL(docxBlob);
    
    // Create a promise that will resolve when the conversion is complete
    return new Promise<Blob>((resolve, reject) => {
      // Create a timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('PDF conversion timed out after 30 seconds'));
      }, 30000); // 30 second timeout
      
      // Create a hidden iframe to host the editor
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0.01';
      document.body.appendChild(iframe);
      
      // Create a message listener for communication with the iframe
      const messageHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'pdf-conversion-result') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          document.body.removeChild(iframe);
          URL.revokeObjectURL(docxUrl);
          
          if (event.data.error) {
            reject(new Error(`PDF conversion failed: ${event.data.error}`));
          } else if (event.data.pdfBlob) {
            console.log('✅ PDF conversion completed successfully via document editor API');
            resolve(event.data.pdfBlob);
          } else {
            reject(new Error('PDF conversion failed: No PDF data received'));
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Create the HTML content for the iframe
      const iframeContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>PDF Conversion</title>
          <script src="${serverUrl}/web-apps/apps/api/documents/api.js"></script>
          <script>
            // Function to handle conversion
            function initEditor() {
              try {
                console.log('Initializing editor for PDF conversion');
                
                // Check if DocsAPI is available
                if (!window.DocsAPI) {
                  window.parent.postMessage({
                    type: 'pdf-conversion-result',
                    error: 'DocsAPI not available'
                  }, '*');
                  return;
                }
                
                // Initialize the editor
                const docEditor = new DocsAPI.DocEditor('editor-container', {
                  width: '100%',
                  height: '100%',
                  documentType: 'word',
                  document: {
                    fileType: 'docx',
                    key: '${conversionKey}',
                    title: '${filename}',
                    url: '${docxUrl}'
                  },
                  editorConfig: {
                    mode: 'view',
                    lang: 'en',
                    customization: {
                      compactToolbar: true,
                      hideRightMenu: true,
                    }
                  },
                  events: {
                    onDocumentReady: function() {
                      console.log('Document ready, downloading as PDF');
                      setTimeout(() => {
                        docEditor.downloadAs('pdf');
                      }, 1000);
                    },
                    onDownloadAs: function(event) {
                      console.log('Download event:', event);
                      if (event.data && event.data.url) {
                        fetch(event.data.url)
                          .then(response => response.blob())
                          .then(blob => {
                            window.parent.postMessage({
                              type: 'pdf-conversion-result',
                              pdfBlob: blob
                            }, '*');
                          })
                          .catch(error => {
                            window.parent.postMessage({
                              type: 'pdf-conversion-result',
                              error: error.message
                            }, '*');
                          });
                      } else {
                        window.parent.postMessage({
                          type: 'pdf-conversion-result',
                          error: 'No download URL provided'
                        }, '*');
                      }
                    },
                    onError: function(event) {
                      console.error('Editor error:', event);
                      window.parent.postMessage({
                        type: 'pdf-conversion-result',
                        error: event.data ? JSON.stringify(event.data) : 'Unknown editor error'
                      }, '*');
                    }
                  }
                });
              } catch (error) {
                console.error('Editor initialization error:', error);
                window.parent.postMessage({
                  type: 'pdf-conversion-result',
                  error: error.message || 'Unknown initialization error'
                }, '*');
              }
            }
            
            // Initialize when the page loads
            window.onload = initEditor;
          </script>
        </head>
        <body style="margin:0;padding:0;overflow:hidden;">
          <div id="editor-container" style="width:100%;height:100vh;"></div>
        </body>
        </html>
      `;
      
      // Set the iframe content
      if (iframe.contentWindow) {
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(iframeContent);
        iframe.contentWindow.document.close();
      } else {
        // If contentWindow is not available, use srcdoc
        iframe.srcdoc = iframeContent;
      }
    });
  }

  // Load OnlyOffice settings from user preferences
  static async loadSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          serverUrl: this.SERVER_URL,
          pdfConversionMethod: 'cloudconvert'
        };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const preferences = profile?.preferences || {};
      
      // Update server URL if set in preferences
      if (preferences.onlyoffice_url) {
        this.SERVER_URL = preferences.onlyoffice_url;
        console.log('My Editor server URL loaded from preferences:', this.SERVER_URL);
      }
      
      console.log('PDF conversion method from preferences:', preferences.pdf_conversion_method);
      
      return {
        serverUrl: this.SERVER_URL,
        pdfConversionMethod: preferences.pdf_conversion_method || 'cloudconvert'
      };
    } catch (error) {
      console.warn('Failed to load My Editor settings:', error);
      return {
        serverUrl: this.SERVER_URL,
        pdfConversionMethod: 'cloudconvert'
      };
    }
  }
}