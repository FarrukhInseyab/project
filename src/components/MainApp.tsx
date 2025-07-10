import React from 'react';
import { useAppState } from '../hooks/useAppState';
import { StepIndicator } from './StepIndicator';
import { DocumentEditor } from './DocumentEditor';
import { TagManager } from './TagManager';
import { TagColumnMapper } from './TagColumnMapper';
import { DataImporter } from './DataImporter';
import { DocumentGenerator } from './DocumentGenerator';
import { TemplateManager } from './TemplateManager';
import { Dashboard } from './Dashboard';
import { UserProfile } from './UserProfile';
import { GeneratedDocuments } from './GeneratedDocuments';
import { SaveTemplateScreen } from './SaveTemplateScreen';
import { TemplateUpdateModal } from './TemplateUpdateModal';
import { populateContentWithMappings, extractTagsFromContent, convertPoundTagsToStandardTags, resetOriginalDocumentBuffer } from '../utils/documentUtils';
import { ArrowLeft, ArrowRight, Sparkles, Menu, X, Folder, BarChart3, LogOut, User, Upload, Archive, CheckCircle, AlertTriangle, Code } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DataMappingService } from '../services/dataMappingService';
import { ApiTester } from './ApiTester';
import { OnlyOfficeEditor } from './OnlyOfficeEditor';
import { NewTemplateOptions } from './NewTemplateOptions';
import { TemplateViewOptions } from './TemplateViewOptions';
import { TemplateEditOptions } from './TemplateEditOptions';
import { TemplateVersionService } from '../services/templateVersionService';
import { TemplateVersionManager } from './TemplateVersionManager';
import { OnlyOfficeService } from '../services/onlyOfficeService';

export const MainApp: React.FC = () => {
  const { signOut, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showUserProfile, setShowUserProfile] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<'dashboard' | 'templates' | 'workflow' | 'generated' | 'api'>('dashboard');
  const [tagColumnMappings, setTagColumnMappings] = React.useState<any[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = React.useState(false);
  const [showTemplateUpdateModal, setShowTemplateUpdateModal] = React.useState<{
    template: any;
    hasMappings: boolean;
  } | null>(null);
  const [showOnlyOfficeEditor, setShowOnlyOfficeEditor] = React.useState(false);
  const [onlyOfficeMode, setOnlyOfficeMode] = React.useState<'edit' | 'create' | 'view'>('create');
  const [showNewTemplateOptions, setShowNewTemplateOptions] = React.useState(false);
  const [showViewOptions, setShowViewOptions] = React.useState(false);
  const [showEditOptions, setShowEditOptions] = React.useState(false);
  const [selectedTemplateForOptions, setSelectedTemplateForOptions] = React.useState<any>(null);
  const [showVersionManager, setShowVersionManager] = React.useState<{
    templateId: string;
    templateName: string;
    currentVersion: number;
    mode: 'history' | 'upload';
  } | null>(null);
  
  const {
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
    clearMessages,
  } = useAppState();

  const handleFileUpload = (file: File, html: string) => {
    // Extract tags from the document content
    const extractedTags = extractTagsFromContent(html);
    
    // Keep the original content with £ tags - DO NOT CONVERT
    const originalContent = html;
    
    // Add extracted tags to the state
    extractedTags.forEach(tagData => {
      const newTag = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: tagData.name,
        displayName: tagData.displayName,
        description: tagData.description,
      };
      addTag(newTag);
    });

    updateState({
      originalFile: file,
      documentHtml: html,
      documentContent: originalContent, // Keep original £ format
    });

    // If tags were extracted, automatically move to the Tag Manager step
    if (extractedTags.length > 0) {
      console.log(`Auto-extracted ${extractedTags.length} tags, moving to Tag Manager`);
      setTimeout(() => {
        goToStep(1); // Move to Tag Manager step
      }, 500); // Small delay to allow state to update
    }
  };

  const handleTagCreate = (tagName: string, selectedText: string) => {
    const newTag = {
      id: Date.now().toString(),
      name: tagName,
      displayName: tagName,
      description: `Tag created from selected text: "${selectedText}"`,
    };
    
    addTag(newTag);
    
    // Replace selected text with £ tag in content
    const updatedContent = state.documentContent.replace(
      selectedText,
      `£${tagName}£`
    );
    updateState({ documentContent: updatedContent });
  };

  const handleAddTag = (tagData: any) => {
    const newTag = {
      id: Date.now().toString(),
      ...tagData,
    };
    addTag(newTag);
  };

  // Handle tag-column mapping completion
  const handleMappingComplete = (mappings: any[]) => {
    console.log('🔄 Tag-column mappings completed:', mappings);
    setTagColumnMappings(mappings);
    
    // CRITICAL: Store the mappings in state for later use
    // This ensures they're available when saving the template
    mappings.forEach(mapping => {
      const tag = state.tags.find(t => t.id === mapping.tagId || t.name === mapping.tagName);
      if (tag) {
        addMapping({
          tagId: tag.id,
          dataKey: mapping.columnName,
          dataValue: null, // Will be populated during data import
          confidence: mapping.confidence || 1.0,
          isManual: mapping.isManual || false
        });
      }
    });
    
    console.log('✅ Mappings stored in state for template saving');
    
    // Move to save template step if this is a new template
    if (!state.selectedTemplate) {
      setShowSaveTemplate(true);
    } else {
      // Move to data import step
      goToStep(2);
    }
  };

  // Auto-create mappings when data is imported
  const handleDataChange = (data: any, podapiCustomerNos?: string[]) => {
    setIncomingData(data, podapiCustomerNos);
    
    // Auto-create mappings based on tag names and data keys
    if (state.tags.length > 0 && Object.keys(data).length > 0) {
      console.log('Auto-creating mappings between tags and data...');
      
      state.tags.forEach(tag => {
        // Look for exact matches first
        const exactMatch = Object.keys(data).find(key => 
          key.toLowerCase() === tag.name.toLowerCase() ||
          key.toLowerCase().replace(/[_\s]/g, '') === tag.name.toLowerCase().replace(/[_\s]/g, '')
        );
        
        if (exactMatch) {
          const mapping = {
            tagId: tag.id,
            dataKey: exactMatch,
            dataValue: data[exactMatch],
            confidence: 1.0,
            isManual: false,
          };
          addMapping(mapping);
          console.log(`Auto-mapped tag "${tag.name}" to data key "${exactMatch}"`);
        } else {
          // Look for partial matches
          const partialMatch = Object.keys(data).find(key => 
            key.toLowerCase().includes(tag.name.toLowerCase()) ||
            tag.name.toLowerCase().includes(key.toLowerCase())
          );
          
          if (partialMatch) {
            const mapping = {
              tagId: tag.id,
              dataKey: partialMatch,
              dataValue: data[partialMatch],
              confidence: 0.8,
              isManual: false,
            };
            addMapping(mapping);
            console.log(`Auto-mapped tag "${tag.name}" to data key "${partialMatch}" (partial match)`);
          }
        }
      });
    }
  };

  const handleSaveTemplate = async (templateData: any) => {
    try {
      const savedTemplate = await addTemplate(templateData);
      console.log('Template saved successfully');
      
      // Close save template screen and go back to templates view
      setShowSaveTemplate(false);
      setCurrentView('templates');
      
      return savedTemplate;
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  };

  const handleSaveTemplateAndLoadData = async (templateData: any) => {
    try {
      const savedTemplate = await addTemplate(templateData);
      console.log('Template saved successfully, now loading fresh copy for data loading');
      
      // Load the fresh template from database (like selecting from template library)
      await loadTemplate(savedTemplate);
      
      // Close save template screen and go to data import step
      setShowSaveTemplate(false);
      goToStep(2);
      
      return savedTemplate;
    } catch (error) {
      console.error('Failed to save template and load data:', error);
      throw error;
    }
  };

  const handleSkipSaveTemplate = () => {
    setShowSaveTemplate(false);
    goToStep(2);
  };

  const handleTemplateSelect = async (template: any) => {
    try {
      console.log('🔍 Template selected:', template.name, 'Version:', template.current_version || template.version || 1);
      
      // Check if this template has existing mappings
      const templateVersion = template.current_version || template.version || 1;
      console.log(`🔍 Checking mappings for template ${template.id} version ${templateVersion}...`);
      
      // First try to debug mappings to see what's in the database
      try {
        const debugMappings = await DataMappingService.debugTemplateMappings(template.id);
        console.log('📊 Debug mappings result:', debugMappings);
      } catch (debugError) {
        console.log('⚠️ Debug mappings error:', debugError);
      }
      
      const hasMappings = await DataMappingService.templateVersionHasMappings(
        template.id, 
        templateVersion
      );
      
      console.log('🔍 Template mappings check result:', {
        templateId: template.id,
        version: templateVersion,
        hasMappings
      });

      if (!hasMappings) {
        // SCENARIO 1: No mappings exist - treat as new template, go to mapping screen
        console.log('📋 SCENARIO 1: No mappings found - treating as new template');
        await loadTemplate(template);
        setCurrentView('workflow');
        // Go to mapping step
        updateState({ currentStep: 1.5 });
      } else {
        // SCENARIO 2 & 3: Mappings exist - show update confirmation modal
        console.log('📋 SCENARIO 2/3: Mappings found - showing update confirmation');
        setShowTemplateUpdateModal({
          template,
          hasMappings
        });
      }
    } catch (error) {
      console.error('Failed to check template mappings:', error);
      // If we can't check mappings, just load the template normally
      await loadTemplate(template);
      setCurrentView('workflow');
    }
  };

  const handleViewTemplate = (template: any) => {
    setSelectedTemplateForOptions(template);
    setShowViewOptions(true);
  };

  const handleEditTemplate = (template: any) => {
    setSelectedTemplateForOptions(template);
    setShowEditOptions(true);
  };

  const handleOpenTemplateInEditor = async (template: any, viewMode = false) => {
    try {
      // Load OnlyOffice settings first to ensure we have the correct URL
      await OnlyOfficeService.loadSettings();
      
      // Load the template and open the editor in edit mode
      await loadTemplate(template);
      setOnlyOfficeMode(viewMode ? 'view' : 'edit');
      setShowOnlyOfficeEditor(true);
      console.log(`Opening template in editor for ${viewMode ? 'viewing' : 'editing'}:`, template.name);
    } catch (error) {
      console.error('Failed to edit template:', error);
    }
  };

  const handleDownloadTemplate = async (template: any) => {
    try {
      // Download the template
      await TemplateVersionService.downloadCurrentVersion(template.id);
      console.log('Template downloaded:', template.name);
    } catch (error) {
      console.error('Failed to download template:', error);
    }
  };

  const handleTemplateUpdateDecision = async (shouldUpdate: boolean) => {
    const { template, hasMappings } = showTemplateUpdateModal!;
    setShowTemplateUpdateModal(null);

    if (shouldUpdate) {
      // SCENARIO 3: User wants to update the template - go to mapping screen
      console.log('🔄 SCENARIO 3: User chose to update template - going to mapping screen');
      await loadTemplate(template);
      setCurrentView('workflow');
      // Go to mapping step
      updateState({ currentStep: 1.5 });
    } else {
      // SCENARIO 2: User doesn't want to update - load data directly since mappings exist
      console.log('📊 SCENARIO 2: User chose to use existing mappings - going to data loading');
      await loadTemplate(template);
      setCurrentView('workflow');
      // Go directly to data import step
      goToStep(2);
    }
  };

  const handleNewTemplate = () => {
    // Show the new template options modal
    setShowNewTemplateOptions(true);
  };

  const handleUploadNewTemplate = () => {
    // Reset the original document buffer when starting a new template
    resetOriginalDocumentBuffer();
    
    // Reset state and go to document upload screen (step 0)
    updateState({
      currentStep: 0,
      documentContent: '',
      documentHtml: '',
      originalFile: undefined,
      tags: [],
      incomingData: {},
      mappings: [],
      populatedContent: '',
      selectedTemplate: undefined,
      podapiCustomerNos: [],
    });
    setTagColumnMappings([]);
    setCurrentView('workflow');
    setShowNewTemplateOptions(false);
  };

  const handleCreateNewTemplateInEditor = async () => {
    // Load OnlyOffice settings first to ensure we have the correct URL
    await OnlyOfficeService.loadSettings();
    
    // Reset state for a new template
    updateState({
      currentStep: 0,
      documentContent: '',
      documentHtml: '',
      originalFile: undefined,
      tags: [],
      incomingData: {},
      mappings: [],
      populatedContent: '',
      selectedTemplate: undefined,
      podapiCustomerNos: [],
    });
    
    setShowOnlyOfficeEditor(true);
    setOnlyOfficeMode('create');
    setShowNewTemplateOptions(false);
  };

  const handleOpenOnlyOfficeEditor = async () => {
    // Load OnlyOffice settings first to ensure we have the correct URL
    await OnlyOfficeService.loadSettings();
    
    setShowOnlyOfficeEditor(true);
    setOnlyOfficeMode('create');
  };

  const handleOpenUserProfile = () => {
    setShowUserProfile(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // CRITICAL: Handle template version updates
  const handleTemplateVersionUpdate = async () => {
    console.log('🔄 Template version updated, refreshing current template...');
    
    // If we're currently viewing a template in the workflow, refresh it
    if (currentView === 'workflow' && state.selectedTemplate) {
      try {
        await refreshCurrentTemplate();
        console.log('✅ Current template refreshed after version update');
      } catch (error) {
        console.error('❌ Failed to refresh current template after version update:', error);
      }
    }
  };

  const handleShowVersionManager = (template: any, mode: 'history' | 'upload' = 'history') => {
    setShowVersionManager({
      templateId: template.id,
      templateName: template.name,
      currentVersion: template.current_version || template.version || 1,
      mode: mode
    });
  };

  const handleShowNewVersion = async (template: any) => {
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

  // Handle document from OnlyOffice editor for tag management
  const handleManageTagsFromEditor = (file: File, html: string, extractedTags: any[]) => {
    console.log('Managing tags from editor with extracted tags:', extractedTags);
    
    // Update state with the document and extracted tags
    updateState({
      originalFile: file,
      documentHtml: html,
      documentContent: html,
    });
    
    // Clear existing tags and add the extracted ones
    updateState({ tags: [] });
    extractedTags.forEach(tagData => {
      const newTag = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: tagData.name,
        displayName: tagData.displayName,
        description: tagData.description,
      };
      addTag(newTag);
    });
    
    // Close the editor
    setShowOnlyOfficeEditor(false);
    
    // Switch to workflow view and go to tag management step
    setCurrentView('workflow');
    goToStep(1);
  };

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: return !!state.documentContent;
      case 1: return state.tags.length > 0;
      case 2: return Object.keys(state.incomingData).length > 0;
      default: return true;
    }
  };

  // Determine if we should show the mapping step
  const shouldShowMappingStep = () => {
    return state.currentStep === 1.5; // Between tag management and data import
  };

  const renderMainContent = () => {
    if (currentView === 'dashboard') {
      return (
        <Dashboard
          templates={state.templates}
          onTemplateSelect={handleTemplateSelect}
          onTemplateDelete={removeTemplate}
          onNewTemplate={handleNewTemplate}
        />
      );
    }

    if (currentView === 'templates') {
      return (
        <TemplateManager
          templates={state.templates}
          onTemplateSelect={handleTemplateSelect}
          onTemplateDelete={removeTemplate}
          onTemplateUpdate={updateTemplate}
          onNewTemplate={handleNewTemplate}
          onVersionUpdate={handleTemplateVersionUpdate}
          onSaveTemplate={addTemplate}
          onTemplateVersionUpdate={handleTemplateVersionUpdate}
          onOpenSettings={handleOpenUserProfile}
          onViewTemplate={handleViewTemplate}
          onEditTemplate={handleEditTemplate}
        />
      );
    }

    if (currentView === 'generated') {
      return (
        <GeneratedDocuments />
      );
    }
    
    if (currentView === 'api') {
      return (
        <ApiTester />
      );
    }

    // Workflow view
    if (showSaveTemplate) {
      return (
        <SaveTemplateScreen
          documentContent={state.documentContent}
          documentHtml={state.documentHtml}
          tags={state.tags}
          originalFileName={state.originalFile?.name}
          onSave={handleSaveTemplate}
          onSkip={handleSkipSaveTemplate}
          onCancel={() => setShowSaveTemplate(false)}
          onSaveAndLoadData={handleSaveTemplateAndLoadData}
        />
      );
    }

    if (shouldShowMappingStep()) {
      return (
        <TagColumnMapper
          tags={state.tags}
          templateId={state.selectedTemplate?.id}
          currentVersion={state.selectedTemplate?.current_version || state.selectedTemplate?.version || 1}
          onMappingComplete={handleMappingComplete}
          onBack={() => goToStep(1)}
        />
      );
    }

    switch (state.currentStep) {
      case 0:
        return (
          <DocumentEditor
            content={state.documentContent}
            onContentChange={(content) => updateState({ documentContent: content })}
            onFileUpload={handleFileUpload}
            tags={state.tags}
            onTagCreate={handleTagCreate}
            onOpenOnlyOfficeEditor={handleOpenOnlyOfficeEditor}
          />
        );
      case 1:
        return (
          <TagManager
            tags={state.tags}
            onTagUpdate={updateTag}
            onTagRemove={removeTag}
            onTagAdd={handleAddTag}
          />
        );
      case 2:
        return (
          <DataImporter
            data={state.incomingData}
            onDataChange={handleDataChange}
            tags={state.tags}
            templateId={state.selectedTemplate?.id}
          />
        );
      case 3:
        return (
          <DocumentGenerator
            originalFile={state.originalFile}
            tags={state.tags}
            mappings={state.mappings}
            incomingData={state.incomingData}
            documentContent={state.documentContent}
            documentHtml={state.documentHtml}
            templateId={state.selectedTemplate?.id}
            podapiCustomerNos={state.podapiCustomerNos || []}
          />
        );
      default:
        return null;
    }
  };

  // Custom next step handler to include mapping step and save template screen
  const handleNextStep = () => {
    if (state.currentStep === 1 && state.tags.length > 0) {
      // After tag management, go to mapping step
      updateState({ currentStep: 1.5 });
    } else if (state.currentStep === 1.5) {
      // After mapping, if this is a new template, show save template screen
      if (!state.selectedTemplate) {
        setShowSaveTemplate(true);
      } else {
        // Otherwise, go to data import
        goToStep(2);
      }
    } else {
      nextStep();
    }
  };

  // Custom previous step handler
  const handlePrevStep = () => {
    if (showSaveTemplate) {
      setShowSaveTemplate(false);
      return;
    }
    
    if (state.currentStep === 1.5) {
      // From mapping step, go back to tag management
      goToStep(1);
    } else if (state.currentStep === 2) {
      // From data import, go back to mapping
      updateState({ currentStep: 1.5 });
    } else {
      prevStep();
    }
  };

  // Custom step click handler
  const handleStepClick = (step: number) => {
    if (showSaveTemplate) {
      setShowSaveTemplate(false);
    }
    
    if (step === 2 && state.tags.length > 0) {
      // If clicking on data import and we have tags, go to mapping first
      updateState({ currentStep: 1.5 });
    } else {
      goToStep(step);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 mobile-container">
      {/* Enhanced Mobile-First Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-50 safe-area-padding">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Mobile-optimized logo section */}
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              <div className="flex items-center space-x-1 sm:space-x-3 min-w-0">
                <img 
                  src="/go-ar-logo.png" 
                  alt="Go-AR Logo" 
                  className="h-6 sm:h-8 lg:h-10 w-auto cursor-pointer flex-shrink-0"
                  onClick={() => setCurrentView('dashboard')}
                />
                <div className="hidden sm:block h-6 sm:h-8 w-px bg-gray-300 flex-shrink-0"></div>
                <div className="min-w-0">
                  <h1 
                    className="text-sm sm:text-lg lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent cursor-pointer truncate"
                    onClick={() => setCurrentView('dashboard')}
                  >
                    Document AI Studio
                  </h1>
                  <p className="hidden lg:block text-xs sm:text-sm text-gray-600 font-medium truncate">
                    Intelligent Document Processing & Auto-Mapping
                  </p>
                  <p className="sm:hidden text-xs text-gray-600 font-medium truncate">
                    AI Document Processing
                  </p>
                </div>
              </div>
            </div>
            
            {/* Mobile Navigation */}
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {/* Desktop Navigation - Hidden on mobile */}
              <div className="hidden lg:flex items-center space-x-2">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`flex items-center space-x-2 px-3 py-1.5 border rounded-full transition-all duration-200 touch-target ${
                    currentView === 'dashboard'
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 text-gray-700 hover:border-blue-200 hover:text-blue-700'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-sm font-medium">Dashboard</span>
                </button>
                <button
                  onClick={() => setCurrentView('templates')}
                  className={`flex items-center space-x-2 px-3 py-1.5 border rounded-full transition-all duration-200 touch-target ${
                    currentView === 'templates'
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 text-indigo-700'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 text-gray-700 hover:border-indigo-200 hover:text-indigo-700'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span className="text-sm font-medium">Templates</span>
                </button>
                <button
                  onClick={() => setCurrentView('generated')}
                  className={`flex items-center space-x-2 px-3 py-1.5 border rounded-full transition-all duration-200 touch-target ${
                    currentView === 'generated'
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 text-gray-700 hover:border-green-200 hover:text-green-700'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  <span className="text-sm font-medium">Generated</span>
                </button>
                <button
                  onClick={() => setCurrentView('api')}
                  className={`flex items-center space-x-2 px-3 py-1.5 border rounded-full transition-all duration-200 touch-target ${
                    currentView === 'api'
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-purple-700'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 text-gray-700 hover:border-purple-200 hover:text-purple-700'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  <span className="text-sm font-medium">API</span>
                </button>
                <button
                  onClick={handleNewTemplate}
                  className={`flex items-center space-x-2 px-3 py-1.5 border rounded-full transition-all duration-200 touch-target ${
                    currentView === 'workflow'
                      ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 text-orange-700'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 text-gray-700 hover:border-orange-200 hover:text-orange-700'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">New Document</span>
                </button>
              </div>
              
              {/* Tablet Navigation - Hidden on mobile and desktop */}
              <div className="hidden sm:flex lg:hidden items-center space-x-1">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`p-2 border rounded-xl transition-all duration-200 touch-target ${
                    currentView === 'dashboard'
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                  }`}
                  title="Dashboard"
                >
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                </button>
                <button
                  onClick={() => setCurrentView('templates')}
                  className={`p-2 border rounded-xl transition-all duration-200 touch-target ${
                    currentView === 'templates'
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                  }`}
                  title="Templates"
                >
                  <Folder className="w-4 h-4 text-indigo-600" />
                </button>
                <button
                  onClick={() => setCurrentView('generated')}
                  className={`p-2 border rounded-xl transition-all duration-200 touch-target ${
                    currentView === 'generated'
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                  }`}
                  title="Generated Documents"
                >
                  <Archive className="w-4 h-4 text-green-600" />
                </button>
                <button
                  onClick={() => setCurrentView('api')}
                  className={`p-2 border rounded-xl transition-all duration-200 touch-target ${
                    currentView === 'api'
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                  }`}
                  title="API"
                >
                  <Code className="w-4 h-4 text-purple-600" />
                </button>
                <button
                  onClick={handleNewTemplate}
                  className={`p-2 border rounded-xl transition-all duration-200 touch-target ${
                    currentView === 'workflow'
                      ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                  }`}
                  title="New Document"
                >
                  <Upload className="w-4 h-4 text-orange-600" />
                </button>
              </div>
              
              {/* User Menu */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleOpenUserProfile}
                  className="hidden sm:flex items-center space-x-2 px-2 sm:px-3 py-1.5 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-full hover:border-blue-200 hover:text-blue-700 transition-all duration-200 touch-target"
                >
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 hidden md:inline truncate max-w-20">
                    {user?.email?.split('@')[0] || 'User'}
                  </span>
                </button>
                <button
                  onClick={handleOpenUserProfile}
                  className="sm:hidden p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 touch-target"
                  title="Profile"
                >
                  <User className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 touch-target"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              
              {/* Mobile Menu Button */}
              <div className="sm:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors touch-target"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile menu dropdown */}
          {isMobileMenuOpen && (
            <div className="sm:hidden mt-3 p-3 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg mobile-space-y-2">
              <button
                onClick={() => {
                  setCurrentView('dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 touch-target ${
                  currentView === 'dashboard'
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => {
                  setCurrentView('templates');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 touch-target ${
                  currentView === 'templates'
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Folder className="w-5 h-5" />
                <span className="font-medium">Templates</span>
              </button>
              <button
                onClick={() => {
                  setCurrentView('generated');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 touch-target ${
                  currentView === 'generated'
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Archive className="w-5 h-5" />
                <span className="font-medium">Generated Documents</span>
              </button>
              <button
                onClick={() => {
                  setCurrentView('api');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 touch-target ${
                  currentView === 'api'
                    ? 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Code className="w-5 h-5" />
                <span className="font-medium">API</span>
              </button>
              <button
                onClick={() => {
                  handleNewTemplate();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 touch-target ${
                  currentView === 'workflow'
                    ? 'bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 text-orange-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-5 h-5" />
                <span className="font-medium">New Document</span>
              </button>
              
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="text-xs text-gray-600 px-3 py-1">
                  {currentView === 'dashboard' && 'Dashboard Overview'}
                  {currentView === 'templates' && 'Template Library'}
                  {currentView === 'generated' && 'Generated Documents'}
                  {currentView === 'api' && 'API Testing & Integration'}
                  {currentView === 'workflow' && showSaveTemplate && 'Save Template'}
                  {currentView === 'workflow' && shouldShowMappingStep() && 'Tag-Column Mapping'}
                  {currentView === 'workflow' && !shouldShowMappingStep() && !showSaveTemplate && `Step ${state.currentStep + 1} of 4: ${
                    ['Upload Document', 'Manage Tags', 'Import Data', 'Generate Documents'][state.currentStep]
                  }`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {(statusMessage || errorMessage) && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4">
          {statusMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800 flex-1">{statusMessage}</p>
                <button
                  onClick={clearMessages}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800 flex-1">{errorMessage}</p>
                <button
                  onClick={clearMessages}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8">
        {/* Mobile-optimized Description - Only show for workflow */}
        {currentView === 'workflow' && !showSaveTemplate && (
          <div className="mb-4 sm:mb-8 text-center">
            <div className="max-w-3xl mx-auto">
              <p className="text-sm sm:text-lg text-gray-700 leading-relaxed px-2">
                Transform your document workflow with intelligent tag extraction and seamless data population.
              </p>
              <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2">
                <span className="text-xs sm:text-base text-blue-600 font-semibold text-center px-2">
                  Pro tip: Use £tag_name£ in your Word document for automatic AI extraction!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mobile-optimized Step Indicator - Only show for workflow */}
        {currentView === 'workflow' && !showSaveTemplate && (
          <StepIndicator 
            currentStep={shouldShowMappingStep() ? 1.5 : state.currentStep} 
            onStepClick={handleStepClick} 
          />
        )}

        {/* Auto-extraction notification - Mobile optimized */}
        {currentView === 'workflow' && state.tags.length > 0 && state.currentStep === 1 && !showSaveTemplate && (
          <div className="mb-3 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Sparkles className="h-3 w-3 sm:h-5 sm:w-5 text-green-600" />
                </div>
              </div>
              <div className="ml-2 sm:ml-3">
                <h3 className="text-xs sm:text-sm font-semibold text-green-800">
                  🎉 AI Extraction Successful!
                </h3>
                <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-green-700">
                  <p>
                    Discovered and extracted <strong>{state.tags.length} intelligent tags</strong> from your document. 
                    All £tag£ patterns have been detected and are ready for data mapping.
                    <span className="hidden sm:inline"> Review and customize them below.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto-mapping notification - Mobile optimized */}
        {currentView === 'workflow' && state.mappings.length > 0 && state.currentStep === 2 && !showSaveTemplate && (
          <div className="mb-3 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Sparkles className="h-3 w-3 sm:h-5 sm:w-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-2 sm:ml-3">
                <h3 className="text-xs sm:text-sm font-semibold text-blue-800">
                  🚀 Smart Mapping Complete!
                </h3>
                <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-blue-700">
                  <p>
                    Intelligently mapped <strong>{state.mappings.length} of {state.tags.length} tags</strong> to your data fields.
                    <span className="hidden sm:inline"> Our AI matched tag names with data keys for seamless document generation.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="mb-4 sm:mb-8">
          {renderMainContent()}
        </div>

        {/* Mobile-optimized Navigation - Only show for workflow and not on save template screen */}
        {currentView === 'workflow' && !showSaveTemplate && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-3 sm:p-6 border border-gray-200/50 shadow-sm safe-area">
            {/* Mobile progress indicator */}
            <div className="flex items-center justify-center mb-3 sm:hidden">
              <div className="flex items-center space-x-2">
                <div className="text-xs text-gray-500 font-medium">
                  {shouldShowMappingStep() ? 'Tag-Column Mapping' : `Step ${state.currentStep + 1} of 4`}
                </div>
                <div className="flex space-x-1">
                  {[0, 1, 1.5, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        (shouldShowMappingStep() ? 1.5 : state.currentStep) >= step
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevStep}
                disabled={state.currentStep === 0}
                className="inline-flex items-center px-3 sm:px-6 py-2 sm:py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md touch-manipulation"
              >
                <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>

              {/* Desktop progress indicator */}
              <div className="hidden sm:flex items-center space-x-4">
                <div className="text-sm text-gray-500 font-medium">
                  {shouldShowMappingStep() ? 'Tag-Column Mapping' : `Step ${state.currentStep + 1} of 4`}
                </div>
                <div className="flex space-x-2">
                  {[0, 1, 1.5, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        (shouldShowMappingStep() ? 1.5 : state.currentStep) >= step
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleNextStep}
                disabled={state.currentStep === 3 || !canProceed(state.currentStep)}
                className="inline-flex items-center px-3 sm:px-6 py-2 sm:py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md touch-manipulation"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
                <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Template Update Modal */}
      {showTemplateUpdateModal && (
        <TemplateUpdateModal
          isOpen={!!showTemplateUpdateModal}
          template={showTemplateUpdateModal.template}
          hasMappings={showTemplateUpdateModal.hasMappings}
          onUpdateTemplate={() => handleTemplateUpdateDecision(true)}
          onUseExisting={() => handleTemplateUpdateDecision(false)}
          onClose={() => setShowTemplateUpdateModal(null)}
        />
      )}

      {/* User Profile Modal */}
      {showUserProfile && (
        <UserProfile onClose={() => setShowUserProfile(false)} />
      )}

      {/* OnlyOffice Editor Modal */}
      {showOnlyOfficeEditor && (
        <OnlyOfficeEditor
          isOpen={showOnlyOfficeEditor}
          onClose={() => setShowOnlyOfficeEditor(false)}
          templateId={state.selectedTemplate?.id}
          templateName={state.selectedTemplate?.name}
          mode={onlyOfficeMode}
          onSave={handleSaveTemplate}
          onVersionUpdate={handleTemplateVersionUpdate}
          onManageTags={handleManageTagsFromEditor}
        />
      )}

      {/* New Template Options Modal */}
      {showNewTemplateOptions && (
        <NewTemplateOptions
          isOpen={showNewTemplateOptions}
          onClose={() => setShowNewTemplateOptions(false)}
          onUploadTemplate={handleUploadNewTemplate}
          onCreateInEditor={handleCreateNewTemplateInEditor}
        />
      )}

      {/* View Template Options Modal */}
      {showViewOptions && selectedTemplateForOptions && (
        <TemplateViewOptions
          isOpen={showViewOptions}
          onClose={() => setShowViewOptions(false)}
          onDownload={() => {
            handleDownloadTemplate(selectedTemplateForOptions);
            setShowViewOptions(false);
          }}
          onOpenInEditor={() => {
            handleOpenTemplateInEditor(selectedTemplateForOptions, true); // Pass true for view mode
            setShowViewOptions(false);
          }}
          templateName={selectedTemplateForOptions.name}
        />
      )}

      {/* Edit Template Options Modal */}
      {showEditOptions && selectedTemplateForOptions && (
        <TemplateEditOptions
          isOpen={showEditOptions}
          onClose={() => setShowEditOptions(false)}
          onUploadNewVersion={() => {
            handleShowNewVersion(selectedTemplateForOptions);
            setShowEditOptions(false);
          }}
          onEditInOnlyOffice={() => {
            handleOpenTemplateInEditor(selectedTemplateForOptions);
            setShowEditOptions(false);
          }}
          templateName={selectedTemplateForOptions.name}
        />
      )}

      {/* Version Manager Modal */}
      {showVersionManager && (
        <TemplateVersionManager
          templateId={showVersionManager.templateId}
          templateName={showVersionManager.templateName}
          currentVersion={showVersionManager.currentVersion}
          initialMode={showVersionManager.mode}
          onClose={() => setShowVersionManager(null)}
          onVersionUpdate={handleTemplateVersionUpdate}
        />
      )}
    </div>
  );
};