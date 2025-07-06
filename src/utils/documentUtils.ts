import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// Store original document data for perfect reconstruction
let originalDocumentBuffer: ArrayBuffer | null = null;

// Function to reset the original document buffer
export const resetOriginalDocumentBuffer = () => {
  originalDocumentBuffer = null;
  console.log('🔄 Original document buffer reset');
};

// Function to check if original document buffer is available
export const hasOriginalDocumentBuffer = (): boolean => {
  return originalDocumentBuffer !== null;
};

// Function to set the original document buffer
export const setOriginalDocumentBuffer = (buffer: ArrayBuffer) => {
  originalDocumentBuffer = buffer;
  console.log('✅ Original document buffer set');
};

// Function to get the original document buffer
export const getOriginalDocumentBuffer = (): ArrayBuffer | null => {
  return originalDocumentBuffer;
};

export const convertDocxToHtml = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Store original document for later reconstruction
    originalDocumentBuffer = arrayBuffer.slice();
    
    // Enhanced mammoth options for maximum format preservation
    const options = {
      styleMap: [
        "p[style-name='Heading 1'] => h1.heading-1:fresh",
        "p[style-name='Heading 2'] => h2.heading-2:fresh", 
        "p[style-name='Heading 3'] => h3.heading-3:fresh",
        "p[style-name='Normal'] => p.normal-paragraph:fresh",
        "p => p.document-paragraph:fresh"
      ],
      
      convertImage: mammoth.images.imgElement(function(image) {
        return image.read("base64").then(function(imageBuffer) {
          const dataUrl = "data:" + image.contentType + ";base64," + imageBuffer;
          return {
            src: dataUrl,
            alt: image.altText || 'Document Image',
            style: "max-width: 100%; height: auto; display: block; margin: 1em 0;"
          };
        });
      }),
      
      includeDefaultStyleMap: true,
      includeEmbeddedStyleMap: true
    };
    
    const result = await mammoth.convertToHtml({ arrayBuffer }, options);
    
    let htmlContent = result.value;
    
    // Add comprehensive CSS styling
    const documentStyles = `
      <style>
        .document-content {
          font-family: 'Calibri', 'Times New Roman', serif;
          font-size: 11pt;
          line-height: 1.15;
          color: #000000;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          max-width: none;
          word-wrap: break-word;
          white-space: pre-wrap;
        }
        
        .document-content h1.heading-1 {
          font-size: 16pt;
          font-weight: bold;
          color: #2F5496;
          margin: 12pt 0 6pt 0;
          line-height: 1.15;
        }
        
        .document-content h2.heading-2 {
          font-size: 13pt;
          font-weight: bold;
          color: #2F5496;
          margin: 10pt 0 6pt 0;
          line-height: 1.15;
        }
        
        .document-content h3.heading-3 {
          font-size: 12pt;
          font-weight: bold;
          color: #1F3763;
          margin: 10pt 0 6pt 0;
          line-height: 1.15;
        }
        
        .document-content p.document-paragraph,
        .document-content p.normal-paragraph {
          margin: 0 0 8pt 0;
          line-height: 1.15;
          text-align: left;
          font-size: 11pt;
          white-space: pre-wrap;
        }
        
        .document-content table {
          border-collapse: collapse;
          margin: 8pt 0;
          width: 100%;
        }
        
        .document-content td, .document-content th {
          border: 1pt solid #000000;
          padding: 4pt 6pt;
          vertical-align: top;
          font-size: 11pt;
          line-height: 1.15;
        }
        
        .document-content th {
          background-color: #D9D9D9;
          font-weight: bold;
        }
        
        .document-content img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1em 0;
        }
      </style>
    `;
    
    // Wrap content with styling
    htmlContent = `
      ${documentStyles}
      <div class="document-content" data-original-format="true">
        ${htmlContent}
      </div>
    `;
    
    return htmlContent;
  } catch (error) {
    console.error('Error converting DOCX to HTML:', error);
    throw new Error('Failed to convert document');
  }
};

// Extract tags between £ symbols
export const extractTagsFromContent = (content: string): Array<{name: string, displayName: string, description: string}> => {
  const tags: Array<{name: string, displayName: string, description: string}> = [];
  
  // Remove HTML tags to get plain text for tag extraction
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  
  // Find all text between £ symbols
  const tagMatches = plainText.match(/£([^£]+)£/g);
  
  if (tagMatches) {
    const uniqueTags = new Set<string>();
    
    tagMatches.forEach(match => {
      // Extract the tag name (remove the £ symbols)
      const tagContent = match.replace(/£/g, '').trim();
      
      if (tagContent && !uniqueTags.has(tagContent)) {
        uniqueTags.add(tagContent);
        
        // Create a clean tag name
        const cleanTagName = tagContent
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '_')
          .toLowerCase();
        
        // Create display name
        const displayName = tagContent
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        tags.push({
          name: cleanTagName,
          displayName: displayName,
          description: `Auto-extracted tag from: £${tagContent}£`
        });
      }
    });
  }
  
  console.log(`Extracted ${tags.length} tags from document:`, tags);
  return tags;
};

export const generateDocxFromContent = async (
  populatedContent: string, 
  mappings: { [tagName: string]: any },
  filename: string = 'populated-document.docx',
  downloadImmediately: boolean = true,
  returnBlobs: boolean = false
): Promise<{ blob: Blob; filename: string }[] | void> => {
  try {
    // Check if we have the original document buffer
    if (!originalDocumentBuffer) {
      throw new Error('Original DOCX file is required for document generation. Please upload a DOCX file first.');
    }

    console.log('🚀 Starting DOCX generation...');
    console.log('📋 Mappings received:', mappings);
    
    // Check if mappings contain arrays (for multi-document generation)
    const hasArrayValues = Object.values(mappings).some(value => Array.isArray(value));
    
    if (hasArrayValues) {
      return await generateMultipleDocuments(mappings, filename, originalDocumentBuffer, downloadImmediately, returnBlobs);
    } else {
      return await generateSingleDocument(mappings, filename, originalDocumentBuffer, downloadImmediately, returnBlobs);
    }
  } catch (error) {
    console.error('❌ Error generating DOCX:', error);
    throw new Error('Failed to generate document: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

// Generate multiple documents when data contains arrays
const generateMultipleDocuments = async (
  mappings: { [tagName: string]: any }, 
  baseFilename: string, 
  documentBuffer: ArrayBuffer,
  downloadImmediately: boolean = true,
  returnBlobs: boolean = false
): Promise<{ blob: Blob; filename: string }[] | void> => {
  try {
    // Find the maximum array length
    let maxLength = 1;
    
    Object.values(mappings).forEach(value => {
      if (Array.isArray(value)) {
        maxLength = Math.max(maxLength, value.length);
      }
    });
    
    console.log(`📄 Generating ${maxLength} documents from array data`);
    
    const generatedDocuments: { blob: Blob; filename: string }[] = [];
    
    // Generate each document
    for (let i = 0; i < maxLength; i++) {
      const documentMappings: { [tagName: string]: string } = {};
      
      Object.entries(mappings).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          documentMappings[key] = String(value[i] || '');
        } else {
          documentMappings[key] = String(value);
        }
      });
      
      const filename = baseFilename.replace('.docx', `_${i + 1}.docx`);
      const result = await generateSingleDocument(documentMappings, filename, documentBuffer, downloadImmediately, true);
      
      if (result && Array.isArray(result)) {
        generatedDocuments.push(...result);
      }
    }
    
    console.log(`✅ Successfully generated ${maxLength} documents`);
    
    if (returnBlobs) {
      return generatedDocuments;
    }
  } catch (error) {
    console.error('❌ Error generating multiple documents:', error);
    throw error;
  }
};

// Generate single document
const generateSingleDocument = async (
  mappings: { [tagName: string]: string }, 
  filename: string, 
  documentBuffer: ArrayBuffer,
  downloadImmediately: boolean = true,
  returnBlobs: boolean = false
): Promise<{ blob: Blob; filename: string }[] | void> => {
  try {
    console.log('🔧 Processing document');
    console.log('🏷️ Mappings:', mappings);
    
    // Convert £ tags to {{ }} format in the document
    const convertedDocumentBuffer = await convertPoundTagsToDocxtemplaterFormat(mappings, documentBuffer);
    
    // Use docxtemplater with the converted document
    const zip = new PizZip(convertedDocumentBuffer);
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{{',
        end: '}}'
      },
      nullGetter: function(part: any) {
        console.log(`⚠️ No data found for tag: ${part.value}`);
        return `{{${part.value}}}`; // Keep original tag if no data
      },
      errorLogging: true
    });

    // Set the data and render
    console.log('📝 Setting data for docxtemplater:', mappings);
    doc.setData(mappings);
    
    try {
      doc.render();
      console.log('✅ Document rendered successfully');
    } catch (renderError: any) {
      console.error('❌ Render error:', renderError);
      throw new Error(`Failed to render document: ${renderError.message}`);
    }

    // Generate the final document
    const buf = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    console.log('✅ DOCX generated successfully');
    
    // Always download if requested
    if (downloadImmediately) {
      saveAs(buf, filename);
      console.log('📥 Document downloaded:', filename);
    }
    
    // Return blobs if requested (for storage)
    if (returnBlobs) {
      return [{ blob: buf, filename }];
    }
  } catch (error) {
    console.error('❌ Error in document generation:', error);
    throw error;
  }
};

// Convert £ tags to {{ }} format in the document buffer
const convertPoundTagsToDocxtemplaterFormat = async (mappings: { [tagName: string]: string }, documentBuffer: ArrayBuffer): Promise<ArrayBuffer> => {
  try {
    console.log('🔄 Converting £ tags to {{ }} format...');
    
    const zip = new PizZip(documentBuffer);
    
    // Get the main document XML
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      throw new Error('Could not find document.xml in the Word file');
    }
    
    let xmlContent = documentXml.asText();
    
    // Find all £ patterns in the document
    const poundPatterns = xmlContent.match(/£[^£]*£/g) || [];
    console.log('🔍 Found £ patterns in document:', poundPatterns);
    
    // Convert each £tag£ to {{tag}} format
    poundPatterns.forEach(pattern => {
      const tagContent = pattern.replace(/£/g, '').trim();
      console.log(`🔄 Converting "${pattern}" to "{{${tagContent}}}"`);
      
      xmlContent = xmlContent.replace(new RegExp(escapeRegex(pattern), 'g'), `{{${tagContent}}}`);
    });
    
    // Update the document XML
    zip.file('word/document.xml', xmlContent);
    
    // Also check headers and footers
    const additionalFiles = [
      'word/header1.xml',
      'word/header2.xml',
      'word/header3.xml',
      'word/footer1.xml',
      'word/footer2.xml',
      'word/footer3.xml'
    ];
    
    additionalFiles.forEach(fileName => {
      const file = zip.file(fileName);
      if (file) {
        let content = file.asText();
        const patterns = content.match(/£[^£]*£/g) || [];
        
        patterns.forEach(pattern => {
          const tagContent = pattern.replace(/£/g, '').trim();
          content = content.replace(new RegExp(escapeRegex(pattern), 'g'), `{{${tagContent}}}`);
        });
        
        zip.file(fileName, content);
      }
    });
    
    // Generate the converted document buffer
    const convertedBuffer = zip.generate({
      type: 'arraybuffer'
    });
    
    console.log('✅ Successfully converted £ tags to {{ }} format');
    return convertedBuffer;
  } catch (error) {
    console.error('❌ Error converting £ tags:', error);
    throw error;
  }
};

// Helper function to escape regex special characters
const escapeRegex = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Utility functions
export const insertTagInContent = (content: string, tagName: string, selectedText: string): string => {
  const tagFormat = `£${tagName}£`;
  return content.replace(selectedText, tagFormat);
};

export const populateContentWithMappings = (content: string, mappings: { [tagName: string]: string }): string => {
  let populatedContent = content;
  
  Object.entries(mappings).forEach(([tagName, value]) => {
    const tagRegex = new RegExp(`£${tagName}£`, 'g');
    populatedContent = populatedContent.replace(tagRegex, value);
  });
  
  return populatedContent;
};

export const convertPoundTagsToStandardTags = (content: string, extractedTags: Array<{name: string, displayName: string}>) => {
  // Return content unchanged - we want to keep £ format in the document
  console.log('Keeping original £ format in document content');
  return content;
};