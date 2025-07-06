import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Upload, 
  RotateCcw, 
  FileText, 
  User, 
  Calendar, 
  HardDrive,
  GitBranch,
  Download,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  X,
  Plus,
  ArrowLeft,
  ArrowRight,
  Zap,
  Star,
  History
} from 'lucide-react';
import { TemplateVersionService, TemplateVersion } from '../services/templateVersionService';
import { StorageService } from '../services/storageService';
import { convertDocxToHtml } from '../utils/documentUtils';

interface TemplateVersionManagerProps {
  templateId: string;
  templateName: string;
  currentVersion: number;
  initialMode?: 'history' | 'upload';
  onClose: () => void;
  onVersionUpdate: () => void;
}

export const TemplateVersionManager: React.FC<TemplateVersionManagerProps> = ({
  templateId,
  templateName,
  currentVersion,
  initialMode = 'history',
  onClose,
  onVersionUpdate,
}) => {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentModal, setCurrentModal] = useState<'history' | 'upload' | 'rollback' | null>(
    initialMode === 'upload' ? 'upload' : 'history'
  );
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState('');
  const [rollbackNotes, setRollbackNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [autoDownloading, setAutoDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadVersionHistory();
  }, [templateId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const history = await TemplateVersionService.getVersionHistory(templateId);
      setVersions(history);
    } catch (error) {
      console.error('Failed to load version history:', error);
      setError('Failed to load version history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file to upload.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);

      console.log('🔄 Processing new version upload...');

      // Convert DOCX to HTML for display
      const documentHtml = await convertDocxToHtml(uploadFile);
      
      // For document content, we'll store the HTML but could also store plain text
      // The key is that both should be properly updated
      const documentContent = documentHtml; // This will be the HTML content for now
      
      console.log('✅ Document converted to HTML');

      // Upload file to storage - this creates the new version's storage path
      const storagePath = await StorageService.uploadTemplate(uploadFile, templateId);
      console.log('✅ File uploaded to storage:', storagePath);

      // Create new version - this updates BOTH the version table AND the main template table
      const versionId = await TemplateVersionService.createNewVersion(
        templateId,
        uploadFile,
        documentContent,
        documentHtml,
        storagePath,
        versionNotes.trim() || undefined
      );
      
      console.log('✅ New version created:', versionId);

      // Reload version history
      await loadVersionHistory();
      
      // Trigger parent component refresh - this will reload the template with new content
      onVersionUpdate();

      // Reset form and show success message
      setUploadFile(null);
      setVersionNotes('');
      setSuccessMessage('New version created successfully! The template now uses the latest version.');
      
      // Auto-close after showing success
      setTimeout(() => {
        setCurrentModal(null);
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to create new version:', error);
      setError(`Failed to create new version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    try {
      setRolling(true);
      setError(null);
      setSuccessMessage(null);

      console.log(`🔄 Rolling back to version ${versionNumber}...`);
      console.log('📋 This will update the current template, not create a new version');

      await TemplateVersionService.rollbackToVersion(
        templateId,
        versionNumber,
        rollbackNotes.trim() || undefined
      );

      console.log('✅ Rollback completed - template updated');

      // Reload version history
      await loadVersionHistory();
      
      // Trigger parent component refresh - this will reload the template with rollback content
      onVersionUpdate();

      // Reset form and show success message
      setRollbackNotes('');
      setRollbackVersion(null);
      setSuccessMessage(`Successfully rolled back to version ${versionNumber}! The template now uses the rolled back content.`);
      
      // Auto-close after showing success
      setTimeout(() => {
        setCurrentModal(null);
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to rollback:', error);
      setError(`Failed to rollback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRolling(false);
    }
  };

  const handleDownloadVersion = async (versionNumber: number) => {
    try {
      setDownloading(versionNumber);
      setError(null);
      console.log(`📥 Downloading version ${versionNumber}...`);
      
      await TemplateVersionService.downloadVersion(templateId, versionNumber);
      
      console.log(`✅ Version ${versionNumber} downloaded successfully`);
      setSuccessMessage(`Version ${versionNumber} downloaded successfully!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to download version:', error);
      setError('Failed to download version. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  // Auto-download current version before showing upload modal
  const handleShowUploadModal = async () => {
    try {
      setAutoDownloading(true);
      setError(null);
      setSuccessMessage(null);
      
      console.log('📥 Auto-downloading current version before new version upload...');
      
      // Download the current version first
      await TemplateVersionService.downloadCurrentVersion(templateId);
      
      console.log('✅ Current version downloaded, opening upload modal...');
      setSuccessMessage('Current version downloaded! Now you can upload the new version.');
      
      // Show upload modal after successful download
      setCurrentModal('upload');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (error) {
      console.error('Failed to auto-download current version:', error);
      setError('Failed to download current version. You can still proceed with upload.');
      
      // Still show upload modal even if download fails
      setCurrentModal('upload');
    } finally {
      setAutoDownloading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getVersionBadge = (version: TemplateVersion) => {
    if (version.is_current) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Current
        </span>
      );
    }

    if (version.metadata?.is_rollback) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
          <RotateCcw className="w-3 h-3 mr-1" />
          Rollback
        </span>
      );
    }

    if (version.metadata?.is_initial) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
          <Star className="w-3 h-3 mr-1" />
          Original Version
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
        <History className="w-3 h-3 mr-1" />
        Archive
      </span>
    );
  };

  const handleShowRollbackModal = (versionNumber: number) => {
    setRollbackVersion(versionNumber);
    setCurrentModal('rollback');
    setError(null);
    setSuccessMessage(null);
  };

  const handleBackToHistory = () => {
    setCurrentModal('history');
    setError(null);
    setSuccessMessage(null);
    // Reset form data
    setUploadFile(null);
    setVersionNotes('');
    setRollbackNotes('');
    setRollbackVersion(null);
  };

  const handleCloseAll = () => {
    if (!uploading && !rolling && !autoDownloading) {
      setCurrentModal(null);
      onClose();
    }
  };

  return (
    <>
      {/* Version History Modal */}
      {currentModal === 'history' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                    <GitBranch className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Version History</h2>
                    <p className="text-gray-600">{templateName}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleShowUploadModal}
                    disabled={uploading || rolling || autoDownloading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {autoDownloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        New Version
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCloseAll}
                    disabled={uploading || rolling || autoDownloading}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Status Messages */}
            {(error || successMessage) && (
              <div className="border-b border-gray-200 p-4">
                {error && (
                  <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-800 flex-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {successMessage && (
                  <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-800 flex-1">{successMessage}</p>
                    <button
                      onClick={() => setSuccessMessage(null)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <GitBranch className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Version History</h3>
                  <p className="text-gray-600 mb-4">This template doesn't have any version history yet.</p>
                  <button
                    onClick={handleShowUploadModal}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Version
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((version, index) => (
                    <div
                      key={version.version_id}
                      className={`border rounded-2xl p-6 transition-all duration-300 ${
                        version.is_current
                          ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              version.is_current
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              <span className="font-bold text-sm">v{version.version_number}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-gray-900">
                                  {templateName}
                                </h3>
                                {getVersionBadge(version)}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  {version.created_by_email}
                                </span>
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {formatDate(version.created_at)}
                                </span>
                                <span className="flex items-center">
                                  <HardDrive className="w-3 h-3 mr-1" />
                                  {formatFileSize(version.file_size)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Filename</p>
                              <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                                {version.original_filename}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Version Notes</p>
                              <p className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                {version.version_notes || (version.metadata?.is_initial ? 'Original Version' : 'No notes')}
                              </p>
                            </div>
                          </div>

                          {/* Version metadata */}
                          {version.metadata && Object.keys(version.metadata).length > 0 && (
                            <div className="mb-4">
                              <p className="text-sm font-medium text-gray-700 mb-2">Additional Info</p>
                              <div className="flex flex-wrap gap-2">
                                {version.metadata.is_rollback && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    Rolled back from v{version.metadata.rollback_from_version}
                                  </span>
                                )}
                                {version.metadata.file_size_change && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    version.metadata.file_size_change > 0
                                      ? 'bg-orange-100 text-orange-800'
                                      : version.metadata.file_size_change < 0
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {version.metadata.file_size_change > 0 ? '+' : ''}
                                    {formatFileSize(Math.abs(version.metadata.file_size_change))}
                                  </span>
                                )}
                                {version.metadata.is_initial && (
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                                    Initial version
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col space-y-2 ml-4">
                          <button
                            onClick={() => handleDownloadVersion(version.version_number)}
                            disabled={downloading === version.version_number}
                            className="inline-flex items-center px-3 py-2 border border-green-300 rounded-xl shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {downloading === version.version_number ? (
                              <>
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2" />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                View
                              </>
                            )}
                          </button>
                          
                          {!version.is_current && (
                            <button
                              onClick={() => handleShowRollbackModal(version.version_number)}
                              disabled={uploading || rolling}
                              className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-xl shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Rollback
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload New Version Modal */}
      {currentModal === 'upload' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleBackToHistory}
                    disabled={uploading}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Upload New Version</h3>
                    <p className="text-sm text-gray-600">Replace the current template with a new version</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseAll}
                  disabled={uploading}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Messages */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-800 flex-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-800 flex-1">{successMessage}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select New Document File
                </label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  disabled={uploading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition-all duration-200 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Only .docx files are supported. The current version will be preserved in history.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Version Notes (Optional)
                </label>
                <textarea
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  disabled={uploading}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition-all duration-200 resize-none disabled:opacity-50"
                  placeholder="Describe what changed in this version..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">What happens next:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Current version becomes v{currentVersion} in history</li>
                      <li>• New file becomes v{currentVersion + 1} (current)</li>
                      <li>• Template content is updated immediately</li>
                      <li>• All tags and mappings are preserved</li>
                      <li>• You can rollback anytime if needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile || uploading}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Creating Version...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Create New Version
                    </>
                  )}
                </button>
                <button
                  onClick={handleBackToHistory}
                  disabled={uploading}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {currentModal === 'rollback' && rollbackVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleBackToHistory}
                    disabled={rolling}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Rollback to Version {rollbackVersion}</h3>
                    <p className="text-sm text-gray-600">This will update the current template content</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseAll}
                  disabled={rolling}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Messages */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-800 flex-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-800 flex-1">{successMessage}</p>
                  </div>
                </div>
              )}

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-orange-900 mb-1">Rollback Process:</h4>
                    <ul className="text-sm text-orange-800 space-y-1">
                      <li>• Current template content will be replaced with version {rollbackVersion}</li>
                      <li>• Version {rollbackVersion} will become the current version</li>
                      <li>• All version history will be preserved</li>
                      <li>• Template content is updated immediately</li>
                      <li>• This action can be undone by rolling back again</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rollback Notes (Optional)
                </label>
                <textarea
                  value={rollbackNotes}
                  onChange={(e) => setRollbackNotes(e.target.value)}
                  disabled={rolling}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 resize-none disabled:opacity-50"
                  placeholder="Explain why you're rolling back to this version..."
                />
              </div>
            </div>

            <div className="border-t border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => handleRollback(rollbackVersion)}
                  disabled={rolling}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rolling ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Rolling Back...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Confirm Rollback
                    </>
                  )}
                </button>
                <button
                  onClick={handleBackToHistory}
                  disabled={rolling}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};