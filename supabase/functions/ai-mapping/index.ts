import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// Function to get available columns from ProofofDebitAPI
async function getAvailableColumns() {
  try {
    // Get a sample record to determine columns
    const { data, error } = await supabase
      .from("ProofofDebitAPI")
      .select("*")
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch sample data: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("No data available in ProofofDebitAPI");
    }

    // Get column names and types
    const sampleRecord = data[0];
    const columns = Object.keys(sampleRecord)
      .filter(column => column !== "Status") // Exclude system columns
      .map(column => ({
        name: column,
        type: typeof sampleRecord[column],
        sample_values: [String(sampleRecord[column])]
      }));

    // Get more sample values for each column
    const { data: moreSamples, error: samplesError } = await supabase
      .from("ProofofDebitAPI")
      .select("*")
      .limit(5);

    if (!samplesError && moreSamples && moreSamples.length > 1) {
      columns.forEach(column => {
        const additionalSamples = moreSamples
          .slice(1) // Skip the first one we already have
          .map(record => String(record[column.name]))
          .filter(Boolean);
        
        column.sample_values = [...column.sample_values, ...additionalSamples];
      });
    }

    return columns;
  } catch (error) {
    console.error("Error getting available columns:", error);
    throw new Error(`Failed to get available columns: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Function to suggest mappings between tags and columns
async function suggestMappings(tags: any[], columns: any[]) {
  try {
    const mappings = [];

    for (const tag of tags) {
      const tagName = tag.name.toLowerCase();
      const displayName = tag.display_name?.toLowerCase() || "";
      
      // Look for exact matches first
      let bestMatch = columns.find(col => 
        col.name.toLowerCase() === tagName ||
        col.name.toLowerCase() === displayName ||
        col.name.toLowerCase().replace(/[_\s]/g, "") === tagName.replace(/[_\s]/g, "") ||
        col.name.toLowerCase().replace(/[_\s]/g, "") === displayName.replace(/[_\s]/g, "")
      );
      
      let confidence = 1.0;
      
      // If no exact match, look for partial matches
      if (!bestMatch) {
        const partialMatches = columns.filter(col => 
          col.name.toLowerCase().includes(tagName) ||
          tagName.includes(col.name.toLowerCase()) ||
          col.name.toLowerCase().includes(displayName) ||
          displayName.includes(col.name.toLowerCase())
        );
        
        if (partialMatches.length > 0) {
          // Sort by closest match (shortest column name that contains the tag name)
          bestMatch = partialMatches.sort((a, b) => {
            // If one contains the tag name exactly, prioritize it
            const aContains = a.name.toLowerCase().includes(tagName);
            const bContains = b.name.toLowerCase().includes(tagName);
            
            if (aContains && !bContains) return -1;
            if (!aContains && bContains) return 1;
            
            // Otherwise sort by length (shorter is better)
            return a.name.length - b.name.length;
          })[0];
          
          confidence = 0.8;
        }
      }
      
      // If still no match, try common mappings
      if (!bestMatch) {
        if (tagName.includes("name") || displayName.includes("name")) {
          bestMatch = columns.find(col => col.name.toLowerCase().includes("name"));
          confidence = 0.7;
        } else if (tagName.includes("date") || displayName.includes("date")) {
          bestMatch = columns.find(col => col.name.toLowerCase().includes("date"));
          confidence = 0.7;
        } else if (tagName.includes("account") || displayName.includes("account")) {
          bestMatch = columns.find(col => col.name.toLowerCase().includes("account"));
          confidence = 0.7;
        } else if (tagName.includes("reference") || displayName.includes("reference")) {
          bestMatch = columns.find(col => col.name.toLowerCase().includes("reference"));
          confidence = 0.7;
        } else if (tagName.includes("number") || displayName.includes("number")) {
          bestMatch = columns.find(col => col.name.toLowerCase().includes("no"));
          confidence = 0.6;
        }
      }
      
      mappings.push({
        tag_id: tag.id,
        tag_name: tag.name,
        display_name: tag.display_name || tag.name,
        column_name: bestMatch ? bestMatch.name : "",
        column_type: bestMatch ? bestMatch.type : "",
        confidence,
        is_manual: false,
        sample_values: bestMatch ? bestMatch.sample_values : []
      });
    }

    return mappings;
  } catch (error) {
    console.error("Error suggesting mappings:", error);
    throw new Error(`Failed to suggest mappings: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Function to get template tags
async function getTemplateTags(templateId: string) {
  try {
    const { data, error } = await supabase
      .from("template_tags")
      .select("*")
      .eq("template_id", templateId);
    
    if (error) {
      throw new Error(`Failed to fetch template tags: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error("Error getting template tags:", error);
    throw new Error(`Failed to get template tags: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Function to save mappings
async function saveMappings(userId: string, templateId: string, templateVersion: number, mappings: any[]) {
  try {
    // Delete existing mappings for this template version
    const { error: deleteError } = await supabase
      .from("data_mappings")
      .delete()
      .eq("template_id", templateId)
      .eq("template_version", templateVersion)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting existing mappings:", deleteError);
      // Continue anyway - we'll insert new ones
    }

    // Filter out mappings with empty column names
    const validMappings = mappings.filter(mapping => mapping.column_name && mapping.column_name.trim() !== "");
    
    if (validMappings.length === 0) {
      return { success: true, message: "No valid mappings to save" };
    }

    // Insert new mappings with version
    const dbMappings = validMappings.map(mapping => ({
      user_id: userId,
      template_id: templateId,
      template_version: templateVersion,
      tag_name: mapping.tag_name,
      data_key: mapping.column_name,
      mapping_confidence: mapping.confidence,
      is_manual: mapping.is_manual,
      is_verified: true,
      usage_count: 0
    }));

    const { error: insertError } = await supabase
      .from("data_mappings")
      .insert(dbMappings);

    if (insertError) {
      throw new Error(`Failed to insert mappings: ${insertError.message}`);
    }

    return { 
      success: true, 
      message: `Saved ${dbMappings.length} mappings for template ${templateId} version ${templateVersion}` 
    };
  } catch (error) {
    console.error("Error saving mappings:", error);
    throw new Error(`Failed to save mappings: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Function to load data using mappings
async function loadDataWithMappings(templateId: string, templateVersion: number) {
  try {
    // Get mappings for this template version
    const { data: mappings, error: mappingsError } = await supabase
      .from("data_mappings")
      .select("*")
      .eq("template_id", templateId)
      .eq("template_version", templateVersion);
    
    if (mappingsError) {
      throw new Error(`Failed to fetch mappings: ${mappingsError.message}`);
    }
    
    if (!mappings || mappings.length === 0) {
      throw new Error("No mappings found for this template version");
    }
    
    // Get ProofofDebitAPI records with Status = 'New'
    const { data: records, error: recordsError } = await supabase
      .from("ProofofDebitAPI")
      .select("*")
      .eq("Status", "New");
    
    if (recordsError) {
      throw new Error(`Failed to fetch records: ${recordsError.message}`);
    }
    
    if (!records || records.length === 0) {
      throw new Error("No records found with Status = 'New' in ProofofDebitAPI");
    }
    
    // Transform data according to mappings
    const mappedData: Record<string, any[]> = {};
    const customerNumbers: string[] = [];
    
    // Initialize arrays for each tag
    mappings.forEach(mapping => {
      mappedData[mapping.tag_name] = [];
    });
    
    // Process each record
    records.forEach(record => {
      // Track customer numbers for status updates
      if (record.customerno) {
        customerNumbers.push(String(record.customerno));
      }
      
      // Map each column to its corresponding tag
      mappings.forEach(mapping => {
        const value = record[mapping.data_key];
        mappedData[mapping.tag_name].push(value !== null && value !== undefined ? String(value) : "");
      });
    });
    
    return {
      data: mappedData,
      customerNumbers,
      recordCount: records.length
    };
  } catch (error) {
    console.error("Error loading data with mappings:", error);
    throw new Error(`Failed to load data with mappings: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Main handler for the API
serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get the URL path
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Verify authentication for all endpoints
    const user = await verifyAuth(req);

    // Handle different endpoints
    if (path === "available-columns" && req.method === "GET") {
      const columns = await getAvailableColumns();
      
      return new Response(JSON.stringify({ data: columns }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } 
    else if (path === "suggest-mappings" && req.method === "POST") {
      const requestData = await req.json();
      const { templateId, tags } = requestData;
      
      if (!templateId) {
        throw new Error("Template ID is required");
      }
      
      let tagsData = tags;
      
      // If tags not provided, fetch from database
      if (!tagsData) {
        tagsData = await getTemplateTags(templateId);
      }
      
      if (!tagsData || tagsData.length === 0) {
        throw new Error("No tags found for this template");
      }
      
      const columns = await getAvailableColumns();
      const mappings = await suggestMappings(tagsData, columns);
      
      return new Response(JSON.stringify({ data: mappings }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    else if (path === "save-mappings" && req.method === "POST") {
      const requestData = await req.json();
      const { templateId, templateVersion, mappings } = requestData;
      
      if (!templateId) {
        throw new Error("Template ID is required");
      }
      
      if (!templateVersion) {
        throw new Error("Template version is required");
      }
      
      if (!mappings || !Array.isArray(mappings)) {
        throw new Error("Mappings array is required");
      }
      
      const result = await saveMappings(user.id, templateId, templateVersion, mappings);
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    else if (path === "load-mapped-data" && req.method === "POST") {
      const requestData = await req.json();
      const { templateId, templateVersion } = requestData;
      
      if (!templateId) {
        throw new Error("Template ID is required");
      }
      
      // Default to version 1 if not specified
      const version = templateVersion || 1;
      
      const result = await loadDataWithMappings(templateId, version);
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    else {
      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
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
        "Content-Type": "application/json",
      },
    });
  }
});