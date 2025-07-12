import { EmailService } from './services/emailService';

/**
 * Test script to verify email functionality
 * Run this script with: npx ts-node src/emailTest.ts
 */
async function testEmailService() {
  console.log('🔄 Testing email service...');
  
  // Verify SMTP connection
  console.log('\n📡 Verifying SMTP connection...');
  const isConnected = await EmailService.verifyConnection();
  
  if (!isConnected) {
    console.error('❌ SMTP connection failed. Please check your configuration.');
    process.exit(1);
  }
  
  // Test email address - CHANGE THIS to your email
  const testEmail = 'alerts@decisions.social';
  
  // Test sending a text email
  console.log('\n📧 Sending a text email...');
  const textEmailResult = await EmailService.sendTextEmail(
    testEmail,
    'Test Text Email from Document AI Studio',
    'This is a test email sent from the Document AI Studio email service. If you received this, the email service is working correctly!'
  );
  
  console.log(textEmailResult ? '✅ Text email sent successfully' : '❌ Failed to send text email');
  
  // Test sending an HTML email
  console.log('\n📧 Sending an HTML email...');
  const htmlEmailResult = await EmailService.sendHtmlEmail(
    testEmail,
    'Test HTML Email from Document AI Studio',
    `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #3b82f6;">HTML Email Test</h2>
        <p>This is a <strong>test HTML email</strong> sent from the Document AI Studio email service.</p>
        <p>If you received this with proper formatting, the HTML email service is working correctly!</p>
        <div style="margin-top: 20px; padding: 10px; background-color: #f0f9ff; border-radius: 5px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0;">This is a styled info box to test HTML formatting.</p>
        </div>
      </div>
    `
  );
  
  console.log(htmlEmailResult ? '✅ HTML email sent successfully' : '❌ Failed to send HTML email');
  
  // Test sending a password reset email
  console.log('\n📧 Sending a password reset email...');
  const resetEmailResult = await EmailService.sendPasswordResetEmail(
    testEmail,
    'http://localhost:5173/reset-password?token=test-token-123'
  );
  
  console.log(resetEmailResult ? '✅ Password reset email sent successfully' : '❌ Failed to send password reset email');
  
  // Test sending a welcome email
  console.log('\n📧 Sending a welcome email...');
  const welcomeEmailResult = await EmailService.sendWelcomeEmail(
    testEmail,
    'Test User'
  );
  
  console.log(welcomeEmailResult ? '✅ Welcome email sent successfully' : '❌ Failed to send welcome email');
  
  console.log('\n🏁 Email service test completed!');
}

// Run the test
testEmailService().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});