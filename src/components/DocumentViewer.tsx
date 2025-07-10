import React, { useState, useEffect } from 'react';
import { DocumentPreview } from './DocumentPreview';
import { TemplateVersionService } from '../services/templateVersionService';
import { StorageService } from '../services/storageService';
import { convertDocxToHtml } from '../utils/documentUtils';
import { FileText, Download, RefreshCw, AlertCircle, Tag, List, Eye } from 'lucide-react';

interface DocumentViewerProps {
  templateId?: string;
  templateName?: string;
  documentHtml?: string;
  tags?: Array<{ name: string; displayName: string }>;
  onClose?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  templateId,
  templateName = 'Document',
  documentHtml = '',
  tags = [],
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState(documentHtml);
  const [showTags, setShowTags] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (templateId && !documentHtml) {
      loadDocumentFromTemplate();
    } else {
      setHtml(documentHtml);
    }
  }, [templateId, documentHtml]);

  const loadDocumentFromTemplate = async () => {
    if (!templateId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get template storage path
      const { TemplateService } = await import('../services/templateService');
      const template = await TemplateService.getTemplate(templateId);
      
      if (!template.storage_path) {
        throw new Error('Template file not found in storage');
      }
      
      // Download the DOCX file
      const fileBuffer = await StorageService.downloadTemplate(template.storage_path);
      
      // Create a blob from the buffer
      const blob = new Blob([fileBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      // Create a File object
      const file = new File([blob], template.original_filename, { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      // Convert to HTML
      const html = await convertDocxToHtml(file);
      setHtml(html);
      
    } catch (error) {
      console.error('Failed to load document:', error);
      setError(`Failed to load document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!templateId) return;
    
    try {
      setDownloading(true);
      await TemplateVersionService.downloadCurrentVersion(templateId);
    } catch (error) {
      console.error('Failed to download document:', error);
      setError(`Failed to download document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  };

  // Highlight tags in the HTML content
  const highlightTags = (content: string): string => {
    let highlightedContent = content;
    tags.forEach(tag => {
      // Look for £ format tags in the content and highlight them
      const tagRegex = new RegExp(`£${tag.name}£`, 'g');
      highlightedContent = highlightedContent.replace(
        tagRegex,
        `<span class="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300 mx-1 shadow-sm print:bg-transparent print:border-transparent print:text-inherit">£${tag.name}£</span>`
      );
      
      // Also try to match with display name variations
      if (tag.displayName) {
        const possibleVariations = [
          tag.displayName,
          tag.displayName.replace(/\s+/g, '_'),
          tag.displayName.replace(/\s+/g, ''),
          tag.displayName.toLowerCase(),
          tag.displayName.toUpperCase()
        ];
        
        possibleVariations.forEach(variation => {
          const variationRegex = new RegExp(`£${variation}£`, 'gi');
          highlightedContent = highlightedContent.replace(
            variationRegex,
            `<span class="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300 mx-1 shadow-sm print:bg-transparent print:border-transparent print:text-inherit">£${variation}£</span>`
          );
        });
      }
    });
    return highlightedContent;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Document Preview</h2>
            <p className="text-sm text-gray-600">{templateName}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowTags(!showTags)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showTags 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center space-x-1">
              <Tag className="w-4 h-4" />
              <span>{showTags ? 'Hide Tags' : 'Show Tags'}</span>
            </div>
          </button>
          
          {templateId && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-1"
            >
              {downloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Tags List */}
      {showTags && tags.length > 0 && (
        <div className="p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/50">
          <div className="flex items-center space-x-2 mb-3">
            <List className="w-4 h-4 text-blue-600" />
            <h3 className="font-medium text-gray-900">Document Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <div 
                key={index}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 text-sm"
              >
                <span className="font-mono text-blue-700">£{tag.name}£</span>
                {tag.displayName && tag.displayName !== tag.name && (
                  <span className="text-gray-600 text-xs ml-1">({tag.displayName})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}
      
      {/* Document Preview */}
      <DocumentPreview 
        content={showTags ? highlightTags(html) : html}
        title={templateName}
        isLoading={loading}
        onDownload={templateId ? handleDownload : undefined}
      />
    </div>
  );
};