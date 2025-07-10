import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../hooks/useAppState';
import { StepIndicator } from './StepIndicator';
import { DocumentEditor } from './DocumentEditor';
import { TagManager } from './TagManager';
import { TagColumnMapper } from './TagColumnMapper';
import { DataImporter } from './DataImporter';
import { DocumentGenerator } from './DocumentGenerator';
import { DocumentViewer } from './DocumentViewer';
import { TemplateManager } from './TemplateManager';
import { SaveTemplateScreen } from './SaveTemplateScreen';
import { Dashboard } from './Dashboard';
import { GeneratedDocuments } from './GeneratedDocuments';
import { UserProfile } from './UserProfile';
import { DocumentEditor as CKDocumentEditor } from './OnlyOfficeEditor';
import { CloudConvertSettings } from './CloudConvertSettings';
import { TemplateUpdateModal } from './TemplateUpdateModal';
import { DataMappingService } from '../services/dataMappingService';
import { v4 as uuidv4 } from 'uuid';
import { DocumentPreview } from './DocumentPreview';
import { 
  User, 
  LogOut, 
  Settings, 
  FileText, 
  Archive, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle, 
  X, 
  RefreshCw,
  Sparkles,
  Zap,
  Database,
  Download,
  Tag,
  Upload,
  Save,
  Plus,
  Folder,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { supabase, testSupabaseConnection } from '../lib/supabase';
import { AuthService } from '../services/authService';
import { DocumentPreview } from './DocumentPreview';

export const MainApp: React.FC = () => {
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
    refreshTemplates,
    clearMessages
  } = useAppState();

  const [view, setView] = useState<'dashboard' | 'templates' | 'editor' | 'generated' | 'preview'>('dashboard');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showCloudConvertSettings, setShowCloudConvertSettings] = useState(false);
  const [showTemplateUpdateModal, setShowTemplateUpdateModal] = useState(false);
  const [templateHasMappings, setTemplateHasMappings] = useState(false);
  const [isCheckingMappings, setIsCheckingMappings] = useState(false);
  const [showCKEditor, setShowCKEditor] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Refs for scroll restoration
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
    getUserEmail();
  }, []);

  // Scroll to top when step changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [state.currentStep, view]);

  const checkConnectionStatus = async () => {
    try {
      setConnectionStatus('checking');
      const result = await testSupabaseConnection();
      setConnectionStatus(result.success ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus('disconnected');
    }
  };

  const getUserEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    } catch (error) {
      console.error('Failed to get user email:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await AuthService.signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleFileUpload = (file: File, html: string) => {
    // Extract tags from the document content
    const { extractTagsFromContent } = require('../utils/documentUtils');
    const extractedTags = extractTagsFromContent(html);
    
    // Create Tag objects with unique IDs
    const tags = extractedTags.map(tag => ({
      ...tag,
      id: uuidv4()
    }));
    
    updateState({
      documentContent: html,
      documentHtml: html,
      originalFile: file,
      tags,
      currentStep: 1 // Move to tag management step
    });
  };

  const handleTagCreate = (tagName: string, selectedText: string) => {
    // Create a new tag
    const newTag = {
      id: uuidv4(),
      name: tagName,
      displayName: tagName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      description: `Created from selected text: "${selectedText}"`
    };
    
    addTag(newTag);
    
    // Update document content with the new tag
    const { insertTagInContent } = require('../utils/documentUtils');
    const updatedContent = insertTagInContent(state.documentContent, tagName, selectedText);
    updateState({ documentContent: updatedContent });
  };

  const handleSaveTemplate = async (templateData: any) => {
    try {
      const savedTemplate = await addTemplate(templateData);
      setView('templates');
      return savedTemplate;
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  };

  const handleSaveAndLoadData = async (templateData: any) => {
    try {
      const savedTemplate = await addTemplate(templateData);
      goToStep(1.5); // Go to column mapping step
      return savedTemplate;
    } catch (error) {
      console.error('Failed to save template and load data:', error);
      throw error;
    }
  };

  const handleMappingComplete = (mappings: any[]) => {
    // Convert the mappings to the format expected by the app state
    const stateMappings = mappings
      .filter(mapping => mapping.columnName) // Only include mappings with a column name
      .map(mapping => ({
        tagId: mapping.tagId,
        dataKey: mapping.columnName,
        dataValue: '', // Will be populated when data is loaded
        confidence: mapping.confidence,
        isManual: mapping.isManual
      }));
    
    updateState({ mappings: stateMappings });
    nextStep(); // Move to data import step
  };

  const handleTemplateSelect = async (template: any) => {
    try {
      setIsCheckingMappings(true);
      
      // Load the template
      await loadTemplate(template);
      
      // Check if the template has mappings
      const templateId = template.id;
      const templateVersion = template.current_version || template.version || 1;
      
      const hasMappings = await DataMappingService.templateVersionHasMappings(
        templateId,
        templateVersion
      );
      
      setTemplateHasMappings(hasMappings);
      
      if (hasMappings) {
        // Show the template update modal to let the user decide
        setShowTemplateUpdateModal(true);
      } else {
        // No mappings, go to the mapping step
        goToStep(1.5);
      }
      
      setView('editor');
    } catch (error) {
      console.error('Failed to select template:', error);
    } finally {
      setIsCheckingMappings(false);
    }
  };

  const handlePreviewTemplate = async (template: any) => {
    try {
      setLoading(true);
      // Load the template
      await loadTemplate(template);
      
      // Switch to preview view
      setView('preview');
      setLoading(false);
    } catch (error) {
      console.error('Failed to preview template:', error);
      setLoading(false);
    }
  };

  const handleUseExistingMappings = async () => {
    try {
      if (!state.selectedTemplate) return;
      
      const templateId = state.selectedTemplate.id;
      const templateVersion = state.selectedTemplate.version || 1;
      
      // Load mappings for the current version
      const mappings = await DataMappingService.getTemplateVersionMappings(
        templateId,
        templateVersion
      );
      
      // Convert to the format expected by the app state
      const stateMappings = mappings.map(mapping => ({
        tagId: mapping.tag_name, // Using tag_name as tagId for now
        dataKey: mapping.data_key,
        dataValue: '', // Will be populated when data is loaded
        confidence: Number(mapping.mapping_confidence) || 0,
        isManual: mapping.is_manual || false
      }));
      
      updateState({ mappings: stateMappings });
      goToStep(2); // Skip mapping step, go directly to data import
      setShowTemplateUpdateModal(false);
    } catch (error) {
      console.error('Failed to use existing mappings:', error);
    }
  };

  const handleUpdateTemplate = () => {
    goToStep(1.5); // Go to mapping step
    setShowTemplateUpdateModal(false);
  };

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 0:
        return (
          <DocumentEditor
            content={state.documentContent}
            onContentChange={(content) => updateState({ documentContent: content })}
            onFileUpload={handleFileUpload}
            tags={state.tags}
            onTagCreate={handleTagCreate}
            onOpenDocumentEditor={() => setShowCKEditor(true)}
          />
        );
      case 1:
        return (
          <TagManager
            tags={state.tags}
            onTagUpdate={updateTag}
            onTagRemove={removeTag}
            onTagAdd={addTag}
          />
        );
      case 1.5:
        return (
          <TagColumnMapper
            tags={state.tags}
            templateId={state.selectedTemplate?.id}
            currentVersion={state.selectedTemplate?.version || 1}
            onMappingComplete={handleMappingComplete}
            onBack={() => goToStep(1)}
          />
        );
      case 2:
        return (
          <DataImporter
            tags={state.tags}
            mappings={state.mappings}
            onMappingChange={addMapping}
            onMappingRemove={removeMapping}
            onDataImport={setIncomingData}
            templateId={state.selectedTemplate?.id}
            templateVersion={state.selectedTemplate?.version || 1}
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
            podapiCustomerNos={state.podapiCustomerNos}
          />
        );
      default:
        return (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Unknown Step</h2>
              <p className="text-gray-600 mb-6">
                The current step is not recognized. Please go back to a valid step.
              </p>
              <button
                onClick={() => goToStep(0)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                Go to Start
              </button>
            </div>
          </div>
        );
    }
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard
            templates={state.templates}
            onTemplateSelect={handleTemplateSelect}
            onTemplateDelete={removeTemplate}
            onNewTemplate={() => {
              updateState({
                documentContent: '',
                documentHtml: '',
                originalFile: undefined,
                tags: [],
                currentStep: 0
              });
              setView('editor');
            }}
          />
        );
      case 'templates':
        return (
          <TemplateManager
            templates={state.templates}
            onTemplateSelect={handleTemplateSelect}
            onTemplateDelete={removeTemplate}
            onTemplateUpdate={updateTemplate}
            onNewTemplate={() => {
              updateState({
                documentContent: '',
                documentHtml: '',
                originalFile: undefined,
                tags: [],
                currentStep: 0
              });
              setView('editor');
            }}
            onVersionUpdate={refreshTemplates}
            onSaveTemplate={handleSaveTemplate}
            onTemplateVersionUpdate={refreshCurrentTemplate}
            onOpenSettings={() => setShowCloudConvertSettings(true)}
            onPreviewTemplate={handlePreviewTemplate}
          />
        );
      case 'editor':
        return (
          <>
            <StepIndicator currentStep={state.currentStep} onStepClick={goToStep} />
            {state.currentStep === 0 && !state.documentContent && state.selectedTemplate && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-blue-900">Template Selected</h3>
                    <p className="text-sm text-blue-700">
                      You're working with the template: <strong>{state.selectedTemplate.name}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}
            {renderCurrentStep()}
            
            {/* Save Template Screen - shown after document upload and tag extraction */}
            {state.currentStep === 1 && state.documentContent && !state.selectedTemplate && (
              <div className="mt-6">
                <SaveTemplateScreen
                  documentContent={state.documentContent}
                  documentHtml={state.documentHtml}
                  tags={state.tags}
                  originalFileName={state.originalFile?.name}
                  onSave={handleSaveTemplate}
                  onSaveAndLoadData={handleSaveAndLoadData}
                  onSkip={() => goToStep(1.5)}
                  onCancel={() => goToStep(0)}
                />
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => state.currentStep > 0 ? prevStep() : setView('dashboard')}
                className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                {state.currentStep > 0 ? 'Previous Step' : 'Back to Dashboard'}
              </button>
              
              {state.currentStep < 3 && (
                <button
                  onClick={nextStep}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center"
                  disabled={
                    (state.currentStep === 0 && !state.documentContent) ||
                    (state.currentStep === 1 && state.tags.length === 0) ||
                    (state.currentStep === 1.5 && state.mappings.length === 0) ||
                    (state.currentStep === 2 && Object.keys(state.incomingData).length === 0)
                  }
                >
                  Next Step
                  <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              )}
            </div>
          </>
        );
      case 'generated':
        return (
          <GeneratedDocuments onClose={() => setView('dashboard')} />
        );
      case 'preview':
        return (
          <DocumentViewer
            templateId={state.selectedTemplate?.id || ''}
            templateName={state.selectedTemplate?.name || 'Document Preview'}
            documentHtml={state.documentHtml || ''}
            tags={state.tags || []}
            onClose={() => setView('templates')}
          />
        );
      default:
        return <Dashboard templates={state.templates} onTemplateSelect={handleTemplateSelect} onTemplateDelete={removeTemplate} onNewTemplate={() => setView('editor')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12 mobile-container">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Document AI Studio
                </h1>
                <p className="text-xs text-gray-500">AI-powered document processing</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => setView('dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'dashboard' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </div>
              </button>
              
              <button
                onClick={() => setView('templates')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'templates' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <Folder className="w-4 h-4" />
                  <span>Templates</span>
                </div>
              </button>
              
              <button
                onClick={() => {
                  updateState({
                    documentContent: '',
                    documentHtml: '',
                    originalFile: undefined,
                    tags: [],
                    currentStep: 0
                  });
                  setView('editor');
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'editor' && state.currentStep === 0 && !state.documentContent
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <Plus className="w-4 h-4" />
                  <span>New</span>
                </div>
              </button>
              
              <button
                onClick={() => setView('generated')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'generated' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <Archive className="w-4 h-4" />
                  <span>Generated</span>
                </div>
              </button>
            </nav>
            
            {/* Mobile Navigation */}
            <div className="flex md:hidden">
              <button
                onClick={() => setView('dashboard')}
                className={`p-2 rounded-lg ${
                  view === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setView('templates')}
                className={`p-2 rounded-lg ${
                  view === 'templates' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                }`}
              >
                <Folder className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => {
                  updateState({
                    documentContent: '',
                    documentHtml: '',
                    originalFile: undefined,
                    tags: [],
                    currentStep: 0
                  });
                  setView('editor');
                }}
                className={`p-2 rounded-lg ${
                  view === 'editor' && state.currentStep === 0 && !state.documentContent
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600'
                }`}
              >
                <Plus className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setView('generated')}
                className={`p-2 rounded-lg ${
                  view === 'generated' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                }`}
              >
                <Archive className="w-5 h-5" />
              </button>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center space-x-2">
              {connectionStatus === 'checking' && (
                <div className="text-gray-500 flex items-center">
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  <span className="text-xs">Connecting...</span>
                </div>
              )}
              
              {connectionStatus === 'connected' && (
                <div className="text-green-600 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span className="text-xs hidden sm:inline">Connected</span>
                </div>
              )}
              
              {connectionStatus === 'disconnected' && (
                <div className="text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-xs hidden sm:inline">Disconnected</span>
                </div>
              )}
              
              <button
                onClick={() => setShowCloudConvertSettings(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowUserProfile(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="User Profile"
              >
                <User className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                {isSigningOut ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Messages */}
      {(statusMessage || errorMessage) && (
        <div className="container mx-auto px-4 mt-4">
          {statusMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-800">{statusMessage}</p>
              </div>
              <button
                onClick={clearMessages}
                className="text-green-600 hover:text-green-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800">{errorMessage}</p>
              </div>
              <button
                onClick={clearMessages}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6" ref={mainContentRef}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        ) : (
          renderView()
        )}
      </main>

      {/* User Profile Modal */}
      {showUserProfile && (
        <UserProfile onClose={() => setShowUserProfile(false)} />
      )}

      {/* CloudConvert Settings Modal */}
      {showCloudConvertSettings && (
        <CloudConvertSettings onClose={() => setShowCloudConvertSettings(false)} />
      )}

      {/* Template Update Modal */}
      {showTemplateUpdateModal && state.selectedTemplate && (
        <TemplateUpdateModal
          isOpen={showTemplateUpdateModal}
          template={state.selectedTemplate}
          hasMappings={templateHasMappings}
          onUpdateTemplate={handleUpdateTemplate}
          onUseExisting={handleUseExistingMappings}
          onClose={() => setShowTemplateUpdateModal(false)}
        />
      )}

      {/* CKEditor Modal */}
      {showCKEditor && (
        <CKDocumentEditor
          isOpen={showCKEditor}
          onClose={() => setShowCKEditor(false)}
          templateId={state.selectedTemplate?.id}
          templateName={state.selectedTemplate?.name}
          mode={state.selectedTemplate ? 'edit' : 'create'}
          onSave={handleSaveTemplate}
          onVersionUpdate={refreshCurrentTemplate}
          onManageTags={handleFileUpload}
        />
      )}
    </div>
  );
};