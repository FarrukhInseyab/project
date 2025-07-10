import React, { useState, useEffect } from 'react';
import { CloudConvertService } from '../services/cloudConvertService';
import { OnlyOfficeService } from '../services/onlyOfficeService';
import { Key, Save, Trash2, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle, Server, FileType, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CloudConvertSettingsProps {
  onClose: () => void;
}

export const CloudConvertSettings: React.FC<CloudConvertSettingsProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfConversionMethod, setPdfConversionMethod] = useState<'cloudconvert' | 'onlyoffice'>('cloudconvert');
  const [onlyOfficeUrl, setOnlyOfficeUrl] = useState('');
  const [testingOnlyOffice, setTestingOnlyOffice] = useState(false);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');

  useEffect(() => {
    checkConfiguration();
    loadSettings();
  }, []);

  const checkConfiguration = async () => {
    try {
      setLoading(true);
      const configured = await CloudConvertService.isConfigured();
      setIsConfigured(configured);
    } catch (error) {
      console.error('Failed to check OnlineConverter configuration:', error);
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load OnlyOffice settings
      const settings = await OnlyOfficeService.loadSettings();
      setOnlyOfficeUrl(settings.serverUrl);
      setPdfConversionMethod(settings.pdfConversionMethod as 'cloudconvert' | 'onlyoffice');
      
      // Check server status
      const isAvailable = await OnlyOfficeService.checkServerAvailability(settings.serverUrl);
      setServerStatus(isAvailable ? 'available' : 'unavailable');
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      setServerStatus('unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      
      await CloudConvertService.saveApiKey(apiKey.trim());
      setIsConfigured(true);
      setMessage({ type: 'success', text: 'OnlineConverter API key saved successfully!' });
      setApiKey('');
    } catch (error) {
      console.error('Failed to save API key:', error);
      setMessage({ type: 'error', text: 'Failed to save API key. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove the OnlineConverter API key? PDF generation will be disabled.')) {
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      
      await CloudConvertService.removeApiKey();
      setIsConfigured(false);
      setMessage({ type: 'success', text: 'OnlineConverter API key removed successfully.' });
    } catch (error) {
      console.error('Failed to remove API key:', error);
      setMessage({ type: 'error', text: 'Failed to remove API key. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      // Save OnlyOffice URL and PDF conversion method to user preferences
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const updatedPreferences = {
        ...profile?.preferences,
        onlyoffice_url: onlyOfficeUrl.trim(),
        pdf_conversion_method: pdfConversionMethod
      };

      const { error } = await supabase
        .from('profiles')
        .update({ preferences: updatedPreferences })
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Update OnlyOffice service with new URL
      OnlyOfficeService.setServerUrl(onlyOfficeUrl.trim());
      
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Check server status after saving
      const isAvailable = await OnlyOfficeService.checkServerAvailability(onlyOfficeUrl.trim());
      setServerStatus(isAvailable ? 'available' : 'unavailable');
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const testOnlyOfficeConnection = async () => {
    try {
      setTestingOnlyOffice(true);
      setMessage(null);
      
      const isAvailable = await OnlyOfficeService.checkServerAvailability(onlyOfficeUrl.trim());
      setServerStatus(isAvailable ? 'available' : 'unavailable');
      
      if (isAvailable) {
        setMessage({ type: 'success', text: 'My Editor server is available and responding' });
      } else {
        setMessage({ type: 'error', text: 'My Editor server is not responding. Please check the URL and server status.' });
      }
    } catch (error) {
      console.error('Failed to test My Editor connection:', error);
      setMessage({ type: 'error', text: 'Failed to connect to My Editor server' });
      setServerStatus('unavailable');
    } finally {
      setTestingOnlyOffice(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <Key className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Document Settings</h2>
                <p className="text-sm text-gray-600">Configure PDF generation and document editing</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* PDF Conversion Method */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileType className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">PDF Conversion Method</h3>
            </div>
            
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="cloudconvert"
                  name="pdfConversionMethod"
                  value="cloudconvert"
                  checked={pdfConversionMethod === 'cloudconvert'}
                  onChange={() => setPdfConversionMethod('cloudconvert')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="cloudconvert" className="ml-2 block text-sm text-gray-900">
                  OnlineConverter
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="onlyoffice"
                  name="pdfConversionMethod"
                  value="onlyoffice"
                  checked={pdfConversionMethod === 'onlyoffice'}
                  onChange={() => setPdfConversionMethod('onlyoffice')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="onlyoffice" className="ml-2 block text-sm text-gray-900">
                  My Editor
                </label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileType className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-900">PDF Conversion Options</h4>
              </div>
              <p className="text-sm text-blue-800">
                <strong>OnlineConverter:</strong> Uses the OnlineConverter API (requires API key).<br />
                <strong>My Editor:</strong> Uses your My Editor server for conversion (requires server configuration).
              </p>
            </div>
          </div>

          {/* OnlyOffice Settings */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Server className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">My Editor Server</h3>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                My Editor Server URL
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={onlyOfficeUrl}
                  onChange={(e) => setOnlyOfficeUrl(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder="http://your-editor-server:8082"
                />
                <button
                  onClick={testOnlyOfficeConnection}
                  disabled={testingOnlyOffice || !onlyOfficeUrl.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 flex items-center"
                >
                  {testingOnlyOffice ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Test
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the URL of your My Editor Document Server
              </p>
              
              {/* Server Status */}
              <div className={`mt-2 flex items-center ${
                serverStatus === 'available' ? 'text-green-600' : 
                serverStatus === 'unavailable' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {serverStatus === 'available' ? (
                  <CheckCircle className="w-4 h-4 mr-1" />
                ) : serverStatus === 'unavailable' ? (
                  <AlertCircle className="w-4 h-4 mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                <span className="text-xs font-medium">
                  {serverStatus === 'available' ? 'Server is available' : 
                   serverStatus === 'unavailable' ? 'Server is not available' : 
                   'Server status unknown'}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <ExternalLink className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-900">My Editor Integration</h4>
              </div>
              <p className="text-xs text-blue-800">
                My Editor provides a full-featured document editor for creating and editing templates. 
                Make sure your My Editor server is accessible from your browser.
              </p>
              <div className="mt-2 text-xs text-blue-800">
                <p className="font-semibold">Common Issues:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>Check that your server URL is correct and includes the protocol (http:// or https://)</li>
                  <li>Ensure your server allows cross-origin requests (CORS)</li>
                  <li>Verify that your server is running and accessible from your browser</li>
                  <li>Try using a public OnlyOffice server if you don't have your own</li>
                </ul>
              </div>
            </div>
          </div>

          {/* CloudConvert Settings */}
          {pdfConversionMethod === 'cloudconvert' && (
            <div className="space-y-4 border-t border-gray-200 pt-6">
              {/* Status */}
              <div className={`p-4 rounded-xl border ${
                isConfigured 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex items-center space-x-3">
                  {isConfigured ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      isConfigured ? 'text-green-800' : 'text-orange-800'
                    }`}>
                      {isConfigured ? 'OnlineConverter Configured' : 'OnlineConverter Not Configured'}
                    </p>
                    <p className={`text-sm ${
                      isConfigured ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {isConfigured 
                        ? 'PDF generation is enabled and ready to use'
                        : 'Add your API key to enable PDF generation'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-2">How to get your OnlineConverter API Key:</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Visit <a href="https://cloudconvert.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">cloudconvert.com</a></li>
                  <li>Sign up for a free account (includes 25 free conversions/day)</li>
                  <li>Go to your Dashboard → API Keys</li>
                  <li>Create a new API key with "read" and "write" permissions</li>
                  <li>Copy the API key and paste it below</li>
                </ol>
                <a 
                  href="https://cloudconvert.com/api/v2" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  OnlineConverter API Documentation
                </a>
              </div>

              {/* API Key Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    OnlineConverter API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl shadow-sm focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                      placeholder={isConfigured ? 'Enter new API key to update' : 'Enter your OnlineConverter API key'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* CloudConvert Actions */}
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || !apiKey.trim()}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {isConfigured ? 'Update API Key' : 'Save API Key'}
                  </button>
                  
                  {isConfigured && (
                    <button
                      onClick={handleRemove}
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-red-300 rounded-xl shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove API Key
                    </button>
                  )}
                </div>
              </div>

              {/* Pricing Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">OnlineConverter Pricing:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>Free:</strong> 25 conversions per day</li>
                  <li>• <strong>Prepaid:</strong> $0.008 per conversion (no monthly fee)</li>
                  <li>• <strong>Subscription:</strong> Starting at $9/month for 1,000 conversions</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Perfect for most users - the free tier covers typical daily usage.
                </p>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-xl ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Save Settings Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save All Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};