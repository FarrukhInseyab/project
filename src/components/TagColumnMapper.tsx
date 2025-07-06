import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Database, 
  Tag, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Brain, 
  Zap,
  Save,
  Eye,
  EyeOff,
  Info,
  Sparkles,
  Target,
  TrendingUp,
  Award,
  Star,
  RotateCcw,
  GitBranch,
  Plus
} from 'lucide-react';
import { Tag as TagType } from '../types';
import { supabase } from '../lib/supabase';
import { DataMappingService } from '../services/dataMappingService';
import { TemplateVersionService } from '../services/templateVersionService';

interface TagColumnMapperProps {
  tags: TagType[];
  templateId?: string;
  currentVersion?: number;
  onMappingComplete: (mappings: TagColumnMapping[]) => void;
  onBack: () => void;
}

interface TagColumnMapping {
  tagId: string;
  tagName: string;
  columnName: string;
  confidence: number;
  isManual: boolean;
}

interface PoDAPIColumn {
  name: string;
  type: string;
  sample_values: string[];
}

export const TagColumnMapper: React.FC<TagColumnMapperProps> = ({
  tags,
  templateId,
  currentVersion = 1,
  onMappingComplete,
  onBack,
}) => {
  const [columns, setColumns] = useState<PoDAPIColumn[]>([]);
  const [mappings, setMappings] = useState<TagColumnMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [hasMappings, setHasMappings] = useState(false);
  const [willCreateNewVersion, setWillCreateNewVersion] = useState(false);

  const loadColumnsAndMappings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use DataMappingService to get available columns
      try {
        const availableColumns = await DataMappingService.getAvailableColumns();
        
        // Check if availableColumns is an array of strings or objects
        if (Array.isArray(availableColumns)) {
          const processedColumns = availableColumns.map(col => {
            // If col is a string, create an object with name and type
            if (typeof col === 'string') {
              return {
                name: col,
                type: 'text',
                sample_values: []
              };
            }
            // If col is already an object with name and type properties
            else if (typeof col === 'object' && col.name) {
              return {
                name: col.name,
                type: col.type || 'text',
                sample_values: col.sample_values || []
              };
            }
            // Fallback for unexpected format
            else {
              return {
                name: String(col),
                type: 'text',
                sample_values: []
              };
            }
          });
          setColumns(processedColumns);
        } else {
          throw new Error('Invalid columns format received from service');
        }
      } catch (columnError) {
        console.error('Error fetching columns from service:', columnError);
        // Fallback to known columns from schema
        const knownColumns = [
          { name: 'referenceno', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'time', type: 'text' },
          { name: 'bank', type: 'text' },
          { name: 'customername', type: 'text' },
          { name: 'nationalid', type: 'bigint' },
          { name: 'customerno', type: 'bigint' },
          { name: 'personalfinanceno', type: 'bigint' },
          { name: 'accountno', type: 'text' },
          { name: 'Status', type: 'text' }
        ];
        setColumns(knownColumns.map(col => ({
          name: col.name,
          type: col.type,
          sample_values: []
        })));
      }

      // Get sample data for preview
      const { data: sampleData, error: sampleError } = await supabase
        .from('ProofofDebitAPI')
        .select('*')
        .limit(3);

      if (!sampleError && sampleData) {
        setPreviewData(sampleData);
      }

      // Check if current version has mappings
      if (templateId) {
        const hasExistingMappings = await DataMappingService.templateVersionHasMappings(templateId, currentVersion);
        setHasMappings(hasExistingMappings);
        setWillCreateNewVersion(hasExistingMappings);

        if (hasExistingMappings) {
          // Load existing mappings for current version
          const existingMappings = await DataMappingService.getTemplateVersionMappings(templateId, currentVersion);
          
          const mappingsWithTagInfo = existingMappings.map(mapping => ({
            tagId: mapping.tag_name, // Using tag_name as tagId for now
            tagName: mapping.tag_name,
            columnName: mapping.data_key,
            confidence: Number(mapping.mapping_confidence) || 0,
            isManual: mapping.is_manual || false
          }));

          setMappings(mappingsWithTagInfo);
        } else {
          // Initialize empty mappings for all tags
          const initialMappings = tags.map(tag => ({
            tagId: tag.id,
            tagName: tag.name,
            columnName: '',
            confidence: 0,
            isManual: false
          }));
          setMappings(initialMappings);
        }
      } else {
        // Initialize empty mappings for all tags
        const initialMappings = tags.map(tag => ({
          tagId: tag.id,
          tagName: tag.name,
          columnName: '',
          confidence: 0,
          isManual: false
        }));
        setMappings(initialMappings);
      }

    } catch (err) {
      console.error('Error loading columns and mappings:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (tagId: string, columnName: string) => {
    setMappings(prev => prev.map(mapping => 
      mapping.tagId === tagId 
        ? { ...mapping, columnName, isManual: true, confidence: 1.0 }
        : mapping
    ));
  };

  const generateAutoMappings = async () => {
    setRegenerating(true);
    try {
      // Simple auto-mapping logic based on name similarity
      const autoMappings = tags.map(tag => {
        const tagNameLower = tag.name.toLowerCase();
        const bestMatch = columns.find(col => {
          const colNameLower = col.name.toLowerCase();
          return colNameLower.includes(tagNameLower) || 
                 tagNameLower.includes(colNameLower) ||
                 (tagNameLower === 'customer_name' && colNameLower === 'customername') ||
                 (tagNameLower === 'customer_no' && colNameLower === 'customerno') ||
                 (tagNameLower === 'account_no' && colNameLower === 'accountno') ||
                 (tagNameLower === 'reference_no' && colNameLower === 'referenceno') ||
                 (tagNameLower === 'national_id' && colNameLower === 'nationalid');
        });

        return {
          tagId: tag.id,
          tagName: tag.name,
          columnName: bestMatch?.name || '',
          confidence: bestMatch ? 0.8 : 0,
          isManual: false
        };
      });

      setMappings(autoMappings);
    } catch (err) {
      console.error('Error generating auto mappings:', err);
      setError('Failed to generate automatic mappings.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (!templateId) {
      onMappingComplete(mappings);
      return;
    }

    setSaving(true);
    try {
      // Filter out mappings with empty column names
      const validMappings = mappings.filter(mapping => mapping.columnName);
      
      if (validMappings.length === 0) {
        setError('Please map at least one tag to a column before saving.');
        return;
      }

      let targetVersion = currentVersion;

      // If current version has mappings, create a new version
      if (willCreateNewVersion && hasMappings) {
        console.log('🔄 Creating new template version for updated mappings...');
        
        // Get current template data
        const { TemplateService } = await import('../services/templateService');
        const template = await TemplateService.getTemplate(templateId);
        
        // Create new version with same content but new mappings
        const newVersionId = await TemplateVersionService.createNewVersion(
          templateId,
          new File([new ArrayBuffer(0)], template.original_filename), // Placeholder file
          template.document_content,
          template.document_html,
          template.storage_path || '',
          'Updated mappings'
        );
        
        // Get the new version number
        const versionHistory = await TemplateVersionService.getVersionHistory(templateId);
        const latestVersion = versionHistory.find(v => v.is_current);
        targetVersion = latestVersion?.version_number || currentVersion + 1;
        
        console.log('✅ New template version created:', targetVersion);
      }

      // Save mappings for the target version
      await DataMappingService.saveTemplateMappings(templateId, targetVersion, validMappings);

      onMappingComplete(mappings);
    } catch (err) {
      console.error('Error saving mappings:', err);
      setError('Failed to save mappings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetMappings = () => {
    const resetMappings = tags.map(tag => ({
      tagId: tag.id,
      tagName: tag.name,
      columnName: '',
      confidence: 0,
      isManual: false
    }));
    setMappings(resetMappings);
  };

  useEffect(() => {
    loadColumnsAndMappings();
  }, [templateId, tags, currentVersion]);

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-lg font-medium text-gray-700">Loading mappings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
        <div className="flex items-center justify-center space-x-3 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <span className="text-lg font-medium">{error}</span>
        </div>
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadColumnsAndMappings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const mappedCount = mappings.filter(m => m.columnName).length;
  const totalTags = tags.length;
  const completionPercentage = totalTags > 0 ? Math.round((mappedCount / totalTags) * 100) : 0;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Tag-Column Mapping</h2>
              <div className="flex items-center space-x-2">
                <p className="text-gray-600">Map template tags to database columns</p>
                {templateId && (
                  <div className="flex items-center space-x-1 text-sm text-blue-600">
                    <GitBranch className="w-4 h-4" />
                    <span>v{currentVersion}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{mappedCount}/{totalTags}</div>
              <div className="text-sm text-gray-500">Tags Mapped</div>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="2"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray={`${completionPercentage}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-700">{completionPercentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Version Info */}
        {willCreateNewVersion && hasMappings && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center space-x-2">
              <Plus className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Saving will create version {currentVersion + 1} with new mappings
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 border-b border-gray-200/50 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={generateAutoMappings}
              disabled={regenerating}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50"
            >
              {regenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              <span>Auto-Map</span>
            </button>
            <button
              onClick={resetMappings}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Data */}
      {showPreview && previewData.length > 0 && (
        <div className="p-6 border-b border-gray-200/50 bg-blue-50/30">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Info className="w-5 h-5 mr-2 text-blue-600" />
            Sample Data Preview
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(column => (
                    <th key={column.name} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {columns.map(column => (
                      <td key={column.name} className="px-4 py-2 text-sm text-gray-900">
                        {row[column.name] !== undefined ? String(row[column.name]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mapping Interface */}
      <div className="p-6">
        <div className="space-y-4">
          {mappings.map((mapping) => (
            <div
              key={mapping.tagId}
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-200"
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Tag className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{mapping.tagName}</div>
                    <div className="text-sm text-gray-500">Template Tag</div>
                  </div>
                </div>
                
                <ArrowRight className="w-5 h-5 text-gray-400" />
                
                <div className="flex items-center space-x-3">
                  <select
                    value={mapping.columnName}
                    onChange={(e) => handleMappingChange(mapping.tagId, e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
                  >
                    <option value="">Select Column</option>
                    {columns.map(column => (
                      <option key={column.name} value={column.name}>
                        {column.name} ({column.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {mapping.columnName && (
                  <div className="flex items-center space-x-2">
                    {mapping.isManual ? (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Manual</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-blue-600">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">Auto ({Math.round(mapping.confidence * 100)}%)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200/50 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600">
              {mappedCount} of {totalTags} tags mapped
            </div>
            <button
              onClick={handleSave}
              disabled={saving || mappedCount === 0}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {saving ? 'Saving...' : willCreateNewVersion && hasMappings 
                  ? 'Save & Create New Version' 
                  : 'Save Mappings'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};