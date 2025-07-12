import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  // In a Supabase Edge Function, the JWT is automatically verified
  // so we don't need to manually verify it
  return true;
}

// Main handler for the API
serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authentication
    await verifyAuth(req);

    if (req.method === "POST") {
      // Parse request body
      const { to, subject, text, html } = await req.json();

      // Validate required fields
      if (!to || !subject || !text) {
        throw new Error("Missing required fields: to, subject, text");
      }

      // Create SMTP client
      const client = new SMTPClient({
        connection: {
          hostname: "decisions.social",
          port: 465,
          tls: true,
          auth: {
            username: "alerts@decisions.social",
            password: "DuONN7qH?MP&",
          },
        },
      });

      // Send email
      await client.send({
        from: "Document AI Studio <alerts@decisions.social>",
        to: Array.isArray(to) ? to : [to],
        subject,
        content: text,
        html: html || text,
      });

      // Close connection
      await client.close();

      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email sent successfully",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("API error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});