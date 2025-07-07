import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import PizZip from "npm:pizzip@3.1.4";
import Docxtemplater from "npm:docxtemplater@3.44.0";
// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// CloudConvert API key
const cloudConvertApiKey = Deno.env.get("CLOUDCONVERT_API_KEY");
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
// Function to handle CORS preflight requests
function handleCors(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return null;
}
// Helper function to verify authentication
async function verifyAuth(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Authentication required");
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error("Invalid authentication token");
  }
  return user;
}
// Function to get customer data from ProofofDebitAPI
async function getCustomerData(customerNo) {
  // Convert to number for proper comparison with bigint column
  const customerNoInt = typeof customerNo === "string" ? parseInt(customerNo, 10) : Number(customerNo);
  if (isNaN(customerNoInt)) {
    throw new Error(`Invalid customer number: ${customerNo}`);
  }
  const { data, error } = await supabase.from("ProofofDebitAPI").select("*").eq("customerno", customerNoInt).single();
  if (error) {
    throw new Error(`Failed to fetch customer data: ${error.message}`);
  }
  return data;
}
// Function to get template data
async function getTemplateData(templateId) {
  const { data, error } = await supabase.from("document_templates").select(`
      *,
      tags:template_tags(*)
    `).eq("id", templateId).single();
  if (error) {
    throw new Error(`Failed to fetch template: ${error.message}`);
  }
  return data;
}
// Function to get template mappings
async function getTemplateMappings(templateId, templateVersion) {
  const { data, error } = await supabase.from("data_mappings").select("*").eq("template_id", templateId).eq("template_version", templateVersion);
  if (error) {
    throw new Error(`Failed to fetch template mappings: ${error.message}`);
  }
  return data || [];
}
// Function to update customer status
async function updateCustomerStatus(customerNo, status) {
  // Convert to number for proper comparison with bigint column
  const customerNoInt = typeof customerNo === "string" ? parseInt(customerNo, 10) : Number(customerNo);
  if (isNaN(customerNoInt)) {
    throw new Error(`Invalid customer number: ${customerNo}`);
  }
  const { data, error } = await supabase.from("ProofofDebitAPI").update({
    Status: status
  }).eq("customerno", customerNoInt).select("customerno, Status");
  if (error) {
    throw new Error(`Failed to update customer status: ${error.message}`);
  }
  return data;
}
// Function to download template file from storage
async function downloadTemplateFile(storagePath) {
  const { data, error } = await supabase.storage.from("document-templates").download(storagePath);
  if (error) {
    throw new Error(`Failed to download template file: ${error.message}`);
  }
  return await data.arrayBuffer();
}
// Function to upload generated document to storage
async function uploadGeneratedDocument(file, userId, generationId, fileName, contentType) {
  // Create a unique file path: user_id/generation_id/filename
  const filePath = `${userId}/${generationId}/${fileName}`;
  // Upload file to generated documents bucket with correct content type
  const { data, error } = await supabase.storage.from("generated-documents").upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: contentType
  });
  if (error) {
    throw new Error(`Failed to upload generated document: ${error.message}`);
  }
  return data.path;
}
// Function to create a generation record in the database
async function createGenerationRecord(userId, templateId, inputData, outputFilenames, outputFormat, customerNo) {
  const { data, error } = await supabase.from("document_generations").insert({
    user_id: userId,
    template_id: templateId,
    generation_type: "single",
    documents_count: outputFilenames.length,
    input_data: inputData,
    output_filenames: outputFilenames,
    file_urls: [],
    status: "processing",
    metadata: {
      source: "api",
      output_format: outputFormat,
      ...customerNo && {
        podapi_customer_nos: [
          String(customerNo)
        ]
      }
    }
  }).select("*").single();
  if (error) {
    throw new Error(`Failed to create generation record: ${error.message}`);
  }
  return data;
}
// Function to update generation record with file URLs and status
async function updateGenerationRecord(generationId, fileUrls, status = "completed", errorMessage) {
  const updates = {
    file_urls: fileUrls,
    status,
    completed_at: new Date().toISOString()
  };
  if (errorMessage) {
    updates.error_message = errorMessage;
  }
  const { error } = await supabase.from("document_generations").update(updates).eq("id", generationId);
  if (error) {
    console.error(`Failed to update generation record: ${error.message}`);
  // Don't throw here, as this is not critical for the user experience
  }
}
// Function to generate document from template and data
async function generateDocument(templateBuffer, data, tags, mappings = []) {
  try {
    // Create a mapping of tag names to data fields
    const mappingsObj = {};
    // If we have saved mappings, use them
    if (mappings && mappings.length > 0) {
      console.log('✅ Using saved mappings for document generation');
      mappings.forEach((mapping)=>{
        const tagName = mapping.tag_name;
        const dataKey = mapping.data_key;
        if (data[dataKey] !== undefined) {
          mappingsObj[tagName] = String(data[dataKey]);
        } else {
          // If data key not found, use placeholder
          mappingsObj[tagName] = `[No data for ${tagName}]`;
        }
      });
    } else {
      // Fallback to auto-mapping if no saved mappings
      console.log('⚠️ No saved mappings found, using auto-mapping');
      tags.forEach((tag)=>{
        const tagName = tag.name;
        // Look for exact matches first
        if (data[tagName] !== undefined) {
          mappingsObj[tagName] = String(data[tagName]);
        } else if (data[tagName.toLowerCase()] !== undefined) {
          mappingsObj[tagName] = String(data[tagName.toLowerCase()]);
        } else if (data[tagName.toUpperCase()] !== undefined) {
          mappingsObj[tagName] = String(data[tagName.toUpperCase()]);
        } else if (data[tagName.replace(/_/g, " ")] !== undefined) {
          mappingsObj[tagName] = String(data[tagName.replace(/_/g, " ")]);
        } else if (data[tagName.replace(/\s+/g, "_")] !== undefined) {
          mappingsObj[tagName] = String(data[tagName.replace(/\s+/g, "_")]);
        } else {
          const matchingKey = Object.keys(data).find((key)=>key.toLowerCase().includes(tagName.toLowerCase()) || tagName.toLowerCase().includes(key.toLowerCase()));
          if (matchingKey) {
            mappingsObj[tagName] = String(data[matchingKey]);
          } else {
            // If no match found, use a placeholder
            mappingsObj[tagName] = `[No data for ${tagName}]`;
          }
        }
      });
    }
    // Convert £ tags to {{ }} format in the document
    const zip = new PizZip(templateBuffer);
    // Get the main document XML
    const documentXml = zip.file("word/document.xml");
    if (!documentXml) {
      throw new Error("Could not find document.xml in the Word file");
    }
    let xmlContent = documentXml.asText();
    // Find all £ patterns in the document
    const poundPatterns = xmlContent.match(/£([^£]+)£/g) || [];
    // Convert each £tag£ to {{tag}} format
    poundPatterns.forEach((pattern)=>{
      const tagContent = pattern.replace(/£/g, "").trim();
      xmlContent = xmlContent.replace(new RegExp(escapeRegex(pattern), "g"), `{{${tagContent}}}`);
    });
    // Update the document XML
    zip.file("word/document.xml", xmlContent);
    // Also check headers and footers
    const additionalFiles = [
      "word/header1.xml",
      "word/header2.xml",
      "word/header3.xml",
      "word/footer1.xml",
      "word/footer2.xml",
      "word/footer3.xml"
    ];
    additionalFiles.forEach((fileName)=>{
      const file = zip.file(fileName);
      if (file) {
        let content = file.asText();
        const patterns = content.match(/£([^£]+)£/g) || [];
        patterns.forEach((pattern)=>{
          const tagContent = pattern.replace(/£/g, "").trim();
          content = content.replace(new RegExp(escapeRegex(pattern), "g"), `{{${tagContent}}}`);
        });
        zip.file(fileName, content);
      }
    });
    // Generate the converted document buffer
    const convertedBuffer = zip.generate({
      type: "arraybuffer"
    });
    // Use docxtemplater with the converted document
    const docxZip = new PizZip(convertedBuffer);
    const doc = new Docxtemplater(docxZip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: "{{",
        end: "}}"
      },
      nullGetter: function(part) {
        return `{{${part.value}}}`; // Keep original tag if no data
      }
    });
    // Set the data and render
    doc.setData(mappingsObj);
    doc.render();
    // Generate the final document
    const buf = doc.getZip().generate({
      type: "nodebuffer"
    });
    return buf;
  } catch (error) {
    console.error("Error generating document:", error);
    throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
// Helper function to escape regex special characters
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Function to get user preferences
async function getUserPreferences(userId) {
  const { data, error } = await supabase.from("profiles").select("preferences").eq("user_id", userId).single();
  if (error) {
    console.error("Error fetching user preferences:", error);
    return {};
  }
  return data?.preferences || {};
}
// Function to convert DOCX to PDF using OnlyOffice
async function convertDocxToPdfWithOnlyOffice(docxBuffer, filename, serverUrl) {
  console.log("🔄 Starting OnlyOffice PDF conversion...");
  // Create a unique key for this conversion
  const conversionKey = `pdf_conversion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  // Create a FormData object to send the file
  const formData = new FormData();
  formData.append('file', new Blob([
    docxBuffer
  ], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }), filename);
  formData.append('outputtype', 'pdf');
  formData.append('key', conversionKey);
  formData.append('filetype', 'docx');
  formData.append('async', 'false');
  // Try the direct conversion endpoint
  const conversionEndpoint = `${serverUrl}/ConvertService.ashx`;
  console.log('🔄 Using direct conversion endpoint:', conversionEndpoint);
  try {
    const response = await fetch(conversionEndpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json, application/pdf'
      }
    });
    if (!response.ok) {
      console.error('❌ Direct conversion failed with status:', response.status);
      const errorText = await response.text();
      throw new Error(`Direct conversion failed: ${response.status} - ${errorText}`);
    }
    // Check if the response is JSON or PDF
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Parse the JSON response
      const result = await response.json();
      if (result.error) {
        throw new Error(`Direct conversion error: ${result.error}`);
      }
      // If the response contains a fileUrl, fetch the converted file
      if (result.fileUrl) {
        console.log('🔄 Fetching converted PDF from:', result.fileUrl);
        const pdfResponse = await fetch(result.fileUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download converted PDF: ${pdfResponse.status}`);
        }
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        console.log('✅ PDF conversion completed successfully via direct API with URL');
        return new Uint8Array(pdfArrayBuffer);
      }
    }
    // If the response is directly the PDF file
    if (contentType && contentType.includes('application/pdf')) {
      const pdfArrayBuffer = await response.arrayBuffer();
      console.log('✅ PDF conversion completed successfully via direct API with PDF response');
      return new Uint8Array(pdfArrayBuffer);
    }
    throw new Error('Direct conversion API did not return a valid PDF or URL');
  } catch (directApiError) {
    console.warn('Direct API conversion failed, trying conversion service:', directApiError);
    // Try the conversion service endpoint
    try {
      const conversionServiceEndpoint = `${serverUrl}/ConvertService`;
      console.log('🔄 Using conversion service endpoint:', conversionServiceEndpoint);
      const formData = new FormData();
      formData.append('file', new Blob([
        docxBuffer
      ], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }), filename);
      formData.append('async', 'false');
      formData.append('filetype', 'docx');
      formData.append('outputtype', 'pdf');
      formData.append('key', conversionKey);
      formData.append('title', filename);
      const response = await fetch(conversionServiceEndpoint, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        console.error('❌ Conversion service failed with status:', response.status);
        const errorText = await response.text();
        throw new Error(`Conversion service failed: ${response.status} - ${errorText}`);
      }
      // Check if the response is directly the PDF file
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/pdf')) {
        const pdfArrayBuffer = await response.arrayBuffer();
        console.log('✅ PDF conversion completed successfully via conversion service');
        return new Uint8Array(pdfArrayBuffer);
      }
      // If the response is JSON, it might contain a URL to the converted file
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        if (result.error) {
          throw new Error(`Conversion service error: ${result.error}`);
        }
        if (result.fileUrl) {
          console.log('🔄 Fetching converted PDF from:', result.fileUrl);
          const pdfResponse = await fetch(result.fileUrl);
          if (!pdfResponse.ok) {
            throw new Error(`Failed to download converted PDF: ${pdfResponse.status}`);
          }
          const pdfArrayBuffer = await pdfResponse.arrayBuffer();
          console.log('✅ PDF conversion completed successfully via conversion service with URL');
          return new Uint8Array(pdfArrayBuffer);
        }
      }
      throw new Error('Conversion service did not return a valid PDF or URL');
    } catch (conversionServiceError) {
      console.error('Both conversion methods failed:', conversionServiceError);
      throw new Error(`OnlyOffice PDF conversion failed: ${conversionServiceError instanceof Error ? conversionServiceError.message : "Unknown error"}`);
    }
  }
}
// Function to convert DOCX to PDF using CloudConvert
async function convertDocxToPdf(docxBuffer, filename, userId) {
  // Get user preferences to determine which conversion method to use
  const preferences = await getUserPreferences(userId);
  const pdfConversionMethod = preferences.pdf_conversion_method || 'cloudconvert';
  const onlyofficeUrl = preferences.onlyoffice_url;
  console.log(`Using PDF conversion method: ${pdfConversionMethod}`);
  // If OnlyOffice is selected and URL is configured, try it first
  if (pdfConversionMethod === 'onlyoffice' && onlyofficeUrl) {
    try {
      console.log(`Attempting OnlyOffice conversion with server: ${onlyofficeUrl}`);
      return await convertDocxToPdfWithOnlyOffice(docxBuffer, filename, onlyofficeUrl);
    } catch (onlyofficeError) {
      console.error("OnlyOffice PDF conversion failed, falling back to CloudConvert:", onlyofficeError);
    // Fall back to CloudConvert
    }
  }
  // Use CloudConvert as fallback or primary method
  if (!cloudConvertApiKey) {
    throw new Error("CloudConvert API key not configured. Please set the CLOUDCONVERT_API_KEY environment variable.");
  }
  try {
    console.log("Starting CloudConvert DOCX to PDF conversion...");
    // Step 1: Create a job
    const jobResponse = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cloudConvertApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tasks: {
          "import-docx": {
            operation: "import/upload"
          },
          "convert-to-pdf": {
            operation: "convert",
            input: "import-docx",
            output_format: "pdf",
            some_other_option: "value"
          },
          "export-pdf": {
            operation: "export/url",
            input: "convert-to-pdf"
          }
        },
        tag: "document-conversion"
      })
    });
    if (!jobResponse.ok) {
      const errorData = await jobResponse.json();
      const errorMessage = errorData.message || jobResponse.statusText;
      throw new Error(`CloudConvert API error: ${errorMessage}`);
    }
    const jobData = await jobResponse.json();
    console.log("CloudConvert job created:", jobData.data.id);
    // Step 2: Upload the DOCX file
    const importTask = jobData.data.tasks.find((task)=>task.name === "import-docx");
    const uploadUrl = importTask.result.form.url;
    const uploadParams = importTask.result.form.parameters;
    const formData = new FormData();
    Object.entries(uploadParams).forEach(([key, value])=>{
      formData.append(key, value);
    });
    // Create a blob from the buffer
    const docxBlob = new Blob([
      docxBuffer
    ], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    formData.append("file", docxBlob, filename);
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    });
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file to CloudConvert: ${uploadResponse.statusText}`);
    }
    console.log("File uploaded to CloudConvert");
    // Step 3: Wait for conversion to complete
    const jobId = jobData.data.id;
    let jobStatus = "processing";
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    while(jobStatus === "processing" && attempts < maxAttempts){
      await new Promise((resolve)=>setTimeout(resolve, 1000)); // Wait 1 second
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${cloudConvertApiKey}`
        }
      });
      if (!statusResponse.ok) {
        throw new Error(`Failed to check job status: ${statusResponse.statusText}`);
      }
      const statusData = await statusResponse.json();
      jobStatus = statusData.data.status;
      attempts++;
      console.log(`Conversion status: ${jobStatus} (attempt ${attempts}/${maxAttempts})`);
    }
    if (jobStatus !== "finished") {
      throw new Error(`Conversion failed or timed out. Status: ${jobStatus}`);
    }
    // Step 4: Get the download URL
    const finalJobResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${cloudConvertApiKey}`
      }
    });
    const finalJobData = await finalJobResponse.json();
    const exportTask = finalJobData.data.tasks.find((task)=>task.name === "export-pdf");
    if (!exportTask || !exportTask.result || !exportTask.result.files || exportTask.result.files.length === 0) {
      throw new Error("No PDF file found in conversion result");
    }
    const downloadUrl = exportTask.result.files[0].url;
    // Step 5: Download the PDF
    const pdfResponse = await fetch(downloadUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    console.log("PDF conversion completed successfully");
    return new Uint8Array(pdfArrayBuffer);
  } catch (error) {
    console.error("CloudConvert PDF conversion failed:", error);
    throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
// Function to convert document to plain text
function convertDocxToText(docxBuffer, mappingsObj) {
  try {
    // Create a simple text representation of the document
    // This is a basic implementation - in a real app, you might want to use a library
    // that can extract text content from DOCX while preserving some structure
    let textContent = "DOCUMENT CONTENT\n";
    textContent += "================\n\n";
    // Add all the mapped values
    textContent += "MAPPED VALUES:\n";
    textContent += "==============\n\n";
    Object.entries(mappingsObj).forEach(([key, value])=>{
      textContent += `${key}: ${value}\n`;
    });
    textContent += "\n";
    textContent += "Generated at: " + new Date().toISOString() + "\n";
    return textContent;
  } catch (error) {
    console.error("Error converting to text:", error);
    throw new Error(`Failed to convert document to text: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
// Main handler for the API
serve(async (req)=>{
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    // Get the URL path
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    // Verify authentication for all endpoints
    const needsAuth = ![
      "generate-document",
      "customer-data",
      "templates",
      "generate"
    ].includes(path); // ✅ allow multiple public endpoints
    const user = needsAuth ? await verifyAuth(req) : null;
    // Handle different endpoints
    if (path === "generate-document" && req.method === "POST") {
      // Parse request body
      const requestData = await req.json();
      const { customerNo, templateId, jsonData, outputFormat = "docx", updateStatus = true } = requestData;
      if (!templateId) {
        throw new Error("Template ID is required");
      }
      if (!jsonData && !customerNo) {
        throw new Error("Either customerNo or jsonData is required");
      }
      // Validate output format
      if (![
        "docx",
        "pdf",
        "text"
      ].includes(outputFormat)) {
        throw new Error("Invalid output format. Must be one of: docx, pdf, text");
      }
      // Get data - either from customerNo or directly from jsonData
      let data;
      if (jsonData) {
        // Use provided JSON data
        if (typeof jsonData === "string") {
          try {
            data = JSON.parse(jsonData);
          } catch (e) {
            throw new Error("Invalid JSON data provided");
          }
        } else {
          data = jsonData;
        }
      } else {
        // Get customer data from database
        data = await getCustomerData(customerNo);
      }
      // Get template data
      const templateData = await getTemplateData(templateId);
      if (!templateData.storage_path) {
        throw new Error("Template file not found in storage");
      }
      // Get template mappings for the current version
      const templateVersion = templateData.current_version || 1;
      const templateMappings = await getTemplateMappings(templateId, templateVersion);
      console.log(`Found ${templateMappings.length} mappings for template version ${templateVersion}`);
      // Download template file
      const templateBuffer = await downloadTemplateFile(templateData.storage_path);
      // Generate document using mappings if available
      const docxBuffer = await generateDocument(templateBuffer, data, templateData.tags, templateMappings);
      // Create a filename based on template name and timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const sanitizedTemplateName = templateData.name.replace(/[^a-zA-Z0-9]/g, "_");
      const baseFilename = `${sanitizedTemplateName}_${timestamp}`;
      // Determine output filename based on format
      let outputFilename;
      let contentType;
      let outputBuffer;
      // Create generation record in database with appropriate filenames
      const outputFilenames = [];
      if (outputFormat === "docx") {
        outputFilename = `${baseFilename}.docx`;
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        outputBuffer = docxBuffer;
        outputFilenames.push(outputFilename);
      } else if (outputFormat === "pdf") {
        const docxFilename = `${baseFilename}.docx`;
        outputFilename = `${baseFilename}.pdf`;
        contentType = "application/pdf";
        outputFilenames.push(docxFilename, outputFilename);
      } else if (outputFormat === "text") {
        outputFilename = `${baseFilename}.txt`;
        contentType = "text/plain";
        outputFilenames.push(outputFilename);
      } else {
        throw new Error(`Unsupported output format: ${outputFormat}`);
      }
      const userId = user ? user.id : null;
      // Create generation record in database
      const generationRecord = await createGenerationRecord(userId, templateId, data, outputFilenames, outputFormat, customerNo);
      // Update customer status if requested and customerNo is provided
      if (updateStatus && customerNo) {
        await updateCustomerStatus(customerNo, "Current");
      }
      // Process based on output format
      if (outputFormat === "docx") {
        // Upload DOCX to storage
        const docxStoragePath = await uploadGeneratedDocument(docxBuffer, user.id, generationRecord.id, outputFilename, contentType);
        // Update generation record
        await updateGenerationRecord(generationRecord.id, [
          docxStoragePath
        ], "completed");
        // Return DOCX document
        return new Response(docxBuffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${outputFilename}"`
          }
        });
      } else if (outputFormat === "pdf") {
        try {
          // First upload the DOCX as a backup
          const docxFilename = `${baseFilename}.docx`;
          const docxStoragePath = await uploadGeneratedDocument(docxBuffer, user.id, generationRecord.id, docxFilename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          // Convert DOCX to PDF using the appropriate method based on user preferences
          const pdfBuffer = await convertDocxToPdf(docxBuffer, docxFilename, user.id);
          // Upload PDF to storage
          const pdfStoragePath = await uploadGeneratedDocument(pdfBuffer, user.id, generationRecord.id, outputFilename, "application/pdf");
          // Update generation record
          await updateGenerationRecord(generationRecord.id, [
            docxStoragePath,
            pdfStoragePath
          ], "completed");
          // Return PDF document
          return new Response(pdfBuffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${outputFilename}"`
            }
          });
        } catch (pdfError) {
          console.error("PDF conversion error:", pdfError);
          // Update generation record with error
          await updateGenerationRecord(generationRecord.id, [], "failed", pdfError instanceof Error ? pdfError.message : "Unknown PDF conversion error");
          throw new Error(`PDF conversion failed: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`);
        }
      } else if (outputFormat === "text") {
        // Create mappings object for text conversion
        const mappingsObj = {};
        if (templateMappings && templateMappings.length > 0) {
          templateMappings.forEach((mapping)=>{
            const tagName = mapping.tag_name;
            const dataKey = mapping.data_key;
            if (data[dataKey] !== undefined) {
              mappingsObj[tagName] = String(data[dataKey]);
            } else {
              mappingsObj[tagName] = `[No data for ${tagName}]`;
            }
          });
        } else {
          templateData.tags.forEach((tag)=>{
            const tagName = tag.name;
            if (data[tagName] !== undefined) {
              mappingsObj[tagName] = String(data[tagName]);
            } else {
              mappingsObj[tagName] = `[No data for ${tagName}]`;
            }
          });
        }
        // Convert to text
        const textContent = convertDocxToText(docxBuffer, mappingsObj);
        // For text format, don't upload to storage, just update the generation record
        await updateGenerationRecord(generationRecord.id, [], "completed");
        // Return text document
        return new Response(textContent, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/plain",
            "Content-Disposition": `attachment; filename="${outputFilename}"`
          }
        });
      }
      // This should never happen due to validation above
      throw new Error(`Unsupported output format: ${outputFormat}`);
    } else if (path === "customer-data" && req.method === "GET") {
      const customerNo = url.searchParams.get("customerNo");
      if (!customerNo) {
        throw new Error("Customer number is required");
      }
      const customerData = await getCustomerData(customerNo);
      return new Response(JSON.stringify({
        data: customerData
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else if (path === "templates" && req.method === "GET") {
      const { data, error } = await supabase.from("document_templates").select(`
          id, 
          name, 
          description, 
          original_filename, 
          updated_at,
          tags:template_tags(id, name, display_name)
        `).order("name");
      // Process the data to add comma-separated tags
      const processedData = data.map((template)=>{
        // Extract tag names
        const tagNames = template.tags ? template.tags.map((tag)=>tag.name) : [];
        const tagDisplayNames = template.tags ? template.tags.map((tag)=>tag.display_name) : [];
        // Add comma-separated tags to the template object
        return {
          ...template,
          tags_csv: tagNames.join(', '),
          tag_display_names_csv: tagDisplayNames.join(', ')
        };
      });
      return new Response(JSON.stringify({
        data: processedData
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else if (path === "generate" && req.method === "POST") {
      // New endpoint for generating documents from JSON data
      const requestData = await req.json();
      const { templateId, jsonData, outputType = "docx" // docx, pdf, or text
       } = requestData;
      if (!templateId) {
        throw new Error("Template ID is required");
      }
      if (!jsonData) {
        throw new Error("JSON data is required");
      }
      // Validate output type
      if (![
        "docx",
        "pdf",
        "text"
      ].includes(outputType)) {
        throw new Error("Invalid output type. Must be one of: docx, pdf, text");
      }
      // Parse JSON data if it's a string
      let data;
      if (typeof jsonData === "string") {
        try {
          data = JSON.parse(jsonData);
        } catch (e) {
          throw new Error("Invalid JSON data provided");
        }
      } else {
        data = jsonData;
      }
      // Get template data
      const templateData = await getTemplateData(templateId);
      if (!templateData.storage_path) {
        throw new Error("Template file not found in storage");
      }
      // Get template mappings for the current version
      const templateVersion = templateData.current_version || 1;
      const templateMappings = await getTemplateMappings(templateId, templateVersion);
      console.log(`Found ${templateMappings.length} mappings for template version ${templateVersion}`);
      // Download template file
      const templateBuffer = await downloadTemplateFile(templateData.storage_path);
      // Generate document using mappings if available
      const docxBuffer = await generateDocument(templateBuffer, data, templateData.tags, templateMappings);
      // Create a filename based on template name and timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const sanitizedTemplateName = templateData.name.replace(/[^a-zA-Z0-9]/g, "_");
      const baseFilename = `${sanitizedTemplateName}_${timestamp}`;
      // Determine output filename based on format
      let outputFilename;
      let contentType;
      let outputBuffer;
      // Create generation record in database with appropriate filenames
      const outputFilenames = [];
      if (outputType === "docx") {
        outputFilename = `${baseFilename}.docx`;
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        outputBuffer = docxBuffer;
        outputFilenames.push(outputFilename);
      } else if (outputType === "pdf") {
        const docxFilename = `${baseFilename}.docx`;
        outputFilename = `${baseFilename}.pdf`;
        contentType = "application/pdf";
        outputFilenames.push(docxFilename, outputFilename);
      } else if (outputType === "text") {
        outputFilename = `${baseFilename}.txt`;
        contentType = "text/plain";
        outputFilenames.push(outputFilename);
      } else {
        throw new Error(`Unsupported output type: ${outputType}`);
      }
      // Create generation record in database
      const generationRecord = await createGenerationRecord(user?.id ?? null, templateId, data, outputFilenames, outputType);
      // Process based on output type
      if (outputType === "docx") {
        // Upload DOCX to storage
        const docxStoragePath = await uploadGeneratedDocument(docxBuffer, user?.id ?? null, generationRecord.id, outputFilename, contentType);
        // Update generation record
        await updateGenerationRecord(generationRecord.id, [
          docxStoragePath
        ], "completed");
        // Return DOCX document
        return new Response(docxBuffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${outputFilename}"`
          }
        });
      } else if (outputType === "pdf") {
        try {
          // First upload the DOCX as a backup
          const docxFilename = `${baseFilename}.docx`;
          const docxStoragePath = await uploadGeneratedDocument(docxBuffer, user?.id ?? null, generationRecord.id, docxFilename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          // Convert DOCX to PDF using the appropriate method based on user preferences
          const pdfBuffer = await convertDocxToPdf(docxBuffer, docxFilename, user?.id ?? null);
          // Upload PDF to storage
          const pdfStoragePath = await uploadGeneratedDocument(pdfBuffer, user?.id ?? null, generationRecord.id, outputFilename, "application/pdf");
          // Update generation record
          await updateGenerationRecord(generationRecord.id, [
            docxStoragePath,
            pdfStoragePath
          ], "completed");
          // Return PDF document
          return new Response(pdfBuffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${outputFilename}"`
            }
          });
        } catch (pdfError) {
          console.error("PDF conversion error:", pdfError);
          // Update generation record with error
          await updateGenerationRecord(generationRecord.id, [], "failed", pdfError instanceof Error ? pdfError.message : "Unknown PDF conversion error");
          throw new Error(`PDF conversion failed: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`);
        }
      } else if (outputType === "text") {
        // Create mappings object for text conversion
        const mappingsObj = {};
        if (templateMappings && templateMappings.length > 0) {
          templateMappings.forEach((mapping)=>{
            const tagName = mapping.tag_name;
            const dataKey = mapping.data_key;
            if (data[dataKey] !== undefined) {
              mappingsObj[tagName] = String(data[dataKey]);
            } else {
              mappingsObj[tagName] = `[No data for ${tagName}]`;
            }
          });
        } else {
          templateData.tags.forEach((tag)=>{
            const tagName = tag.name;
            if (data[tagName] !== undefined) {
              mappingsObj[tagName] = String(data[tagName]);
            } else {
              mappingsObj[tagName] = `[No data for ${tagName}]`;
            }
          });
        }
        // Convert to text
        const textContent = convertDocxToText(docxBuffer, mappingsObj);
        // For text format, don't upload to storage, just update the generation record
        await updateGenerationRecord(generationRecord.id, [], "completed");
        // Return text document
        return new Response(textContent, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/plain",
            "Content-Disposition": `attachment; filename="${outputFilename}"`
          }
        });
      }
      // This should never happen due to validation above
      throw new Error(`Unsupported output type: ${outputType}`);
    } else {
      return new Response(JSON.stringify({
        error: "Endpoint not found",
        available_endpoints: [
          "POST /generate-document - Generate document from template and customer data",
          "GET /customer-data - Get customer data by customer number",
          "GET /templates - List available templates",
          "POST /generate - Generate document from template and JSON data"
        ]
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
