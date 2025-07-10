import React, { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertCircle, Zap, Package, RefreshCw, Sparkles, Settings } from 'lucide-react';
import { generateDocxFromContent } from '../utils/documentUtils';
import { CloudConvertService } from '../services/cloudConvertService';
import { OnlyOfficeService } from '../services/onlyOfficeService';
import { CloudConvertSettings } from './CloudConvertSettings';
import { Tag, Mapping, IncomingData, DocumentTemplate } from '../types';
import { GenerationService } from '../services/generationService';
import { StorageService } from '../services/storageService';
import { PoDAPIService } from '../services/podapiService';
import { saveAs } from 'file-saver';

interface DocumentGeneratorProps {
  originalFile?: File;
  tags: Tag[];
  mappings: Mapping[];
  incomingData: IncomingData;
  documentContent: string;
  documentHtml: string;
  templateId?: string;
  podapiCustomerNos?: string[];
}

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({
  originalFile,
  tags,
  mappings,
  incomingData,
  documentContent,
  documentHtml,
  templateId,
  podapiCustomerNos = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [documentsGenerated, setDocumentsGenerated] = useState(0);
  const [showCloudConvertSettings, setShowCloudConvertSettings] = useState(false);
  const [cloudConvertConfigured, setCloudConvertConfigured] = useState(false);
  const [pdfConversionMethod, setPdfConversionMethod] = useState<'cloudconvert' | 'onlyoffice'>('cloudconvert');
  const [onlyOfficeConfigured, setOnlyOfficeConfigured] = useState(false);

  // Check configurations on mount
  useEffect(() => {
    checkCloudConvertConfiguration();
    checkOnlyOfficeConfiguration();
    loadPdfConversionMethod();
  }, []);

  const checkCloudConvertConfiguration = async () => {
    try {
      setLoading(true);
      const configured = await CloudConvertService.isConfigured();
      setCloudConvertConfigured(configured);
    } catch (error) {
      console.error('Failed to check OnlineConverter configuration:', error);
      setCloudConvertConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  const checkOnlyOfficeConfiguration = async () => {
    try {
      setLoading(true);
      const isAvailable = await OnlyOfficeService.checkServerAvailability();
      setOnlyOfficeConfigured(isAvailable);
    } catch (error) {
      console.error('Failed to check My Editor configuration:', error);
      setOnlyOfficeConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  const loadPdfConversionMethod = async () => {
    try {
      setLoading(true);
      const settings = await OnlyOfficeService.loadSettings();
      console.log('Loaded PDF conversion method:', settings.pdfConversionMethod);
      setPdfConversionMethod(settings.pdfConversionMethod as 'cloudconvert' | 'onlyoffice');
    } catch (error) {
      console.error('Failed to load PDF conversion method:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create mappings object from current mappings
  const mappingsByTagName = React.useMemo(() => {
    return mappings.reduce((acc, mapping) => {
      const tag = tags.find(t => t.id === mapping.tagId);
      if (tag) {
        acc[tag.name] = mapping.dataValue;
      }
      return acc;
    }, {} as { [tagName: string]: any });
  }, [mappings, tags]);

  // Check if we have array data for multi-document generation
  const hasArrayData = Object.values(mappingsByTagName).some(value => Array.isArray(value));
  const maxDocuments = hasArrayData 
    ? Math.max(...Object.values(mappingsByTagName).map(val => Array.isArray(val) ? val.length : 1))
    : 1;

  // Check if PDF conversion is configured based on selected method
  const isPdfConversionConfigured = 
    (pdfConversionMethod === 'cloudconvert' && cloudConvertConfigured) ||
    (pdfConversionMethod === 'onlyoffice' && onlyOfficeConfigured);

  // Function to update PoDAPI records status to "Current"
  const updatePoDAPIRecordsStatus = async () => {
    if (!podapiCustomerNos || podapiCustomerNos.length === 0) {
      console.log('📋 No PoDAPI customer numbers to update');
      return;
    }

    try {
      console.log(`📝 Updating ${podapiCustomerNos.length} PoDAPI records to "Current" status...`);
      console.log('📋 Customer numbers to update:', podapiCustomerNos);
      
      const result = await PoDAPIService.updateRecordsStatus(podapiCustomerNos, 'Current');
      console.log('✅ PoDAPI records successfully marked as "Current":', result);
      
      // Show success message to user
      setStatusMessage(prev => prev + '\n✅ PoDAPI records marked as "Current"');
      
      return result;
    } catch (error) {
      console.error('❌ Failed to update PoDAPI records status:', error);
      
      // Show warning to user but don't fail the entire process
      setStatusMessage(prev => prev + '\n⚠️ Warning: Failed to update PoDAPI records status');
      
      // Don't throw error - this shouldn't fail the entire generation process
      return null;
    }
  };

  const handleGenerateDocx = async () => {
    if (!originalFile) {
      setStatusMessage('Original document not available. Please upload a document first.');
      setGenerationStatus('error');
      return;
    }

    if (mappings.length === 0) {
      setStatusMessage('No mappings available. Please map your tags to data fields first.');
      setGenerationStatus('error');
      return;
    }

    setIsGeneratingDocx(true);
    setGenerationStatus('processing');
    setStatusMessage(hasArrayData 
      ? `Generating and downloading ${maxDocuments} DOCX documents...` 
      : 'Generating and downloading DOCX document...'
    );

    let generationRecord = null;

    try {
      console.log('📄 Starting DOCX generation with mappings:', mappingsByTagName);
      console.log('📋 PoDAPI customer numbers:', podapiCustomerNos);
      
      // Create generation record in database first
      if (templateId) {
        try {
          const generationData = {
            template_id: templateId,
            generation_type: hasArrayData ? 'batch' as const : 'single' as const,
            documents_count: maxDocuments,
            input_data: incomingData,
            output_filenames: hasArrayData 
              ? Array.from({ length: maxDocuments }, (_, i) => 
                  originalFile.name.replace('.docx', `_${i + 1}.docx`)
                )
              : [originalFile.name.replace('.docx', '_populated.docx')],
            file_urls: [], // Will be populated with storage URLs
            status: 'processing' as const,
            file_size_total: originalFile.size * maxDocuments,
            metadata: {
              mappings: mappingsByTagName,
              tags_count: tags.length,
              original_filename: originalFile.name,
              podapi_customer_nos: podapiCustomerNos // Track which PoDAPI customer numbers were used
            }
          };

          generationRecord = await GenerationService.createGeneration(generationData);
          console.log('✅ Generation record created in database:', generationRecord.id);
        } catch (dbError) {
          console.error('⚠️ Failed to create generation record:', dbError);
          // Continue with document generation even if DB save fails
        }
      }
      
      // Generate the documents - this will both download AND return blobs for storage
      console.log('🔧 Calling generateDocxFromContent...');
      const generatedDocuments = await generateDocxFromContent(
        '', 
        mappingsByTagName, 
        originalFile.name.replace('.docx', '_populated.docx'),
        true, // Download immediately
        true  // Also return blobs for storage
      );
      
      console.log('📦 Generated documents result:', generatedDocuments);
      
      // Upload generated documents to storage if we have them and a generation record
      if (generationRecord && generatedDocuments && Array.isArray(generatedDocuments)) {
        try {
          console.log('📤 Uploading generated documents to storage...');
          const fileUrls: string[] = [];
          
          for (let i = 0; i < generatedDocuments.length; i++) {
            const doc = generatedDocuments[i];
            console.log(`📤 Uploading document ${i + 1}: ${doc.filename}`);
            
            const storagePath = await StorageService.uploadGeneratedDocument(
              doc.blob,
              generationRecord.id,
              doc.filename
            );
            fileUrls.push(storagePath);
            console.log(`✅ Document ${i + 1} uploaded to: ${storagePath}`);
          }
          
          // Update generation record with file URLs and storage path
          console.log('📝 Updating generation record with file URLs...');
          await GenerationService.updateGenerationStatus(generationRecord.id, 'completed');
          await GenerationService.updateGeneration(generationRecord.id, {
            file_urls: fileUrls,
            storage_path: fileUrls[0] // Primary file path
          });
          
          console.log('✅ Generated documents uploaded to storage and database updated');
        } catch (storageError) {
          console.error('⚠️ Failed to upload generated documents to storage:', storageError);
          
          // Update generation record to indicate partial failure
          if (generationRecord) {
            try {
              await GenerationService.updateGeneration(generationRecord.id, {
                status: 'completed',
                metadata: {
                  ...generationRecord.metadata,
                  storage_warning: 'Documents generated but storage upload failed'
                }
              });
            } catch (updateError) {
              console.error('⚠️ Failed to update generation record with storage warning:', updateError);
            }
          }
          
          // Continue - documents were still generated and downloaded
          console.log('⚠️ Continuing despite storage upload failure');
        }
      } else {
        console.log('⚠️ No generation record or generated documents to upload to storage');
        if (!generationRecord) console.log('  - No generation record');
        if (!generatedDocuments) console.log('  - No generated documents');
        if (!Array.isArray(generatedDocuments)) console.log('  - Generated documents not an array');
      }
      
      // *** THIS IS THE CRITICAL PART - UPDATE PoDAPI RECORDS ***
      console.log('📝 About to call updatePoDAPIRecordsStatus...');
      if (podapiCustomerNos && podapiCustomerNos.length > 0) {
        setStatusMessage(prev => prev + '\n📝 Updating PoDAPI records...');
        await updatePoDAPIRecordsStatus();
      } else {
        console.log('📋 No PoDAPI customer numbers provided, skipping database update');
      }
      
      setGenerationStatus('success');
      setDocumentsGenerated(maxDocuments);
      setStatusMessage(hasArrayData 
        ? `🎉 Successfully generated and downloaded ${maxDocuments} DOCX documents!` 
        : '🎉 DOCX document successfully generated and downloaded!'
      );
    } catch (error) {
      console.error('❌ Error generating DOCX:', error);
      
      // Update generation record to failed
      if (generationRecord) {
        try {
          await GenerationService.updateGenerationStatus(
            generationRecord.id, 
            'failed', 
            error instanceof Error ? error.message : 'Unknown error'
          );
          console.log('✅ Generation record updated to failed');
        } catch (dbError) {
          console.error('⚠️ Failed to update generation record:', dbError);
        }
      }
      
      setGenerationStatus('error');
      setStatusMessage(`❌ Failed to generate DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!isPdfConversionConfigured) {
      setShowCloudConvertSettings(true);
      return;
    }

    if (!originalFile) {
      setStatusMessage('Original document not available. Please upload a document first.');
      setGenerationStatus('error');
      return;
    }

    if (mappings.length === 0) {
      setStatusMessage('No mappings available. Please map your tags to data fields first.');
      setGenerationStatus('error');
      return;
    }

    setIsGeneratingPdf(true);
    setGenerationStatus('processing');
    setStatusMessage(hasArrayData 
      ? `Generating ${maxDocuments} DOCX documents and converting to PDF...` 
      : 'Generating DOCX document and converting to PDF...'
    );

    let generationRecord = null;

    try {
      console.log('📄 Starting PDF generation with mappings:', mappingsByTagName);
      console.log('📋 PoDAPI customer numbers:', podapiCustomerNos);
      console.log('📋 Using PDF conversion method:', pdfConversionMethod);
      
      // Create generation record in database first
      if (templateId) {
        try {
          const generationData = {
            template_id: templateId,
            generation_type: hasArrayData ? 'batch' as const : 'single' as const,
            documents_count: maxDocuments * 2, // Both DOCX and PDF
            input_data: incomingData,
            output_filenames: hasArrayData 
              ? Array.from({ length: maxDocuments }, (_, i) => [
                  originalFile.name.replace('.docx', `_${i + 1}.docx`),
                  originalFile.name.replace('.docx', `_${i + 1}.pdf`)
                ]).flat()
              : [
                  originalFile.name.replace('.docx', '_populated.docx'),
                  originalFile.name.replace('.docx', '_populated.pdf')
                ],
            file_urls: [], // Will be populated with storage URLs
            status: 'processing' as const,
            file_size_total: originalFile.size * maxDocuments * 2,
            metadata: {
              mappings: mappingsByTagName,
              tags_count: tags.length,
              original_filename: originalFile.name,
              includes_pdf: true,
              pdf_conversion_method: pdfConversionMethod,
              podapi_customer_nos: podapiCustomerNos // Track which PoDAPI customer numbers were used
            }
          };

          generationRecord = await GenerationService.createGeneration(generationData);
          console.log('✅ PDF generation record created in database:', generationRecord.id);
        } catch (dbError) {
          console.error('⚠️ Failed to create generation record:', dbError);
          // Continue with document generation even if DB save fails
        }
      }
      
      // First generate DOCX documents (without downloading)
      console.log('🔧 Generating DOCX documents for PDF conversion...');
      const generatedDocuments = await generateDocxFromContent(
        '', 
        mappingsByTagName, 
        originalFile.name.replace('.docx', '_populated.docx'),
        false, // Don't download DOCX yet
        true   // Return blobs for conversion
      );

      if (!generatedDocuments || !Array.isArray(generatedDocuments)) {
        throw new Error('Failed to generate DOCX documents for PDF conversion');
      }

      console.log(`🔄 Converting ${generatedDocuments.length} DOCX documents to PDF...`);

      const allGeneratedFiles: { blob: Blob; filename: string }[] = [];

      // Convert each DOCX to PDF and collect both files
      for (let i = 0; i < generatedDocuments.length; i++) {
        const doc = generatedDocuments[i];
        
        setStatusMessage(`Converting document ${i + 1} of ${generatedDocuments.length} to PDF...`);
        
        try {
          // Convert to PDF using the selected method
          let pdfBlob: Blob;
          
          if (pdfConversionMethod === 'onlyoffice' && onlyOfficeConfigured) {
            try {
              console.log('Using My Editor for PDF conversion');
              pdfBlob = await OnlyOfficeService.convertDocxToPdf(doc.blob, doc.filename);
            } catch (onlyOfficeError) {
              console.error('❌ My Editor PDF conversion failed, falling back to OnlineConverter:', onlyOfficeError);
              setStatusMessage(prev => prev + '\n⚠️ My Editor conversion failed, falling back to OnlineConverter...');
              
              // Fall back to CloudConvert if OnlyOffice fails
              if (!cloudConvertConfigured) {
                throw new Error('My Editor conversion failed and OnlineConverter is not configured');
              }
              
              console.log('Using CloudConvert for PDF conversion (fallback)');
              pdfBlob = await CloudConvertService.convertDocxToPdf(doc.blob, doc.filename);
            }
          } else {
            // Use CloudConvert
            console.log('Using CloudConvert for PDF conversion');
            pdfBlob = await CloudConvertService.convertDocxToPdf(doc.blob, doc.filename);
          }
          
          const pdfFilename = doc.filename.replace('.docx', '.pdf');
          
          // Download both DOCX and PDF
          saveAs(doc.blob, doc.filename);
          saveAs(pdfBlob, pdfFilename);
          
          // Collect for storage upload
          allGeneratedFiles.push(
            { blob: doc.blob, filename: doc.filename },
            { blob: pdfBlob, filename: pdfFilename }
          );
          
          console.log(`✅ Document ${i + 1} converted and downloaded: ${doc.filename} → ${pdfFilename}`);
        } catch (conversionError) {
          console.error(`❌ Failed to convert document ${i + 1}:`, conversionError);
          // Still download the DOCX even if PDF conversion fails
          saveAs(doc.blob, doc.filename);
          allGeneratedFiles.push({ blob: doc.blob, filename: doc.filename });
          throw new Error(`PDF conversion failed for document ${i + 1}: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
        }
      }
      
      // Upload all generated files to storage if we have a generation record
      if (generationRecord && allGeneratedFiles.length > 0) {
        try {
          console.log('📤 Uploading generated files (DOCX + PDF) to storage...');
          const fileUrls: string[] = [];
          
          for (let i = 0; i < allGeneratedFiles.length; i++) {
            const file = allGeneratedFiles[i];
            console.log(`📤 Uploading file ${i + 1}: ${file.filename}`);
            
            const storagePath = await StorageService.uploadGeneratedDocument(
              file.blob,
              generationRecord.id,
              file.filename
            );
            fileUrls.push(storagePath);
            console.log(`✅ File ${i + 1} uploaded to: ${storagePath}`);
          }
          
          // Update generation record with file URLs and storage path
          console.log('📝 Updating generation record with file URLs...');
          await GenerationService.updateGenerationStatus(generationRecord.id, 'completed');
          await GenerationService.updateGeneration(generationRecord.id, {
            file_urls: fileUrls,
            storage_path: fileUrls[0] // Primary file path
          });
          
          console.log('✅ Generated files uploaded to storage and database updated');
        } catch (storageError) {
          console.error('⚠️ Failed to upload generated files to storage:', storageError);
          
          // Update generation record to indicate partial failure
          if (generationRecord) {
            try {
              await GenerationService.updateGeneration(generationRecord.id, {
                status: 'completed',
                metadata: {
                  ...generationRecord.metadata,
                  storage_warning: 'Documents generated but storage upload failed'
                }
              });
            } catch (updateError) {
              console.error('⚠️ Failed to update generation record with storage warning:', updateError);
            }
          }
          
          // Continue - documents were still generated and downloaded
          console.log('⚠️ Continuing despite storage upload failure');
        }
      }
      
      // *** THIS IS THE CRITICAL PART - UPDATE PoDAPI RECORDS ***
      console.log('📝 About to call updatePoDAPIRecordsStatus...');
      if (podapiCustomerNos && podapiCustomerNos.length > 0) {
        setStatusMessage(prev => prev + '\n📝 Updating PoDAPI records...');
        await updatePoDAPIRecordsStatus();
      } else {
        console.log('📋 No PoDAPI customer numbers provided, skipping database update');
      }
      
      setGenerationStatus('success');
      setDocumentsGenerated(allGeneratedFiles.length);
      setStatusMessage(hasArrayData 
        ? `🎉 Successfully generated and downloaded ${generatedDocuments.length} documents in both DOCX and PDF formats!` 
        : '🎉 Document successfully generated and downloaded in both DOCX and PDF formats!'
      );
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      
      // Update generation record to failed
      if (generationRecord) {
        try {
          await GenerationService.updateGenerationStatus(
            generationRecord.id, 
            'failed', 
            error instanceof Error ? error.message : 'Unknown error'
          );
          console.log('✅ Generation record updated to failed');
        } catch (dbError) {
          console.error('⚠️ Failed to update generation record:', dbError);
        }
      }
      
      setGenerationStatus('error');
      setStatusMessage(`❌ Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const resetStatus = () => {
    setGenerationStatus('idle');
    setStatusMessage('');
  };

  if (!originalFile) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8 sm:p-12 text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-orange-100 to-red-100 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-orange-600" />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">No Document Available</h3>
        <p className="text-gray-600 leading-relaxed px-4">
          Please upload a document first before generating populated versions.
        </p>
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8 sm:p-12 text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-orange-100 to-red-100 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <Package className="w-8 h-8 sm:w-10 sm:h-10 text-orange-600" />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">No Mappings Available</h3>
        <p className="text-gray-600 mb-4 leading-relaxed px-4">
          Please map your document tags to data fields before generating documents.
        </p>
        <p className="text-sm text-gray-500 px-4">
          Go back to the Data Import step to create mappings between your tags and data.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
        <div className="border-b border-gray-200/50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Document Generation</h2>
                <p className="text-sm text-gray-600">Generate and download your populated documents instantly</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="text-sm text-gray-600 font-medium text-center sm:text-left">
                {mappings.length} of {tags.length} tags mapped
              </div>
              {podapiCustomerNos.length > 0 && (
                <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-medium">
                  {podapiCustomerNos.length} PoDAPI records
                </div>
              )}
              {generationStatus === 'success' && (
                <div className="flex items-center justify-center sm:justify-start text-green-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Ready</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Generate populated documents with exact formatting preserved. Documents are automatically downloaded and saved to your account.
            {hasArrayData && (
              <span className="text-orange-600 font-medium block mt-1">
                ✨ Multi-document mode: Will generate {maxDocuments} separate documents
              </span>
            )}
            {podapiCustomerNos.length > 0 && (
              <span className="text-blue-600 font-medium block mt-1">
                📋 PoDAPI records will be marked as "Current" after successful generation
              </span>
            )}
          </p>
        </div>

        {/* Status Display */}
        {statusMessage && (
          <div className={`border-b border-gray-200/50 p-4 sm:p-6 ${
            generationStatus === 'success' ? 'bg-gradient-to-r from-green-50 to-emerald-50' :
            generationStatus === 'error' ? 'bg-gradient-to-r from-red-50 to-pink-50' :
            generationStatus === 'processing' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-gray-50'
          }`}>
            <div className="flex items-start">
              {generationStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />}
              {generationStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />}
              {generationStatus === 'processing' && <RefreshCw className="w-5 h-5 text-blue-500 mr-3 mt-0.5 animate-spin flex-shrink-0" />}
              <div className="flex-1">
                <div className={`text-sm font-semibold whitespace-pre-line ${
                  generationStatus === 'success' ? 'text-green-800' :
                  generationStatus === 'error' ? 'text-red-800' :
                  generationStatus === 'processing' ? 'text-blue-800' : 'text-gray-800'
                }`}>
                  {statusMessage}
                </div>
                {generationStatus === 'error' && (
                  <button
                    onClick={resetStatus}
                    className="text-xs text-red-600 hover:text-red-800 mt-1 underline touch-manipulation"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-8">
          {/* Action Buttons */}
          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            {/* Generate DOCX */}
            <div className="border border-gray-200 rounded-2xl p-6 sm:p-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-blue-50">
              <div className="flex flex-col sm:flex-row sm:items-center mb-6 space-y-4 sm:space-y-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mr-0 sm:mr-4 self-center sm:self-auto">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">DOCX Document</h3>
                  <p className="text-sm text-gray-600">Generate Word document with exact original formatting</p>
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span>Preserves all original Word formatting</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span>Maintains fonts, spacing, and layout</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Sparkles className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                  <span>Replaces £tags£ with your data intelligently</span>
                </div>
                {hasArrayData && (
                  <div className="flex items-center text-sm text-orange-600">
                    <Package className="w-4 h-4 text-orange-500 mr-3 flex-shrink-0" />
                    <span className="font-medium">Generates {maxDocuments} separate files</span>
                  </div>
                )}
                {podapiCustomerNos.length > 0 && (
                  <div className="flex items-center text-sm text-blue-600">
                    <CheckCircle className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                    <span className="font-medium">Marks {podapiCustomerNos.length} PoDAPI records as "Current"</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleGenerateDocx}
                disabled={isGeneratingDocx || isGeneratingPdf || mappings.length === 0}
                className="w-full inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 border border-transparent rounded-2xl shadow-lg text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation"
              >
                {isGeneratingDocx ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                    Generating DOCX...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-3" />
                    Generate & Download DOCX
                  </>
                )}
              </button>
            </div>

            {/* Generate PDF */}
            <div className="border border-gray-200 rounded-2xl p-6 sm:p-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-red-50">
              <div className="flex flex-col sm:flex-row sm:items-center mb-6 space-y-4 sm:space-y-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl flex items-center justify-center mr-0 sm:mr-4 self-center sm:self-auto">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">DOCX + PDF Documents</h3>
                  <p className="text-sm text-gray-600">Generate both Word and PDF formats simultaneously</p>
                </div>
                <button
                  onClick={() => setShowCloudConvertSettings(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 touch-manipulation"
                  title="PDF Conversion Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
              
              {!cloudConvertConfigured && pdfConversionMethod === 'cloudconvert' && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">OnlineConverter Setup Required</span>
                  </div>
                  <p className="text-sm text-orange-700">
                    Configure your OnlineConverter API key to enable PDF generation. Free tier includes 25 conversions per day.
                  </p>
                </div>
              )}
              
              {!onlyOfficeConfigured && pdfConversionMethod === 'onlyoffice' && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">My Editor Setup Required</span>
                  </div>
                  <p className="text-sm text-orange-700">
                    Configure your My Editor server URL to enable PDF generation using My Editor.
                  </p>
                </div>
              )}
              
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span>Generates both DOCX and PDF formats</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span>Perfect formatting preservation in both formats</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Sparkles className="w-4 h-4 text-red-500 mr-3 flex-shrink-0" />
                  <span>Professional PDF output via {pdfConversionMethod === 'cloudconvert' ? 'OnlineConverter' : 'My Editor'}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Download className="w-4 h-4 text-purple-500 mr-3 flex-shrink-0" />
                  <span>Downloads both files automatically</span>
                </div>
                {hasArrayData && (
                  <div className="flex items-center text-sm text-orange-600">
                    <Package className="w-4 h-4 text-orange-500 mr-3 flex-shrink-0" />
                    <span className="font-medium">Generates {maxDocuments * 2} files total (DOCX + PDF)</span>
                  </div>
                )}
                {podapiCustomerNos.length > 0 && (
                  <div className="flex items-center text-sm text-blue-600">
                    <CheckCircle className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                    <span className="font-medium">Marks {podapiCustomerNos.length} PoDAPI records as "Current"</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleGeneratePdf}
                disabled={isGeneratingDocx || isGeneratingPdf || mappings.length === 0}
                className="w-full inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 border border-transparent rounded-2xl shadow-lg text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation"
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                    Converting to PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-3" />
                    {isPdfConversionConfigured ? 'Generate DOCX + PDF' : 'Setup PDF Conversion'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mapping Summary */}
          <div className="mt-8 sm:mt-12">
            <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
              Active Mappings ({mappings.length} of {tags.length} tags)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {mappings.map((mapping) => {
                const tag = tags.find(t => t.id === mapping.tagId);
                const value = mapping.dataValue;
                const isArray = Array.isArray(value);
                
                return (
                  <div key={mapping.tagId} className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl hover:shadow-md transition-all duration-200">
                    <div className="text-sm">
                      <div className="font-semibold text-blue-900 mb-2 break-all">
                        {`£${tag?.name}£`}
                      </div>
                      <div className="text-blue-700">
                        <span className="text-xs text-gray-600 font-medium">{mapping.dataKey}:</span>
                        <div className="font-medium mt-1">
                          {isArray ? (
                            <span className="text-xs bg-blue-100 px-2 py-1 rounded-full">
                              [{value.length} values]
                            </span>
                          ) : (
                            <span className="truncate block max-w-full text-xs sm:text-sm">
                              {String(value)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showCloudConvertSettings && (
        <CloudConvertSettings
          onClose={() => {
            setShowCloudConvertSettings(false);
            checkCloudConvertConfiguration(); // Refresh configuration status
            checkOnlyOfficeConfiguration(); // Refresh OnlyOffice status
            loadPdfConversionMethod(); // Refresh PDF conversion method
          }}
        />
      )}
    </>
  );
};