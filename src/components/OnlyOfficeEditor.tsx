import React, { useEffect, useRef, useState } from 'react';
import { X, Save, Download, AlertCircle, CheckCircle, RefreshCw, FileText, Upload, Tag } from 'lucide-react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';
import { StorageService } from '../services/storageService';
import { TemplateService } from '../services/templateService';
import { TemplateVersionService } from '../services/templateVersionService';
import { convertDocxToHtml, extractTagsFromContent } from '../utils/documentUtils';
import { EditorService } from '../services/onlyOfficeService';
import { createDocx } from 'docx-templates';

interface DocumentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string;
  templateName?: string;
  mode: 'edit' | 'create' | 'view';
  onSave?: (templateData: any) => void;
  onVersionUpdate?: () => void;
  onManageTags?: (file: File, html: string, extractedTags: any[]) => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  isOpen,
  onClose,
  templateId,
  templateName,
  mode,
  onSave,
  onVersionUpdate,
  onManageTags,
}) => {
  const editorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [fallbackMode, setFallbackMode] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [editorData, setEditorData] = useState<string>('');
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDocument();
    }

    return () => {
      // Cleanup
    };
  }, [isOpen]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      setFallbackMode(false);
      
      let documentConfig;
      if ((mode === 'edit' || mode === 'view') && templateId) {
        await loadExistingDocument();
      } else {
        await prepareNewDocument();
      }

      setLoading(false);
      console.log('Document loaded successfully');
    } catch (error) {
      console.error('Error loading document:', error);
      setError(`Failed to load document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setFallbackMode(true);
      setLoading(false);
    }
  };

  const loadExistingDocument = async () => {
    if (!templateId) throw new Error('Template ID required for editing');

    try {
      const template = await TemplateService.getTemplate(templateId);

      // Get document URL
      const url = await EditorService.getDocumentUrl(templateId);
      
      // Download the document
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.statusText}`);
      }
      
      // Convert to HTML for editing
      const blob = await response.blob();
      const file = new File([blob], template.original_filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      
      const html = await convertDocxToHtml(file);
      setDocumentContent(html);
      setEditorData(html);
      
      console.log('✅ Document loaded successfully');
    } catch (error) {
      console.error('Error preparing existing document:', error);
      throw error;
    }
  };

  const prepareNewDocument = async () => {
    try {
      // Create a blank document
      const blankHtml = '<p>Start typing your document here...</p>';
      setDocumentContent(blankHtml);
      setEditorData(blankHtml);
      console.log('✅ New document created');
    } catch (error) {
      console.error('Error preparing new document:', error);
      throw error;
    }
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
    
    try {
      // Generate DOCX from HTML content
      const docxBlob = await generateDocxFromHtml(editorData);
      
      const filename = mode === 'edit' && templateName
        ? `${templateName}.docx`
        : `${newTemplateName || 'New Template'}.docx`;

      const file = new File([docxBlob], filename, {
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
      setError(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSaving(false);
    }
  } catch (error) {
    console.error('Error in handleManageTags:', error);
    setError(`Failed to manage tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    setSaving(false);
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

      // Generate DOCX from HTML content
      const docxBlob = await generateDocxFromHtml(editorData);
      handleSaveDocumentBlob(docxBlob);
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

  // Generate DOCX from HTML content
  const generateDocxFromHtml = async (html: string): Promise<Blob> => {
    try {
      // Create a simple template with the HTML content
      const template = `
        <html>
          <body>
            ${html}
          </body>
        </html>
      `;
      
      // Use docx-templates to generate a DOCX file
      const buffer = await createDocx(template, {});
      
      // Convert buffer to Blob
      return new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
    } catch (error) {
      console.error('Error generating DOCX from HTML:', error);
      throw new Error(`Failed to generate DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                  {mode === 'edit' ? 'Edit Document' : mode === 'view' ? 'View Document' : 'Create New Document'}
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

        {/* New Document Form (only for create mode) */}
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

        {/* Status Messages */}
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
                    Advanced editor is not available. Using fallback text editor.
                  </p>
                </div>
              </div>
              <div className="border border-gray-300 rounded-xl h-[500px] overflow-auto p-4">
                <textarea
                  className="w-full h-full border border-gray-200 rounded-lg p-4 text-gray-700"
                  placeholder="Enter your document content here..."
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] border border-gray-300 rounded-lg">
              <CKEditor
                editor={DecoupledEditor}
                data={editorData}
                onReady={(editor) => {
                  // Insert the toolbar into the editor container
                  const toolbarContainer = document.querySelector('.document-editor__toolbar');
                  if (toolbarContainer) {
                    toolbarContainer.appendChild(editor.ui.view.toolbar.element);
                  }
                  
                  // Store the editor reference
                  editorRef.current = editor;
                  setEditorReady(true);
                  
                  console.log('Editor is ready to use!');
                }}
                onChange={(event, editor) => {
                  const data = editor.getData();
                  setEditorData(data);
                }}
                config={{
                  toolbar: [
                    'heading',
                    '|',
                    'bold',
                    'italic',
                    'underline',
                    'strikethrough',
                    '|',
                    'fontSize',
                    'fontFamily',
                    'fontColor',
                    'fontBackgroundColor',
                    '|',
                    'alignment',
                    '|',
                    'numberedList',
                    'bulletedList',
                    '|',
                    'indent',
                    'outdent',
                    '|',
                    'link',
                    'blockQuote',
                    'insertTable',
                    '|',
                    'undo',
                    'redo'
                  ],
                  placeholder: 'Type or paste your content here...',
                  table: {
                    contentToolbar: [
                      'tableColumn',
                      'tableRow',
                      'mergeTableCells',
                      'tableCellProperties',
                      'tableProperties'
                    ]
                  }
                }}
              />
              <style jsx>{`
                .document-editor__toolbar {
                  background: #f8f9fa;
                  border: 1px solid #c4c4c4;
                  border-radius: 4px 4px 0 0;
                  padding: 8px;
                }
                
                .ck-editor__editable {
                  min-height: 400px;
                  padding: 1em;
                  border: 1px solid #c4c4c4;
                  border-radius: 0 0 4px 4px;
                }
              `}</style>
              <div className="document-editor__toolbar"></div>
            </div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Rename the component export to maintain compatibility with existing code
export const OnlyOfficeEditor = DocumentEditor;