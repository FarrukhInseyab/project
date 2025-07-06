import React, { useState } from 'react';
import { Tag as TagType } from '../types';
import { 
  Tag, 
  Edit2, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  Sparkles, 
  Brain, 
  CheckCircle, 
  Info, 
  AlertTriangle, 
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  Copy,
  Zap
} from 'lucide-react';

interface TagManagerProps {
  tags: TagType[];
  onTagUpdate: (tagId: string, updates: Partial<TagType>) => void;
  onTagRemove: (tagId: string) => void;
  onTagAdd: (tag: Omit<TagType, 'id'>) => void;
}

export const TagManager: React.FC<TagManagerProps> = ({
  tags,
  onTagUpdate,
  onTagRemove,
  onTagAdd,
}) => {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState({
    name: '',
    displayName: '',
    description: '',
    expectedValue: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'displayName'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<string>('all');

  const handleEditTag = (tag: TagType) => {
    setEditingTag(tag.id);
  };

  const handleSaveTag = (tagId: string, updates: Partial<TagType>) => {
    onTagUpdate(tagId, updates);
    setEditingTag(null);
  };

  const handleAddTag = () => {
    if (!newTag.name.trim()) return;
    
    const tag: Omit<TagType, 'id'> = {
      name: newTag.name.trim(),
      displayName: newTag.displayName.trim() || newTag.name.trim(),
      description: newTag.description.trim(),
      expectedValue: newTag.expectedValue.trim(),
    };
    
    onTagAdd(tag);
    setNewTag({ name: '', displayName: '', description: '', expectedValue: '' });
    setIsAddingTag(false);
  };

  const handleCopyTag = (tag: TagType) => {
    const newTagData = {
      name: `${tag.name}_copy`,
      displayName: `${tag.displayName} (Copy)`,
      description: tag.description,
      expectedValue: tag.expectedValue,
    };
    
    onTagAdd(newTagData);
  };

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  // Filter and sort tags
  const filteredTags = tags
    .filter(tag => {
      const matchesSearch = 
        tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tag.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tag.description && tag.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesFilter = 
        filterType === 'all' || 
        (filterType === 'withDescription' && tag.description) ||
        (filterType === 'withoutDescription' && !tag.description) ||
        (filterType === 'withExpectedValue' && tag.expectedValue) ||
        (filterType === 'withoutExpectedValue' && !tag.expectedValue);
      
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const valueA = sortBy === 'name' ? a.name.toLowerCase() : a.displayName.toLowerCase();
      const valueB = sortBy === 'name' ? b.name.toLowerCase() : b.displayName.toLowerCase();
      
      if (sortDirection === 'asc') {
        return valueA.localeCompare(valueB);
      } else {
        return valueB.localeCompare(valueA);
      }
    });

  // Get unique expected value types for filtering
  const expectedValueTypes = Array.from(
    new Set(
      tags
        .filter(tag => tag.expectedValue)
        .map(tag => tag.expectedValue?.toLowerCase())
    )
  );

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      {/* Enhanced Header */}
      <div className="border-b border-gray-200/50 p-4 sm:p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Tag Management</h2>
              <p className="text-sm text-gray-600">Review and customize your document tags</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 bg-white/60 backdrop-blur-sm rounded-xl border border-emerald-200">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">{tags.length} Tags</span>
            </div>
            <button
              onClick={() => setIsAddingTag(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 hover:shadow-md touch-manipulation"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tag
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="border-b border-gray-200/50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm"
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm appearance-none bg-white"
            >
              <option value="all">All Tags</option>
              <option value="withDescription">With Description</option>
              <option value="withoutDescription">Without Description</option>
              <option value="withExpectedValue">With Expected Value</option>
              <option value="withoutExpectedValue">Without Expected Value</option>
              {expectedValueTypes.map(type => (
                <option key={type} value={`type_${type}`}>Type: {type}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'displayName')}
              className="px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm"
            >
              <option value="name">Sort by Tag Name</option>
              <option value="displayName">Sort by Display Name</option>
            </select>
            <button
              onClick={toggleSortDirection}
              className="px-3 py-2 border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
            >
              {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {isAddingTag && (
          <div className="mb-6 p-6 border border-emerald-200 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-emerald-900">Add New Tag</h3>
              </div>
              <button
                onClick={() => {
                  setIsAddingTag(false);
                  setNewTag({ name: '', displayName: '', description: '', expectedValue: '' });
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tag Name * <span className="text-xs font-normal text-gray-500">(used in document as £tag_name£)</span>
                </label>
                <input
                  type="text"
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base"
                  placeholder="e.g., client_name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use lowercase with underscores for spaces
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Display Name <span className="text-xs font-normal text-gray-500">(human-readable label)</span>
                </label>
                <input
                  type="text"
                  value={newTag.displayName}
                  onChange={(e) => setNewTag({ ...newTag, displayName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base"
                  placeholder="e.g., Client Name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Proper case with spaces for readability
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-xs font-normal text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newTag.description}
                  onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base"
                  placeholder="Brief description of this tag"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Expected Value Type <span className="text-xs font-normal text-gray-500">(optional)</span>
                </label>
                <select
                  value={newTag.expectedValue}
                  onChange={(e) => setNewTag({ ...newTag, expectedValue: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base"
                >
                  <option value="">Select value type...</option>
                  <option value="Text">Text</option>
                  <option value="Number">Number</option>
                  <option value="Date">Date</option>
                  <option value="Email">Email</option>
                  <option value="Phone">Phone</option>
                  <option value="Currency">Currency</option>
                  <option value="Percentage">Percentage</option>
                  <option value="Boolean">Boolean</option>
                </select>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={handleAddTag}
                disabled={!newTag.name.trim()}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Tag
              </button>
              <button
                onClick={() => {
                  setIsAddingTag(false);
                  setNewTag({ name: '', displayName: '', description: '', expectedValue: '' });
                }}
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 touch-manipulation"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tag Count and Info */}
        {!isAddingTag && (
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {filteredTags.length} {filteredTags.length === 1 ? 'Tag' : 'Tags'} 
                  {searchTerm && ` matching "${searchTerm}"`}
                  {filterType !== 'all' && ' (filtered)'}
                </h3>
                {tags.length > 0 && filteredTags.length === 0 && (
                  <span className="text-sm text-red-600">No matches found</span>
                )}
              </div>
              
              {tags.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Info className="w-4 h-4" />
                  <span>Click on a tag to edit</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tags.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">No Tags Detected Yet</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto leading-relaxed px-4">
              Upload a document with £tag£ format or create tags manually by selecting text in your document.
            </p>
            <button
              onClick={() => setIsAddingTag(true)}
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 touch-manipulation"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Tag
            </button>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Matching Tags</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
            >
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTags.map((tag) => (
              <TagCard
                key={tag.id}
                tag={tag}
                isEditing={editingTag === tag.id}
                onEdit={() => handleEditTag(tag)}
                onSave={(updates) => handleSaveTag(tag.id, updates)}
                onCancel={() => setEditingTag(null)}
                onRemove={() => onTagRemove(tag.id)}
                onCopy={() => handleCopyTag(tag)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface TagCardProps {
  tag: TagType;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<TagType>) => void;
  onCancel: () => void;
  onRemove: () => void;
  onCopy: () => void;
}

const TagCard: React.FC<TagCardProps> = ({
  tag,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  onCopy,
}) => {
  const [editData, setEditData] = useState({
    displayName: tag.displayName,
    description: tag.description || '',
    expectedValue: tag.expectedValue || '',
  });

  if (isEditing) {
    return (
      <div className="border border-blue-200 rounded-2xl p-6 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-blue-900 text-lg">Editing: £{tag.name}£</h3>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={editData.displayName}
              onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Expected Value Type
            </label>
            <select
              value={editData.expectedValue}
              onChange={(e) => setEditData({ ...editData, expectedValue: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
            >
              <option value="">Select value type...</option>
              <option value="Text">Text</option>
              <option value="Number">Number</option>
              <option value="Date">Date</option>
              <option value="Email">Email</option>
              <option value="Phone">Phone</option>
              <option value="Currency">Currency</option>
              <option value="Percentage">Percentage</option>
              <option value="Boolean">Boolean</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm resize-none"
              placeholder="Add a description for this tag..."
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={() => onSave(editData)}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 touch-manipulation"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 touch-manipulation"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-all duration-300 bg-white/60 backdrop-blur-sm hover:bg-white/80 cursor-pointer" onClick={onEdit}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300 shadow-sm">
              £{tag.name}£
            </span>
            
            {tag.expectedValue && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                {tag.expectedValue}
              </span>
            )}
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{tag.displayName}</h3>
          
          {tag.description ? (
            <p className="text-sm text-gray-600 mb-2">{tag.description}</p>
          ) : (
            <p className="text-sm text-gray-400 italic mb-2">No description</p>
          )}
          
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span>Ready for mapping</span>
          </div>
        </div>
        
        <div className="flex space-x-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 touch-manipulation"
            title="Duplicate Tag"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 touch-manipulation"
            title="Edit Tag"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Are you sure you want to delete the tag "${tag.displayName}"?`)) {
                onRemove();
              }
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 touch-manipulation"
            title="Delete Tag"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};