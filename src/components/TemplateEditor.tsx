import React, { useState } from 'react';
import { OnlyOfficeEditor } from './OnlyOfficeEditor';
import { FileText, Edit, Upload, Plus, AlertTriangle, Settings, ExternalLink } from 'lucide-react';
import { DocumentTemplate } from '../types';
import { OnlyOfficeService } from '../services/onlyOfficeService';

interface TemplateEditorProps {
  template?: DocumentTemplate;
  onSave?: (templateData: any) => void;
  onVersionUpdate?: () => void;
  onOpenSettings?: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onVersionUpdate,
  onOpenSettings,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'create'>('edit');
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const checkServerAvailability = async () => {
    try {
      setChecking(true);
      setServerError(null);
      
      // Load current settings first
      await OnlyOfficeService.loadSettings();
      
      const available = await OnlyOfficeService.checkServerAvailability();
      setServerAvailable(available);
      
      if (!available) {
        setServerError(`Cannot connect to My Editor server at ${OnlyOfficeService.getServerUrl()}. Please check your server configuration in settings.`);
      }
      
      return available;
    } catch (error) {
      console.error('Error checking My Editor server:', error);
      setServerAvailable(false);
      setServerError(`Failed to check My Editor server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleEditTemplate = async () => {
    if (serverAvailable === null) {
      const available = await checkServerAvailability();
      if (!available) return;
    } else if (!serverAvailable) {
      // Try to check again in case settings have changed
      const available = await checkServerAvailability();
      if (!available) return;
    }

    setEditorMode('edit');
    setIsEditorOpen(true);
  };

  const handleCreateTemplate = async () => {
    if (serverAvailable === null) {
      const available = await checkServerAvailability();
      if (!available) return;
    } else if (!serverAvailable) {
      // Try to check again in case settings have changed
      const available = await checkServerAvailability();
      if (!available) return;
    }

    setEditorMode('create');
    setIsEditorOpen(true);
  };

  const handleRetryConnection = async () => {
    await checkServerAvailability();
  };

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Edit Existing Template */}
        {template && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-600">Edit this template with My Editor</p>
                </div>
              </div>
              <button
                onClick={handleEditTemplate}
                disabled={checking}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50"
              >
                {checking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Template
                  </>
                )}
              </button>
            </div>
            
            {serverAvailable === false && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">My Editor Server Unavailable</h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      {serverError || `Cannot connect to My Editor server at ${OnlyOfficeService.getServerUrl()}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleRetryConnection}
                        disabled={checking}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50"
                      >
                        {checking ? 'Checking...' : 'Retry Connection'}
                      </button>
                      <button
                        onClick={handleOpenSettings}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Configure Server
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create New Template */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Create New Template</h3>
                <p className="text-sm text-gray-600">Create a new template with My Editor</p>
              </div>
            </div>
            <button
              onClick={handleCreateTemplate}
              disabled={checking}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50"
            >
              {checking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Checking...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </>
              )}
            </button>
          </div>
          
          {serverAvailable === false && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800 mb-1">My Editor Server Unavailable</h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    {serverError || `Cannot connect to My Editor server at ${OnlyOfficeService.getServerUrl()}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleRetryConnection}
                      disabled={checking}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50"
                    >
                      {checking ? 'Checking...' : 'Retry Connection'}
                    </button>
                    <button
                      onClick={handleOpenSettings}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Configure Server
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Server Configuration Help */}
        {serverAvailable === false && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-start space-x-3">
              <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-2">My Editor Server Setup</h4>
                <p className="text-sm text-blue-800 mb-3">
                  To use My Editor document editing, you need a running My Editor Document Server. 
                  The current configured URL is: <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">{OnlyOfficeService.getServerUrl()}</code>
                </p>
                <div className="text-sm text-blue-800">
                  <p className="mb-2"><strong>Quick Setup Options:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Install My Editor Document Server locally</li>
                    <li>Use a cloud-hosted My Editor instance</li>
                    <li>Update the server URL in your profile settings</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OnlyOffice Editor Modal */}
      {isEditorOpen && (
        <OnlyOfficeEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          templateId={template?.id}
          templateName={template?.name}
          mode={editorMode}
          onSave={onSave}
          onVersionUpdate={onVersionUpdate}
        />
      )}
    </>
  );
};