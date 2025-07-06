import React, { useState } from 'react';
import { Save, FileText, Tag, Sparkles, ArrowRight, X, Star, Folder, Database, Zap } from 'lucide-react';
import { DocumentTemplate, Tag as TagType } from '../types';

interface SaveTemplateScreenProps {
  documentContent: string;
  documentHtml: string;
  tags: TagType[];
  originalFileName?: string;
  onSave: (templateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
  onSkip: () => void;
  onCancel: () => void;
  onSaveAndLoadData?: (templateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
}

export const SaveTemplateScreen: React.FC<SaveTemplateScreenProps> = ({
  documentContent,
  documentHtml,
  tags,
  originalFileName,
  onSave,
  onSkip,
  onCancel,
  onSaveAndLoadData,
}) => {
  const [templateData, setTemplateData] = useState({
    name: originalFileName ? originalFileName.replace('.docx', '') : 'New Template',
    description: '',
    category: '',
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [savingAndLoading, setSavingAndLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!templateData.name.trim()) {
      setError('Please enter a template name');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const template: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
        name: templateData.name.trim(),
        description: templateData.description.trim(),
        category: templateData.category.trim(),
        originalFileName: originalFileName || 'document.docx',
        documentContent,
        documentHtml,
        tags: tags.map(tag => ({ ...tag })),
        isDefault: templateData.isDefault,
      };

      await onSave(template);
    } catch (error) {
      console.error('Failed to save template:', error);
      setError('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLoadData = async () => {
    if (!templateData.name.trim()) {
      setError('Please enter a template name');
      return;
    }

    try {
      setSavingAndLoading(true);
      setError(null);

      const template: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
        name: templateData.name.trim(),
        description: templateData.description.trim(),
        category: templateData.category.trim(),
        originalFileName: originalFileName || 'document.docx',
        documentContent,
        documentHtml,
        tags: tags.map(tag => ({ ...tag })),
        isDefault: templateData.isDefault,
      };

      if (onSaveAndLoadData) {
        await onSaveAndLoadData(template);
      } else {
        await onSave(template);
      }
    } catch (error) {
      console.error('Failed to save template and load data:', error);
      setError('Failed to save template. Please try again.');
    } finally {
      setSavingAndLoading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      {/* Header */}
      <div className="border-b border-gray-200/50 p-6 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Save className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Save as Template</h2>
              <p className="text-gray-600">Create a reusable template for future document generation</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Template Preview */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 mb-3">Template Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 font-medium">Document:</span>
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="font-semibold text-blue-900">{originalFileName || 'document.docx'}</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 font-medium">Tags extracted:</span>
                    <Tag className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="font-semibold text-blue-900">{tags.length} tags</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 font-medium">Content size:</span>
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="font-semibold text-blue-900">{Math.round(documentContent.length / 1024)} KB</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={templateData.name}
                onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                placeholder="Enter template name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category
              </label>
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={templateData.category}
                  onChange={(e) => setTemplateData({ ...templateData, category: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  placeholder="e.g., Contracts, Invoices, Reports"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isDefault"
                checked={templateData.isDefault}
                onChange={(e) => setTemplateData({ ...templateData, isDefault: e.target.checked })}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="isDefault" className="flex items-center text-sm text-gray-700">
                <Star className="w-4 h-4 mr-1 text-yellow-500" />
                Mark as default template
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={templateData.description}
              onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition-all duration-200 resize-none"
              placeholder="Describe what this template is used for, when to use it, and any special instructions..."
            />
          </div>
        </div>

        {/* Tags Preview */}
        {tags.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Tags that will be saved ({tags.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 12).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300 shadow-sm"
                >
                  £{tag.name}£
                </span>
              ))}
              {tags.length > 12 && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                  +{tags.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-6">
          <h4 className="text-lg font-bold text-emerald-900 mb-3">Why Save as Template?</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-emerald-800">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Reuse with different data sets</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Share with team members</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Version control and history</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Organize by categories</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Track usage analytics</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Faster future document generation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Three Buttons */}
      <div className="border-t border-gray-200/50 p-6 bg-gray-50/50">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Skip to Data Load */}
          <button
            onClick={onSkip}
            disabled={saving || savingAndLoading}
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Skip to Data Load
          </button>
          
          {/* Save Template */}
          <button
            onClick={handleSave}
            disabled={saving || savingAndLoading || !templateData.name.trim()}
            className="inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </>
            )}
          </button>

          {/* Save Template & Load Data */}
          <button
            onClick={handleSaveAndLoadData}
            disabled={saving || savingAndLoading || !templateData.name.trim()}
            className="inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {savingAndLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving & Loading...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Save & Load Data
              </>
            )}
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            <strong>Skip:</strong> Continue without saving • <strong>Save:</strong> Save and return to templates • <strong>Save & Load:</strong> Save and continue to data loading
          </p>
        </div>
      </div>
    </div>
  );
};