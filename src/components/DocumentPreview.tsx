import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, EyeOff, Maximize, Minimize, RefreshCw } from 'lucide-react';

interface DocumentPreviewProps {
  content: string;
  title?: string;
  isLoading?: boolean;
  onDownload?: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  content,
  title = 'Document Preview',
  isLoading = false,
  onDownload
}) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && fullscreen) {
        setFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [fullscreen]);

  return (
    <div className={`document-preview ${fullscreen ? 'fixed inset-0 z-50 bg-white' : 'relative'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 ${fullscreen ? 'border-b border-gray-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl border border-gray-200/50'}`}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center space-x-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
              title="Download document"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title={showControls ? "Hide controls" : "Show controls"}
          >
            {showControls ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div 
        className={`document-preview-container overflow-auto bg-white border-l border-r border-b ${fullscreen ? '' : 'rounded-b-2xl border-gray-200/50'}`}
        style={{ height: fullscreen ? 'calc(100% - 64px)' : '500px' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div 
            className="document-preview-content p-6"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>

      {/* Fullscreen overlay controls */}
      {fullscreen && showControls && (
        <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-2 flex space-x-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
              title="Download document"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowControls(false)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title="Hide controls"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title="Exit fullscreen"
          >
            <Minimize className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};