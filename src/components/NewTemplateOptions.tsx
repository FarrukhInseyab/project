import React from 'react';
import { Upload, Edit, X } from 'lucide-react';

interface NewTemplateOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadTemplate: () => void;
  onCreateInEditor: () => void;
}

export const NewTemplateOptions: React.FC<NewTemplateOptionsProps> = ({
  isOpen,
  onClose,
  onUploadTemplate,
  onCreateInEditor,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Create New Template</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">
            How would you like to create your new template?
          </p>

          <div className="space-y-4">
            <button
              onClick={onUploadTemplate}
              className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Upload DOCX File</div>
                  <div className="text-sm text-gray-600">Use an existing document as template</div>
                </div>
              </div>
            </button>

            <button
              onClick={onCreateInEditor}
              className="w-full flex items-center justify-between p-4 border border-blue-300 rounded-xl hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-blue-900">Create in Document Editor</div>
                  <div className="text-sm text-blue-600">Start with a blank document in My Editor</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};