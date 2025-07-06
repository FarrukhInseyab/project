import React from 'react';
import { AlertTriangle, Database, ArrowRight, X, Zap, GitBranch } from 'lucide-react';

interface TemplateUpdateModalProps {
  isOpen: boolean;
  template: any;
  hasMappings: boolean;
  onUpdateTemplate: () => void;
  onUseExisting: () => void;
  onClose: () => void;
}

export const TemplateUpdateModal: React.FC<TemplateUpdateModalProps> = ({
  isOpen,
  template,
  hasMappings,
  onUpdateTemplate,
  onUseExisting,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Template Action Required</h3>
                <p className="text-sm text-gray-600">Choose how to proceed with this template</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Template Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <Database className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900">{template.name}</h4>
                <div className="flex items-center space-x-2 text-sm text-blue-700">
                  <GitBranch className="w-3 h-3" />
                  <span>Version {template.current_version || template.version || 1}</span>
                  {hasMappings && (
                    <>
                      <span>•</span>
                      <span className="text-green-700 font-medium">Has mappings</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {hasMappings ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="font-semibold text-green-900 mb-2">Mappings Available</h4>
              <p className="text-sm text-green-800">
                This template version has existing tag-column mappings saved in the database. 
                You can use the existing mappings or update them.
              </p>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h4 className="font-semibold text-orange-900 mb-2">No Mappings Found</h4>
              <p className="text-sm text-orange-800">
                This template version doesn't have any tag-column mappings. 
                You'll need to create mappings before loading data.
              </p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            {hasMappings && (
              <button
                onClick={onUseExisting}
                className="w-full flex items-center justify-between p-4 border border-green-300 rounded-xl hover:bg-green-50 transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-green-900">Use Existing Mappings</div>
                    <div className="text-sm text-green-700">Go directly to data loading with saved mappings</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-green-600 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <button
              onClick={onUpdateTemplate}
              className="w-full flex items-center justify-between p-4 border border-blue-300 rounded-xl hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Database className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-blue-900">
                    {hasMappings ? 'Update Template Mappings' : 'Create New Mappings'}
                  </div>
                  <div className="text-sm text-blue-700">
                    {hasMappings 
                      ? 'Modify existing mappings and create a new version'
                      : 'Set up tag-column mappings for this template'
                    }
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="font-semibold text-gray-900 mb-2">What happens next:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              {hasMappings ? (
                <>
                  <li>• <strong>Use Existing:</strong> Load data immediately with current mappings</li>
                  <li>• <strong>Update:</strong> Modify mappings and save as new template version</li>
                </>
              ) : (
                <>
                  <li>• You'll be taken to the mapping screen to set up tag-column relationships</li>
                  <li>• After mapping, you can save the template and proceed to data loading</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};