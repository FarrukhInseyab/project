import React, { useState, useRef, useEffect } from 'react';
import { Upload, Database, Plus, Trash2, FileText, RefreshCw, Copy, Zap, Brain, Grid, CheckSquare, Square, AlertTriangle, Shield, ArrowRight } from 'lucide-react';
import { IncomingData, Tag } from '../types';
import { supabase } from '../lib/supabase';
import { DataMappingService } from '../services/dataMappingService';

interface DataImporterProps {
  data: IncomingData;
  onDataChange: (data: IncomingData, podapiCustomerNos?: string[]) => void;
  tags?: Tag[];
  templateId?: string; // Add templateId prop
}

interface PoDAPIRecord {
  customerno: string | number;
  [key: string]: any;
}

export const DataImporter: React.FC<DataImporterProps> = ({ 
  data, 
  onDataChange, 
  tags = [], 
  templateId 
}) => {
  const [activeTab, setActiveTab] = useState<'json' | 'form' | 'multi' | 'podapi'>('podapi'); // Default to podapi
  const [jsonText, setJsonText] = useState('');
  const [formData, setFormData] = useState<Array<{ key: string; value: string }>>([]);
  const [multiDocumentMode, setMultiDocumentMode] = useState(false);
  const [podapiRecords, setPodapiRecords] = useState<PoDAPIRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [loadingPodapi, setLoadingPodapi] = useState(false);
  const [showPodapiGrid, setShowPodapiGrid] = useState(false);
  const [podapiError, setPodapiError] = useState<string | null>(null);
  const [hasMappings, setHasMappings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for existing mappings when component mounts
  useEffect(() => {
    checkForMappings();
  }, [templateId]);

  const checkForMappings = async () => {
    if (!templateId) {
      setHasMappings(false);
      return;
    }

    try {
      // Get the current template version
      const { data: templateData } = await supabase
        .from('document_templates')
        .select('current_version')
        .eq('id', templateId)
        .single();
      
      const currentVersion = templateData?.current_version || 1;
      console.log('🔍 Checking for mappings for template:', templateId, 'version:', currentVersion);
      
      const mappings = await DataMappingService.getTemplateVersionMappings(templateId, currentVersion);
      setHasMappings(mappings.length > 0);
      
      if (mappings.length > 0) {
        console.log('✅ Found existing mappings for template version:', currentVersion, 'count:', mappings.length);
      }
    } catch (error) {
      console.error('Failed to check for mappings:', error);
      setHasMappings(false);
    }
  };

  // Load data using saved mappings
  const loadMappedData = async () => {
    if (!templateId) {
      setPodapiError('Template ID is required for mapped data loading');
      return;
    }

    try {
      setLoadingPodapi(true);
      setPodapiError(null);
      console.log('🔄 Loading data using saved mappings...');

      // Get the current template version
      const { data: templateData } = await supabase
        .from('document_templates')
        .select('current_version')
        .eq('id', templateId)
        .single();
      
      const currentVersion = templateData?.current_version || 1;
      console.log('📋 Using template version:', currentVersion);
      
      // If we have selected records, only load those
      const selectedCustomerNos = Array.from(selectedRecords);
      
      // Call loadMappedData with the current version and selected customer numbers
      const result = await DataMappingService.loadMappedData(
        templateId, 
        currentVersion,
        selectedCustomerNos.length > 0 ? selectedCustomerNos : undefined
      );
      
      console.log('✅ Mapped data loaded:', result);

      // Update the data and pass customer numbers
      const formattedJson = JSON.stringify(result.data, null, 2);
      setJsonText(formattedJson);
      onDataChange(result.data, result.customerNumbers);
      
      // Switch to JSON tab to show the result
      setActiveTab('json');
      
      console.log(`✅ Loaded ${result.recordCount} records using saved mappings for version ${currentVersion}`);
      
    } catch (error) {
      console.error('❌ Failed to load mapped data:', error);
      setPodapiError(error instanceof Error ? error.message : 'Failed to load mapped data');
    } finally {
      setLoadingPodapi(false);
    }
  };

  // Generate dummy data based on tags
  const generateDummyData = (tags: Tag[], isMultiDocument: boolean = false): IncomingData => {
    const dummyData: IncomingData = {};
    
    tags.forEach(tag => {
      const tagName = tag.name.toLowerCase();
      const displayName = tag.displayName.toLowerCase();
      
      let sampleValues: string[] = [];
      
      // Generate appropriate dummy data based on tag name patterns
      if (tagName.includes('name') || displayName.includes('name')) {
        if (tagName.includes('first') || displayName.includes('first')) {
          sampleValues = ['John', 'Sarah', 'Michael'];
        } else if (tagName.includes('last') || displayName.includes('last')) {
          sampleValues = ['Doe', 'Smith', 'Johnson'];
        } else if (tagName.includes('client') || displayName.includes('client')) {
          sampleValues = ['Acme Corporation', 'Tech Solutions Inc.', 'Global Industries'];
        } else if (tagName.includes('company') || displayName.includes('company')) {
          sampleValues = ['Tech Solutions Inc.', 'Digital Innovations', 'Future Systems'];
        } else {
          sampleValues = ['John Smith', 'Sarah Johnson', 'Michael Brown'];
        }
      } else if (tagName.includes('email') || displayName.includes('email')) {
        sampleValues = ['john.doe@example.com', 'sarah.smith@company.com', 'michael.brown@business.org'];
      } else if (tagName.includes('phone') || displayName.includes('phone') || tagName.includes('tel')) {
        sampleValues = ['+1 (555) 123-4567', '+1 (555) 987-6543', '+1 (555) 456-7890'];
      } else if (tagName.includes('date') || displayName.includes('date')) {
        sampleValues = ['2024-01-15', '2024-02-20', '2024-03-10'];
      } else if (tagName.includes('address') || displayName.includes('address')) {
        sampleValues = ['123 Main Street, New York, NY 10001', '456 Oak Avenue, Los Angeles, CA 90210', '789 Pine Road, Chicago, IL 60601'];
      } else if (tagName.includes('amount') || tagName.includes('price') || tagName.includes('cost') || displayName.includes('amount')) {
        sampleValues = ['$1,250.00', '$2,500.00', '$3,750.00'];
      } else if (tagName.includes('id') || displayName.includes('id') || tagName.includes('number')) {
        sampleValues = ['INV-2024-001', 'INV-2024-002', 'INV-2024-003'];
      } else if (tagName.includes('description') || displayName.includes('description')) {
        sampleValues = ['Professional services rendered as per agreement', 'Consulting services for Q1 2024', 'Software development and maintenance'];
      } else if (tagName.includes('title') || displayName.includes('title')) {
        sampleValues = ['Senior Software Engineer', 'Project Manager', 'Business Analyst'];
      } else if (tagName.includes('department') || displayName.includes('department')) {
        sampleValues = ['Engineering', 'Marketing', 'Sales'];
      } else if (tagName.includes('project') || displayName.includes('project')) {
        sampleValues = ['Website Redesign Project', 'Mobile App Development', 'Database Migration'];
      } else if (tagName.includes('city') || displayName.includes('city')) {
        sampleValues = ['New York', 'Los Angeles', 'Chicago'];
      } else if (tagName.includes('state') || displayName.includes('state')) {
        sampleValues = ['NY', 'CA', 'IL'];
      } else if (tagName.includes('zip') || displayName.includes('zip') || tagName.includes('postal')) {
        sampleValues = ['10001', '90210', '60601'];
      } else if (tagName.includes('country') || displayName.includes('country')) {
        sampleValues = ['United States', 'Canada', 'United Kingdom'];
      } else {
        // Default dummy data based on expected value type or generic
        if (tag.expectedValue) {
          const expectedType = tag.expectedValue.toLowerCase();
          if (expectedType.includes('date')) {
            sampleValues = ['2024-01-15', '2024-02-20', '2024-03-10'];
          } else if (expectedType.includes('number')) {
            sampleValues = ['123', '456', '789'];
          } else if (expectedType.includes('email')) {
            sampleValues = ['example1@email.com', 'example2@email.com', 'example3@email.com'];
          } else if (expectedType.includes('phone')) {
            sampleValues = ['(555) 123-4567', '(555) 987-6543', '(555) 456-7890'];
          } else {
            sampleValues = ['Sample Value 1', 'Sample Value 2', 'Sample Value 3'];
          }
        } else {
          sampleValues = ['Sample Value 1', 'Sample Value 2', 'Sample Value 3'];
        }
      }
      
      // Use array for multi-document mode, single value for regular mode
      dummyData[tag.name] = isMultiDocument ? sampleValues : sampleValues[0];
    });
    
    return dummyData;
  };

  // Initialize with dummy data when tags are available and no data exists
  useEffect(() => {
    if (tags.length > 0 && Object.keys(data).length === 0 && !jsonText && activeTab !== 'podapi') {
      const dummyData = generateDummyData(tags, multiDocumentMode);
      const formattedJson = JSON.stringify(dummyData, null, 2);
      setJsonText(formattedJson);
      onDataChange(dummyData);
    }
  }, [tags, data, jsonText, onDataChange, multiDocumentMode, activeTab]);

  // Update jsonText when data changes externally
  useEffect(() => {
    if (Object.keys(data).length > 0 && !jsonText && activeTab !== 'podapi') {
      setJsonText(JSON.stringify(data, null, 2));
    }
  }, [data, jsonText, activeTab]);

  // Load PoDAPI records with enhanced error handling
  const loadPodapiRecords = async () => {
    try {
      setLoadingPodapi(true);
      setPodapiError(null);
      console.log('🔍 Starting PoDAPI data load...');
      
      // First, check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated. Please log in again.');
      }
      console.log('✅ User authenticated:', user.email);
      
      // Check if the table exists and what columns it has
      console.log('🔍 Checking ProofofDebitAPI table structure...');
      
      // Try to get table info first with a simple query
      const { data: tableInfo, error: tableError } = await supabase
        .from('ProofofDebitAPI')
        .select('*')
        .limit(1);

      if (tableError) {
        console.error('❌ Error checking table structure:', tableError);
        
        // Provide specific error messages based on error type
        let errorMessage = `Failed to access ProofofDebitAPI table: ${tableError.message}`;
        
        if (tableError.message.includes('permission denied') || tableError.message.includes('RLS')) {
          errorMessage = `🔒 Permission denied: Row Level Security (RLS) is blocking access to ProofofDebitAPI table. Please contact your administrator to grant access permissions.`;
        } else if (tableError.message.includes('does not exist')) {
          errorMessage = `📋 Table not found: ProofofDebitAPI table does not exist in the database. Please verify the table name and ensure it has been created.`;
        } else if (tableError.message.includes('column') && tableError.message.includes('does not exist')) {
          errorMessage = `📋 Column error: ${tableError.message}. Please check the table structure.`;
        }
        
        setPodapiError(errorMessage);
        return;
      }

      console.log('✅ Table accessible, sample record:', tableInfo);

      // Now load all records with Status = 'New'
      console.log('🔍 Loading records where Status = "New"...');
      const { data: records, error } = await supabase
        .from('ProofofDebitAPI')
        .select('*')
        .eq('Status', 'New');

      if (error) {
        console.error('❌ Error loading PoDAPI records:', error);
        
        let errorMessage = `Failed to load PoDAPI records: ${error.message}`;
        
        if (error.message.includes('permission denied') || error.message.includes('RLS')) {
          errorMessage = `🔒 Permission denied: You don't have permission to read records from ProofofDebitAPI table. Please contact your administrator to grant read permissions.`;
        } else if (error.message.includes('column') && error.message.includes('does not exist')) {
          errorMessage = `📋 Column error: ${error.message}. The Status column may not exist or may have a different name.`;
        }
        
        setPodapiError(errorMessage);
        return;
      }

      console.log('📊 Query result:', {
        recordCount: records?.length || 0,
        records: records
      });

      if (!records || records.length === 0) {
        console.log('⚠️ No records found with Status = "New"');
        
        // Let's also check what Status values exist
        const { data: statusCheck, error: statusError } = await supabase
          .from('ProofofDebitAPI')
          .select('Status')
          .limit(10);

        if (!statusError && statusCheck) {
          const uniqueStatuses = [...new Set(statusCheck.map(r => r.Status))];
          console.log('📋 Available Status values in table:', uniqueStatuses);
          setPodapiError(`No records found with Status = "New". Available Status values: ${uniqueStatuses.join(', ')}`);
        } else {
          setPodapiError('No records found with Status = "New"');
        }
        
        setPodapiRecords([]);
        setShowPodapiGrid(true);
        return;
      }

      // Ensure all records have customerno (which is the primary key)
      const validRecords = records.filter(record => record.customerno !== null && record.customerno !== undefined);
      
      if (validRecords.length !== records.length) {
        console.warn(`⚠️ ${records.length - validRecords.length} records missing customerno field`);
      }

      setPodapiRecords(validRecords);
      setShowPodapiGrid(true);
      console.log(`✅ Successfully loaded ${validRecords.length} PoDAPI records with Status = "New"`);
      
      // Log the first record structure for debugging
      if (validRecords.length > 0) {
        console.log('📋 First record structure:', Object.keys(validRecords[0]));
        console.log('📋 Sample customerno:', validRecords[0].customerno, 'Type:', typeof validRecords[0].customerno);
      }
      
    } catch (error) {
      console.error('❌ Unexpected error loading PoDAPI records:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPodapiError(`Failed to load PoDAPI records: ${errorMessage}`);
    } finally {
      setLoadingPodapi(false);
    }
  };

  // Generate JSON from selected PoDAPI records
  const generateJsonFromPodapi = async (useAllRecords: boolean = false) => {
    const recordsToUse = useAllRecords 
      ? podapiRecords 
      : podapiRecords.filter(record => selectedRecords.has(String(record.customerno)));

    if (recordsToUse.length === 0) {
      alert('No records selected. Please select at least one record.');
      return;
    }

    console.log('🔧 Generating JSON from records:', recordsToUse.length);

    try {
      // If we have mappings for this template, use loadMappedData
      if (hasMappings && templateId) {
        setLoadingPodapi(true);
        console.log('🔄 Using saved mappings to generate data...');
        
        // Get the current template version
        const { data: templateData } = await supabase
          .from('document_templates')
          .select('current_version')
          .eq('id', templateId)
          .single();
        
        const currentVersion = templateData?.current_version || 1;
        
        // Get customer numbers from selected records
        const customerNumbers = recordsToUse.map(record => String(record.customerno));
        console.log('📋 Using customer numbers:', customerNumbers);
        
        // Load data using mappings for the current version only
        const result = await DataMappingService.loadMappedData(
          templateId,
          currentVersion,
          customerNumbers
        );
        
        // Update the data and pass customer numbers
        const formattedJson = JSON.stringify(result.data, null, 2);
        setJsonText(formattedJson);
        onDataChange(result.data, result.customerNumbers);
        
        // Switch to JSON tab to show the result
        setActiveTab('json');
        setShowPodapiGrid(false);
        
        console.log(`✅ Generated JSON from ${result.recordCount} PoDAPI records using saved mappings`);
        setLoadingPodapi(false);
        return;
      }
      
      // If no mappings, fall back to manual mapping
      console.log('⚠️ No saved mappings found, using manual mapping');
      
      // Define columns to exclude from mapping
      const excludedColumns = ['Status'];

      // Map PoDAPI columns to tags
      const mappedData: IncomingData = {};
      
      if (tags.length === 0) {
        // If no tags, use all columns from the first record (excluding system columns)
        if (recordsToUse.length > 0) {
          const firstRecord = recordsToUse[0];
          Object.keys(firstRecord).forEach(column => {
            if (!excludedColumns.includes(column)) {
              mappedData[column] = recordsToUse.length === 1 
                ? firstRecord[column] 
                : recordsToUse.map(record => record[column]);
            }
          });
        }
      } else {
        // Map columns to tags based on name similarity
        tags.forEach(tag => {
          const tagName = tag.name.toLowerCase();
          const displayName = tag.displayName.toLowerCase();
          
          // Find matching column in PoDAPI records (excluding system columns)
          let matchingColumn = null;
          const firstRecord = recordsToUse[0];
          
          if (firstRecord) {
            const availableColumns = Object.keys(firstRecord).filter(column => 
              !excludedColumns.includes(column)
            );
            
            console.log(`🔍 Looking for match for tag "${tag.name}" in columns:`, availableColumns);
            
            // Look for exact matches first
            matchingColumn = availableColumns.find(column => 
              column.toLowerCase() === tagName ||
              column.toLowerCase() === displayName ||
              column.toLowerCase().replace(/[_\s]/g, '') === tagName.replace(/[_\s]/g, '') ||
              column.toLowerCase().replace(/[_\s]/g, '') === displayName.replace(/[_\s]/g, '')
            );
            
            // If no exact match, look for partial matches
            if (!matchingColumn) {
              matchingColumn = availableColumns.find(column => 
                column.toLowerCase().includes(tagName) ||
                tagName.includes(column.toLowerCase()) ||
                column.toLowerCase().includes(displayName) ||
                displayName.includes(column.toLowerCase())
              );
            }
            
            console.log(`🎯 Tag "${tag.name}" matched to column: ${matchingColumn || 'No match'}`);
          }
          
          if (matchingColumn) {
            mappedData[tag.name] = recordsToUse.length === 1 
              ? recordsToUse[0][matchingColumn] 
              : recordsToUse.map(record => record[matchingColumn]);
          } else {
            // No matching column found, use placeholder
            mappedData[tag.name] = recordsToUse.length === 1 
              ? `[No match for ${tag.displayName}]` 
              : recordsToUse.map(() => `[No match for ${tag.displayName}]`);
          }
        });
      }

      console.log('📋 Generated mapped data:', mappedData);

      // Extract customer numbers for tracking - keep them as strings for consistency
      // but ensure they represent the actual integer values from the database
      const customerNumbers = recordsToUse.map(record => String(record.customerno));
      console.log('📋 Customer numbers for tracking (as strings):', customerNumbers);
      console.log('📋 Original customer number types:', recordsToUse.map(record => typeof record.customerno));

      // Update the data and pass customer numbers
      const formattedJson = JSON.stringify(mappedData, null, 2);
      setJsonText(formattedJson);
      onDataChange(mappedData, customerNumbers);
      
      // Switch to JSON tab to show the result
      setActiveTab('json');
      setShowPodapiGrid(false);
      
      console.log(`✅ Generated JSON from ${recordsToUse.length} PoDAPI records (excluding: ${excludedColumns.join(', ')})`);
      console.log(`📋 Tracking ${customerNumbers.length} customer numbers for status update`);
    } catch (error) {
      console.error('❌ Error generating JSON:', error);
      setPodapiError(error instanceof Error ? error.message : 'Unknown error generating JSON');
    }
  };

  // Toggle record selection using customerno
  const toggleRecordSelection = (customerno: string | number) => {
    const customernoStr = String(customerno);
    const newSelection = new Set(selectedRecords);
    if (newSelection.has(customernoStr)) {
      newSelection.delete(customernoStr);
    } else {
      newSelection.add(customernoStr);
    }
    setSelectedRecords(newSelection);
  };

  // Select all records using customerno
  const selectAllRecords = () => {
    setSelectedRecords(new Set(podapiRecords.map(record => String(record.customerno))));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedRecords(new Set());
  };

  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        setJsonText(JSON.stringify(parsed, null, 2));
        onDataChange(parsed);
      } catch (error) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleJsonChange = (value: string) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      onDataChange(parsed);
      
      // Check if data contains arrays (multi-document mode)
      const hasArrays = Object.values(parsed).some(val => Array.isArray(val));
      setMultiDocumentMode(hasArrays);
    } catch (error) {
      // Invalid JSON, don't update data
    }
  };

  const addFormField = () => {
    setFormData([...formData, { key: '', value: '' }]);
  };

  const updateFormField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...formData];
    updated[index][field] = value;
    setFormData(updated);
    
    // Update data object
    const newData: IncomingData = {};
    updated.forEach(item => {
      if (item.key.trim()) {
        newData[item.key.trim()] = item.value;
      }
    });
    onDataChange(newData);
  };

  const removeFormField = (index: number) => {
    const updated = formData.filter((_, i) => i !== index);
    setFormData(updated);
    
    // Update data object
    const newData: IncomingData = {};
    updated.forEach(item => {
      if (item.key.trim()) {
        newData[item.key.trim()] = item.value;
      }
    });
    onDataChange(newData);
  };

  const handleRegenerateDummyData = () => {
    if (tags.length > 0) {
      const dummyData = generateDummyData(tags, multiDocumentMode);
      const formattedJson = JSON.stringify(dummyData, null, 2);
      setJsonText(formattedJson);
      onDataChange(dummyData);
    }
  };

  const toggleMultiDocumentMode = () => {
    const newMode = !multiDocumentMode;
    setMultiDocumentMode(newMode);
    
    if (tags.length > 0) {
      const dummyData = generateDummyData(tags, newMode);
      const formattedJson = JSON.stringify(dummyData, null, 2);
      setJsonText(formattedJson);
      onDataChange(dummyData);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  React.useEffect(() => {
    // Initialize form data from existing data
    if (Object.keys(data).length > 0 && formData.length === 0 && activeTab === 'form') {
      const fields = Object.entries(data).map(([key, value]) => ({
        key,
        value: Array.isArray(value) ? value.join(', ') : String(value)
      }));
      setFormData(fields);
    }
  }, [data, formData.length, activeTab]);

  // Check if current data will generate multiple documents
  const willGenerateMultipleDocs = Object.values(data).some(val => Array.isArray(val));
  const maxDocuments = Math.max(...Object.values(data).map(val => Array.isArray(val) ? val.length : 1));

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      <div className="border-b border-gray-200/50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Smart Data Import</h2>
              <p className="text-sm text-gray-600">AI-powered data mapping and population</p>
            </div>
          </div>
          {willGenerateMultipleDocs && (
            <div className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <Zap className="w-4 h-4 text-green-600" />
              <span className="text-xs sm:text-sm font-medium text-green-700">
                {maxDocuments} documents ready
              </span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Import or manually enter the data that will populate your document tags.
          {tags.length > 0 && (
            <span className="text-purple-600 font-medium"> Smart dummy data has been pre-filled based on your tags.</span>
          )}
        </p>
      </div>

      <div className="border-b border-gray-200/50">
        <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('podapi')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'podapi'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            PoDAPI {hasMappings && <span className="text-xs bg-green-100 text-green-800 px-1 rounded">Mapped</span>}
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'json'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            JSON Import
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'form'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Manual Entry
          </button>
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'podapi' ? (
          <div className="space-y-6">
            {/* PoDAPI Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">ProofofDebitAPI Integration</h3>
                <p className="text-sm text-gray-600">
                  {hasMappings 
                    ? 'Load data using saved tag-column mappings'
                    : 'Load data from ProofofDebitAPI table where Status = "New"'
                  }
                </p>
              </div>
              <div className="flex space-x-3">
                {hasMappings && (
                  <button
                    onClick={loadMappedData}
                    disabled={loadingPodapi}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  >
                    {loadingPodapi ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Load Mapped Data
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={loadPodapiRecords}
                  disabled={loadingPodapi}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  {loadingPodapi ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Grid className="w-4 h-4 mr-2" />
                      Browse Records
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Mapping Status */}
            {hasMappings && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-green-900">Mappings Configured</h4>
                    <p className="text-sm text-green-800">
                      This template has saved tag-column mappings. Use "Load Mapped Data" for automatic data import.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {podapiError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    {podapiError.includes('🔒') ? (
                      <Shield className="w-4 h-4 text-red-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-red-900 mb-2">PoDAPI Access Error</h4>
                    <p className="text-sm text-red-800 leading-relaxed whitespace-pre-line">
                      {podapiError}
                    </p>
                    {podapiError.includes('RLS') && (
                      <div className="mt-3 p-3 bg-red-100 rounded-lg">
                        <p className="text-xs text-red-700 font-medium">
                          💡 Solution: Run the RLS fix migration to grant access permissions to the ProofofDebitAPI table.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PoDAPI Grid */}
            {showPodapiGrid && !podapiError && (
              <div className="space-y-4">
                {/* Grid Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-700">
                      {podapiRecords.length} records found (Status = 'New')
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedRecords.size} selected
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button
                      onClick={selectAllRecords}
                      className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 touch-manipulation"
                    >
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Select All
                    </button>
                    <button
                      onClick={clearSelection}
                      className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 touch-manipulation"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Clear
                    </button>
                  </div>
                </div>

                {/* Records Grid */}
                {podapiRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <Grid className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">No Records Found</h3>
                    <p className="text-gray-600">No records found in ProofofDebitAPI table with Status = 'New'</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Select
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Customer No
                            </th>
                            {podapiRecords.length > 0 && Object.keys(podapiRecords[0])
                              .filter(column => !['customerno', 'Status'].includes(column))
                              .slice(0, 4)
                              .map(column => (
                                <th key={column} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  {column}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {podapiRecords.map((record) => (
                            <tr key={record.customerno} className={`hover:bg-gray-50 ${selectedRecords.has(String(record.customerno)) ? 'bg-blue-50' : ''}`}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button
                                  onClick={() => toggleRecordSelection(record.customerno)}
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  {selectedRecords.has(String(record.customerno)) ? (
                                    <CheckSquare className="w-5 h-5" />
                                  ) : (
                                    <Square className="w-5 h-5" />
                                  )}
                                </button>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {record.customerno}
                              </td>
                              {Object.entries(record)
                                .filter(([column]) => !['customerno', 'Status'].includes(column))
                                .slice(0, 4)
                                .map(([column, value]) => (
                                  <td key={column} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {String(value).length > 50 ? String(value).substring(0, 50) + '...' : String(value)}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {podapiRecords.length > 0 && (
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                    <button
                      onClick={() => generateJsonFromPodapi(false)}
                      disabled={selectedRecords.size === 0}
                      className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Generate JSON from Selected ({selectedRecords.size})
                    </button>
                    <button
                      onClick={() => generateJsonFromPodapi(true)}
                      className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 touch-manipulation"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      Generate JSON from All ({podapiRecords.length})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            {!showPodapiGrid && !podapiError && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Grid className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 mb-2">How PoDAPI Integration Works:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Loads records from ProofofDebitAPI table where Status = 'New'</li>
                      <li>• Uses <strong>customerno</strong> (integer) as the primary reference for tracking</li>
                      <li>• Maps database columns to your document tags automatically</li>
                      <li>• Generates JSON data for single or multiple document generation</li>
                      <li>• <strong>Marks records as "Current"</strong> after successful document generation</li>
                      <li>• Automatically excludes: Status (system columns only)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'json' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 touch-manipulation"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload JSON File
                </button>
                <span className="text-sm text-gray-500 text-center sm:text-left">or edit the JSON directly below</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                {tags.length > 0 && (
                  <>
                    <button
                      onClick={toggleMultiDocumentMode}
                      className={`inline-flex items-center justify-center px-3 py-2 border rounded-xl shadow-sm text-sm font-medium transition-all duration-200 touch-manipulation ${
                        multiDocumentMode
                          ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {multiDocumentMode ? 'Multi-Doc Mode' : 'Single Doc Mode'}
                    </button>
                    <button
                      onClick={handleRegenerateDummyData}
                      className="inline-flex items-center justify-center px-3 py-2 border border-purple-300 rounded-xl shadow-sm text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 touch-manipulation"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Regenerate Data
                    </button>
                  </>
                )}
                {jsonText && (
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 touch-manipulation"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </button>
                )}
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleJsonUpload}
              className="hidden"
            />
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                JSON Data
                {tags.length > 0 && jsonText && (
                  <span className="text-purple-600 text-xs ml-2 font-medium">
                    (AI-generated {multiDocumentMode ? 'multi-document' : 'single'} smart data)
                  </span>
                )}
                {willGenerateMultipleDocs && (
                  <span className="text-green-600 text-xs ml-2 block mt-1 font-medium">
                    ✓ Arrays detected - will generate {maxDocuments} documents
                  </span>
                )}
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="w-full h-48 sm:h-64 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-purple-500 focus:border-purple-500 font-mono text-xs sm:text-sm transition-all duration-200 resize-none"
                placeholder={tags.length > 0 ? 'Smart dummy data will be generated based on your tags...' : '{"clientName": "John Doe", "date": "2024-01-15", "amount": "$1,000"}'}
              />
              {multiDocumentMode && (
                <p className="text-xs text-green-600 mt-2 font-medium">
                  💡 Tip: Use arrays like ["Value1", "Value2", "Value3"] to generate multiple documents with different values for each tag.
                </p>
              )}
            </div>
          </div>
        ) : activeTab === 'form' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <h3 className="text-sm font-semibold text-gray-900">Data Fields</h3>
              <button
                onClick={addFormField}
                className="inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 touch-manipulation"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </button>
            </div>
            
            {formData.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">No data fields</h3>
                <p className="text-sm text-gray-500 mb-4 px-4">
                  Add fields to manually enter your data values.
                  {tags.length > 0 && (
                    <span className="block text-purple-600 mt-1 font-medium">
                      Or switch to JSON tab to see AI-generated smart data based on your tags.
                    </span>
                  )}
                </p>
                <button
                  onClick={addFormField}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 touch-manipulation"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Field
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.map((field, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => updateFormField(index, 'key', e.target.value)}
                        placeholder="Field name (e.g., clientName)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => updateFormField(index, 'value', e.target.value)}
                        placeholder="Field value (use comma-separated for multiple docs)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-sm sm:text-base"
                      />
                    </div>
                    <button
                      onClick={() => removeFormField(index)}
                      className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 self-center sm:self-auto touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {Object.keys(data).length > 0 && (
        <div className="border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-purple-50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-2 sm:space-y-0">
            <h4 className="text-sm font-semibold text-gray-900">Smart Data Preview</h4>
            <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
              {tags.length > 0 && Object.keys(data).length === tags.length && (
                <span className="text-xs text-green-600 bg-green-100 px-3 py-1 rounded-full font-medium">
                  All tags have data
                </span>
              )}
              {willGenerateMultipleDocs && (
                <span className="text-xs text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-medium">
                  {maxDocuments} documents will be generated
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
            {Object.entries(data).slice(0, 6).map(([key, value]) => (
              <div key={key} className="flex flex-col sm:flex-row">
                <span className="font-semibold text-gray-700 mr-0 sm:mr-2">{key}:</span>
                <span className="text-gray-600 truncate">
                  {Array.isArray(value) ? `[${value.length} items]` : String(value)}
                </span>
              </div>
            ))}
            {Object.keys(data).length > 6 && (
              <div className="text-gray-500 italic">
                +{Object.keys(data).length - 6} more fields...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};