import { EmailService } from './services/emailService';

/**
 * Test script for email functionality
 * This is a browser-compatible test that uses the Supabase Edge Function
 */
async function testEmail() {
  try {
    console.log('Testing email service...');
    
    // First, make sure you're logged in to Supabase
    // This is required for the EmailService to work
    const { supabase } = await import('./lib/supabase');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('Error: You must be logged in to test the email service');
      console.log('Please log in to the application first, then run this test');
      return;
    }
    
    console.log('Logged in as:', user.email);
    
    // Test sending a document generated notification
    console.log('\nSending document generated notification...');
    const result = await EmailService.sendTemplateEmail(
      user.email!, // Send to the current user
      'document_generated',
      { documentName: 'Test Document.docx' }
    );
    
    if (result) {
      console.log('✅ Email sent successfully!');
    } else {
      console.error('❌ Failed to send email');
    }
    
  } catch (error) {
    console.error('Error in email test:', error);
  }
}

// Run the test
testEmail();