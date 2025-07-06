import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

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
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Function to handle CORS preflight requests
function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

// Helper function to verify authentication
async function verifyAuth(req: Request) {
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

// Function to download file from storage
async function downloadFile(bucket: string, path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }
  if (!data) {
    throw new Error("No file data received from storage");
  }
  return await data.arrayBuffer();
}

// Function to upload file to storage
async function uploadFile(bucket: string, path: string, file: Uint8Array, contentType: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: contentType
  });
  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  return data.path;
}

// Function to get user preferences
async function getUserPreferences(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("user_id", userId)
    .single();
  
  if (error) {
    console.error("Error fetching user preferences:", error);
    return {};
  }
  
  return data?.preferences || {};
}

// Function to convert DOCX to PDF using OnlyOffice
async function convertDocxToPdfWithOnlyOffice(docxBuffer: ArrayBuffer, filename: string, serverUrl: string): Promise<Uint8Array> {
  console.log("🔄 Starting OnlyOffice PDF conversion...");
  
  // Create a unique key for this conversion
  const conversionKey = `pdf_conversion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Create a FormData object to send the file
  const formData = new FormData();
  formData.append('file', new Blob([docxBuffer], { 
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
        'Accept': 'application/json, application/pdf',
      },
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
      formData.append('file', new Blob([docxBuffer], { 
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
      }), filename);
      formData.append('async', 'false');
      formData.append('filetype', 'docx');
      formData.append('outputtype', 'pdf');
      formData.append('key', conversionKey);
      formData.append('title', filename);
      
      const response = await fetch(conversionServiceEndpoint, {
        method: 'POST',
        body: formData,
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
      throw new Error(`OnlyOffice PDF conversion failed: ${conversionServiceError instanceof Error ? conversionServiceError.message : 'Unknown error'}`);
    }
  }
}

// Function to convert DOCX to PDF using CloudConvert
async function convertDocxToPdf(docxBuffer: ArrayBuffer, filename: string, userId: string): Promise<Uint8Array> {
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
        "Content-Type": "application/json",
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
            engine: "office",
            timeout: 120
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
    const importTask = jobData.data.tasks.find((task: any) => task.name === "import-docx");
    const uploadUrl = importTask.result.form.url;
    const uploadParams = importTask.result.form.parameters;

    const formData = new FormData();
    Object.entries(uploadParams).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    
    // Create a blob from the buffer
    const docxBlob = new Blob([docxBuffer], { 
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

    while (jobStatus === "processing" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${cloudConvertApiKey}`,
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
        "Authorization": `Bearer ${cloudConvertApiKey}`,
      }
    });

    const finalJobData = await finalJobResponse.json();
    const exportTask = finalJobData.data.tasks.find((task: any) => task.name === "export-pdf");
    
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

// Function to update generation record with file URLs and status
async function updateGenerationRecord(
  generationId: string, 
  fileUrls: string[], 
  status: string = "completed", 
  errorMessage?: string
) {
  const updates: any = {
    file_urls: fileUrls,
    status,
    completed_at: new Date().toISOString()
  };
  
  if (errorMessage) {
    updates.error_message = errorMessage;
  }
  
  const { error } = await supabase
    .from("document_generations")
    .update(updates)
    .eq("id", generationId);
  
  if (error) {
    console.error(`Failed to update generation record: ${error.message}`);
    // Don't throw here, as this is not critical for the user experience
  }
}

// Main handler for the API
serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method === "POST") {
      // Parse request body
      const requestData = await req.json();
      const { 
        filePath, 
        fileName, 
        generationId, 
        outputPath, 
        bucket = "generated-documents" 
      } = requestData;

      if (!filePath) {
        throw new Error("File path is required");
      }

      if (!fileName) {
        throw new Error("File name is required");
      }

      // Download the DOCX file from storage
      console.log(`Downloading file from ${bucket}/${filePath}`);
      const docxBuffer = await downloadFile(bucket, filePath);

      // Convert DOCX to PDF using the appropriate method
      console.log(`Converting ${fileName} to PDF`);
      const pdfBuffer = await convertDocxToPdf(docxBuffer, fileName, user.id);

      // Generate PDF filename
      const pdfFileName = fileName.replace(/\.docx$/i, ".pdf");

      // Determine output path
      let pdfPath = outputPath;
      if (!pdfPath) {
        // If no output path specified, use the same directory as the input file
        const pathParts = filePath.split("/");
        pathParts[pathParts.length - 1] = pdfFileName;
        pdfPath = pathParts.join("/");
      }

      // Upload PDF to storage
      console.log(`Uploading PDF to ${bucket}/${pdfPath}`);
      const storagePath = await uploadFile(bucket, pdfPath, pdfBuffer, "application/pdf");

      // Update generation record if generationId is provided
      if (generationId) {
        console.log(`Updating generation record ${generationId}`);
        // Get current file_urls
        const { data: generation, error: getError } = await supabase
          .from("document_generations")
          .select("file_urls")
          .eq("id", generationId)
          .single();

        if (!getError && generation) {
          const currentUrls = generation.file_urls || [];
          await updateGenerationRecord(generationId, [
            ...currentUrls,
            storagePath
          ], "completed");
        }
      }

      // Return success response with PDF path
      return new Response(JSON.stringify({
        success: true,
        pdfPath: storagePath,
        message: "PDF conversion successful"
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else if (req.method === "GET") {
      // Return API info
      return new Response(JSON.stringify({
        name: "convert-to-pdf",
        version: "1.0.0",
        description: "Converts DOCX files to PDF using OnlyOffice or CloudConvert",
        endpoints: {
          "POST /": "Convert DOCX to PDF"
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else {
      return new Response(JSON.stringify({
        error: "Method not allowed"
      }), {
        status: 405,
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