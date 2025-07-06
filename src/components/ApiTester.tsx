import React, { useState, useEffect, useRef } from 'react';
import { 
  Code, 
  Send, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clipboard, 
  Terminal, 
  Zap, 
  BookOpen,
  Layers,
  Server,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Info,
  FileType,
  AlignLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  error?: string;
  textContent?: string;
}

export const ApiTester: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'customer' | 'templates' | 'docs' | 'advanced'>('generate');
  const [customerNo, setCustomerNo] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<boolean>(true);
  const [outputFormat, setOutputFormat] = useState<'docx' | 'pdf'>('docx');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyLoaded, setApiKeyLoaded] = useState<boolean>(false);
  const fileDownloadRef = useRef<HTMLAnchorElement>(null);
  
  // Advanced API state
  const [advancedTemplateId, setAdvancedTemplateId] = useState<string>('');
  const [jsonData, setJsonData] = useState<string>('');
  const [outputType, setOutputType] = useState<'docx' | 'pdf' | 'text'>('docx');
  const [textOutput, setTextOutput] = useState<string>('');
  const [showTextOutput, setShowTextOutput] = useState<boolean>(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    loadApiKey();
  }, []);

  // Load API key from user preferences
  const loadApiKey = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      if (profile?.preferences?.api_key) {
        setApiKey(profile.preferences.api_key);
      }
      
      setApiKeyLoaded(true);
    } catch (error) {
      console.error('Failed to load API key:', error);
      setApiKeyLoaded(true);
    }
  };

  // Save API key to user preferences
  const saveApiKey = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const updatedPreferences = {
        ...profile?.preferences,
        api_key: apiKey
      };

      const { error } = await supabase
        .from('profiles')
        .update({ preferences: updatedPreferences })
        .eq('user_id', user.id);

      if (error) throw error;
      
      alert('API key saved successfully');
    } catch (error) {
      console.error('Failed to save API key:', error);
      setError(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

const generateApiKey = async () => {
  try {
    // Generate a random API key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const newApiKey = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    setApiKey(newApiKey);  // Update the state to reflect the new key

    // Save the new API key to user preferences
    await saveApiKey(newApiKey);  // Ensure the key is saved to the user's profile without any page redirection
  } catch (error) {
    console.error('Failed to generate API key:', error);
    setError(`Failed to generate API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

  // Load templates from the database
  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('document_templates')
        .select(`
          id, 
          name, 
          description, 
          original_filename,
          updated_at,
          tags:template_tags(id, name, display_name)
        `)
        .order('name');
      
      if (error) throw error;
      
      setTemplates(data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setError(`Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle document generation
  const handleGenerateDocument = async () => {
    if (!customerNo) {
      setError('Customer number is required');
      return;
    }
    
    if (!templateId) {
      setError('Template ID is required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setResponse(null);
      
      // Get the API URL
      const apiUrl = `${supabase.supabaseUrl}/functions/v1/document-api/generate-document`;
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "generate",
          customerNo,
          templateId,
          updateStatus,
          outputFormat
        })
      });
      
      // Get response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Check if response is a document
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || 
          contentType.includes('application/pdf')) {
        // It's a document, handle download
        const blob = await response.blob();
        
        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `document.${outputFormat}`;
        
        // Create download link
        const url = URL.createObjectURL(blob);
        
        if (fileDownloadRef.current) {
          fileDownloadRef.current.href = url;
          fileDownloadRef.current.download = filename;
          fileDownloadRef.current.click();
          URL.revokeObjectURL(url);
        }
        
        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers,
          body: `Document downloaded: ${filename}`
        });
      } else {
        // It's JSON or an error
        const responseData = await response.json();
        
        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers,
          body: responseData,
          error: responseData.error
        });
      }
    } catch (error) {
      console.error('Error generating document:', error);
      setError(`Error generating document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle customer data fetch
  const handleGetCustomerData = async () => {
    if (!customerNo) {
      setError('Customer number is required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setResponse(null);
      
      // Get the API URL
      const apiUrl = `${supabase.supabaseUrl}/functions/v1/document-api/customer-data?customerNo=${customerNo}`;
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Get response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Parse response
      const responseData = await response.json();
      
      setResponse({
        status: response.status,
        statusText: response.statusText,
        headers,
        body: responseData,
        error: responseData.error
      });
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setError(`Error fetching customer data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle templates fetch
  const handleGetTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      setResponse(null);
      
      // Get the API URL
      const apiUrl = `${supabase.supabaseUrl}/functions/v1/document-api/templates`;
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Get response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Parse response
      const responseData = await response.json();
      
      setResponse({
        status: response.status,
        statusText: response.statusText,
        headers,
        body: responseData,
        error: responseData.error
      });
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError(`Error fetching templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle advanced API document generation
  const handleAdvancedGenerate = async () => {
    if (!advancedTemplateId) {
      setError('Template ID is required');
      return;
    }
    
    if (!jsonData) {
      setError('JSON data is required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setResponse(null);
      setTextOutput('');
      setShowTextOutput(false);
      
      // Get the API URL
      const apiUrl = `${supabase.supabaseUrl}/functions/v1/document-api/generate`;
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Parse JSON data to validate it
      let parsedData;
      try {
        parsedData = JSON.parse(jsonData);
      } catch (e) {
        throw new Error('Invalid JSON data. Please check your syntax.');
      }
      
      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "generate",
          templateId: advancedTemplateId,
          jsonData: parsedData,
          outputType: outputType
        })
      });
      
      // Get response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Check content type
      const contentType = response.headers.get('Content-Type') || '';
      
      if (outputType === 'text') {
        // Handle text output
        const textContent = await response.text();
        setTextOutput(textContent);
        setShowTextOutput(true);
        
        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers,
          body: 'Text content generated successfully',
          textContent
        });
      } 
      else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || 
               contentType.includes('application/pdf')) {
        // It's a document, handle download
        const blob = await response.blob();
        
        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `document.${outputType}`;
        
        // Create download link
        const url = URL.createObjectURL(blob);
        
        if (fileDownloadRef.current) {
          fileDownloadRef.current.href = url;
          fileDownloadRef.current.download = filename;
          fileDownloadRef.current.click();
          URL.revokeObjectURL(url);
        }
        
        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers,
          body: `Document downloaded: ${filename}`
        });
      } else {
        // It's JSON or an error
        const responseData = await response.json();
        
        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers,
          body: responseData,
          error: responseData.error
        });
      }
    } catch (error) {
      console.error('Error generating document:', error);
      setError(`Error generating document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Copy response to clipboard
  const handleCopyResponse = async () => {
    if (!response) return;
    
    const responseText = JSON.stringify(response, null, 2);
    navigator.clipboard.writeText(responseText);
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy text output to clipboard
  const handleCopyTextOutput = async () => {
    if (!textOutput) return;
    
    navigator.clipboard.writeText(textOutput);
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy code snippet to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter templates based on search term
  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Toggle template expansion
  const toggleTemplateExpansion = (id: string) => {
    if (expandedTemplate === id) {
      setExpandedTemplate(null);
    } else {
      setExpandedTemplate(id);
    }
  };

  // Handle template selection for advanced API
  const handleAdvancedTemplateSelect = (template: any) => {
    setAdvancedTemplateId(template.id);
    
    // Generate sample JSON data based on template tags
    if (template.tags && template.tags.length > 0) {
      const sampleData: Record<string, string> = {};
      
      template.tags.forEach((tag: any) => {
        const tagName = tag.name;
        const displayName = tag.display_name || tagName;
        
        // Generate appropriate sample data based on tag name
        let sampleValue = `Sample ${displayName}`;
        
        if (tagName.includes('date') || displayName.toLowerCase().includes('date')) {
          sampleValue = new Date().toISOString().split('T')[0];
        } else if (tagName.includes('name') || displayName.toLowerCase().includes('name')) {
          sampleValue = 'John Doe';
        } else if (tagName.includes('email') || displayName.toLowerCase().includes('email')) {
          sampleValue = 'john.doe@example.com';
        } else if (tagName.includes('phone') || displayName.toLowerCase().includes('phone')) {
          sampleValue = '+1 (555) 123-4567';
        } else if (tagName.includes('address') || displayName.toLowerCase().includes('address')) {
          sampleValue = '123 Main St, Anytown, CA 12345';
        } else if (tagName.includes('amount') || displayName.toLowerCase().includes('amount')) {
          sampleValue = '$1,234.56';
        } else if (tagName.includes('number') || displayName.toLowerCase().includes('number')) {
          sampleValue = '12345';
        }
        
        sampleData[tagName] = sampleValue;
      });
      
      setJsonData(JSON.stringify(sampleData, null, 2));
    }
  };

  // Render the generate document tab
  const renderGenerateTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Number *
            </label>
            <input
              type="text"
              value={customerNo}
              onChange={(e) => setCustomerNo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter customer number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template ID *
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500"
                placeholder="Select a template below"
              />
              <button
                onClick={loadTemplates}
                disabled={loading}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                title="Refresh templates"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="updateStatus"
                checked={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="updateStatus" className="ml-2 text-sm text-gray-700">
                Update Status to "Current"
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Format:</label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as 'docx' | 'pdf')}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="docx">DOCX</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={handleGenerateDocument}
            disabled={loading || !customerNo || !templateId}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Generate Document
              </>
            )}
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Available Templates</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No templates found</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {filteredTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200"
                >
                  <div 
                    className="p-3 cursor-pointer flex items-center justify-between"
                    onClick={() => toggleTemplateExpansion(template.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{template.name}</h4>
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {template.original_filename}
                        </p>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      {expandedTemplate === template.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  
                  {expandedTemplate === template.id && (
                    <div className="p-3 pt-0 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">ID:</p>
                          <p className="text-xs font-mono bg-gray-50 p-1 rounded">{template.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Updated:</p>
                          <p className="text-xs">{formatDate(template.updated_at)}</p>
                        </div>
                      </div>
                      
                      {template.description && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500">Description:</p>
                          <p className="text-xs text-gray-700">{template.description}</p>
                        </div>
                      )}
                      
                      {template.tags && template.tags.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.tags.map((tag: any) => (
                              <span 
                                key={tag.id}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {tag.display_name || tag.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplateId(template.id);
                        }}
                        className="mt-3 w-full flex items-center justify-center px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />
                        Use this template
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden download link */}
      <a ref={fileDownloadRef} className="hidden" />
      
      {/* Advanced Settings */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 mr-1" />
          ) : (
            <ChevronDown className="w-4 h-4 mr-1" />
          )}
          Advanced Settings
        </button>
        
        {showAdvanced && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-sm font-medium text-gray-700 mb-3">API Key Management</h3>
            
            <div className="flex items-end space-x-2 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Your API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="No API key set"
                />
              </div>
              <button
                onClick={saveApiKey}
                disabled={!apiKey.trim()}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={generateApiKey}
                className="px-3 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
              >
                Generate New
              </button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 mr-2" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Using Your API Key</p>
                  <p className="mb-2">
                    Include your API key in the Authorization header when making requests from external applications:
                  </p>
                  <pre className="bg-blue-100 p-2 rounded overflow-x-auto">
                    <code>Authorization: Bearer {apiKey || 'your-api-key'}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render the customer data tab
  const renderCustomerTab = () => (
    <div className="space-y-6">
      <div className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Number *
            </label>
            <input
              type="text"
              value={customerNo}
              onChange={(e) => setCustomerNo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter customer number"
            />
          </div>
          
          <button
            onClick={handleGetCustomerData}
            disabled={loading || !customerNo}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Database className="w-5 h-5 mr-2" />
                Get Customer Data
              </>
            )}
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
            <Info className="w-4 h-4 mr-1" />
            API Endpoint Information
          </h3>
          <p className="text-xs text-blue-700 mb-2">
            This endpoint retrieves customer data from the ProofofDebitAPI table using the customer number.
          </p>
          <div className="bg-blue-100 p-2 rounded-lg">
            <code className="text-xs font-mono text-blue-900">
              GET /functions/v1/document-api/customer-data?customerNo=123456
            </code>
          </div>
        </div>
      </div>
    </div>
  );

  // Render the templates tab
  const renderTemplatesTab = () => (
    <div className="space-y-6">
      <div className="max-w-xl">
        <button
          onClick={handleGetTemplates}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              Get Available Templates
            </>
          )}
        </button>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
            <Info className="w-4 h-4 mr-1" />
            API Endpoint Information
          </h3>
          <p className="text-xs text-blue-700 mb-2">
            This endpoint retrieves all templates available to the authenticated user.
          </p>
          <div className="bg-blue-100 p-2 rounded-lg">
            <code className="text-xs font-mono text-blue-900">
              GET /functions/v1/document-api/templates
            </code>
          </div>
        </div>
      </div>
    </div>
  );

  // Render the advanced API tab
  const renderAdvancedTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template ID *
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={advancedTemplateId}
                onChange={(e) => setAdvancedTemplateId(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500"
                placeholder="Select a template below"
              />
              <button
                onClick={loadTemplates}
                disabled={loading}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                title="Refresh templates"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              JSON Data *
            </label>
            <textarea
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 font-mono text-sm h-64"
              placeholder='{"clientName": "John Doe", "date": "2024-06-28"}'
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter JSON data to populate the template. Select a template below to auto-populate with sample data.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Output Format:</label>
              <select
                value={outputType}
                onChange={(e) => setOutputType(e.target.value as 'docx' | 'pdf' | 'text')}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="docx">DOCX</option>
                <option value="pdf">PDF</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={handleAdvancedGenerate}
            disabled={loading || !advancedTemplateId || !jsonData}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {outputType === 'docx' && <FileText className="w-5 h-5 mr-2" />}
                {outputType === 'pdf' && <FileText className="w-5 h-5 mr-2" />}
                {outputType === 'text' && <AlignLeft className="w-5 h-5 mr-2" />}
                Generate {outputType.toUpperCase()}
              </>
            )}
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Available Templates</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No templates found</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {filteredTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200"
                >
                  <div 
                    className="p-3 cursor-pointer flex items-center justify-between"
                    onClick={() => toggleTemplateExpansion(template.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{template.name}</h4>
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {template.original_filename}
                        </p>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      {expandedTemplate === template.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  
                  {expandedTemplate === template.id && (
                    <div className="p-3 pt-0 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">ID:</p>
                          <p className="text-xs font-mono bg-gray-50 p-1 rounded">{template.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Updated:</p>
                          <p className="text-xs">{formatDate(template.updated_at)}</p>
                        </div>
                      </div>
                      
                      {template.description && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500">Description:</p>
                          <p className="text-xs text-gray-700">{template.description}</p>
                        </div>
                      )}
                      
                      {template.tags && template.tags.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.tags.map((tag: any) => (
                              <span 
                                key={tag.id}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                              >
                                {tag.display_name || tag.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdvancedTemplateSelect(template);
                        }}
                        className="mt-3 w-full flex items-center justify-center px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />
                        Use this template
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Text Output Display */}
      {showTextOutput && textOutput && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Text Output</h3>
            <button
              onClick={handleCopyTextOutput}
              className="flex items-center text-purple-600 hover:text-purple-800"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </button>
          </div>
          
          <div className="bg-gray-100 rounded-xl p-4 overflow-x-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">{textOutput}</pre>
          </div>
        </div>
      )}
      
      {/* Hidden download link */}
      <a ref={fileDownloadRef} className="hidden" />
      
      <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <h3 className="text-sm font-medium text-purple-800 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-1" />
          Advanced API Endpoint Information
        </h3>
        <p className="text-xs text-purple-700 mb-2">
          This endpoint generates documents directly from JSON data without requiring a customer number.
        </p>
        <div className="bg-purple-100 p-2 rounded-lg mb-2">
          <code className="text-xs font-mono text-purple-900">
            POST /functions/v1/document-api/generate
          </code>
        </div>
        <p className="text-xs text-purple-700 mb-2">
          Request body:
        </p>
        <pre className="bg-purple-100 p-2 rounded-lg text-xs font-mono text-purple-900 overflow-x-auto mb-2">
{`{
  "templateId": "uuid",
  "jsonData": { ... },
  "outputType": "docx" | "pdf" | "text"
}`}
        </pre>
        <p className="text-xs text-purple-700">
          When outputType is "text", the response will be plain text content instead of a file download.
        </p>
      </div>
    </div>
  );

  // Render the documentation tab
  const renderDocsTab = () => {
    // Define a fixed template name for the example
    const exampleTemplateName = "example-template";
    
    return (
      <div className="space-y-8">
        <div className="prose max-w-none">
          <h2 className="text-xl font-bold text-gray-900 mb-4">API Documentation</h2>
          <p className="text-gray-700">
            The Document API provides endpoints for generating documents, retrieving customer data, and listing available templates.
            All endpoints require authentication using a Bearer token.
          </p>
          
          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Authentication</h3>
          <p className="text-gray-700 mb-3">
            All API requests require authentication using a Bearer token in the Authorization header.
          </p>
          <div className="bg-gray-100 p-3 rounded-lg mb-4">
            <code className="text-sm font-mono">
              Authorization: Bearer your-api-key
            </code>
          </div>
          <p className="text-gray-700">
            You can generate and manage your API key in the Advanced Settings section of the Generate Document tab.
          </p>
          
          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Endpoints</h3>
          
          {/* Generate Document Endpoint */}
          <div className="border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <div className="px-2 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-medium">POST</div>
              <code className="text-sm font-mono">/functions/v1/document-api/generate-document</code>
            </div>
            <p className="text-gray-700 mb-3">
              Generates a document based on a template and customer data.
            </p>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Request Body</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "customerNo": "123456",     // Required: Customer number
  "templateId": "uuid",       // Required: Template ID
  "updateStatus": true,       // Optional: Update customer status to "Current" (default: true)
  "outputFormat": "docx"      // Optional: Output format, "docx" or "pdf" (default: "docx")
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Response</h4>
            <p className="text-gray-700 mb-2">
              Returns the generated document as a file download with appropriate Content-Type header:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3">
              <li>DOCX: <code className="text-xs font-mono">application/vnd.openxmlformats-officedocument.wordprocessingml.document</code></li>
              <li>PDF: <code className="text-xs font-mono">application/pdf</code></li>
            </ul>
            <p className="text-gray-700 mb-2">
              Content-Disposition header will include the filename:
            </p>
            <pre className="bg-gray-100 p-2 rounded-lg mb-4 overflow-x-auto">
              <code className="text-xs font-mono">{`Content-Disposition: attachment; filename="${exampleTemplateName}.docx"`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Error Response</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "error": "Error message"
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Example</h4>
            <div className="bg-gray-100 p-3 rounded-lg mb-2 overflow-x-auto">
              <code className="text-sm font-mono">{`curl -X POST "${supabase.supabaseUrl}/functions/v1/document-api/generate-document" \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{"customerNo": "123456", "templateId": "550e8400-e29b-41d4-a716-446655440000", "outputFormat": "pdf"}'`}</code>
            </div>
            <button
              onClick={() => handleCopyCode(`curl -X POST "${supabase.supabaseUrl}/functions/v1/document-api/generate-document" \\
  -H "Authorization: Bearer ${apiKey || 'your-api-key'}" \\
  -H "Content-Type: application/json" \\
  -d '{"customerNo": "123456", "templateId": "550e8400-e29b-41d4-a716-446655440000", "outputFormat": "pdf"}'`)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy example
            </button>
          </div>
          
          {/* Advanced Generate Endpoint */}
          <div className="border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-medium">POST</div>
              <code className="text-sm font-mono">/functions/v1/document-api/generate</code>
            </div>
            <p className="text-gray-700 mb-3">
              Generates a document based on a template and JSON data without requiring a customer number.
            </p>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Request Body</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "templateId": "uuid",       // Required: Template ID
  "jsonData": { ... },        // Required: JSON data to populate the template
  "outputType": "docx"        // Optional: Output type, "docx", "pdf", or "text" (default: "docx")
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Response</h4>
            <p className="text-gray-700 mb-2">
              Returns the generated document based on the requested output type:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3">
              <li>DOCX: File download with <code className="text-xs font-mono">application/vnd.openxmlformats-officedocument.wordprocessingml.document</code></li>
              <li>PDF: File download with <code className="text-xs font-mono">application/pdf</code></li>
              <li>Text: Plain text content with <code className="text-xs font-mono">text/plain</code></li>
            </ul>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Error Response</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "error": "Error message"
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Example</h4>
            <div className="bg-gray-100 p-3 rounded-lg mb-2 overflow-x-auto">
              <code className="text-sm font-mono">{`curl -X POST "${supabase.supabaseUrl}/functions/v1/document-api/generate" \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{"templateId": "550e8400-e29b-41d4-a716-446655440000", "jsonData": {"clientName": "John Doe", "date": "2024-06-28"}, "outputType": "text"}'`}</code>
            </div>
            <button
              onClick={() => handleCopyCode(`curl -X POST "${supabase.supabaseUrl}/functions/v1/document-api/generate" \\
  -H "Authorization: Bearer ${apiKey || 'your-api-key'}" \\
  -H "Content-Type: application/json" \\
  -d '{"templateId": "550e8400-e29b-41d4-a716-446655440000", "jsonData": {"clientName": "John Doe", "date": "2024-06-28"}, "outputType": "text"}'`)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy example
            </button>
          </div>
          
          {/* Customer Data Endpoint */}
          <div className="border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">GET</div>
              <code className="text-sm font-mono">/functions/v1/document-api/customer-data</code>
            </div>
            <p className="text-gray-700 mb-3">
              Retrieves customer data from the ProofofDebitAPI table.
            </p>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Query Parameters</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`customerNo    // Required: Customer number`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Response</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "data": {
    "customerno": 123456,
    "customername": "John Doe",
    "accountno": "ACC123456",
    // Other customer fields...
  }
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Error Response</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "error": "Error message"
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Example</h4>
            <div className="bg-gray-100 p-3 rounded-lg mb-2 overflow-x-auto">
              <code className="text-sm font-mono">{`curl "${supabase.supabaseUrl}/functions/v1/document-api/customer-data?customerNo=123456" \\
  -H "Authorization: Bearer your-api-key"`}</code>
            </div>
            <button
              onClick={() => handleCopyCode(`curl "${supabase.supabaseUrl}/functions/v1/document-api/customer-data?customerNo=123456" \\
  -H "Authorization: Bearer ${apiKey || 'your-api-key'}"`)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy example
            </button>
          </div>
          
          {/* Templates Endpoint */}
          <div className="border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">GET</div>
              <code className="text-sm font-mono">/functions/v1/document-api/templates</code>
            </div>
            <p className="text-gray-700 mb-3">
              Retrieves all templates available to the authenticated user.
            </p>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Response</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Invoice Template",
      "description": "Standard invoice template",
      "original_filename": "invoice.docx",
      "updated_at": "2023-01-01T12:00:00Z",
      "tags_csv": "client_name, invoice_number, date, amount",
      "tag_display_names_csv": "Client Name, Invoice Number, Date, Amount"
    },
    // More templates...
  ]
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Error Response</h4>
            <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
              <code className="text-sm font-mono">{`{
  "error": "Error message"
}`}</code>
            </pre>
            
            <h4 className="text-base font-medium text-gray-900 mb-2">Example</h4>
            <div className="bg-gray-100 p-3 rounded-lg mb-2 overflow-x-auto">
              <code className="text-sm font-mono">{`curl "${supabase.supabaseUrl}/functions/v1/document-api/templates" \\
  -H "Authorization: Bearer your-api-key"`}</code>
            </div>
            <button
              onClick={() => handleCopyCode(`curl "${supabase.supabaseUrl}/functions/v1/document-api/templates" \\
  -H "Authorization: Bearer ${apiKey || 'your-api-key'}"`)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy example
            </button>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Error Handling</h3>
          <p className="text-gray-700 mb-3">
            All API endpoints return appropriate HTTP status codes:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4">
            <li><strong>200 OK</strong>: Request successful</li>
            <li><strong>400 Bad Request</strong>: Invalid request parameters</li>
            <li><strong>401 Unauthorized</strong>: Missing or invalid authentication</li>
            <li><strong>404 Not Found</strong>: Resource not found</li>
            <li><strong>500 Internal Server Error</strong>: Server error</li>
          </ul>
          <p className="text-gray-700">
            Error responses include a JSON object with an <code className="text-xs font-mono">error</code> field containing a descriptive message.
          </p>
          
          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Integration Examples</h3>
          
          <h4 className="text-base font-medium text-gray-900 mb-2">Node.js Example</h4>
          <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
            <code className="text-sm font-mono">{`const generateDocument = async (templateId, jsonData, outputType = "docx") => {
  const response = await fetch(
    "${supabase.supabaseUrl}/functions/v1/document-api/generate",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer your-api-key",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        templateId,
        jsonData,
        outputType
      })
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate document");
  }
  
  // Handle the response based on output type
  if (outputType === "text") {
    // For text output, return the text content
    return await response.text();
  } else {
    // For DOCX/PDF, handle the document download
    const blob = await response.blob();
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : \`document.\${outputType}\`;
    
    // Save the file (browser environment)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { filename, size: blob.size };
  }
}`}</code>
          </pre>
          <button
            onClick={() => handleCopyCode(`const generateDocument = async (templateId, jsonData, outputType = "docx") => {
  const response = await fetch(
    "${supabase.supabaseUrl}/functions/v1/document-api/generate",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer ${apiKey || 'your-api-key'}",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        templateId,
        jsonData,
        outputType
      })
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate document");
  }
  
  // Handle the response based on output type
  if (outputType === "text") {
    // For text output, return the text content
    return await response.text();
  } else {
    // For DOCX/PDF, handle the document download
    const blob = await response.blob();
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : \`document.\${outputType}\`;
    
    // Save the file (browser environment)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { filename, size: blob.size };
  }
}`)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy example
          </button>
          
          <h4 className="text-base font-medium text-gray-900 mt-4 mb-2">Python Example</h4>
          <pre className="bg-gray-100 p-3 rounded-lg mb-4 overflow-x-auto">
            <code className="text-sm font-mono">{`import requests
import json
import os

def generate_document(template_id, json_data, output_type="docx"):
    url = "${supabase.supabaseUrl}/functions/v1/document-api/generate"
    
    headers = {
        "Authorization": "Bearer your-api-key",
        "Content-Type": "application/json"
    }
    
    data = {
        "templateId": template_id,
        "jsonData": json_data,
        "outputType": output_type
    }
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code != 200:
        try:
            error_data = response.json()
            raise Exception(error_data.get("error", "Failed to generate document"))
        except:
            raise Exception(f"Failed to generate document: {response.status_code}")
    
    # Handle the response based on output type
    if output_type == "text":
        # For text output, return the text content
        return response.text
    else:
        # For DOCX/PDF, save the file
        # Get filename from Content-Disposition header
        content_disposition = response.headers.get("Content-Disposition", "")
        import re
        filename_match = re.search(r'filename="([^"]+)"', content_disposition)
        filename = filename_match.group(1) if filename_match else f"document.{output_type}"
        
        # Save the file
        with open(filename, "wb") as f:
            f.write(response.content)
        
        print(f"Document saved as {filename}")
        return filename`}</code>
          </pre>
          <button
            onClick={() => handleCopyCode(`import requests
import json
import os

def generate_document(template_id, json_data, output_type="docx"):
    url = "${supabase.supabaseUrl}/functions/v1/document-api/generate"
    
    headers = {
        "Authorization": "Bearer ${apiKey || 'your-api-key'}",
        "Content-Type": "application/json"
    }
    
    data = {
        "templateId": template_id,
        "jsonData": json_data,
        "outputType": output_type
    }
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code != 200:
        try:
            error_data = response.json()
            raise Exception(error_data.get("error", "Failed to generate document"))
        except:
            raise Exception(f"Failed to generate document: {response.status_code}")
    
    # Handle the response based on output type
    if output_type == "text":
        # For text output, return the text content
        return response.text
    else:
        # For DOCX/PDF, save the file
        # Get filename from Content-Disposition header
        content_disposition = response.headers.get("Content-Disposition", "")
        import re
        filename_match = re.search(r'filename="([^"]+)"', content_disposition)
        filename = filename_match.group(1) if filename_match else f"document.{output_type}"
        
        # Save the file
        with open(filename, "wb") as f:
            f.write(response.content)
        
        print(f"Document saved as {filename}")
        return filename`)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy example
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      {/* Header */}
      <div className="border-b border-gray-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">API Testing & Integration</h2>
              <p className="text-sm text-gray-600">Test and integrate with the Document API</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200/50">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('generate')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
              activeTab === 'generate'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Generate Document
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
              activeTab === 'customer'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Customer Data
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
              activeTab === 'templates'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
              activeTab === 'advanced'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Advanced API
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
              activeTab === 'docs'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Documentation
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        
        {/* Tab content */}
        {activeTab === 'generate' && renderGenerateTab()}
        {activeTab === 'customer' && renderCustomerTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'advanced' && renderAdvancedTab()}
        {activeTab === 'docs' && renderDocsTab()}
        
        {/* Response display */}
        {response && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Response</h3>
              <button
                onClick={handleCopyResponse}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </button>
            </div>
            
            <div className="bg-gray-100 rounded-xl p-4 overflow-x-auto">
              <div className="flex items-center space-x-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  response.status >= 200 && response.status < 300 ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium">
                  Status: {response.status} {response.statusText}
                </span>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Headers:</h4>
                <pre className="text-xs font-mono bg-gray-200 p-2 rounded">
                  {Object.entries(response.headers).map(([key, value]) => (
                    `${key}: ${value}\n`
                  ))}
                </pre>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Body:</h4>
                <pre className="text-xs font-mono bg-gray-200 p-2 rounded overflow-x-auto">
                  {typeof response.body === 'string' 
                    ? response.body 
                    : JSON.stringify(response.body, null, 2)}
                </pre>
              </div>
              
              {response.error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-sm font-medium text-red-800">{response.error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};