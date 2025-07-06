import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit2, 
  Trash2, 
  Star, 
  Calendar, 
  Tag, 
  FileText, 
  MoreVertical, 
  Clock,
  GitBranch,
  RefreshCw,
  Upload,
  Settings,
  Download,
  AlertCircle,
  Wifi,
  WifiOff,
  Edit
} from 'lucide-react';
import { DocumentTemplate, TemplateCategory } from '../types';
import { TemplateService } from '../services/templateService';
import { TemplateVersionManager } from './TemplateVersionManager';
import { TemplateVersionService } from '../services/templateVersionService';
import { TemplateViewOptions } from './TemplateViewOptions';
import { TemplateEditOptions } from './TemplateEditOptions';
import { NewTemplateOptions } from './NewTemplateOptions';

interface TemplateManagerProps {
  templates: DocumentTemplate[];
  onTemplateSelect: (template: DocumentTemplate) => void;
  onTemplateDelete: (templateId: string) => void;
  onTemplateUpdate: (templateId: string, updates: Partial<DocumentTemplate>) => void;
  onNewTemplate: () => void;
  onVersionUpdate?: () => void;
  onSaveTemplate?: (templateData: any) => Promise<any>;
  onTemplateVersionUpdate?: () => void;
  onOpenSettings?: () => void;
  onViewTemplate?: (template: DocumentTemplate) => void;
  onEditTemplate?: (template: DocumentTemplate) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  onTemplateSelect,
  onTemplateDelete,
  onTemplateUpdate,
  onNewTemplate,
  onVersionUpdate,
  onSaveTemplate,
  onTemplateVersionUpdate,
  onOpenSettings,
  onViewTemplate,
  onEditTemplate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [freshTemplates, setFreshTemplates] = useState<any[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showVersionManager, setShowVersionManager] = useState<{
    templateId: string;
    templateName: string;
    currentVersion: number;
    mode: 'history' | 'upload';
  } | null>(null);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [showEditOptions, setShowEditOptions] = useState(false);
  const [showNewOptions, setShowNewOptions] = useState(false);
  const [selectedTemplateForOptions, setSelectedTemplateForOptions] = useState<DocumentTemplate | null>(null);

  useEffect(() => {
    loadCategories();
    loadFreshTemplateData();
  }, []);

  // Reload fresh template data when templates prop changes
  useEffect(() => {
    loadFreshTemplateData();
  }, [templates]);

  const loadCategories = async () => {
    try {
      setConnectionError(null);
      const cats = await TemplateService.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load categories:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load categories';
      setConnectionError(errorMessage);
    }
  };

  // CRITICAL: Load fresh template data from database
  const loadFreshTemplateData = async () => {
    try {
      console.log('🔄 Loading fresh template data from database...');
      setConnectionError(null);
      setRefreshing(true);
      
      const freshData = await TemplateService.getTemplates();
      console.log('✅ Fresh template data loaded:', freshData?.length || 0, 'templates');
      setFreshTemplates(freshData || []);
      
      // Clear any previous connection errors on successful load
      setConnectionError(null);
    } catch (error) {
      console.error('❌ Failed to load fresh template data:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load templates';
      setConnectionError(errorMessage);
      
      // Fallback to props data if database fetch fails
      console.log('📦 Falling back to props data:', templates.length, 'templates');
      setFreshTemplates(templates);
    } finally {
      setRefreshing(false);
    }
  };

  // Use fresh template data instead of props
  const templatesData = freshTemplates.length > 0 ? freshTemplates : templates;

  const filteredTemplates = templatesData.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category?.id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (date: Date | string) => {
    if (!date) return 'N/A';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return 'N/A';
    }
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  const handleVersionUpdate = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Template version updated, refreshing template data...');
      
      // Reload fresh template data from database
      await loadFreshTemplateData();
      
      // Call the parent's version update handler
      if (onVersionUpdate) {
        await onVersionUpdate();
      }
      
      // Call the template version update handler
      if (onTemplateVersionUpdate) {
        await onTemplateVersionUpdate();
      }
      
    } catch (error) {
      console.error('Failed to handle version update:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleVersionManagerClose = () => {
    setShowVersionManager(null);
    // Refresh template data when version manager closes
    loadFreshTemplateData();
  };

  const handleShowVersionHistory = (template: DocumentTemplate) => {
    setShowVersionManager({
      templateId: template.id,
      templateName: template.name,
      currentVersion: template.current_version || template.version || 1,
      mode: 'history'
    });
  };

  // FIXED: Auto-download current version before showing new version modal
  const handleShowNewVersion = async (template: DocumentTemplate) => {
    try {
      console.log('📥 Auto-downloading current version before new version upload...');
      
      // Download the current version first
      await TemplateVersionService.downloadCurrentVersion(template.id);
      
      console.log('✅ Current version downloaded, opening new version modal...');
      
      // Show new version modal after successful download
      setShowVersionManager({
        templateId: template.id,
        templateName: template.name,
        currentVersion: template.current_version || template.version || 1,
        mode: 'upload'
      });
      
    } catch (error) {
      console.error('Failed to auto-download current version:', error);
      
      // Still show the modal even if download fails, but user will see error
      setShowVersionManager({
        templateId: template.id,
        templateName: template.name,
        currentVersion: template.current_version || template.version || 1,
        mode: 'upload'
      });
    }
  };

  const handleDownloadTemplate = async (template: DocumentTemplate) => {
    try {
      console.log('📥 Downloading current version of template:', template.name);
      await TemplateVersionService.downloadCurrentVersion(template.id);
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  const handleRetryConnection = () => {
    setConnectionError(null);
    loadFreshTemplateData();
    loadCategories();
  };

  const handleSaveTemplate = async (templateData: any) => {
    if (onSaveTemplate) {
      try {
        const result = await onSaveTemplate(templateData);
        await loadFreshTemplateData(); // Refresh the template list
        return result;
      } catch (error) {
        console.error('Failed to save template:', error);
        throw error;
      }
    } else {
      console.warn('onSaveTemplate prop not provided to TemplateManager');
    }
  };

  const handleViewTemplate = (template: DocumentTemplate) => {
    if (onViewTemplate) {
      onViewTemplate(template);
    } else {
      setSelectedTemplateForOptions(template);
      setShowViewOptions(true);
    }
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    if (onEditTemplate) {
      onEditTemplate(template);
    } else {
      setSelectedTemplateForOptions(template);
      setShowEditOptions(true);
    }
  };

  const handleNewTemplateClick = () => {
    setShowNewOptions(true);
  };

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
        {/* Connection Error Banner */}
        {connectionError && (
          <div className="border-b border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <WifiOff className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                  <p className="text-sm text-red-700 mt-1">{connectionError}</p>
                </div>
              </div>
              <button
                onClick={handleRetryConnection}
                className="inline-flex items-center px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="border-b border-gray-200/50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Template Library</h2>
                <p className="text-sm text-gray-600">Manage and organize your document templates</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {refreshing && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Refreshing...</span>
                </div>
              )}
              {connectionError ? (
                <div className="flex items-center space-x-2 text-sm text-red-600">
                  <WifiOff className="w-4 h-4" />
                  <span>Offline</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span>Connected</span>
                </div>
              )}
              <button
                onClick={loadFreshTemplateData}
                disabled={refreshing}
                className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh Templates"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleNewTemplateClick}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 hover:shadow-md touch-manipulation"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="border-b border-gray-200/50 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm appearance-none bg-white"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : connectionError && templatesData.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-red-100 to-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">
                Unable to load templates
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto leading-relaxed px-4">
                There was a problem connecting to the database. Please check your internet connection and try again.
              </p>
              <button
                onClick={handleRetryConnection}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 touch-manipulation"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Folder className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">
                {searchTerm || selectedCategory !== 'all' ? 'No templates found' : 'No templates yet'}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto leading-relaxed px-4">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Create your first template to get started with document automation.'
                }
              </p>
              {!searchTerm && selectedCategory === 'all' && (
                <button
                  onClick={handleNewTemplateClick}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 touch-manipulation"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Template
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  categories={categories}
                  onSelect={() => onTemplateSelect(template)}
                  onDelete={() => onTemplateDelete(template.id)}
                  onUpdate={(updates) => onTemplateUpdate(template.id, updates)}
                  onShowVersionHistory={() => handleShowVersionHistory(template)}
                  onShowNewVersion={() => handleShowNewVersion(template)}
                  onDownload={() => handleDownloadTemplate(template)}
                  onViewOptions={() => handleViewTemplate(template)}
                  onEditOptions={() => handleEditTemplate(template)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Version Manager Modal */}
      {showVersionManager && (
        <TemplateVersionManager
          templateId={showVersionManager.templateId}
          templateName={showVersionManager.templateName}
          currentVersion={showVersionManager.currentVersion}
          initialMode={showVersionManager.mode}
          onClose={handleVersionManagerClose}
          onVersionUpdate={handleVersionUpdate}
        />
      )}

      {/* View Options Modal */}
      {showViewOptions && selectedTemplateForOptions && (
        <TemplateViewOptions
          isOpen={showViewOptions}
          onClose={() => setShowViewOptions(false)}
          onDownload={() => {
            handleDownloadTemplate(selectedTemplateForOptions);
            setShowViewOptions(false);
          }}
          onOpenInEditor={() => {
            // Instead of opening the editor directly, select the template to go to document editor
            onTemplateSelect(selectedTemplateForOptions);
            setShowViewOptions(false);
          }}
          templateName={selectedTemplateForOptions.name}
        />
      )}

      {/* Edit Options Modal */}
      {showEditOptions && selectedTemplateForOptions && (
        <TemplateEditOptions
          isOpen={showEditOptions}
          onClose={() => setShowEditOptions(false)}
          onUploadNewVersion={() => {
            handleShowNewVersion(selectedTemplateForOptions);
            setShowEditOptions(false);
          }}
          onEditInOnlyOffice={() => {
            // Instead of opening the editor directly, select the template to go to document editor
            onTemplateSelect(selectedTemplateForOptions);
            setShowEditOptions(false);
          }}
          templateName={selectedTemplateForOptions.name}
        />
      )}

      {/* New Template Options Modal */}
      {showNewOptions && (
        <NewTemplateOptions
          isOpen={showNewOptions}
          onClose={() => setShowNewOptions(false)}
          onUploadTemplate={() => {
            onNewTemplate();
            setShowNewOptions(false);
          }}
          onCreateInEditor={() => {
            // Go to document editor step directly
            onNewTemplate();
            setShowNewOptions(false);
          }}
        />
      )}
    </>
  );
};

interface TemplateCardProps {
  template: any; // Using any to access database fields directly
  categories: TemplateCategory[];
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<DocumentTemplate>) => void;
  onShowVersionHistory: () => void;
  onShowNewVersion: () => void;
  onDownload: () => void;
  onViewOptions: () => void;
  onEditOptions: () => void;
  formatDate: (date: Date | string) => string;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  categories,
  onSelect,
  onDelete,
  onUpdate,
  onShowVersionHistory,
  onShowNewVersion,
  onDownload,
  onViewOptions,
  onEditOptions,
  formatDate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: template.name,
    description: template.description || '',
    category: template.category?.name || ''
  });

  const handleSaveEdit = () => {
    if (editData.name.trim() && editData.name !== template.name) {
      const updates: any = { name: editData.name.trim() };
      
      if (editData.description !== template.description) {
        updates.description = editData.description.trim();
      }
      
      if (editData.category !== template.category?.name) {
        updates.category = editData.category.trim();
      }
      
      onUpdate(updates);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditData({
      name: template.name,
      description: template.description || '',
      category: template.category?.name || ''
    });
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    if (confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      onDelete();
    }
  };

  // Get version notes from the latest version or metadata
  const getVersionNotes = () => {
    // Check if this is the first version
    if ((template.current_version || template.version || 1) === 1) {
      return 'Original Version';
    }
    
    // Try to get version notes from metadata or description
    if (template.metadata?.version_notes) {
      return template.metadata.version_notes;
    }
    
    if (template.description) {
      return template.description;
    }
    
    return 'No notes available';
  };

  // Get the current version number
  const getCurrentVersion = () => {
    return template.current_version || template.version || 1;
  };

  // Get total versions
  const getTotalVersions = () => {
    return template.total_versions || 1;
  };

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Header with badges */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            ) : (
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight">
                {template.name}
              </h3>
            )}
          </div>
          
          {/* Version Badge */}
          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 flex-shrink-0">
            <GitBranch className="w-3 h-3 mr-1" />
            v{getCurrentVersion()}
            {getTotalVersions() > 1 && (
              <span className="text-gray-500 ml-1">/{getTotalVersions()}</span>
            )}
          </span>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {template.is_default && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <Star className="w-3 h-3 mr-1" />
              Default
            </span>
          )}
          {template.category && (
            <span 
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: template.category.color || '#3B82F6' }}
            >
              {template.category.name}
            </span>
          )}
        </div>

        {/* File info */}
        <div className="text-xs text-gray-500 flex items-center space-x-3">
          <span className="flex items-center">
            <FileText className="w-3 h-3 mr-1" />
            {template.file_type?.toUpperCase() || 'DOCX'}
          </span>
          <span className="flex items-center">
            <Tag className="w-3 h-3 mr-1" />
            {template.tags?.length || 0}
          </span>
          <span className="flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {formatDate(template.updated_at)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {isEditing ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-none"
                rows={2}
                placeholder="Optional description..."
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={editData.category}
                onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Enter category name..."
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-2 py-1 border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Description */}
            {template.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Description:</p>
                <p className="text-xs text-gray-600 line-clamp-2">{template.description}</p>
              </div>
            )}
            
            {/* Version Notes */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Version Notes:</p>
              <p className="text-xs text-gray-600 line-clamp-2">
                {getVersionNotes()}
              </p>
            </div>

            {/* File Name */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">File Name:</p>
              <p className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                {template.original_filename}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="p-4 pt-0 space-y-2">
          {/* Primary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onViewOptions}
              className="flex items-center justify-center px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
              title="View Template"
            >
              <Eye className="w-3 h-3 mr-1" />
              View
            </button>
            
            <button
              onClick={onEditOptions}
              className="flex items-center justify-center px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-cyan-700 transition-all duration-200"
              title="Edit Template"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onSelect}
              className="flex items-center justify-center px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-xs font-medium hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
              title="Use Template"
            >
              <FileText className="w-3 h-3 mr-1" />
              Use
            </button>
            
            <button
              onClick={onShowVersionHistory}
              className="flex items-center justify-center px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg text-xs font-medium hover:from-orange-700 hover:to-red-700 transition-all duration-200"
              title="Version History"
            >
              <GitBranch className="w-3 h-3 mr-1" />
              History
            </button>
          </div>

          {/* Edit/Delete Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Rename
            </button>
            <button
              onClick={handleDeleteClick}
              className="flex items-center justify-center px-3 py-2 border border-red-300 text-red-700 rounded-lg text-xs hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};