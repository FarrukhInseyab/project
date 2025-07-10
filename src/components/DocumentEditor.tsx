import React, { useRef, useCallback, useState } from 'react';
import { Upload, FileText, Download, Zap, Sparkles, Brain, Edit } from 'lucide-react';
import { convertDocxToHtml } from '../utils/documentUtils';
import { Tag as TagType } from '../types';

interface DocumentEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onFileUpload: (file: File, html: string) => void;
  tags: TagType[];
  onTagCreate: (tagName: string, selectedText: string) => void;
  onOpenOnlyOfficeEditor?: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  content,
  onContentChange,
  onFileUpload,
  tags,
  onTagCreate,
  onOpenOnlyOfficeEditor,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [showOnlyOfficeInfo, setShowOnlyOfficeInfo] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Please upload a .docx file');
      return;
    }

    try {
      const html = await convertDocxToHtml(file);
      onFileUpload(file, html);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error processing the document. Please try again.');
    }
  };

  const highlightTags = (text: string): string => {
    let highlightedText = text;
    tags.forEach(tag => {
      // Look for £ format tags in the content and highlight them
      const tagRegex = new RegExp(`£${tag.name}£`, 'g');
      highlightedText = highlightedText.replace(
        tagRegex,
        `<span class="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300 mx-1 shadow-sm print:bg-transparent print:border-transparent print:text-inherit">£${tag.name}£</span>`
      );
      
      // Also try to match with display name variations
      const possibleVariations = [
        tag.displayName,
        tag.displayName.replace(/\s+/g, '_'),
        tag.displayName.replace(/\s+/g, ''),
        tag.displayName.toLowerCase(),
        tag.displayName.toUpperCase()
      ];
      
      possibleVariations.forEach(variation => {
        const variationRegex = new RegExp(`£${variation}£`, 'gi');
        highlightedText = highlightedText.replace(
          variationRegex,
          `<span class="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300 mx-1 shadow-sm print:bg-transparent print:border-transparent print:text-inherit">£${variation}£</span>`
        );
      });
    });
    return highlightedText;
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      <div className="border-b border-gray-200/50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Document Editor</h2>
              <p className="text-sm text-gray-600">Upload and prepare your Word document</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-md touch-manipulation"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload DOCX
            </button>
            <button
              onClick={onOpenOnlyOfficeEditor}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-md touch-manipulation"
              onMouseEnter={() => setShowOnlyOfficeInfo(true)}
              onMouseLeave={() => setShowOnlyOfficeInfo(false)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Use My Editor
            </button>
          </div>
        </div>
      </div>

      {/* OnlyOffice Info Tooltip */}
      {showOnlyOfficeInfo && (
        <div className="border-b border-gray-200/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mr-0 sm:mr-4 self-center sm:self-auto">
              <Edit className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-2">
                <Sparkles className="w-5 h-5 text-blue-600 mx-auto sm:mx-0" />
                <p className="text-sm sm:text-base font-bold text-blue-900 mt-1 sm:mt-0">
                  My Editor Integration
                </p>
              </div>
              <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                Create or edit documents directly in My Editor's full-featured editor. 
                <span className="hidden sm:inline"> All changes will be saved back to your template library.</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced AI extraction info banner - Mobile optimized */}
      <div className="border-b border-gray-200/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mr-0 sm:mr-4 self-center sm:self-auto">
            <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-600 mx-auto sm:mx-0" />
              <p className="text-sm sm:text-base font-bold text-blue-900 mt-1 sm:mt-0">
                AI-Powered Tag Extraction
              </p>
            </div>
            <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
              Use <code className="bg-blue-100 px-1 sm:px-2 py-1 rounded-md font-mono text-blue-900 text-xs">£tag_name£</code> format in your Word document for automatic intelligent extraction. 
              <span className="hidden sm:inline"> Our AI will detect patterns, extract tags, and automatically move you to the next step.</span>
            </p>
          </div>
          <div className="flex items-center justify-center sm:justify-start space-x-2 px-3 sm:px-4 py-2 bg-white/60 backdrop-blur-sm rounded-xl border border-blue-200">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Auto-Extract</span>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="p-4 sm:p-6">
        {content ? (
          <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-inner">
            <div
              ref={editorRef}
              className="min-h-64 sm:min-h-96 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 p-4 text-sm sm:text-base"
              contentEditable
              dangerouslySetInnerHTML={{ __html: highlightTags(content) }}
              onInput={(e) => {
                const target = e.target as HTMLDivElement;
                onContentChange(target.innerHTML);
              }}
              style={{ 
                outline: 'none',
                minHeight: window.innerWidth < 640 ? '300px' : '500px',
                padding: '16px',
                margin: '0'
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-gray-500">
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mb-4 sm:mb-6">
              <FileText className="w-8 h-8 sm:w-12 sm:h-12 text-blue-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-3 text-gray-900 text-center">Ready for Your Document</h3>
            <p className="text-sm sm:text-base text-center max-w-md mb-4 sm:mb-6 text-gray-600 leading-relaxed px-4">
              Upload a Word document (.docx) to begin. All formatting, styles, tables, and layout will be preserved exactly as designed.
            </p>
            
            {/* Enhanced instructions - Mobile optimized */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-6 max-w-lg text-center mb-4 sm:mb-6 mx-4">
              <div className="flex flex-col sm:flex-row items-center justify-center mb-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-0 sm:mr-3 mb-2 sm:mb-0">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-sm sm:text-base font-bold text-blue-900">AI Magic Tip</span>
              </div>
              <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                For automatic intelligent extraction, use <code className="bg-blue-100 px-1 sm:px-2 py-1 rounded-md font-mono text-blue-900 text-xs">£tag_name£</code> format in your Word document.
                <br />
                <span className="font-medium mt-2 block">Examples:</span>
                <div className="flex flex-wrap justify-center gap-1 sm:gap-2 mt-1">
                  <code className="bg-blue-100 px-1 sm:px-2 py-1 rounded-md font-mono text-blue-900 text-xs">£client_name£</code>
                  <code className="bg-blue-100 px-1 sm:px-2 py-1 rounded-md font-mono text-blue-900 text-xs">£invoice_date£</code>
                </div>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 border border-transparent rounded-2xl shadow-lg text-sm sm:text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />
                Choose Your Document
              </button>
              
              <button
                onClick={onOpenOnlyOfficeEditor}
                className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 border border-gray-300 rounded-2xl shadow-lg text-sm sm:text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation"
              >
                <Edit className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />
                Use My Editor
              </button>
            </div>
          </div>
        )}
      </div>

      {content && (
        <div className="border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-blue-50 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <p className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
              <strong>Pro Tips:</strong> Use £tag£ format in your Word document for automatic AI extraction. 
              <span className="hidden sm:inline"> All original formatting is preserved perfectly.</span>
            </p>
            <div className="flex items-center justify-center sm:justify-end space-x-4 sm:space-x-6">
              <div className="flex items-center text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="font-medium">Format preserved</span>
              </div>
              {tags.length > 0 && (
                <div className="flex items-center text-xs text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="font-medium">{tags.length} tags detected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};