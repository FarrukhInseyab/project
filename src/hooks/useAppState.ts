import { useState, useEffect } from 'react';
import { AppState, Tag, Mapping, IncomingData, DocumentTemplate } from '../types';
import { TemplateService } from '../services/templateService';
import { ActivityService } from '../services/activityService';
import { StorageService } from '../services/storageService';
import { DataMappingService } from '../services/dataMappingService';
import { setOriginalDocumentBuffer } from '../utils/documentUtils';

const initialState: AppState = {
  currentStep: 0,
  documentContent: '',
  documentHtml: '',
  tags: [],
  incomingData: {},
  mappings: [],
  populatedContent: '',
  templates: [],
  podapiCustomerNos: [],
};

export const useAppState = () => {
  const [state, setState] = useState<AppState>(initialState);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load templates from database on mount
  useEffect(() => {
    loadTemplatesFromDB();
  }, []);

  const loadTemplatesFromDB = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const templates = await TemplateService.getTemplates();
      setState(prev => ({ ...prev, templates: templates || [] }));
      setStatusMessage('Templates loaded successfully');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setErrorMessage('Failed to load templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const addTag = (tag: Tag) => {
    setState(prev => ({
      ...prev,
      tags: [...prev.tags, tag]
    }));
  };

  const updateTag = (tagId: string, updates: Partial<Tag>) => {
    setState(prev => ({
      ...prev,
      tags: prev.tags.map(tag => 
        tag.id === tagId ? { ...tag, ...updates } : tag
      )
    }));
  };

  const removeTag = (tagId: string) => {
    setState(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag.id !== tagId),
      mappings: prev.mappings.filter(mapping => mapping.tagId !== tagId)
    }));
  };

  const addMapping = (mapping: Mapping) => {
    setState(prev => ({
      ...prev,
      mappings: [...prev.mappings.filter(m => m.tagId !== mapping.tagId), mapping]
    }));
  };

  const removeMapping = (tagId: string) => {
    setState(prev => ({
      ...prev,
      mappings: prev.mappings.filter(mapping => mapping.tagId !== tagId)
    }));
  };

  const setIncomingData = (data: IncomingData, podapiCustomerNos?: string[]) => {
    setState(prev => ({ 
      ...prev, 
      incomingData: data,
      podapiCustomerNos: podapiCustomerNos || prev.podapiCustomerNos
    }));
  };

  // Template management functions with storage integration
  const addTemplate = async (templateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setStatusMessage('Saving template...');
      
      let categoryId = null;
      
      // Handle category - convert category name to category_id
      if (templateData.category) {
        // Get existing categories
        const categories = await TemplateService.getCategories();
        
        // Look for existing category with the same name
        const existingCategory = categories.find(cat => 
          cat.name.toLowerCase() === templateData.category.toLowerCase()
        );
        
        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          // Create new category
          const newCategory = await TemplateService.createCategory({
            name: templateData.category,
            description: `Category for ${templateData.category} templates`,
            color: '#3B82F6',
            icon: 'folder',
            sort_order: 0
          });
          categoryId = newCategory.id;
        }
      }
      
      // Convert local template format to database format
      const dbTemplate = {
        name: templateData.name,
        description: templateData.description,
        original_filename: templateData.originalFileName,
        document_content: templateData.documentContent,
        document_html: templateData.documentHtml,
        category_id: categoryId,
        is_default: templateData.isDefault || false,
        file_size: templateData.documentContent.length,
        file_type: 'docx',
        metadata: {}
      };

      // Save template to database first
      const savedTemplate = await TemplateService.createTemplate(dbTemplate);
      
      // Upload original DOCX file to storage
      if (state.originalFile) {
        try {
          const storagePath = await StorageService.uploadTemplate(state.originalFile, savedTemplate.id);
          
          // Update template with storage path
          await TemplateService.updateTemplate(savedTemplate.id, {
            storage_path: storagePath
          });
          
          console.log('✅ Original DOCX file uploaded to templates bucket:', storagePath);
        } catch (uploadError) {
          console.error('⚠️ Failed to upload original file to storage:', uploadError);
          // Continue without failing the entire operation
        }
      }
      
      // Save tags to database
      if (templateData.tags && templateData.tags.length > 0) {
        const dbTags = templateData.tags.map(tag => ({
          name: tag.name,
          display_name: tag.displayName,
          description: tag.description,
          expected_value: tag.expectedValue,
          data_type: 'text' as const,
          is_required: false,
          validation_rules: {}
        }));
        
        await TemplateService.createTemplateTags(savedTemplate.id, dbTags);
      }

      // Save tag-column mappings if they exist
      if (state.mappings && state.mappings.length > 0) {
        try {
          const tagColumnMappings = state.mappings.map(mapping => {
            const tag = state.tags.find(t => t.id === mapping.tagId);
            return {
              tagId: mapping.tagId,
              tagName: tag?.name || mapping.tagId,
              columnName: mapping.dataKey,
              confidence: mapping.confidence || 1.0,
              isManual: mapping.isManual || true
            };
          });
          
          // Save mappings for version 1 (initial version)
          await DataMappingService.saveTemplateMappings(savedTemplate.id, 1, tagColumnMappings);
          console.log('✅ Tag-column mappings saved for initial version');
        } catch (mappingError) {
          console.error('⚠️ Failed to save mappings:', mappingError);
          // Continue without failing the entire operation
        }
      }

      // Log activity
      await ActivityService.logActivity('template_created', 'template', savedTemplate.id, {
        template_name: templateData.name,
        tags_count: templateData.tags?.length || 0
      });

      // Reload templates from database
      await loadTemplatesFromDB();
      
      setStatusMessage('Template saved successfully!');
      setTimeout(() => setStatusMessage(null), 5000);
      
      return savedTemplate;
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrorMessage('Failed to save template. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = async (templateId: string, updates: Partial<DocumentTemplate>) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setStatusMessage('Updating template...');
      
      // Convert updates to database format
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.description) dbUpdates.description = updates.description;
      if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;
      
      // Handle category update
      if (updates.category) {
        const categories = await TemplateService.getCategories();
        const existingCategory = categories.find(cat => 
          cat.name.toLowerCase() === updates.category.toLowerCase()
        );
        
        if (existingCategory) {
          dbUpdates.category_id = existingCategory.id;
        } else {
          const newCategory = await TemplateService.createCategory({
            name: updates.category,
            description: `Category for ${updates.category} templates`,
            color: '#3B82F6',
            icon: 'folder',
            sort_order: 0
          });
          dbUpdates.category_id = newCategory.id;
        }
      }

      await TemplateService.updateTemplate(templateId, dbUpdates);
      
      // Log activity
      await ActivityService.logActivity('template_updated', 'template', templateId, {
        updates: Object.keys(dbUpdates)
      });

      // Reload templates from database
      await loadTemplatesFromDB();
      
      setStatusMessage('Template updated successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update template:', error);
      setErrorMessage('Failed to update template. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setStatusMessage('Deleting template...');
      
      // Get template to find storage path
      const template = await TemplateService.getTemplate(templateId);
      
      // Delete from storage if exists
      if (template.storage_path) {
        try {
          await StorageService.deleteTemplate(template.storage_path);
          console.log('✅ Template file deleted from storage');
        } catch (storageError) {
          console.error('⚠️ Failed to delete template file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }
      
      // Delete from database
      await TemplateService.deleteTemplate(templateId);
      
      // Log activity
      await ActivityService.logActivity('template_deleted', 'template', templateId);

      // Reload templates from database
      await loadTemplatesFromDB();
      
      setStatusMessage('Template deleted successfully');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete template:', error);
      setErrorMessage('Failed to delete template. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async (template: DocumentTemplate) => {
    try {
      setStatusMessage('Loading template...');
      console.log('🔄 Loading template with fresh data from database...');
      
      // CRITICAL: Always load the LATEST template data from database
      // This ensures we get the most recent version after any updates
      const fullTemplate = await TemplateService.getTemplate(template.id);
      console.log('📋 Loaded template from database:', {
        id: fullTemplate.id,
        name: fullTemplate.name,
        current_version: fullTemplate.current_version,
        total_versions: fullTemplate.total_versions,
        tags_count: fullTemplate.tags?.length || 0,
        storage_path: fullTemplate.storage_path
      });
      
      // CRITICAL: Convert database format to local format - ALWAYS use fresh data
      const localTags = fullTemplate.tags?.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        displayName: tag.display_name,
        description: tag.description,
        expectedValue: tag.expected_value
      })) || [];

      console.log('🏷️ Converted tags for local use:', localTags);

      // CRITICAL: Handle original DOCX file properly
      let originalFile: File | undefined = undefined;
      
      // Try to download the original DOCX file from storage
      if (fullTemplate.storage_path) {
        try {
          console.log('📥 Downloading latest DOCX file from templates bucket...');
          const fileBuffer = await StorageService.downloadTemplate(fullTemplate.storage_path);
          
          // Set the original document buffer for document generation
          setOriginalDocumentBuffer(fileBuffer);
          
          // Create File object from the downloaded buffer
          const blob = new Blob([fileBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          });
          originalFile = new File([blob], fullTemplate.original_filename, { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          });
          
          console.log('✅ Latest DOCX file loaded from templates bucket');
        } catch (storageError) {
          console.error('⚠️ Failed to download original file from storage:', storageError);
          
          // CRITICAL: Don't create a fake File object - leave it undefined
          // This allows the UI to properly handle the missing file case
          originalFile = undefined;
          
          setErrorMessage('Original DOCX file not available. You can view the template content but cannot generate documents until you upload a new version.');
        }
      } else {
        console.warn('⚠️ No storage path found for template - original DOCX file not available');
        originalFile = undefined;
        setErrorMessage('Original DOCX file not available. You can view the template content but cannot generate documents until you upload a new version.');
      }

      // CRITICAL: Use the LATEST content and tags from database
      setState(prev => ({
        ...prev,
        documentContent: fullTemplate.document_content,  // ← LATEST CONTENT
        documentHtml: fullTemplate.document_html,        // ← LATEST HTML
        originalFile: originalFile,                      // ← ACTUAL FILE OR UNDEFINED
        tags: localTags,                                 // ← LATEST TAGS
        selectedTemplate: {
          ...template,
          tags: localTags,                               // ← LATEST TAGS
          originalFilePath: fullTemplate.storage_path,
          version: fullTemplate.current_version,         // ← LATEST VERSION
          totalVersions: fullTemplate.total_versions
        },
        currentStep: 1, // Move to tag management step
        // Reset other state
        incomingData: {},
        mappings: [],
        populatedContent: '',
        podapiCustomerNos: [] // Reset PoDAPI customer numbers
      }));

      console.log('✅ Template loaded with latest version data');
      console.log('🏷️ Tags in state:', localTags.length);
      console.log('📄 Original file available:', !!originalFile);

      // Log template usage
      await TemplateService.incrementUsageCount(template.id);
      await ActivityService.logActivity('template_used', 'template', template.id, {
        template_name: template.name,
        version_used: fullTemplate.current_version
      });
      
      if (originalFile) {
        setStatusMessage('Template loaded successfully!');
      } else {
        setStatusMessage('Template loaded (content only - upload new version to enable document generation)');
      }
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (error) {
      console.error('Failed to load template:', error);
      setErrorMessage('Failed to load template. Please try again.');
      throw error;
    }
  };

  // CRITICAL: Add a function to refresh current template data
  const refreshCurrentTemplate = async () => {
    if (state.selectedTemplate) {
      console.log('🔄 Refreshing current template data...');
      try {
        setStatusMessage('Refreshing template data...');
        // Reload the current template with fresh data
        await loadTemplate(state.selectedTemplate);
        console.log('✅ Current template refreshed successfully');
      } catch (error) {
        console.error('❌ Failed to refresh current template:', error);
        setErrorMessage('Failed to refresh template data.');
      }
    }
  };

  const nextStep = () => {
    setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
  };

  const prevStep = () => {
    setState(prev => ({ ...prev, currentStep: Math.max(0, prev.currentStep - 1) }));
  };

  const goToStep = (step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const clearMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  return {
    state,
    loading,
    statusMessage,
    errorMessage,
    updateState,
    addTag,
    updateTag,
    removeTag,
    addMapping,
    removeMapping,
    setIncomingData,
    addTemplate,
    updateTemplate,
    removeTemplate,
    loadTemplate,
    refreshCurrentTemplate,
    nextStep,
    prevStep,
    goToStep,
    refreshTemplates: loadTemplatesFromDB,
    clearMessages,
  };
};