import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Search,
  Filter,
  Eye,
  Trash2,
  ExternalLink,
  Package,
  Zap,
  Archive
} from 'lucide-react';
import { GenerationService } from '../services/generationService';
import { StorageService } from '../services/storageService';
import type { DocumentGeneration } from '../lib/supabase';

interface GeneratedDocumentsProps {
  onClose?: () => void;
}

export const GeneratedDocuments: React.FC<GeneratedDocumentsProps> = ({ onClose }) => {
  const [generations, setGenerations] = useState<DocumentGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'processing'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadGenerations();
  }, []);

  const loadGenerations = async () => {
    try {
      setLoading(true);
      const data = await GenerationService.getGenerations({ limit: 50 });
      setGenerations(data);
    } catch (error) {
      console.error('Failed to load generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (generation: DocumentGeneration) => {
    if (!generation.file_urls || generation.file_urls.length === 0) {
      alert('No files available for download');
      return;
    }

    try {
      setDownloadingId(generation.id);
      
      for (let i = 0; i < generation.file_urls.length; i++) {
        const fileUrl = generation.file_urls[i];
        const fileName = generation.output_filenames[i] || `document_${i + 1}.docx`;
        
        // Download from storage
        const fileBuffer = await StorageService.downloadGeneratedDocument(fileUrl);
        
        // Create blob and download
        const blob = new Blob([fileBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download files:', error);
      alert('Failed to download files. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (generationId: string) => {
    if (!confirm('Are you sure you want to delete this generation record? The files will also be removed from storage.')) {
      return;
    }

    try {
      const generation = generations.find(g => g.id === generationId);
      
      // Delete files from storage
      if (generation?.file_urls) {
        for (const fileUrl of generation.file_urls) {
          try {
            await StorageService.deleteGeneratedDocument(fileUrl);
          } catch (error) {
            console.error('Failed to delete file from storage:', error);
          }
        }
      }
      
      // Delete generation record
      await GenerationService.deleteGeneration(generationId);
      
      // Reload generations
      await loadGenerations();
    } catch (error) {
      console.error('Failed to delete generation:', error);
      alert('Failed to delete generation. Please try again.');
    }
  };

  const filteredGenerations = generations.filter(generation => {
    const matchesSearch = generation.template?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         generation.output_filenames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || generation.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'processing':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      {/* Header */}
      <div className="border-b border-gray-200/50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Generated Documents</h2>
              <p className="text-sm text-gray-600">Download and manage your generated documents</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 font-medium">
            {filteredGenerations.length} of {generations.length} generations
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
              placeholder="Search by template name or filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-sm appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Generations List */}
      <div className="p-4 sm:p-6">
        {filteredGenerations.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Archive className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">
              {searchTerm || statusFilter !== 'all' ? 'No generations found' : 'No documents generated yet'}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto leading-relaxed px-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start generating documents from your templates to see them here.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGenerations.map((generation) => (
              <div
                key={generation.id}
                className="border border-gray-200 rounded-2xl p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-white/60 backdrop-blur-sm hover:bg-white/80"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                          {generation.template?.name || 'Unknown Template'}
                        </h3>
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(generation.created_at)}
                          </span>
                          <span className="flex items-center">
                            <Package className="w-3 h-3 mr-1" />
                            {generation.documents_count} document{generation.documents_count !== 1 ? 's' : ''}
                          </span>
                          {generation.file_size_total > 0 && (
                            <span className="flex items-center">
                              <Download className="w-3 h-3 mr-1" />
                              {formatFileSize(generation.file_size_total)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center space-x-2 mb-3">
                      {getStatusIcon(generation.status)}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(generation.status)}`}>
                        {generation.status.charAt(0).toUpperCase() + generation.status.slice(1)}
                      </span>
                      {generation.generation_type === 'batch' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Zap className="w-3 h-3 mr-1" />
                          Batch
                        </span>
                      )}
                    </div>

                    {/* Files */}
                    {generation.output_filenames && generation.output_filenames.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Generated Files:</p>
                        <div className="flex flex-wrap gap-2">
                          {generation.output_filenames.map((filename, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              {filename}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {generation.status === 'failed' && generation.error_message && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">
                          <strong>Error:</strong> {generation.error_message}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 sm:ml-4">
                    {generation.status === 'completed' && generation.file_urls && generation.file_urls.length > 0 && (
                      <button
                        onClick={() => handleDownload(generation)}
                        disabled={downloadingId === generation.id}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                      >
                        {downloadingId === generation.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(generation.id)}
                      className="inline-flex items-center justify-center px-4 py-2 border border-red-300 rounded-xl shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};