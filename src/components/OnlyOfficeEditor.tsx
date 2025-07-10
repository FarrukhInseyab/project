import React, { useEffect, useRef, useState } from 'react';
import { X, Save, Download, AlertCircle, CheckCircle, RefreshCw, FileText, Upload, Tag } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { TemplateService } from '../services/templateService';
import { TemplateVersionService } from '../services/templateVersionService';
import { convertDocxToHtml, extractTagsFromContent } from '../utils/documentUtils';
import { OnlyOfficeService } from '../services/onlyOfficeService';

interface OnlyOfficeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string;
  templateName?: string;
  mode: 'edit' | 'create' | 'view';
  onSave?: (templateData: any) => void;
  onVersionUpdate?: () => void;
  onManageTags?: (file: File, html: string, extractedTags: any[]) => void;
}

declare global {
  interface Window {
    DocsAPI: any;
  }
}

export const OnlyOfficeEditor: React.FC<OnlyOfficeEditorProps> = ({
  isOpen,
  onClose,
  templateId,
  templateName,
  mode,
  onSave,
  onVersionUpdate,
  onManageTags,
}) => {
  const docEditorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentKey, setDocumentKey] = useState<string>('');
  const [fallbackMode, setFallbackMode] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxConnectionAttempts = 3;
  const [serverUrl, setServerUrl] = useState('');

  // Use refs for download attempts and timeout to avoid closure issues
  const downloadAttemptsRef = useRef(0);
  const maxDownloadAttempts = 3;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOnlyOfficeAPI();
    }

    return () => {
      if (docEditorRef.current) {
        try {
          docEditorRef.current.destroyEditor();
          docEditorRef.current = null;
        } catch (error) {
          console.log('Editor cleanup error:', error);
        }
      }
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOpen]);

 const loadOnlyOfficeAPI = async () => {
  try {
    setLoading(true);
    setError(null);
    setFallbackMode(false);
 
    const settings = await OnlyOfficeService.loadSettings();
    const currentServerUrl = settings.serverUrl;
    setServerUrl(currentServerUrl);
    console.log('Using OnlyOffice server URL:', currentServerUrl);
 
    if (window.DocsAPI) {
      console.log('DocsAPI already loaded, waiting for stability...');
      await waitForDocsAPI(); // ✅ Wait for DocsAPI
      await initializeEditor();
      return;
    }
 
    const existingScript = document.querySelector(`script[src="${currentServerUrl}/web-apps/apps/api/documents/api.js"]`);
    if (!existingScript) {
      console.log('Injecting API script...');
      const script = document.createElement('script');
      script.src = `${currentServerUrl}/web-apps/apps/api/documents/api.js`;
      script.async = true;
 
      const scriptLoadTimeout = setTimeout(() => {
        console.error('API script load timed out');
        setError('Editor API script load timed out. Retrying...');
        retryLoadWithBackoff();
      }, 8000);
 
      script.onload = async () => {
        clearTimeout(scriptLoadTimeout);
        console.log('API script loaded successfully');
        await waitForDocsAPI(); // ✅ Ensure DocsAPI is available
        await initializeEditor();
      };
 
      script.onerror = () => {
        clearTimeout(scriptLoadTimeout);
        console.error('Failed to load API script');
        setError('Editor server is not accessible. Using fallback editor.');
        setFallbackMode(true);
        setLoading(false);
      };
 
      document.head.appendChild(script);
    } else {
      console.log('API script already injected, polling for DocsAPI...');
      try {
        await waitForDocsAPI(); // ✅ Wait for DocsAPI if script already injected
        await initializeEditor();
      } catch (err) {
        console.warn('DocsAPI still not available, retrying...');
        retryLoadWithBackoff();
      }
    }
  } catch (error) {
    console.error('Error loading API script:', error);
    setError('Failed to initialize editor. Using fallback mode.');
    setFallbackMode(true);
    setLoading(false);
  }
};

// Retry with exponential backoff
const retryLoadWithBackoff = () => {
  if (connectionAttempts < maxConnectionAttempts) {
    const nextAttempt = connectionAttempts + 1;
    setConnectionAttempts(nextAttempt);
    const retryDelay = Math.min(2000 * Math.pow(2, nextAttempt - 1), 10000);
    
    console.log(`Retrying loadOnlyOfficeAPI (attempt ${nextAttempt}/${maxConnectionAttempts}) after ${retryDelay}ms...`);

    setTimeout(() => {
      if (!window.DocsAPI) {
        loadOnlyOfficeAPI();
      } else {
        initializeEditor(); // ✅ If already available, directly initialize
      }
    }, retryDelay);
  } else {
    console.error('Max retry attempts reached');
    setError('Unable to load editor after multiple attempts.');
    setFallbackMode(true);
    setLoading(false);
  }
};




  const initializeEditor = async () => {
    try {
      if (!window.DocsAPI) {
        if (connectionAttempts < maxConnectionAttempts) {
          setConnectionAttempts(prev => prev + 1);

          const retryDelay = Math.min(2000 * Math.pow(2, connectionAttempts), 10000); // 2s, 4s, 8s, max 10s
          console.log(`Retrying My Editor API initialization (attempt ${connectionAttempts + 1}/${maxConnectionAttempts}) after ${retryDelay}ms...`);
          
          setTimeout(() => loadOnlyOfficeAPI(), retryDelay);
          return;
        }
        throw new Error('My Editor API not available after multiple attempts');
      }


      let documentConfig;
      if ((mode === 'edit' || mode === 'view') && templateId) {
        documentConfig = await prepareExistingDocument();
      } else {
        documentConfig = await prepareNewDocument();
      }

      if (!documentConfig) {
        throw new Error('Failed to prepare document configuration');
      }

      const container = document.getElementById('onlyoffice-editor');
      if (container) container.innerHTML = '';

      console.log('Initializing editor with config:', documentConfig);
      docEditorRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor', documentConfig);

      setLoading(false);
      console.log('My Editor editor initialized successfully');
    } catch (error) {
      console.error('Error initializing My Editor editor:', error);
      setError(`Failed to initialize editor: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setFallbackMode(true);
      setLoading(false);
    }
  };

  const prepareExistingDocument = async () => {
    if (!templateId) throw new Error('Template ID required for editing');

    try {
      const template = await TemplateService.getTemplate(templateId);

      // ✅ Call OnlyOfficeService to get signed URL
      const url = await OnlyOfficeService.getDocumentUrl(templateId);
      setDocumentUrl(url);
      const key = `template_${templateId}_${Date.now()}`;
      setDocumentKey(key);

      return {
        type: 'desktop',
        width: '100%',
        height: '600px',
        documentType: 'word',
        documentServerUrl: 'http://127.0.0.1:8082',
        document: {
          fileType: 'docx',
          key: key,
          title: template.name,
          url: url,
          permissions: {
            edit: mode === 'edit', // Only allow editing in edit mode
            download: true,
            print: true,
            review: mode === 'edit',
            comment: mode === 'edit'
          }
        },
        editorConfig: {
          mode: mode === 'edit' ? 'edit' : 'view', // Set mode based on prop
          lang: 'en',
          callbackUrl: '',
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
          onDocumentReady: () => console.log('Document ready for editing'),
          onError: (event: any) => {
            console.error('My Editor editor error:', event);
            setError('Editor error occurred');
          }
        }
      };
    } catch (error) {
      console.error('Error preparing existing document:', error);
      throw error;
    }
  };

    const prepareNewDocument = async () => {
  try {
    let blankDocxUrl;
    try {
      console.log('Attempting to load empty template from Supabase storage...');
      blankDocxUrl = "https://qwdybygdvylpnyfdtfmi.supabase.co/storage/v1/object/sign/empty-template/emptytemplate.docx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMDQ0NTk4Yy02MGViLTQ3MTUtOGEyOC0zODZmYzZlMDFiNWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlbXB0eS10ZW1wbGF0ZS9lbXB0eXRlbXBsYXRlLmRvY3giLCJpYXQiOjE3NTE2NjIxMzcsImV4cCI6MTc1MjI2NjkzN30.iIntXqaN8E5ONSKGn7entftReiJYT7w8Ds9Jb9vpPjw";

      console.log('Empty template loaded successfully from storage');
    } catch (storageError) {
      console.warn('Failed to load empty template from storage, using fallback:', storageError);
      blankDocxUrl = await createBlankDocument(); // Fallback if loading from storage fails
    }

    setDocumentUrl(blankDocxUrl);
    setDocumentKey(`new_template_${Date.now()}`);

    return {
      type: 'desktop',
      width: '100%',
      height: '600px',
      documentType: 'word',
      documentServerUrl: 'http://127.0.0.1:8082',
      document: {
        fileType: 'docx',
        key: documentKey,
        title: newTemplateName || 'New Template',
        url: blankDocxUrl, // Use the URL from Supabase or the fallback
        permissions: {
          edit: true,
          download: true,
          print: true,
          review: true,
          comment: true
        }
      },
      editorConfig: {
        mode: 'edit',
        lang: 'en',
        callbackUrl: '',
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
        onDocumentReady: () => console.log('New document ready for editing'),
        onError: (event: any) => {
          console.error('My Editor editor error:', event);
          setError('Editor error occurred');
        }
      }
    };
  } catch (error) {
    console.error('Error preparing new document:', error);
    throw error;
  }
};

  const createBlankDocument = async (): Promise<string> => {
    const blankDocxContent = `UEsDBBQAAAAIAOuAOVcAAAAAAAAAAAAAAAALAAAAX3JlbHMvLnJlbHOtksFqwzAMhu+DvYPRfXGSdqNMXUuHYYOxXgfbO1jOJBH5I2Nt9/YzHQwGG2Mc9P/f9+8VmPUcdjJgeAMODK7RdVG26EjCj2+NXvgBJawS6T16Ug+3nUQf1gMuEoo/jILfrAEaw2Bl6JBOZMLvz4tJwT1ahdxWSNDfgjyjlSIWnP2isCCRfQGd6eTt28UrAjNVkArABTpOPnICvQBfQP+gHqOCrk9MS9WkMSdgV4+9X2b1Ub7jR0IZmBt+kYqXJ0/jGkn7bPHnzBXW8BXd4Rqapz7Dws2zfYu+lMdMRtu2tpJEtlYZ3eOOSBLFwkdB2/s3yElLsT/PK/BfAAD//wMAUEsDBBQAAAAIAOuAOVcAAAAAAAAAAAAAAAAPAAAAZG9jUHJvcS9h proposéLnhtbJPBSgMxEIafBd9hyL1Jd1sQabZFELyIFLyGZCZtMJkJyWxr396sWi8qPc5l/v9/5vtIrOs2OQdQjbU8Y2nGmANZWCt5nbGXl/v0jjlnhLRCWYcZO4Jh6/z6CtNSl1pJeHIOlHMZq4xpY9IkEUJDI5S1HXjwpjVaJOCtrhMhbQsJY1nGhkkS1YJWQjXQCaE7+A8BaQz/B4Dv7Wq1+gNAz/sPgIhSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSS`;
    const blob = new Blob([blankDocxContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return URL.createObjectURL(blob);
  };

const handleManageTags = async () => {
  if (fallbackMode) {
    handleFallbackSave();
    return;
  }

  try {
    setSaving(true);
    setError(null);
    setSuccess(null);
    downloadAttemptsRef.current = 0;

    // Set a timeout to prevent indefinite hanging
    timeoutRef.current = setTimeout(() => {
      if (saving) {
        setError('Document download timed out. Please try again.');
        setSaving(false);
        console.error('Download operation timed out after 20 seconds');
      }
    }, 20000);

    if (!docEditorRef.current) {
      throw new Error('Editor not initialized');
    }

    // Try to get the document using the editor API
    tryGetDocumentContent();
  } catch (error) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    console.error('Error preparing document for tag management:', error);
    setError(`Failed to prepare document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    setSaving(false);
  }
};

const tryGetDocumentContent = () => {
  if (downloadAttemptsRef.current >= maxDownloadAttempts) {
    setError('Failed to retrieve document after multiple attempts');
    setSaving(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    return;
  }

  downloadAttemptsRef.current += 1;
  const currentAttempt = downloadAttemptsRef.current;
  console.log(`Document retrieval attempt ${currentAttempt}/${maxDownloadAttempts}`);

  try {
    // First try: downloadAs method
    docEditorRef.current.downloadAs('docx', (blob: Blob) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      console.log('Document retrieved via downloadAs');
      handleManageTagsBlob(blob);
    });

    // Set a 10-second timeout for this attempt
    const attemptTimeout = setTimeout(() => {
      console.log(`Attempt ${currentAttempt} timed out, trying next method...`);
      tryAlternativeDownloadMethod();
    }, 10000);

    // Cleanup timeout when component unmounts
    return () => clearTimeout(attemptTimeout);
  } catch (error) {
    console.error(`Attempt ${currentAttempt} failed:`, error);
    tryAlternativeDownloadMethod();
  }
};

const tryAlternativeDownloadMethod = () => {
  // Try to get the document via the server URL directly
  if (documentUrl) {
    console.log('Trying to fetch document directly from URL');
    fetch(documentUrl)
      .then(response => response.blob())
      .then(blob => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        console.log('Document retrieved via direct URL fetch');
        handleManageTagsBlob(blob);
      })
      .catch(error => {
        console.error('Direct URL fetch failed:', error);
        tryServerSideConversion();
      });
  } else {
    tryServerSideConversion();
  }
};

const tryServerSideConversion = async () => {
  console.log('Trying server-side conversion');
  try {
    // Get the document via the editor API
    const docData = await new Promise<string>((resolve, reject) => {
      if (typeof docEditorRef.current.getDoc === 'function') {
        docEditorRef.current.getDoc(resolve);
      } else {
        reject('getDoc method not available');
      }
    });

    // Convert base64 to blob
    const byteCharacters = atob(docData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    console.log('Document retrieved via getDoc');
    handleManageTagsBlob(blob);
  } catch (error) {
    console.error('Server-side conversion failed:', error);
    
    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, downloadAttemptsRef.current - 1), 8000);
    
    // Retry after delay
    setTimeout(() => tryGetDocumentContent(), delay);
  }
};

const tryDownloadForTagManagement = () => {
  if (downloadAttemptsRef.current >= maxDownloadAttempts) {
    setError('Failed to download document after multiple attempts');
    setSaving(false);
    // Clean up timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    return;
  }

  downloadAttemptsRef.current += 1;
  const currentAttempt = downloadAttemptsRef.current;
  console.log(`Download attempt ${currentAttempt}/${maxDownloadAttempts}`);

  // Set per-attempt timeout
  const attemptTimeout = setTimeout(() => {
    console.error(`Download attempt ${currentAttempt} timed out after 10 seconds`);
    if (downloadAttemptsRef.current < maxDownloadAttempts) {
      console.log('Retrying download...');
      tryDownloadForTagManagement();
    }
  }, 10000); // 10 seconds per attempt

  try {
    docEditorRef.current.downloadAs('docx', (blob: Blob) => {
      // Clean up timeouts on success
      clearTimeout(attemptTimeout);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      console.log('Document downloaded successfully for tag management');
      handleManageTagsBlob(blob);
    });
  } catch (error) {
    clearTimeout(attemptTimeout);
    console.error(`Download attempt ${currentAttempt} failed:`, error);
    
    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, currentAttempt - 1), 8000);
    
    // Retry after delay
    setTimeout(() => tryDownloadForTagManagement(), delay);
  }
};

  const handleManageTagsBlob = async (blob: Blob) => {
    try {
      const filename = mode === 'edit' && templateName
        ? `${templateName}.docx`
        : `${newTemplateName || 'New Template'}.docx`;

      const file = new File([blob], filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Convert to HTML for display and tag extraction
      const html = await convertDocxToHtml(file);

      // Extract tags from the document content
      const extractedTags = extractTagsFromContent(html);

      console.log('Extracted tags for tag management:', extractedTags);

      // Close the editor
      onClose();

      // Call the onManageTags callback to proceed to tag management step
      if (onManageTags) {
        onManageTags(file, html, extractedTags);
      }
    } catch (error) {
      console.error('Error processing document for tag management:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSaveDocument = async () => {
    if (fallbackMode) {
      handleFallbackSave();
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (!docEditorRef.current) {
        throw new Error('Editor not initialized');
      }

      docEditorRef.current.downloadAs('docx', (blob: Blob) => {
        handleSaveDocumentBlob(blob);
      });
    } catch (error) {
      console.error('Error saving document:', error);
      setError(`Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSaving(false);
    }
  };

  const handleSaveDocumentBlob = async (blob: Blob) => {
    try {
      const filename = mode === 'edit' && templateName
        ? `${templateName}.docx`
        : `${newTemplateName || 'New Template'}.docx`;

      const file = new File([blob], filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Convert to HTML for display and tag extraction
      const html = await convertDocxToHtml(file);

      // Extract tags from the document content
      const extractedTags = extractTagsFromContent(html);

      if (mode === 'edit' && templateId) {
        // Update existing template
        await handleUpdateTemplate(file, html, extractedTags);
      } else {
        // Create new template
        await handleCreateTemplate(file, html, extractedTags);
      }
    } catch (error) {
      console.error('Error processing saved document:', error);
      setError(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSaving(false);
    }
  };

  const handleUpdateTemplate = async (file: File, html: string, extractedTags: any[]) => {
    try {
      if (!templateId) throw new Error('Template ID is required for updating');

      // Upload file to storage
      const storagePath = await StorageService.uploadTemplate(file, templateId);

      // Create new version
      const versionNotes = 'Updated via My Editor editor';
      await TemplateVersionService.createNewVersion(
        templateId,
        file,
        html,
        html,
        storagePath,
        versionNotes
      );

      // Notify parent component
      if (onVersionUpdate) {
        onVersionUpdate();
      }

      setSuccess('Template updated successfully!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error updating template:', error);
      setError(`Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = async (file: File, html: string, extractedTags: any[]) => {
    try {
      if (!newTemplateName) throw new Error('Template name is required');

      // Convert extracted tags to the format expected by the template service
      const tags = extractedTags.map(tag => ({
        name: tag.name,
        displayName: tag.displayName,
        description: tag.description,
      }));

      // Create template data
      const templateData = {
        name: newTemplateName,
        description: newTemplateDescription,
        originalFileName: file.name,
        documentContent: html,
        documentHtml: html,
        tags: tags,
        category: '',
        isDefault: false,
      };

      // Save template
      if (onSave) {
        await onSave(templateData);
      }

      setSuccess('Template created successfully!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error creating template:', error);
      setError(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFallbackSave = async () => {
    try {
      setSaving(true);
      const textarea = document.querySelector('textarea');
      if (!textarea) throw new Error('Fallback editor not found');

      const content = textarea.value;
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], 'template.txt');

      // Process as plain text instead of DOCX
      const extractedTags = extractTagsFromContent(content);

      if (onManageTags) {
        onManageTags(file, content, extractedTags);
      }
    } catch (error) {
      setError(`Fallback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const waitForDocsAPI = async (maxWait = 15000, interval = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.DocsAPI) {
        resolve();
      } else if (Date.now() - start >= maxWait) {
        reject(new Error('DocsAPI not loaded within timeout'));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
};


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {mode === 'edit' ? 'Edit Template' : mode === 'view' ? 'View Template' : 'Create New Template'}
                </h2>
                <p className="text-gray-600">
                  {mode === 'edit' || mode === 'view' ? templateName : 'Create a new document template'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* New Template Form (only for create mode) */}
        {mode === 'create' && (
          <div className="border-b border-gray-200 p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter template name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter template description"
                />
              </div>
            </div>
          </div>
        )}

        {/* Status messages */}
        {(error || success) && (
          <div className="p-4 border-b border-gray-200">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Server URL Debug Info */}
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-blue-800">
              <strong>Server URL:</strong> {serverUrl}
            </p>
            <button
              onClick={loadOnlyOfficeAPI}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg"
            >
              Reload
            </button>
          </div>
        </div>

        {/* Editor Container */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600">Loading editor...</p>
              </div>
            </div>
          ) : fallbackMode ? (
            <div className="p-6 h-full">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    My Editor editor is not available. Using fallback text editor.
                  </p>
                </div>
              </div>
              <div className="border border-gray-300 rounded-xl h-[500px] overflow-auto p-4">
                <textarea
                  className="w-full h-full border border-gray-200 rounded-lg p-4 text-gray-700"
                  placeholder="Fallback text editor not implemented."
                  disabled
                />
              </div>
            </div>
          ) : (
            <div id="onlyoffice-editor" className="h-full min-h-[500px]"></div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-between">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition-all duration-200"
            >
              Cancel
            </button>
            <div className="flex space-x-3">
              {mode !== 'view' && (
                <button
                  onClick={handleManageTags}
                  disabled={saving || (mode === 'create' && !newTemplateName)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Tag className="w-5 h-5 mr-2" />
                      Manage Tags
                    </>
                  )}
                </button>
              )}
              {/* {mode === 'view' && (
                <button
                  onClick={onClose} // You might want a separate download handler for view mode
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download
                </button>
              )} */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};